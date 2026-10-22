import { CUSTOMER_COLUMNS } from './customer'
import type { CustomerColumn } from './customer'
import { validateCell } from './rules/columnRules'
import {
  buildDuplicateIndex,
  duplicateRows,
  normalizeCustomerId,
  normalizeEmail,
} from './rules/duplicates'
import { ISSUE_TYPES } from './rules/issueTypes'
import type { CellIssue, IssueId } from './rules/issueTypes'

export type Row = readonly string[]

// valid: no issues. fixable: every issue has a suggested value, so the row can be fixed after
// the user reviews the preview. manual: at least one issue needs a value from a person or AI.
export const ROW_STATUS = { VALID: 0, FIXABLE: 1, MANUAL: 2 } as const
export type RowStatus = (typeof ROW_STATUS)[keyof typeof ROW_STATUS]

// One issue in one cell. With the original cell value it describes a fix completely:
// what is wrong (type), where (row, column), and the proposed new value (suggestion).
export interface IssueRecord extends CellIssue {
  row: number
  column: CustomerColumn
}

export interface ValidationSummary {
  statusCounts: Record<'valid' | 'fixable' | 'manual', number>
  issueCounts: Partial<Record<IssueId, number>>
  // Columns from the spec that the file does not have. Not reported per row.
  missingColumns: CustomerColumn[]
}

export interface ValidationResult extends ValidationSummary {
  issues: IssueRecord[]
  // ROW_STATUS per row
  rowStatus: Uint8Array<ArrayBuffer>
  // Issues of row r are issues[issueOffsets[r]] up to issues[issueOffsets[r + 1]]
  issueOffsets: Uint32Array<ArrayBuffer>
}

// Index of each spec column in the file header, matched by trimmed lowercase name
export function mapColumns(header: readonly string[]) {
  const positions = new Map<CustomerColumn, number>()
  header.forEach((name, index) => {
    const key = name.trim().toLowerCase() as CustomerColumn
    if (CUSTOMER_COLUMNS.includes(key) && !positions.has(key)) positions.set(key, index)
  })
  const missing = CUSTOMER_COLUMNS.filter((column) => !positions.has(column))
  return { positions, missing }
}

function* columnValues(rows: readonly Row[], position: number | undefined) {
  if (position === undefined) return
  for (const row of rows) yield row[position] ?? ''
}

// Validates all rows. A generator, so the caller decides when to pause: it yields the number
// of rows processed every `yieldEvery` rows and returns the result at the end.
export function* validateRows(
  header: readonly string[],
  rows: readonly Row[],
  yieldEvery = 5000,
): Generator<number, ValidationResult> {
  const { positions, missing } = mapColumns(header)

  const duplicates = {
    customer_id: duplicateRows(
      buildDuplicateIndex(columnValues(rows, positions.get('customer_id')), normalizeCustomerId),
    ),
    email: duplicateRows(
      buildDuplicateIndex(columnValues(rows, positions.get('email')), normalizeEmail),
    ),
  }

  const issues: IssueRecord[] = []
  const rowStatus = new Uint8Array(rows.length)
  const issueOffsets = new Uint32Array(rows.length + 1)
  const statusCounts = { valid: 0, fixable: 0, manual: 0 }
  const issueCounts: Partial<Record<IssueId, number>> = {}
  const columns = [...positions]

  for (let row = 0; row < rows.length; row++) {
    let status: RowStatus = ROW_STATUS.VALID
    issueOffsets[row] = issues.length

    for (const [column, position] of columns) {
      let issue = validateCell(column, rows[row][position] ?? '')

      // A duplicate outranks fixable issues, but a missing or invalid value stays first
      if (
        (column === 'customer_id' || column === 'email') &&
        duplicates[column].has(row) &&
        (!issue || ISSUE_TYPES[issue.type].fixKind !== 'manual')
      ) {
        issue = { type: `${column}.duplicate` }
      }
      if (!issue) continue

      issues.push({ row, column, ...issue })
      issueCounts[issue.type] = (issueCounts[issue.type] ?? 0) + 1
      status =
        issue.suggestion === undefined
          ? ROW_STATUS.MANUAL
          : (Math.max(status, ROW_STATUS.FIXABLE) as RowStatus)
    }

    rowStatus[row] = status
    if (status === ROW_STATUS.VALID) statusCounts.valid++
    else if (status === ROW_STATUS.FIXABLE) statusCounts.fixable++
    else statusCounts.manual++

    if ((row + 1) % yieldEvery === 0) yield row + 1
  }

  issueOffsets[rows.length] = issues.length
  return { issues, rowStatus, issueOffsets, statusCounts, issueCounts, missingColumns: missing }
}

// The issue of one cell, found through the per-row offsets
export function findCellIssue(
  issues: readonly IssueRecord[],
  issueOffsets: Uint32Array,
  row: number,
  column: CustomerColumn,
): IssueRecord | undefined {
  for (let i = issueOffsets[row]; i < issueOffsets[row + 1]; i++) {
    if (issues[i].column === column) return issues[i]
  }
  return undefined
}

// Runs validateRows to the end without pausing
export function validateAll(header: readonly string[], rows: readonly Row[]) {
  const generator = validateRows(header, rows)
  for (;;) {
    const step = generator.next()
    if (step.done) return step.value
  }
}
