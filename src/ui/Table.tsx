// Rows are virtualized, positioned divs, so ARIA grid roles replace table tags (see CLAUDE.md)
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import type { CSSProperties, ReactNode } from 'react'
import { VirtualScroller } from './VirtualScroller'

export interface TableColumn<TRow> {
  id: string
  header: ReactNode
  cell: (row: TRow) => ReactNode
  // Minimum width in Tailwind spacing steps: 36 means the same width as `w-36`
  size?: number
}

interface TableProps<TRow> {
  rows: readonly TRow[]
  columns: ReadonlyArray<TableColumn<TRow>>
  label: string
  // Row height in Tailwind spacing steps
  rowSize?: number
  className?: string
}

const DEFAULT_COLUMN_SIZE = 36

// Generic virtualized grid. Knows nothing about the row type it renders.
export function Table<TRow>({ rows, columns, label, rowSize = 8, className }: TableProps<TRow>) {
  const sizes = columns.map((column) => column.size ?? DEFAULT_COLUMN_SIZE)
  const layout: CSSProperties = {
    gridTemplateColumns: sizes
      .map((size) => `minmax(calc(var(--spacing) * ${size}), 1fr)`)
      .join(' '),
    minWidth: `calc(var(--spacing) * ${sizes.reduce((sum, size) => sum + size, 0)})`,
  }

  const header = (
    <div
      role="row"
      aria-rowindex={1}
      className="sticky top-0 z-10 grid border-b border-zinc-200 bg-zinc-50 text-sm font-semibold dark:border-zinc-800 dark:bg-zinc-800"
      style={layout}
    >
      {columns.map((column) => (
        <div key={column.id} role="columnheader" className="truncate px-3 py-2">
          {column.header}
        </div>
      ))}
    </div>
  )

  return (
    <VirtualScroller
      role="grid"
      aria-label={label}
      aria-rowcount={rows.length + 1}
      aria-colcount={columns.length}
      count={rows.length}
      itemSize={rowSize}
      header={header}
      className={`rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 ${className ?? ''}`}
      renderItem={({ index, style }) => (
        <div
          role="row"
          aria-rowindex={index + 2}
          className="grid border-b border-zinc-100 text-sm dark:border-zinc-800/60"
          style={{ ...layout, ...style }}
        >
          {columns.map((column) => (
            <div key={column.id} role="gridcell" className="flex min-w-0 items-center px-3">
              <span className="truncate">{column.cell(rows[index])}</span>
            </div>
          ))}
        </div>
      )}
    />
  )
}
