import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { CustomerRow } from '../domain/customer'
import { createMockCustomers } from '../mock/customers'
import { simulateLoad } from '../mock/simulateLoad'
import { isAbortError } from '../worker/client'
import type { LoadProgress } from '../worker/protocol'

const MOCK_ROW_COUNT = 200

export interface Dataset {
  fileName: string
  rows: CustomerRow[]
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

export const dataStore = createStore<DataState>()((set) => ({
  dataset: null,
  progress: null,
  error: null,

  // Simulated for now: any file shows the same mock rows after a fake parse and analysis
  loadFile: async (file) => {
    loadController?.abort()
    const controller = new AbortController()
    loadController = controller
    set({ error: null })

    try {
      await simulateLoad(file, MOCK_ROW_COUNT, controller.signal, (progress) => set({ progress }))
      set({ dataset: { fileName: file.name, rows: createMockCustomers(MOCK_ROW_COUNT) } })
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

  cancelLoad: () => loadController?.abort(new DOMException('Load cancelled', 'AbortError')),

  reset: () => set({ dataset: null, error: null }),
}))

export const useDataStore = <T>(selector: (state: DataState) => T) => useStore(dataStore, selector)
