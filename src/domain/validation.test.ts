import { describe, expect, it } from 'vitest'
import { buildDuplicateIndex, duplicateRows, normalizeEmail } from './rules/duplicates'
import { ROW_STATUS, findCellIssue, mapColumns, validateAll, validateRows } from './validation'

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
const VALID = ['C1', 'Anna', 'Muller', 'anna@example.com', '2024-03-15', 'DE', 'pro', '49.90']

const withCell = (base: string[], column: string, value: string) =>
  base.map((cell, i) => (HEADER[i] === column ? value : cell))

describe('validateRows', () => {
  it('marks rows without issues as valid', () => {
    const result = validateAll(HEADER, [VALID])
    expect(result.issues).toEqual([])
    expect([...result.rowStatus]).toEqual([ROW_STATUS.VALID])
    expect(result.statusCounts).toEqual({ valid: 1, fixable: 0, manual: 0 })
    expect(result.missingColumns).toEqual([])
  })

  it('marks rows where every issue has a suggestion as fixable, with the planned change', () => {
    const row = withCell(withCell(VALID, 'country', 'Germany'), 'plan', 'Pro')
    const result = validateAll(HEADER, [row])
    expect(result.rowStatus[0]).toBe(ROW_STATUS.FIXABLE)
    expect(result.issues).toEqual([
      { row: 0, column: 'country', type: 'country.name', suggestion: 'DE' },
      { row: 0, column: 'plan', type: 'plan.format', suggestion: 'pro' },
    ])
  })

  it('marks a row as manual when any issue needs user input', () => {
    const row = withCell(withCell(VALID, 'plan', 'Pro'), 'email', 'not-an-email')
    const result = validateAll(HEADER, [row])
    expect(result.rowStatus[0]).toBe(ROW_STATUS.MANUAL)
    expect(result.issueCounts).toEqual({ 'plan.format': 1, 'email.invalid': 1 })
  })

  it('flags every row of a duplicate group, comparing emails trimmed and case-insensitive', () => {
    const rows = [
      VALID,
      withCell(withCell(VALID, 'customer_id', 'C2'), 'email', ' ANNA@example.com'),
      withCell(withCell(VALID, 'customer_id', 'C3'), 'email', 'other@example.com'),
    ]
    const result = validateAll(HEADER, rows)
    expect(result.issues).toEqual([
      { row: 0, column: 'email', type: 'email.duplicate' },
      { row: 1, column: 'email', type: 'email.duplicate' },
    ])
    expect([...result.rowStatus]).toEqual([ROW_STATUS.MANUAL, ROW_STATUS.MANUAL, ROW_STATUS.VALID])
  })

  it('reports duplicate customer IDs', () => {
    const result = validateAll(HEADER, [VALID, withCell(VALID, 'email', 'b@example.com')])
    expect(result.issueCounts['customer_id.duplicate']).toBe(2)
  })

  it('keeps a missing value instead of reporting it as a duplicate', () => {
    const empty = withCell(VALID, 'customer_id', '')
    const result = validateAll(HEADER, [empty, withCell(empty, 'email', 'b@example.com')])
    expect(result.issueCounts).toEqual({ 'customer_id.missing': 2 })
  })

  it('reports columns missing from the file once, not per row', () => {
    const header = HEADER.filter((name) => name !== 'plan')
    const row = VALID.filter((_, i) => HEADER[i] !== 'plan')
    const result = validateAll(header, [row, row.map((cell) => cell)])
    expect(result.missingColumns).toEqual(['plan'])
    expect(result.issues.some((issue) => issue.column === 'plan')).toBe(false)
  })

  it('treats cells missing from a short row as empty', () => {
    const result = validateAll(HEADER, [VALID.slice(0, 6)])
    expect(result.issueCounts).toEqual({ 'plan.missing': 1, 'monthly_spend.missing': 1 })
  })

  it('yields progress while working', () => {
    const rows = Array.from({ length: 10 }, (_, i) => withCell(VALID, 'customer_id', `C${i}`))
    const progress: number[] = []
    const generator = validateRows(
      HEADER,
      rows.map((row, i) => withCell(row, 'email', `${i}@x.com`)),
      4,
    )
    let step = generator.next()
    while (!step.done) {
      progress.push(step.value)
      step = generator.next()
    }
    expect(progress).toEqual([4, 8])
    expect(step.value.statusCounts.valid).toBe(10)
  })
})

describe('findCellIssue', () => {
  it('finds the issue of a cell through the row offsets', () => {
    const rows = [
      withCell(VALID, 'plan', 'Pro'),
      withCell(VALID, 'customer_id', 'C2'),
      withCell(withCell(VALID, 'customer_id', 'C3'), 'country', 'Germany'),
    ].map((row, i) => withCell(row, 'email', `${i}@example.com`))
    const { issues, issueOffsets } = validateAll(HEADER, rows)
    expect([...issueOffsets]).toEqual([0, 1, 1, 2])
    expect(findCellIssue(issues, issueOffsets, 0, 'plan')?.suggestion).toBe('pro')
    expect(findCellIssue(issues, issueOffsets, 1, 'plan')).toBeUndefined()
    expect(findCellIssue(issues, issueOffsets, 2, 'country')?.type).toBe('country.name')
    expect(findCellIssue(issues, issueOffsets, 2, 'plan')).toBeUndefined()
  })
})

describe('mapColumns', () => {
  it('matches names trimmed and case-insensitive, in any order, ignoring unknown columns', () => {
    const { positions, missing } = mapColumns([' Email ', 'extra', 'CUSTOMER_ID'])
    expect(positions.get('email')).toBe(0)
    expect(positions.get('customer_id')).toBe(2)
    expect(missing).not.toContain('email')
    expect(missing).toContain('plan')
  })
})

describe('duplicate index', () => {
  it('groups rows by normalized value and skips empty values', () => {
    const index = buildDuplicateIndex(['a@x.com', '', 'A@X.com ', 'b@x.com', ''], normalizeEmail)
    expect(index.get('a@x.com')).toEqual([0, 2])
    expect(index.has('')).toBe(false)
    expect([...duplicateRows(index)]).toEqual([0, 2])
  })
})
