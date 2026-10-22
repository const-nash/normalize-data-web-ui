// TEMPORARY: naive line/comma splitter so the pipeline works end to end.
// Ignores quoting and delimiter detection; will be replaced by PapaParse.

export interface ChunkParser {
  push: (text: string, onRow: (row: string[]) => void) => void
  flush: (onRow: (row: string[]) => void) => void
}

const emit = (line: string, onRow: (row: string[]) => void) => {
  const clean = line.endsWith('\r') ? line.slice(0, -1) : line
  if (clean !== '') onRow(clean.split(','))
}

export function createNaiveParser(): ChunkParser {
  let tail = ''

  return {
    push(text, onRow) {
      const lines = (tail + text).split('\n')
      tail = lines.pop() ?? ''
      for (const line of lines) emit(line, onRow)
    },
    flush(onRow) {
      emit(tail, onRow)
      tail = ''
    },
  }
}
