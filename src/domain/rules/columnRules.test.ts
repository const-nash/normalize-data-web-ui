import { describe, expect, it } from 'vitest'
import { ISSUE_TEXT } from '../../constants/errorMessages'
import { CUSTOMER_COLUMNS } from '../customer'
import type { CustomerColumn } from '../customer'
import { validateCell } from './columnRules'
import { COUNTRY_CODES } from './countries'
import { isRealDate } from './dates'
import { ISSUE_TYPES } from './issueTypes'
import type { CellIssue } from './issueTypes'

type Case = [value: string, expected: CellIssue | null]

const cases: Record<CustomerColumn, Case[]> = {
  customer_id: [
    ['C10023', null],
    ['', { type: 'customer_id.missing' }],
    ['   ', { type: 'customer_id.missing' }],
    [' C10023 ', { type: 'customer_id.whitespace', suggestion: 'C10023' }],
  ],
  first_name: [
    ['Anna', null],
    ['', { type: 'first_name.missing' }],
    [' Anna', { type: 'first_name.whitespace', suggestion: 'Anna' }],
  ],
  last_name: [
    ['Müller', null],
    ['\t', { type: 'last_name.missing' }],
    ['Müller ', { type: 'last_name.whitespace', suggestion: 'Müller' }],
  ],
  email: [
    ['anna@example.com', null],
    ['anna.m+tag@mail.example.co.uk', null],
    ['', { type: 'email.missing' }],
    [' anna@example.com ', { type: 'email.whitespace', suggestion: 'anna@example.com' }],
    ['not-an-email', { type: 'email.invalid' }],
    ['anna@example', { type: 'email.invalid' }],
    ['anna@@example.com', { type: 'email.invalid' }],
    ['an na@example.com', { type: 'email.invalid' }],
  ],
  signup_date: [
    ['2024-03-15', null],
    ['2024-02-29', null],
    ['', { type: 'signup_date.missing' }],
    [' 2024-03-15', { type: 'signup_date.format', suggestion: '2024-03-15' }],
    ['2024/3/5', { type: 'signup_date.format', suggestion: '2024-03-05' }],
    ['15/03/2024', { type: 'signup_date.format', suggestion: '2024-03-15' }],
    ['03/15/2024', { type: 'signup_date.format', suggestion: '2024-03-15' }],
    ['15.03.2024', { type: 'signup_date.format', suggestion: '2024-03-15' }],
    ['05/05/2024', { type: 'signup_date.format', suggestion: '2024-05-05' }],
    ['03/04/2024', { type: 'signup_date.ambiguous', suggestion: '2024-04-03' }],
    ['2024-02-30', { type: 'signup_date.impossible' }],
    ['2023-02-29', { type: 'signup_date.impossible' }],
    ['31/04/2024', { type: 'signup_date.impossible' }],
    ['2024-13-01', { type: 'signup_date.impossible' }],
    ['March 3, 2024', { type: 'signup_date.unrecognized' }],
    ['24-03-15', { type: 'signup_date.unrecognized' }],
  ],
  country: [
    ['DE', null],
    ['', { type: 'country.missing' }],
    ['de', { type: 'country.format', suggestion: 'DE' }],
    [' FR ', { type: 'country.format', suggestion: 'FR' }],
    ['U.S.', { type: 'country.format', suggestion: 'US' }],
    ['Germany', { type: 'country.name', suggestion: 'DE' }],
    ['Deutschland', { type: 'country.name', suggestion: 'DE' }],
    ['españa', { type: 'country.name', suggestion: 'ES' }],
    ['Espana', { type: 'country.name', suggestion: 'ES' }],
    ['United Kingdom', { type: 'country.name', suggestion: 'GB' }],
    ['USA', { type: 'country.name', suggestion: 'US' }],
    ['Czech Republic', { type: 'country.name', suggestion: 'CZ' }],
    ['Atlantis', { type: 'country.unknown' }],
    ['XX', { type: 'country.unknown' }],
    ['EU', { type: 'country.unknown' }],
    ['UK', { type: 'country.name', suggestion: 'GB' }],
    ['SU', { type: 'country.unknown' }],
  ],
  plan: [
    ['pro', null],
    ['', { type: 'plan.missing' }],
    ['Pro', { type: 'plan.format', suggestion: 'pro' }],
    [' FREE ', { type: 'plan.format', suggestion: 'free' }],
    ['premium', { type: 'plan.unknown' }],
  ],
  monthly_spend: [
    ['0', null],
    ['49.90', null],
    ['120', null],
    ['', { type: 'monthly_spend.missing' }],
    ['€49', { type: 'monthly_spend.format', suggestion: '49' }],
    ['49.90 EUR', { type: 'monthly_spend.format', suggestion: '49.90' }],
    ['$ 12.5', { type: 'monthly_spend.format', suggestion: '12.5' }],
    ['1,5', { type: 'monthly_spend.separator', suggestion: '1.5' }],
    ['49,90 €', { type: 'monthly_spend.separator', suggestion: '49.90' }],
    ['1,234.50', { type: 'monthly_spend.separator', suggestion: '1234.50' }],
    ['1.234,56', { type: 'monthly_spend.separator', suggestion: '1234.56' }],
    ['-5', { type: 'monthly_spend.negative' }],
    ['-€5', { type: 'monthly_spend.negative' }],
    ['-1,5', { type: 'monthly_spend.negative' }],
    ['abc', { type: 'monthly_spend.invalid' }],
    ['12.5.3', { type: 'monthly_spend.invalid' }],
  ],
}

describe('column rules', () => {
  for (const column of CUSTOMER_COLUMNS) {
    describe(column, () => {
      it.each(cases[column])('%j', (value, expected) => {
        expect(validateCell(column, value)).toEqual(expected)
      })
    })
  }

  it('returns only issue types of its own column', () => {
    for (const column of CUSTOMER_COLUMNS) {
      for (const [value] of cases[column]) {
        const issue = validateCell(column, value)
        if (issue) expect(ISSUE_TYPES[issue.type].column).toBe(column)
      }
    }
  })

  it('gives a suggestion exactly for safe and suggested fixes', () => {
    for (const column of CUSTOMER_COLUMNS) {
      for (const [value] of cases[column]) {
        const issue = validateCell(column, value)
        if (!issue) continue
        const fixable = ISSUE_TYPES[issue.type].fixKind !== 'manual'
        expect(issue.suggestion !== undefined, `${column} "${value}"`).toBe(fixable)
      }
    }
  })

  it('suggests values that pass the rule', () => {
    for (const column of CUSTOMER_COLUMNS) {
      for (const [value] of cases[column]) {
        const suggestion = validateCell(column, value)?.suggestion
        if (suggestion !== undefined) expect(validateCell(column, suggestion)).toBeNull()
      }
    }
  })
})

describe('issue catalog', () => {
  it('defines every issue text once, with a known column and a valid example', () => {
    expect(Object.keys(ISSUE_TYPES).toSorted()).toEqual(Object.keys(ISSUE_TEXT).toSorted())
    for (const type of Object.values(ISSUE_TYPES)) {
      expect(CUSTOMER_COLUMNS).toContain(type.column)
      expect(validateCell(type.column, type.example), type.id).toBeNull()
    }
  })
})

describe('country codes', () => {
  it('contains exactly the 249 ISO 3166-1 alpha-2 codes', () => {
    expect(COUNTRY_CODES.size).toBe(249)
  })
})

describe('isRealDate', () => {
  it('knows leap years', () => {
    expect(isRealDate(2000, 2, 29)).toBe(true)
    expect(isRealDate(1900, 2, 29)).toBe(false)
    expect(isRealDate(2024, 2, 29)).toBe(true)
    expect(isRealDate(2023, 2, 29)).toBe(false)
  })
})
