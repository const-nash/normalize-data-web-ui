import type { IssueId } from './rules/issueTypes'
import { mapColumns } from './validation'
import type { IssueRecord, Row } from './validation'

// One cell change. A single edit is one history entry; a bulk fix is one entry with many.
export interface Patch {
  row: number
  // Index in the file header
  column: number
  before: string
  after: string
}

export interface PlannedFix extends Patch {
  type: IssueId
  // Index of the fixed issue in the issue list
  issue: number
}

interface PlanInput {
  columns: readonly string[]
  rows: readonly Row[]
  issues: readonly IssueRecord[]
}

// Every issue of the given type that has a suggested value, as a fix with before and after.
// With a row mask (for example the rows matching a search) only those rows are fixed.
export function planAutoFix(
  { columns, rows, issues }: PlanInput,
  issueType: IssueId,
  rowMask: Uint8Array | null = null,
) {
  const { positions } = mapColumns(columns)
  const fixes: PlannedFix[] = []
  for (let index = 0; index < issues.length; index++) {
    const issue = issues[index]
    if (issue.type !== issueType || issue.suggestion === undefined) continue
    if (rowMask && rowMask[issue.row] === 0) continue
    const column = positions.get(issue.column)
    if (column === undefined) continue
    fixes.push({
      row: issue.row,
      column,
      before: rows[issue.row][column] ?? '',
      after: issue.suggestion,
      type: issue.type,
      issue: index,
    })
  }
  return fixes
}

// Returns new rows with the patches applied; untouched rows are shared, touched rows copied.
// `undo` applies them in reverse, restoring `before` values.
export function applyPatches(rows: readonly Row[], patches: readonly Patch[], undo = false) {
  const next = rows.slice()
  const copied = new Set<number>()
  for (let i = 0; i < patches.length; i++) {
    const patch = patches[undo ? patches.length - 1 - i : i]
    if (!copied.has(patch.row)) {
      next[patch.row] = rows[patch.row].slice()
      copied.add(patch.row)
    }
    ;(next[patch.row] as string[])[patch.column] = undo ? patch.before : patch.after
  }
  return { rows: next, changedRows: copied as ReadonlySet<number> }
}

// Finds the patch of a cell in patches sorted by row, then column (as planAutoFix makes them)
export function findPatch(patches: readonly Patch[], row: number, column: number) {
  let low = 0
  let high = patches.length - 1
  while (low <= high) {
    const mid = (low + high) >> 1
    const patch = patches[mid]
    const order = patch.row - row || patch.column - column
    if (order === 0) return patch
    if (order < 0) low = mid + 1
    else high = mid - 1
  }
  return undefined
}
