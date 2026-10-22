import type { IssueId } from './rules/issueTypes'
import { ROW_STATUS, mapColumns } from './validation'
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

export const FIX_MODE = {
  // Only rows where every issue has a suggestion; such rows become valid
  CLEAN_ROWS: 'clean-rows',
  // Every issue with a suggestion, also in rows that keep manual issues
  ALL: 'all',
} as const
export type FixMode = (typeof FIX_MODE)[keyof typeof FIX_MODE]

export interface FixGroup {
  type: IssueId
  count: number
  examples: PlannedFix[]
}

export interface AutoFixPlan {
  fixes: PlannedFix[]
  rowCount: number
  // Per issue type, most frequent first
  groups: FixGroup[]
}

const EXAMPLES_PER_GROUP = 3

interface PlanInput {
  columns: readonly string[]
  rows: readonly Row[]
  issues: readonly IssueRecord[]
  rowStatus: Uint8Array
}

export function planAutoFix({ columns, rows, issues, rowStatus }: PlanInput, mode: FixMode) {
  const { positions } = mapColumns(columns)
  const fixes: PlannedFix[] = []
  const groups = new Map<IssueId, FixGroup>()
  let rowCount = 0
  let lastRow = -1

  for (let index = 0; index < issues.length; index++) {
    const issue = issues[index]
    if (issue.suggestion === undefined) continue
    if (mode === FIX_MODE.CLEAN_ROWS && rowStatus[issue.row] !== ROW_STATUS.FIXABLE) continue
    const column = positions.get(issue.column)
    if (column === undefined) continue

    const fix: PlannedFix = {
      row: issue.row,
      column,
      before: rows[issue.row][column] ?? '',
      after: issue.suggestion,
      type: issue.type,
      issue: index,
    }
    fixes.push(fix)
    if (issue.row !== lastRow) {
      rowCount++
      lastRow = issue.row
    }

    const group = groups.get(issue.type)
    if (group) {
      group.count++
      if (group.examples.length < EXAMPLES_PER_GROUP) group.examples.push(fix)
    } else {
      groups.set(issue.type, { type: issue.type, count: 1, examples: [fix] })
    }
  }

  const sorted = [...groups.values()].toSorted((a, b) => b.count - a.count)
  return { fixes, rowCount, groups: sorted } satisfies AutoFixPlan
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
