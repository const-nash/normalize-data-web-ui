import type { Patch } from './autoFix'
import { applyPatches } from './autoFix'
import type { CustomerColumn } from './customer'
import { buildDuplicateIndex, normalizeCustomerId, normalizeEmail } from './rules/duplicates'
import type { DuplicateIndex } from './rules/duplicates'
import { cellIssue, mapColumns, replaceRowIssues } from './validation'
import type { IssueRecord, Row, ValidationResult } from './validation'

type UniqueColumn = 'customer_id' | 'email'

export type DuplicateIndexes = Record<UniqueColumn, DuplicateIndex>

const NORMALIZE: Record<UniqueColumn, (value: string) => string> = {
  customer_id: normalizeCustomerId,
  email: normalizeEmail,
}

const isUnique = (column: CustomerColumn | undefined): column is UniqueColumn =>
  column === 'customer_id' || column === 'email'

export function buildDuplicateIndexes(header: readonly string[], rows: readonly Row[]) {
  const { positions } = mapColumns(header)
  const build = (column: UniqueColumn) => {
    const position = positions.get(column)
    const values = position === undefined ? [] : rows.map((row) => row[position] ?? '')
    return buildDuplicateIndex(values, NORMALIZE[column])
  }
  return { customer_id: build('customer_id'), email: build('email') }
}

// Moves a row from one duplicate group to another. Returns the rows whose duplicate state may
// have changed: the old group and the new group. Mutates the index.
function moveInIndex(index: DuplicateIndex, row: number, oldKey: string, newKey: string) {
  const affected: number[] = []
  const oldGroup = index.get(oldKey)
  if (oldGroup) {
    const rest = oldGroup.filter((r) => r !== row)
    if (rest.length > 0) index.set(oldKey, rest)
    else index.delete(oldKey)
    affected.push(...rest)
  }
  if (newKey !== '') {
    const group = index.get(newKey) ?? []
    affected.push(...group)
    index.set(newKey, [...group, row])
  }
  return affected
}

interface EditInput {
  header: readonly string[]
  rows: readonly Row[]
  validation: ValidationResult
  // Mutated in place; rebuild it after an undo
  indexes: DuplicateIndexes
}

// Changes one cell and revalidates only its row and the duplicate groups it left or joined
export function editCell(
  { header, rows, validation, indexes }: EditInput,
  row: number,
  column: number,
  value: string,
) {
  const before = rows[row][column] ?? ''
  if (before === value) return null

  const patch: Patch = { row, column, before, after: value }
  const next = applyPatches(rows, [patch]).rows
  const { positions } = mapColumns(header)
  const specColumn = [...positions].find(([, position]) => position === column)?.[0]

  const affected = new Set([row])
  if (isUnique(specColumn)) {
    const normalize = NORMALIZE[specColumn]
    const oldKey = normalize(before)
    const newKey = normalize(value)
    if (oldKey !== newKey) {
      for (const r of moveInIndex(indexes[specColumn], row, oldKey, newKey)) affected.add(r)
    }
  }

  const isDuplicate = (r: number, uniqueColumn: UniqueColumn, position: number) => {
    const key = NORMALIZE[uniqueColumn](next[r][position] ?? '')
    return key !== '' && (indexes[uniqueColumn].get(key)?.length ?? 0) > 1
  }

  let result = validation
  for (const r of [...affected].toSorted((a, b) => a - b)) {
    const rowIssues: IssueRecord[] = []
    for (const [col, position] of positions) {
      const duplicate = isUnique(col) && isDuplicate(r, col, position)
      const issue = cellIssue(col, next[r][position] ?? '', duplicate)
      if (issue) rowIssues.push({ row: r, column: col, ...issue })
    }
    result = replaceRowIssues(result, r, rowIssues)
  }

  return { rows: next, validation: result, patch }
}
