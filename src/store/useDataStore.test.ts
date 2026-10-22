import { beforeEach, describe, expect, it } from 'vitest'
import { QUICK_FILTER } from '../domain/filter'
import { validateAll } from '../domain/validation'
import { dataStore } from './useDataStore'

const HEADER = [
  'customer_id',
  'first_name',
  'last_name',
  'email',
  'signup_date',
  'country',
  'plan',
  'monthly_spend',
]
const row = (id: string, name: string, country: string) => [
  id,
  name,
  'Muller',
  `${id}@example.com`,
  '2024-03-15',
  country,
  'pro',
  '49.90',
]
const ROWS = [
  row('C1', 'John', 'Germany'),
  row('C2', 'Anna', 'Germany'),
  row('C3', 'John', 'France'),
  row('C4', 'Mia', 'DE'),
]

const state = () => dataStore.getState()

beforeEach(() => {
  state().reset()
  dataStore.setState({
    dataset: {
      fileName: 'test.csv',
      columns: HEADER,
      rows: ROWS,
      changed: new Uint8Array(ROWS.length * HEADER.length),
      ...validateAll(HEADER, ROWS),
    },
  })
  state().setSearch('')
})

describe('search scope', () => {
  it('counts the overview only for rows matching the search', () => {
    expect(state().scope).toBeNull()
    state().setSearch('john')
    expect(state().scope).toEqual({
      rowCount: 2,
      statusCounts: { valid: 0, fixable: 2, manual: 0 },
      issueCounts: { 'country.name': 2 },
    })
  })

  it('applies an automatic fix only to rows matching the search', () => {
    state().setSearch('john')
    expect(state().applyAutoFix('country.name')).toBe(2)
    const rows = state().dataset?.rows ?? []
    expect(rows.map((r) => r[5])).toEqual(['DE', 'Germany', 'FR', 'DE'])
    expect(state().dataset?.issueCounts).toEqual({ 'country.name': 1 })
  })

  it('applies to all rows when the search is empty', () => {
    expect(state().applyAutoFix('country.name')).toBe(3)
  })
})

describe('quick filter and overview selection', () => {
  it('selecting an issue type resets the quick filter to all rows', () => {
    state().setQuickFilter(QUICK_FILTER.VALID)
    state().setIssueType('country.name')
    expect(state().quickFilter).toBe(QUICK_FILTER.ALL)
    expect([...state().visibleRows]).toEqual([0, 1, 2])
  })

  it('changing the quick filter clears the selected issue type', () => {
    state().setIssueType('country.name')
    state().setQuickFilter(QUICK_FILTER.WITH_ISSUES)
    expect(state().issueType).toBeNull()
  })

  it('a search without rows of the selected type clears the selection', () => {
    state().setIssueType('country.name')
    state().setSearch('mia')
    expect(state().issueType).toBeNull()
  })
})
