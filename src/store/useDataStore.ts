import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { ERROR_MESSAGE } from '../constants/errorMessages'
import { QUICK_FILTER, buildSearchIndex, filterRows, normalizeQuery } from '../domain/filter'
import type { QuickFilter } from '../domain/filter'
import { checkImportFile } from '../domain/importFile'
import type { IssueRecord, ValidationSummary } from '../domain/validation'
import { getImportWorker, isAbortError } from '../worker/client'
import type { LoadProgress, Row } from '../worker/protocol'

// Lets the progress bar finish its animation before the screen changes
const PROGRESS_SETTLE_MS = 300

export interface Dataset extends ValidationSummary {
  fileName: string
  columns: string[]
  rows: Row[]
  // Every issue with its row, column and suggested value: enough to preview each fix
  issues: IssueRecord[]
  // ROW_STATUS per row: valid, fixable after review, or manual
  rowStatus: Uint8Array
  // Issues of row r are issues[issueOffsets[r]] up to issues[issueOffsets[r + 1]]
  issueOffsets: Uint32Array
}

export interface DataState {
  dataset: Dataset | null
  // View state: the grid renders `visibleRows`, indices into dataset.rows
  search: string
  quickFilter: QuickFilter
  visibleRows: Uint32Array
  setSearch: (search: string) => void
  setQuickFilter: (quickFilter: QuickFilter) => void
  progress: LoadProgress | null
  error: string | null
  loadFile: (file: File) => Promise<void>
  cancelLoad: () => void
  reset: () => void
}

let loadController: AbortController | null = null
// Built on the first search, not part of reactive state
let searchIndex: string[] | null = null

const VIEW_RESET = { search: '', quickFilter: QUICK_FILTER.ALL } as const

function computeView(dataset: Dataset | null, search: string, quickFilter: QuickFilter) {
  if (!dataset) return new Uint32Array()
  const query = normalizeQuery(search)
  if (query !== '') searchIndex ??= buildSearchIndex(dataset.rows)
  return filterRows({ rowStatus: dataset.rowStatus, quickFilter, query, searchIndex })
}

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

export const dataStore = createStore<DataState>()((set, get) => ({
  dataset: null,
  ...VIEW_RESET,
  visibleRows: new Uint32Array(),

  setSearch: (search) => {
    const { dataset, quickFilter } = get()
    set({ search, visibleRows: computeView(dataset, search, quickFilter) })
  },

  setQuickFilter: (quickFilter) => {
    const { dataset, search } = get()
    set({ quickFilter, visibleRows: computeView(dataset, search, quickFilter) })
  },

  progress: null,
  error: null,

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
      const dataset: Dataset = { fileName: file.name, rows, issues, ...result }
      searchIndex = null
      set({
        dataset,
        ...VIEW_RESET,
        visibleRows: computeView(dataset, VIEW_RESET.search, VIEW_RESET.quickFilter),
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
    set({ dataset: null, error: null, ...VIEW_RESET, visibleRows: new Uint32Array() })
  },
}))

export const useDataStore = Object.assign(
  <T>(selector: (state: DataState) => T) => useStore(dataStore, selector),
  { getState: dataStore.getState },
)
