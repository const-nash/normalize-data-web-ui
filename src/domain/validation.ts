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

  const columns = [...positions]
  const issues: IssueRecord[] = []
  const issueOffsets = new Uint32Array(rows.length + 1)

  for (let row = 0; row < rows.length; row++) {
    issueOffsets[row] = issues.length
    for (const [column, position] of columns) {
      const isDuplicate =
        (column === 'customer_id' || column === 'email') && duplicates[column].has(row)
      const issue = cellIssue(column, rows[row][position] ?? '', isDuplicate)
      if (issue) issues.push({ row, column, ...issue })
    }
    if ((row + 1) % yieldEvery === 0) yield row + 1
  }
  issueOffsets[rows.length] = issues.length

  return { ...summarize(issues, issueOffsets, rows.length), missingColumns: missing }
}

export function cellIssue(column: CustomerColumn, value: string, isDuplicate: boolean) {
  const issue = validateCell(column, value)
  // A duplicate outranks fixable issues, but a missing or invalid value stays first
  if (isDuplicate && (!issue || ISSUE_TYPES[issue.type].fixKind !== 'manual')) {
    return { type: `${column as 'customer_id' | 'email'}.duplicate` } as const
  }
  return issue
}

// Row statuses and counts derived from the issue list
function summarize(
  issues: IssueRecord[],
  issueOffsets: Uint32Array<ArrayBuffer>,
  rowCount: number,
) {
  const rowStatus = new Uint8Array(rowCount)
  const statusCounts = { valid: 0, fixable: 0, manual: 0 }
  const issueCounts: Partial<Record<IssueId, number>> = {}

  for (let row = 0; row < rowCount; row++) {
    let status: RowStatus = ROW_STATUS.VALID
    for (let i = issueOffsets[row]; i < issueOffsets[row + 1]; i++) {
      const { type, suggestion } = issues[i]
      issueCounts[type] = (issueCounts[type] ?? 0) + 1
      if (suggestion === undefined) status = ROW_STATUS.MANUAL
      else if (status === ROW_STATUS.VALID) status = ROW_STATUS.FIXABLE
    }
    rowStatus[row] = status
    if (status === ROW_STATUS.VALID) statusCounts.valid++
    else if (status === ROW_STATUS.FIXABLE) statusCounts.fixable++
    else statusCounts.manual++
  }
  return { issues, issueOffsets, rowStatus, statusCounts, issueCounts }
}

const statusKey = (status: number) =>
  status === ROW_STATUS.VALID ? 'valid' : status === ROW_STATUS.FIXABLE ? 'fixable' : 'manual'

// Replaces the issues of one row and updates statuses and counts by difference. The arrays are
// copied, not rebuilt: a few milliseconds for 200,000 rows.
export function replaceRowIssues(
  previous: ValidationResult,
  row: number,
  rowIssues: IssueRecord[],
): ValidationResult {
  const { issues, issueOffsets, rowStatus } = previous
  const start = issueOffsets[row]
  const end = issueOffsets[row + 1]
  const delta = rowIssues.length - (end - start)

  const issueCounts = { ...previous.issueCounts }
  for (let i = start; i < end; i++) {
    const type = issues[i].type
    const count = (issueCounts[type] ?? 0) - 1
    if (count > 0) issueCounts[type] = count
    else delete issueCounts[type]
  }
  let status: RowStatus = ROW_STATUS.VALID
  for (const { type, suggestion } of rowIssues) {
    issueCounts[type] = (issueCounts[type] ?? 0) + 1
    if (suggestion === undefined) status = ROW_STATUS.MANUAL
    else if (status === ROW_STATUS.VALID) status = ROW_STATUS.FIXABLE
  }

  const nextOffsets = issueOffsets.slice()
  if (delta !== 0) for (let r = row + 1; r < nextOffsets.length; r++) nextOffsets[r] += delta
  const nextStatus = rowStatus.slice()
  nextStatus[row] = status
  const statusCounts = { ...previous.statusCounts }
  statusCounts[statusKey(rowStatus[row])]--
  statusCounts[statusKey(status)]++

  return {
    issues: issues.toSpliced(start, end - start, ...rowIssues),
    issueOffsets: nextOffsets,
    rowStatus: nextStatus,
    statusCounts,
    issueCounts,
    missingColumns: previous.missingColumns,
  }
}

// Removes resolved issues and recounts. Used after automatic fixes: every suggested value passes
// its rule (see the column rule tests), so a fixed cell has no issue left and the other cells of
// the row are unchanged. Much cheaper than running the rules again.
export function removeIssues(
  previous: ValidationResult,
  resolved: ReadonlySet<number>,
): ValidationResult {
  const rowCount = previous.rowStatus.length
  const issues: IssueRecord[] = []
  const issueOffsets = new Uint32Array(rowCount + 1)
  for (let row = 0; row < rowCount; row++) {
    issueOffsets[row] = issues.length
    for (let i = previous.issueOffsets[row]; i < previous.issueOffsets[row + 1]; i++) {
      if (!resolved.has(i)) issues.push(previous.issues[i])
    }
  }
  issueOffsets[rowCount] = issues.length
  return { ...summarize(issues, issueOffsets, rowCount), missingColumns: previous.missingColumns }
}

// Revalidates only `changedRows` and keeps the issues of all other rows. Duplicate flags of
// changed cells are kept as they were: the duplicate index is not rebuilt here.
export function revalidateRows(
  header: readonly string[],
  rows: readonly Row[],
  previous: ValidationResult,
  changedRows: ReadonlySet<number>,
): ValidationResult {
  const { positions } = mapColumns(header)
  const columns = [...positions]
  const issues: IssueRecord[] = []
  const issueOffsets = new Uint32Array(rows.length + 1)

  for (let row = 0; row < rows.length; row++) {
    issueOffsets[row] = issues.length
    if (!changedRows.has(row)) {
      for (let i = previous.issueOffsets[row]; i < previous.issueOffsets[row + 1]; i++) {
        issues.push(previous.issues[i])
      }
      continue
    }
    for (const [column, position] of columns) {
      const old = findCellIssue(previous.issues, previous.issueOffsets, row, column)
      const issue = cellIssue(column, rows[row][position] ?? '', !!old?.type.endsWith('.duplicate'))
      if (issue) issues.push({ row, column, ...issue })
    }
  }
  issueOffsets[rows.length] = issues.length

  return {
    ...summarize(issues, issueOffsets, rows.length),
    missingColumns: previous.missingColumns,
  }
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
