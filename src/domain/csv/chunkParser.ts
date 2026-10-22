import Papa from 'papaparse'
import type { ParseError, ParseResult } from 'papaparse'
import { KILOBYTE } from '../../constants/fileSize'

export type CsvRow = string[]

export interface CsvParseError {
  // Index among data rows (header excluded), when known
  row: number | null
  message: string
}

export interface CsvSummary {
  columns: string[]
  rowCount: number
  delimiter: string
  errors: CsvParseError[]
  errorCount: number
}

export interface CsvHandlers {
  onHeader?: (columns: string[]) => void
  // Called once per pushed text chunk that completed at least one row
  onRows?: (rows: CsvRow[]) => void
}

export interface CsvParserOptions {
  // Characters buffered to detect the delimiter and line break. Defaults to 64 KB.
  sampleSize?: number
}

export interface CsvChunkParser {
  push: (text: string) => void
  finish: () => CsvSummary
}

const DEFAULT_SAMPLE_SIZE = 64 * KILOBYTE
const MAX_STORED_ERRORS = 100
const DELIMITERS = [',', ';', '\t', '|']

const isEmptyLine = (row: CsvRow) => row.length === 1 && row[0].trim() === ''

// Incremental CSV parser built on PapaParse. Feed it text in any slices: rows split between
// slices are completed on the next push. It knows nothing about files, threads or workers.
export function createCsvChunkParser(
  handlers: CsvHandlers = {},
  { sampleSize = DEFAULT_SAMPLE_SIZE }: CsvParserOptions = {},
): CsvChunkParser {
  let sample = '' // text buffered until the format is detected
  let parser: Papa.Parser | null = null
  let delimiter = ','
  let partial = '' // incomplete last row of the previous slice
  let baseIndex = 0
  let isFirstText = true
  let columns: string[] | null = null
  let rowCount = 0
  let errorCount = 0
  const errors: CsvParseError[] = []

  const detectFormat = (text: string) => {
    const { meta } = Papa.parse<string[]>(text, { preview: 10, delimitersToGuess: DELIMITERS })
    delimiter = meta.delimiter
    parser = new Papa.Parser({ delimiter, newline: meta.linebreak as Papa.ParseConfig['newline'] })
  }

  const recordErrors = (list: ParseError[], firstRow: number) => {
    errorCount += list.length
    for (const error of list) {
      if (errors.length >= MAX_STORED_ERRORS) break
      errors.push({
        row: error.row === undefined ? null : firstRow + error.row,
        message: error.message,
      })
    }
  }

  const parse = (text: string, isLast: boolean) => {
    if (!parser) return
    const input = partial + text
    const result = parser.parse(input, baseIndex, !isLast) as ParseResult<CsvRow>

    if (!isLast) {
      const cursor = result.meta.cursor
      partial = input.slice(cursor - baseIndex)
      baseIndex = cursor
    }

    const firstRow = rowCount - (columns ? 0 : 1)
    const rows: CsvRow[] = []
    for (const row of result.data) {
      if (isEmptyLine(row)) continue
      if (!columns) {
        columns = row
        handlers.onHeader?.(columns)
        continue
      }
      rows.push(row)
    }
    recordErrors(result.errors, firstRow)

    if (rows.length > 0) {
      rowCount += rows.length
      handlers.onRows?.(rows)
    }
  }

  return {
    push(text) {
      if (isFirstText && text.length > 0) {
        isFirstText = false
        if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // byte order mark
      }
      if (!parser) {
        sample += text
        if (sample.length < sampleSize) return
        detectFormat(sample)
        text = sample
        sample = ''
      }
      parse(text, false)
    },

    finish() {
      if (!parser) {
        if (sample.trim() === '') return { columns: [], rowCount: 0, delimiter, errors, errorCount }
        detectFormat(sample)
      }
      parse(sample, true)
      sample = ''
      return { columns: columns ?? [], rowCount, delimiter, errors, errorCount }
    },
  }
}
