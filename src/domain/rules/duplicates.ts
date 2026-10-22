// Duplicate index: maps a normalized value to the rows that have it. Kept as a Map so a later
// edit can update only the affected group.

export type DuplicateIndex = Map<string, number[]>

export const normalizeCustomerId = (value: string) => value.trim()
// Emails are compared trimmed and case-insensitive (see CLAUDE.md)
export const normalizeEmail = (value: string) => value.trim().toLowerCase()

export function buildDuplicateIndex(
  values: Iterable<string>,
  normalize: (value: string) => string,
): DuplicateIndex {
  const index: DuplicateIndex = new Map()
  let row = 0
  for (const value of values) {
    const key = normalize(value)
    if (key !== '') {
      const rows = index.get(key)
      if (rows) rows.push(row)
      else index.set(key, [row])
    }
    row++
  }
  return index
}

// Rows that share their value with at least one other row
export function duplicateRows(index: DuplicateIndex): Set<number> {
  const rows = new Set<number>()
  for (const group of index.values()) {
    if (group.length > 1) for (const row of group) rows.add(row)
  }
  return rows
}
