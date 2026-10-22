import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { ERROR_MESSAGE } from '../constants/errorMessages'
import { applyPatches, findPatch, planAutoFix } from '../domain/autoFix'
import type { FixMode, Patch } from '../domain/autoFix'
import {
  QUICK_FILTER,
  buildSearchIndex,
  filterRows,
  normalizeQuery,
  rowsWithIssue,
} from '../domain/filter'
import type { QuickFilter } from '../domain/filter'
import { checkImportFile } from '../domain/importFile'
import type { IssueId } from '../domain/rules/issueTypes'
import { removeIssues } from '../domain/validation'
import type { IssueRecord, Row as DatasetRow, ValidationResult } from '../domain/validation'
import { getImportWorker, isAbortError } from '../worker/client'
import type { LoadProgress, Row } from '../worker/protocol'

// Lets the progress bar finish its animation before the screen changes
const PROGRESS_SETTLE_MS = 300

export interface Dataset extends ValidationResult {
  fileName: string
  columns: string[]
  rows: DatasetRow[]
  // 1 for cells changed by fixes, at `row * columns.length + column`
  changed: Uint8Array
}

interface HistoryEntry {
  label: string
  patches: Patch[]
  // State before the entry, restored on undo
  validation: ValidationResult
  changed: Uint8Array
}

export interface ViewState {
  search: string
  quickFilter: QuickFilter
  // Only rows with this issue type, chosen in the issues overview
  issueType: IssueId | null
}

export interface DataState extends ViewState {
  dataset: Dataset | null
  // The grid renders `visibleRows`, indices into dataset.rows
  visibleRows: Uint32Array
  history: HistoryEntry[]
  progress: LoadProgress | null
  error: string | null
  setSearch: (search: string) => void
  setQuickFilter: (quickFilter: QuickFilter) => void
  setIssueType: (issueType: IssueId | null) => void
  applyAutoFix: (mode: FixMode) => number
  undo: () => void
  loadFile: (file: File) => Promise<void>
  cancelLoad: () => void
  reset: () => void
}

let loadController: AbortController | null = null
// Built on the first search, not part of reactive state
let searchIndex: string[] | null = null

const VIEW_RESET: ViewState = { search: '', quickFilter: QUICK_FILTER.ALL, issueType: null }

function computeView(dataset: Dataset | null, { search, quickFilter, issueType }: ViewState) {
  if (!dataset) return new Uint32Array()
  const query = normalizeQuery(search)
  if (query !== '') searchIndex ??= buildSearchIndex(dataset.rows)
  const rowMask = issueType ? rowsWithIssue(dataset.issues, issueType, dataset.rows.length) : null
  return filterRows({ rowStatus: dataset.rowStatus, quickFilter, query, searchIndex, rowMask })
}

const validationOf = ({
  issues,
  issueOffsets,
  rowStatus,
  statusCounts,
  issueCounts,
  missingColumns,
}: Dataset): ValidationResult => ({
  issues,
  issueOffsets,
  rowStatus,
  statusCounts,
  issueCounts,
  missingColumns,
})

const settle = (signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, PROGRESS_SETTLE_MS)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason as Error)
      },
      { once: true },
    )
  })

export const dataStore = createStore<DataState>()((set, get) => {
  // Updates view state and recomputes the visible rows in one store update
  const setView = (view: Partial<ViewState>) => {
    const next = { ...get(), ...view }
    set({ ...view, visibleRows: computeView(next.dataset, next) })
  }

  // Replaces the dataset after a change of rows, keeping the current view
  const commitDataset = (dataset: Dataset, history: HistoryEntry[]) => {
    searchIndex = null
    let view: ViewState = get()
    // The chosen issue type may be gone after a fix
    if (view.issueType && !dataset.issueCounts[view.issueType]) view = { ...view, issueType: null }
    set({ dataset, history, issueType: view.issueType, visibleRows: computeView(dataset, view) })
  }

  return {
    dataset: null,
    ...VIEW_RESET,
    visibleRows: new Uint32Array(),
    history: [],
    progress: null,
    error: null,

    setSearch: (search) => setView({ search }),
    setQuickFilter: (quickFilter) => setView({ quickFilter }),
    setIssueType: (issueType) => setView({ issueType }),

    applyAutoFix: (mode) => {
      const { dataset, history } = get()
      if (!dataset) return 0
      const { fixes } = planAutoFix(dataset, mode)
      if (fixes.length === 0) return 0

      const { rows } = applyPatches(dataset.rows, fixes)
      const changed = dataset.changed.slice()
      const width = dataset.columns.length
      for (const fix of fixes) changed[fix.row * width + fix.column] = 1
      const entry: HistoryEntry = {
        label: `Fixed ${fixes.length.toLocaleString()} values automatically`,
        patches: fixes,
        validation: validationOf(dataset),
        changed: dataset.changed,
      }
      const validation = removeIssues(dataset, new Set(fixes.map((fix) => fix.issue)))
      commitDataset({ ...dataset, ...validation, rows, changed }, [...history, entry])
      return fixes.length
    },

    undo: () => {
      const { dataset, history } = get()
      const entry = history.at(-1)
      if (!dataset || !entry) return
      const { rows } = applyPatches(dataset.rows, entry.patches, true)
      commitDataset(
        { ...dataset, ...entry.validation, rows, changed: entry.changed },
        history.slice(0, -1),
      )
    },

    loadFile: async (file) => {
      // Checked before anything else, so a rejected file never cancels a running load
      const error = checkImportFile(file)
      if (error) {
        set({ error })
        return
      }

      loadController?.abort()
      const controller = new AbortController()
      loadController = controller

      // Collect chunks outside the store and commit once, so React renders a single update
      const rows: Row[] = []
      const issues: IssueRecord[] = []
      set({
        error: null,
        progress: {
          stage: 'parsing',
          bytesRead: 0,
          totalBytes: file.size,
          rowsProcessed: 0,
          totalRows: 0,
        },
      })

      try {
        const { rowCount, ...result } = await getImportWorker().request(
          'load',
          { file },
          {
            signal: controller.signal,
            onProgress: (progress) => set({ progress }),
            onChunk: (chunk) => {
              if (chunk.kind === 'rows') for (const row of chunk.rows) rows.push(row)
              else for (const issue of chunk.issues) issues.push(issue)
            },
          },
        )
        set({
          progress: {
            stage: 'validating',
            bytesRead: file.size,
            totalBytes: file.size,
            rowsProcessed: rowCount,
            totalRows: rowCount,
          },
        })
        await settle(controller.signal)
        const dataset: Dataset = {
          fileName: file.name,
          rows,
          issues,
          changed: new Uint8Array(rows.length * result.columns.length),
          ...result,
          issueOffsets: result.issueOffsets as Uint32Array<ArrayBuffer>,
          rowStatus: result.rowStatus as Uint8Array<ArrayBuffer>,
        }
        searchIndex = null
        set({
          dataset,
          history: [],
          ...VIEW_RESET,
          visibleRows: computeView(dataset, VIEW_RESET),
        })
      } catch (err) {
        if (isAbortError(err)) return
        set({ error: err instanceof Error ? err.message : ERROR_MESSAGE.FILE_READ_FAILED })
      } finally {
        if (loadController === controller) {
          loadController = null
          set({ progress: null })
        }
      }
    },

    cancelLoad: () =>
      loadController?.abort(new DOMException(ERROR_MESSAGE.LOAD_CANCELLED, 'AbortError')),

    reset: () => {
      searchIndex = null
      set({
        dataset: null,
        history: [],
        error: null,
        ...VIEW_RESET,
        visibleRows: new Uint32Array(),
      })
    },
  }
})

// Value of a cell before the first fix that changed it
export function originalValue(history: readonly HistoryEntry[], row: number, column: number) {
  for (const entry of history) {
    const patch = findPatch(entry.patches, row, column)
    if (patch) return patch.before
  }
  return undefined
}

export const useDataStore = Object.assign(
  <T>(selector: (state: DataState) => T) => useStore(dataStore, selector),
  { getState: dataStore.getState },
)
