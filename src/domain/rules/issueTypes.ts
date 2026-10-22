import { ISSUE_TEXT } from '../../constants/errorMessages'
import type { CustomerColumn } from '../customer'

export type IssueId = keyof typeof ISSUE_TEXT

// safe: can be applied automatically; suggested: needs confirmation; manual: needs user input
export type FixKind = 'safe' | 'suggested' | 'manual'

export interface IssueType {
  id: IssueId
  column: CustomerColumn
  title: string
  explanation: string
  example: string
  fixKind: FixKind
}

// One issue found in one cell. `suggestion` is the proposed value for safe and suggested fixes.
export interface CellIssue {
  type: IssueId
  suggestion?: string
}

const define = (id: IssueId, example: string, fixKind: FixKind): IssueType => ({
  id,
  column: id.slice(0, id.indexOf('.')) as CustomerColumn,
  ...ISSUE_TEXT[id],
  example,
  fixKind,
})

const TYPES: IssueType[] = [
  define('customer_id.missing', 'C10023', 'manual'),
  define('customer_id.whitespace', 'C10023', 'safe'),
  // Found across rows by the duplicate index, not by a cell rule
  define('customer_id.duplicate', 'C10023', 'manual'),
  define('first_name.missing', 'Anna', 'manual'),
  define('first_name.whitespace', 'Anna', 'safe'),
  define('last_name.missing', 'Müller', 'manual'),
  define('last_name.whitespace', 'Müller', 'safe'),
  define('email.missing', 'anna@example.com', 'manual'),
  define('email.whitespace', 'anna@example.com', 'safe'),
  define('email.invalid', 'anna@example.com', 'manual'),
  // Found across rows by the duplicate index, not by a cell rule
  define('email.duplicate', 'anna@example.com', 'manual'),
  define('signup_date.missing', '2024-03-15', 'manual'),
  define('signup_date.format', '2024-03-15', 'safe'),
  define('signup_date.ambiguous', '2024-03-15', 'suggested'),
  define('signup_date.impossible', '2024-03-15', 'manual'),
  define('signup_date.unrecognized', '2024-03-15', 'manual'),
  define('country.missing', 'DE', 'manual'),
  define('country.format', 'DE', 'safe'),
  define('country.name', 'DE', 'suggested'),
  define('country.unknown', 'DE', 'manual'),
  define('plan.missing', 'pro', 'manual'),
  define('plan.format', 'pro', 'safe'),
  define('plan.unknown', 'pro', 'manual'),
  define('monthly_spend.missing', '49.90', 'manual'),
  define('monthly_spend.format', '49.90', 'safe'),
  define('monthly_spend.separator', '1234.50', 'suggested'),
  define('monthly_spend.negative', '0', 'manual'),
  define('monthly_spend.invalid', '49.90', 'manual'),
]

export const ISSUE_TYPES = Object.fromEntries(TYPES.map((type) => [type.id, type])) as Record<
  IssueId,
  IssueType
>
