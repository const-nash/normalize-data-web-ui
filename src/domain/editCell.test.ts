import { describe, expect, it } from 'vitest'
import { buildDuplicateIndexes, editCell } from './editCell'
import { ROW_STATUS, validateAll } from './validation'
import type { Row } from './validation'

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
const COL = Object.fromEntries(HEADER.map((name, i) => [name, i]))
const row = (id: string, email = `${id}@example.com`) => [
  id,
  'Anna',
  'Muller',
  email,
  '2024-03-15',
  'DE',
  'pro',
  '49.90',
]

// editCell returns null only for unchanged values, which these tests do not use
function edited<T>(result: T | null): T {
  if (result === null) throw new Error('Expected a change')
  return result
}

function setup(rows: Row[]) {
  return {
    header: HEADER,
    rows,
    validation: validateAll(HEADER, rows),
    indexes: buildDuplicateIndexes(HEADER, rows),
  }
}

describe('editCell', () => {
  it('revalidates the edited cell and updates counts by difference', () => {
    const state = setup([row('C1'), row('C2')])
    const broken = edited(editCell(state, 1, COL.country, 'Atlantis'))
    expect(broken.patch).toEqual({ row: 1, column: COL.country, before: 'DE', after: 'Atlantis' })
    expect(broken.rows[1][COL.country]).toBe('Atlantis')
    expect(broken.validation.issueCounts).toEqual({ 'country.unknown': 1 })
    expect(broken.validation.statusCounts).toEqual({ valid: 1, fixable: 0, manual: 1 })
    expect(broken.validation.rowStatus[1]).toBe(ROW_STATUS.MANUAL)

    const fixed = edited(editCell({ ...state, ...broken }, 1, COL.country, 'FR'))
    expect(fixed.validation.issueCounts).toEqual({})
    expect(fixed.validation.statusCounts).toEqual({ valid: 2, fixable: 0, manual: 0 })
  })

  it('keeps issue offsets consistent with the full validation', () => {
    const rows = [row('C1'), row('C2'), row('C3')]
    const state = setup(rows)
    const edits: Array<[number, string, string]> = [
      [0, 'plan', 'Pro'],
      [2, 'country', 'Germany'],
      [0, 'monthly_spend', 'abc'],
      [0, 'plan', 'pro'],
    ]
    for (const [r, column, value] of edits) {
      Object.assign(state, edited(editCell(state, r, COL[column], value)))
    }
    expect(state.validation).toEqual(validateAll(HEADER, state.rows))
  })

  it('creates and resolves duplicates through the index', () => {
    let state = setup([row('C1'), row('C2'), row('C3')])

    const dup = edited(editCell(state, 2, COL.email, ' C1@EXAMPLE.com'))
    state = { ...state, ...dup }
    expect(state.validation.issueCounts).toEqual({ 'email.duplicate': 2 })
    expect([...state.validation.rowStatus]).toEqual([
      ROW_STATUS.MANUAL,
      ROW_STATUS.VALID,
      ROW_STATUS.MANUAL,
    ])

    const resolved = edited(editCell(state, 2, COL.email, 'c3@example.com'))
    state = { ...state, ...resolved }
    expect(state.validation.issueCounts).toEqual({})
    expect(state.validation).toEqual(validateAll(HEADER, state.rows))
  })

  it('handles a group of three where one row leaves', () => {
    let state = setup([row('C1'), row('C1', 'b@example.com'), row('C1', 'c@example.com')])
    expect(state.validation.issueCounts['customer_id.duplicate']).toBe(3)
    state = { ...state, ...edited(editCell(state, 1, COL.customer_id, 'C9')) }
    expect(state.validation).toEqual(validateAll(HEADER, state.rows))
    expect(state.validation.issueCounts['customer_id.duplicate']).toBe(2)
  })

  it('returns null when the value does not change', () => {
    expect(editCell(setup([row('C1')]), 0, COL.plan, 'pro')).toBeNull()
  })

  it('edits columns the spec does not know without validating them', () => {
    const header = [...HEADER, 'notes']
    const rows = [[...row('C1'), 'x']]
    const state = {
      header,
      rows,
      validation: validateAll(header, rows),
      indexes: buildDuplicateIndexes(header, rows),
    }
    const result = edited(editCell(state, 0, 8, 'anything'))
    expect(result.rows[0][8]).toBe('anything')
    expect(result.validation.issueCounts).toEqual({})
  })
})
