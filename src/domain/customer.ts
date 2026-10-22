// Raw values as they come from the file. Validation and normalization work on these strings.
export interface CustomerRow {
  customer_id: string
  first_name: string
  last_name: string
  email: string
  signup_date: string
  country: string
  plan: string
  monthly_spend: string
}

export type CustomerColumn = keyof CustomerRow

export const CUSTOMER_COLUMNS: readonly CustomerColumn[] = [
  'customer_id',
  'first_name',
  'last_name',
  'email',
  'signup_date',
  'country',
  'plan',
  'monthly_spend',
]
