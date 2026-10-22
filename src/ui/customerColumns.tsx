import { CUSTOMER_COLUMNS } from '../domain/customer'
import type { CustomerColumn, CustomerRow } from '../domain/customer'
import type { TableColumn } from './Table'

// size: minimum width in spacing steps; priority: higher stays visible longer
const LAYOUT: Record<CustomerColumn, { size: number; priority: number }> = {
  customer_id: { size: 28, priority: 100 },
  email: { size: 52, priority: 90 },
  first_name: { size: 32, priority: 80 },
  last_name: { size: 32, priority: 70 },
  country: { size: 28, priority: 60 },
  plan: { size: 24, priority: 50 },
  monthly_spend: { size: 32, priority: 40 },
  signup_date: { size: 32, priority: 30 },
}

export const customerColumns: Array<TableColumn<CustomerRow>> = CUSTOMER_COLUMNS.map((key) => ({
  id: key,
  header: key,
  cell: (row) => row[key],
  size: LAYOUT[key].size,
  priority: LAYOUT[key].priority,
}))
