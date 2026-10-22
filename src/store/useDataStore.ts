import { create } from 'zustand'

export type Row = Record<string, string>

interface DataState {
  fileName: string | null
  columns: string[]
  rows: Row[]
  setData: (fileName: string, columns: string[], rows: Row[]) => void
  reset: () => void
}

export const useDataStore = create<DataState>()((set) => ({
  fileName: null,
  columns: [],
  rows: [],
  setData: (fileName, columns, rows) => set({ fileName, columns, rows }),
  reset: () => set({ fileName: null, columns: [], rows: [] }),
}))
