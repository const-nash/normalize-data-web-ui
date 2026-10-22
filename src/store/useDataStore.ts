import { create } from 'zustand'
import { getImportWorker, isAbortError } from '../worker/client'
import type { LoadProgress, Row } from '../worker/protocol'

const SUPPORTED_EXTENSIONS = new Set(['csv', 'tsv', 'txt'])
const MAX_FILE_BYTES = 100 * 1024 * 1024

export interface Dataset {
  fileName: string
  columns: string[]
  rows: Row[]
}

interface DataState {
  dataset: Dataset | null
  progress: LoadProgress | null
  error: string | null
  loadFile: (file: File) => Promise<void>
  cancelLoad: () => void
  reset: () => void
}

let loadController: AbortController | null = null

function checkFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    return `Unsupported file type ".${extension}". Please choose a CSV, TSV or TXT file.`
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'This file is larger than 100 MB. Please split it into smaller files.'
  }
  return null
}

export const useDataStore = create<DataState>()((set) => ({
  dataset: null,
  progress: null,
  error: null,

  loadFile: async (file) => {
    const error = checkFile(file)
    if (error) {
      set({ error })
      return
    }

    loadController?.abort()
    const controller = new AbortController()
    loadController = controller

    // Collect chunks outside the store and commit once, so React renders a single update
    const rows: Row[] = []
    set({
      error: null,
      progress: { stage: 'parsing', bytesRead: 0, totalBytes: file.size, rowsProcessed: 0 },
    })

    try {
      const { columns } = await getImportWorker().request(
        'load',
        { file },
        {
          signal: controller.signal,
          onProgress: (progress) => set({ progress }),
          onChunk: (chunk) => {
            for (const row of chunk) rows.push(row)
          },
        },
      )
      set({ dataset: { fileName: file.name, columns, rows } })
    } catch (err) {
      if (isAbortError(err)) return
      set({ error: err instanceof Error ? err.message : 'Could not read the file.' })
    } finally {
      if (loadController === controller) {
        loadController = null
        set({ progress: null })
      }
    }
  },

  cancelLoad: () => loadController?.abort(),

  reset: () => set({ dataset: null, error: null }),
}))
