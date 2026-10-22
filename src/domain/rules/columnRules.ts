import type { CustomerColumn } from '../customer'
import { parseAmount } from './amounts'
import { matchCountry } from './countries'
import { parseDate } from './dates'
import type { CellIssue } from './issueTypes'

// Validation rules per column (see the column table in CLAUDE.md). Each rule takes a raw cell
// value and returns the most important issue, or null when the value is fine. Rules never
// mutate input. Uniqueness of customer_id and email is checked across rows by the duplicate
// index, not here.

type ColumnRule = (value: string) => CellIssue | null

export const PLANS = ['free', 'pro', 'enterprise'] as const

const EMAIL = /^[^\s@]+@(?:[^\s@.]+\.)+[^\s@.]{2,}$/
const plans = new Set<string>(PLANS)

// Shared rule for required text: missing when empty after trimming, safe fix for padding
function requiredText(column: 'customer_id' | 'first_name' | 'last_name'): ColumnRule {
  return (value) => {
    const trimmed = value.trim()
    if (trimmed === '') return { type: `${column}.missing` }
    if (trimmed !== value) return { type: `${column}.whitespace`, suggestion: trimmed }
    return null
  }
}

export const COLUMN_RULES: Record<CustomerColumn, ColumnRule> = {
  customer_id: requiredText('customer_id'),
  first_name: requiredText('first_name'),
  last_name: requiredText('last_name'),

  email(value) {
    const trimmed = value.trim()
    if (trimmed === '') return { type: 'email.missing' }
    if (!EMAIL.test(trimmed)) return { type: 'email.invalid' }
    if (trimmed !== value) return { type: 'email.whitespace', suggestion: trimmed }
    return null
  },

  signup_date(value) {
    if (value.trim() === '') return { type: 'signup_date.missing' }
    const date = parseDate(value)
    switch (date.kind) {
      case 'valid':
        return null
      case 'convertible':
        return date.ambiguous
          ? { type: 'signup_date.ambiguous', suggestion: date.value }
          : { type: 'signup_date.format', suggestion: date.value }
      case 'impossible':
        return { type: 'signup_date.impossible' }
      case 'unrecognized':
        return { type: 'signup_date.unrecognized' }
    }
  },

  country(value) {
    if (value.trim() === '') return { type: 'country.missing' }
    const match = matchCountry(value)
    switch (match.kind) {
      case 'valid':
        return null
      case 'code':
        return { type: 'country.format', suggestion: match.code }
      case 'name':
        return { type: 'country.name', suggestion: match.code }
      case 'unknown':
        return { type: 'country.unknown' }
    }
  },

  plan(value) {
    const key = value.trim().toLowerCase()
    if (key === '') return { type: 'plan.missing' }
    if (!plans.has(key)) return { type: 'plan.unknown' }
    if (key !== value) return { type: 'plan.format', suggestion: key }
    return null
  },

  monthly_spend(value) {
    if (value.trim() === '') return { type: 'monthly_spend.missing' }
    const amount = parseAmount(value)
    switch (amount.kind) {
      case 'valid':
        return null
      case 'cleaned':
        return { type: 'monthly_spend.format', suggestion: amount.value }
      case 'separator':
        return { type: 'monthly_spend.separator', suggestion: amount.value }
      case 'negative':
        return { type: 'monthly_spend.negative' }
      case 'invalid':
        return { type: 'monthly_spend.invalid' }
    }
  },
}

export const validateCell = (column: CustomerColumn, value: string) => COLUMN_RULES[column](value)
