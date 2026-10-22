import { describe, expect, it } from 'vitest'
import { QUICK_FILTER, buildSearchIndex, filterRows, normalizeQuery, rowsWithIssue } from './filter'
import { ROW_STATUS } from './validation'

const rows = [
  ['C1', 'Anna', 'anna@example.com'],
  ['C2', 'Jonas', 'jonas@mail.de'],
  ['C3', 'ANNETTE', 'a@example.com'],
  ['C4', 'Mia', 'mia@example.com'],
]
const rowStatus = Uint8Array.from([
  ROW_STATUS.VALID,
  ROW_STATUS.FIXABLE,
  ROW_STATUS.MANUAL,
  ROW_STATUS.FIXABLE,
])
const searchIndex = buildSearchIndex(rows)

const run = (quickFilter: (typeof QUICK_FILTER)[keyof typeof QUICK_FILTER], query = '') => [
  ...filterRows({ rowStatus, quickFilter, query: normalizeQuery(query), searchIndex }),
]

describe('filterRows', () => {
  it('applies quick filters', () => {
    expect(run(QUICK_FILTER.ALL)).toEqual([0, 1, 2, 3])
    expect(run(QUICK_FILTER.WITH_ISSUES)).toEqual([1, 2, 3])
    expect(run(QUICK_FILTER.MANUAL)).toEqual([2])
    expect(run(QUICK_FILTER.FIXABLE)).toEqual([1, 3])
    expect(run(QUICK_FILTER.VALID)).toEqual([0])
  })

  it('finds a substring in any column, ignoring case and surrounding spaces', () => {
    expect(run(QUICK_FILTER.ALL, ' ANN ')).toEqual([0, 2])
    expect(run(QUICK_FILTER.ALL, 'mail.de')).toEqual([1])
    expect(run(QUICK_FILTER.ALL, 'c4')).toEqual([3])
  })

  it('combines search and quick filter', () => {
    expect(run(QUICK_FILTER.FIXABLE, 'example')).toEqual([3])
  })

  it('does not match across column boundaries', () => {
    // "C1" + "Anna" must not match "1anna"
    expect(run(QUICK_FILTER.ALL, '1anna')).toEqual([])
  })

  it('returns nothing when nothing matches', () => {
    expect(run(QUICK_FILTER.ALL, 'zzz')).toEqual([])
  })
})

describe('rowsWithIssue', () => {
  it('keeps only rows with the selected issue type', () => {
    const issues = [
      { row: 1, column: 'plan', type: 'plan.format', suggestion: 'pro' },
      { row: 3, column: 'plan', type: 'plan.format', suggestion: 'pro' },
      { row: 2, column: 'email', type: 'email.invalid' },
    ] as const
    const rowMask = rowsWithIssue(issues, 'plan.format', 4)
    const result = filterRows({
      rowStatus,
      quickFilter: QUICK_FILTER.ALL,
      query: '',
      searchIndex,
      rowMask,
    })
    expect([...result]).toEqual([1, 3])
  })
})
