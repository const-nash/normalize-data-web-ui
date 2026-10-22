import { CUSTOMER_COLUMNS } from '../domain/customer'
import type { CustomerRow } from '../domain/customer'
import type { TableColumn } from './Table'

const SIZES: Partial<Record<keyof CustomerRow, number>> = {
  customer_id: 28,
  email: 56,
  plan: 24,
  monthly_spend: 32,
}

export const customerColumns: Array<TableColumn<CustomerRow>> = CUSTOMER_COLUMNS.map((key) => ({
  id: key,
  header: key,
  cell: (row) => row[key],
  size: SIZES[key],
}))
