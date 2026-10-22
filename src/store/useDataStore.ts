import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { ERROR_MESSAGE } from '../constants/errorMessages'
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
}

export interface DataState {
  dataset: Dataset | null
  progress: LoadProgress | null
  error: string | null
  loadFile: (file: File) => Promise<void>
  cancelLoad: () => void
  reset: () => void
}

let loadController: AbortController | null = null

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

export const dataStore = createStore<DataState>()((set) => ({
  dataset: null,
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
      set({ dataset: { fileName: file.name, rows, issues, ...result } })
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

  reset: () => set({ dataset: null, error: null }),
}))

export const useDataStore = <T>(selector: (state: DataState) => T) => useStore(dataStore, selector)
