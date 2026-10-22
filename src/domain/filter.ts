import type { IssueId } from './rules/issueTypes'
import { ROW_STATUS } from './validation'
import type { IssueRecord, Row } from './validation'

export const QUICK_FILTER = {
  ALL: 'all',
  WITH_ISSUES: 'with-issues',
  MANUAL: 'manual',
  FIXABLE: 'fixable',
  VALID: 'valid',
} as const
export type QuickFilter = (typeof QUICK_FILTER)[keyof typeof QUICK_FILTER]

// Joins cells with a character that never appears in text, so a match cannot span columns
const CELL_SEPARATOR = '\u0000'

export const normalizeQuery = (query: string) => query.trim().toLowerCase()

// One lowercase string per row: a search is then one `includes` per row
export function buildSearchIndex(rows: readonly Row[]): string[] {
  return rows.map((row) => row.join(CELL_SEPARATOR).toLowerCase())
}

const matchesStatus: Record<QuickFilter, (status: number) => boolean> = {
  [QUICK_FILTER.ALL]: () => true,
  [QUICK_FILTER.WITH_ISSUES]: (status) => status !== ROW_STATUS.VALID,
  [QUICK_FILTER.MANUAL]: (status) => status === ROW_STATUS.MANUAL,
  [QUICK_FILTER.FIXABLE]: (status) => status === ROW_STATUS.FIXABLE,
  [QUICK_FILTER.VALID]: (status) => status === ROW_STATUS.VALID,
}

interface FilterInput {
  rowStatus: Uint8Array
  quickFilter: QuickFilter
  // Already normalized; empty means no text filter
  query: string
  // Required when query is not empty
  searchIndex: readonly string[] | null
  // 1 for rows to keep, from rowsWithIssue; null keeps all
  rowMask?: Uint8Array | null
}

// Marks the rows whose text contains the (normalized) query
export function searchMask(searchIndex: readonly string[], query: string) {
  const mask = new Uint8Array(searchIndex.length)
  for (let row = 0; row < searchIndex.length; row++) {
    if (searchIndex[row].includes(query)) mask[row] = 1
  }
  return mask
}

export interface ScopeSummary {
  rowCount: number
  statusCounts: Record<'valid' | 'fixable' | 'manual', number>
  issueCounts: Partial<Record<IssueId, number>>
}

// Row and issue counts for the rows in the mask, for example the rows that match a search
export function summarizeRows(
  rowStatus: Uint8Array,
  issues: readonly IssueRecord[],
  mask: Uint8Array,
): ScopeSummary {
  const statusCounts = { valid: 0, fixable: 0, manual: 0 }
  let rowCount = 0
  for (let row = 0; row < rowStatus.length; row++) {
    if (mask[row] === 0) continue
    rowCount++
    if (rowStatus[row] === ROW_STATUS.VALID) statusCounts.valid++
    else if (rowStatus[row] === ROW_STATUS.FIXABLE) statusCounts.fixable++
    else statusCounts.manual++
  }
  const issueCounts: Partial<Record<IssueId, number>> = {}
  for (const issue of issues) {
    if (mask[issue.row] === 1) issueCounts[issue.type] = (issueCounts[issue.type] ?? 0) + 1
  }
  return { rowCount, statusCounts, issueCounts }
}

// Marks the rows that have an issue of the given type
export function rowsWithIssue(issues: readonly IssueRecord[], type: IssueId, rowCount: number) {
  const mask = new Uint8Array(rowCount)
  for (const issue of issues) if (issue.type === type) mask[issue.row] = 1
  return mask
}

// Indices of the rows that pass the quick filter and contain the query in any column.
// Rows themselves are never copied.
export function filterRows({ rowStatus, quickFilter, query, searchIndex, rowMask }: FilterInput) {
  const passesStatus = matchesStatus[quickFilter]
  const result = new Uint32Array(rowStatus.length)
  let count = 0
  for (let row = 0; row < rowStatus.length; row++) {
    if (!passesStatus(rowStatus[row])) continue
    if (rowMask && rowMask[row] === 0) continue
    if (query !== '' && !searchIndex?.[row].includes(query)) continue
    result[count++] = row
  }
  return result.subarray(0, count)
}
