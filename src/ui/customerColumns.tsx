import type { CustomerColumn } from '../domain/customer'
import type { Row } from '../worker/protocol'
import type { TableColumn } from './Table'

interface ColumnLayout {
  // Minimum width in spacing steps
  size: number
  // Higher stays visible longer
  priority: number
}

const LAYOUT: Record<CustomerColumn, ColumnLayout> = {
  customer_id: { size: 28, priority: 100 },
  email: { size: 52, priority: 90 },
  first_name: { size: 32, priority: 80 },
  last_name: { size: 32, priority: 70 },
  country: { size: 28, priority: 60 },
  plan: { size: 24, priority: 50 },
  monthly_spend: { size: 32, priority: 40 },
  signup_date: { size: 32, priority: 30 },
}

// Columns the spec does not know stay visible only while there is room
const UNKNOWN_COLUMN: ColumnLayout = { size: 32, priority: 0 }

const layoutFor = (name: string) =>
  LAYOUT[name.trim().toLowerCase() as CustomerColumn] ?? UNKNOWN_COLUMN

// Builds table columns from the file header, in file order. Rows stay positional arrays.
export function columnsForHeader(header: readonly string[]): Array<TableColumn<Row>> {
  return header.map((name, index) => {
    const { size, priority } = layoutFor(name)
    return {
      id: `${index}:${name}`,
      header: name,
      cell: (row) => row[index] ?? '',
      size,
      priority,
    }
  })
}
