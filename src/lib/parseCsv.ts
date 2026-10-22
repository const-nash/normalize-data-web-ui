import Papa from 'papaparse'
import type { Row } from '../store/useDataStore'

export interface ParsedCsv {
  columns: string[]
  rows: Row[]
}

export function parseCsv(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: (result) => resolve({ columns: result.meta.fields ?? [], rows: result.data }),
      error: reject,
    })
  })
}
