import { mapColumns, findCellIssue } from '../domain/validation'
import type { CustomerColumn } from '../domain/customer'
import { originalValue } from '../store/useDataStore'
import type { DataState, Dataset } from '../store/useDataStore'
import { IssueCell } from './IssueCell'
import { issueCellClass } from './issueCellClass'
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

// Builds table columns from the file header, in file order. A table row is a row index into
// the dataset, so a cell can look up both its value and its issue.
export function columnsForDataset(
  dataset: Dataset,
  history: DataState['history'],
): Array<TableColumn<number>> {
  const { rows, columns, issues, issueOffsets, changed } = dataset
  const width = columns.length
  const specColumnAt = new Map<number, CustomerColumn>()
  for (const [column, index] of mapColumns(columns).positions) specColumnAt.set(index, column)

  return columns.map((name, index) => {
    const specColumn = specColumnAt.get(index)
    const { size, priority } = specColumn ? LAYOUT[specColumn] : UNKNOWN_COLUMN
    const issueAt = (row: number) =>
      specColumn ? findCellIssue(issues, issueOffsets, row, specColumn) : undefined

    return {
      id: `${index}:${name}`,
      header: name,
      cell: (row) => (
        <IssueCell
          value={rows[row][index] ?? ''}
          issue={issueAt(row)}
          original={changed[row * width + index] ? originalValue(history, row, index) : undefined}
        />
      ),
      cellClassName: (row) => issueCellClass(issueAt(row), changed[row * width + index] === 1),
      size,
      priority,
    }
  })
}
