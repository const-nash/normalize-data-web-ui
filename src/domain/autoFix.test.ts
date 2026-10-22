import { describe, expect, it } from 'vitest'
import { applyPatches, findPatch, planAutoFix } from './autoFix'
import { ROW_STATUS, removeIssues, revalidateRows, validateAll } from './validation'

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
const row = (id: string, overrides: Record<string, string> = {}) => {
  const base: Record<string, string> = {
    customer_id: id,
    first_name: 'Anna',
    last_name: 'Muller',
    email: `${id}@example.com`,
    signup_date: '2024-03-15',
    country: 'DE',
    plan: 'pro',
    monthly_spend: '49.90',
  }
  return HEADER.map((column) => overrides[column] ?? base[column])
}

const ROWS = [
  row('C1'),
  row('C2', { country: 'Germany', plan: 'Pro' }), // fixable
  row('C3', { country: 'France', email: 'broken' }), // manual, with one fixable cell
  row('C4', { monthly_spend: '€12' }), // fixable
]
const input = () => {
  const validation = validateAll(HEADER, ROWS)
  return { columns: HEADER, rows: ROWS, ...validation }
}

// All fixable issues of the test rows, one issue type after another
const planAll = (state: ReturnType<typeof input>) =>
  (['country.name', 'plan.format', 'monthly_spend.format'] as const)
    .flatMap((type) => planAutoFix(state, type))
    .toSorted((a, b) => a.row - b.row || a.column - b.column)

describe('planAutoFix', () => {
  it('plans fixes for one issue type, with before and after values', () => {
    const fixes = planAutoFix(input(), 'country.name')
    expect(fixes.map((fix) => [fix.row, fix.before, fix.after])).toEqual([
      [1, 'Germany', 'DE'],
      [2, 'France', 'FR'],
    ])
  })

  it('includes fixable cells of rows that also have manual issues', () => {
    expect(planAutoFix(input(), 'country.name').some((fix) => fix.row === 2)).toBe(true)
  })

  it('plans nothing for manual issue types', () => {
    expect(planAutoFix(input(), 'email.invalid')).toEqual([])
  })
})

describe('findPatch', () => {
  it('finds the patch of a cell by row and column', () => {
    const fixes = planAll(input())
    for (const fix of fixes) expect(findPatch(fixes, fix.row, fix.column)).toBe(fix)
    expect(findPatch(fixes, 0, 0)).toBeUndefined()
    expect(findPatch(fixes, 1, 0)).toBeUndefined()
    expect(findPatch([], 0, 0)).toBeUndefined()
  })
})

describe('applyPatches', () => {
  it('applies patches without mutating the input and undoes them', () => {
    const fixes = planAll(input())
    const applied = applyPatches(ROWS, fixes)
    expect(applied.rows[1][5]).toBe('DE')
    expect(ROWS[1][5]).toBe('Germany')
    expect(applied.rows[0]).toBe(ROWS[0]) // untouched rows are shared
    expect([...applied.changedRows]).toEqual([1, 2, 3])

    const undone = applyPatches(applied.rows, fixes, true)
    expect(undone.rows).toEqual(ROWS)
  })

  it('restores the original value when one cell has several patches', () => {
    const patches = [
      { row: 0, column: 0, before: 'a', after: 'b' },
      { row: 0, column: 0, before: 'b', after: 'c' },
    ]
    const applied = applyPatches([['a']], patches)
    expect(applied.rows[0][0]).toBe('c')
    expect(applyPatches(applied.rows, patches, true).rows[0][0]).toBe('a')
  })
})

describe('revalidateRows', () => {
  it('updates statuses and counts after a fix, keeping manual issues', () => {
    const before = input()
    const { rows, changedRows } = applyPatches(ROWS, planAll(before))
    const after = revalidateRows(HEADER, rows, before, changedRows)

    expect([...after.rowStatus]).toEqual([
      ROW_STATUS.VALID,
      ROW_STATUS.VALID,
      ROW_STATUS.MANUAL,
      ROW_STATUS.VALID,
    ])
    expect(after.issueCounts).toEqual({ 'email.invalid': 1 })
    expect(after.statusCounts).toEqual({ valid: 3, fixable: 0, manual: 1 })
  })

  it('gives the same result as removing the fixed issues', () => {
    const before = input()
    for (const fixes of [planAutoFix(before, 'country.name'), planAll(before)]) {
      const { rows, changedRows } = applyPatches(ROWS, fixes)
      const removed = removeIssues(before, new Set(fixes.map((fix) => fix.issue)))
      expect(removed).toEqual(revalidateRows(HEADER, rows, before, changedRows))
    }
  })

  it('keeps duplicate flags of changed rows', () => {
    const rows = [row('C1'), row('C1', { email: 'x@example.com', plan: 'Pro' })]
    const before = validateAll(HEADER, rows)
    const fixes = planAutoFix({ columns: HEADER, rows, ...before }, 'plan.format')
    const applied = applyPatches(rows, fixes)
    const after = revalidateRows(HEADER, applied.rows, before, applied.changedRows)
    expect(after.issueCounts).toEqual({ 'customer_id.duplicate': 2 })
  })
})
