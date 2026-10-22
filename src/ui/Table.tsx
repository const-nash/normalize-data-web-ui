// Rows are virtualized, positioned divs, so ARIA grid roles replace table tags (see CLAUDE.md)
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import { useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { PROBE_WIDTH, useVisibleColumns } from './useVisibleColumns'
import { VirtualScroller } from './VirtualScroller'

export interface TableColumn<TRow> {
  id: string
  header: ReactNode
  cell: (row: TRow) => ReactNode
  // Extra classes for the cell container, for example to mark an invalid value
  cellClassName?: (row: TRow) => string | undefined
  // Minimum width in Tailwind spacing steps: 32 means the same width as `w-32`
  size?: number
  // Higher numbers stay visible longer when the table gets narrow
  priority?: number
}

interface TableProps<TRow> {
  rowCount: number
  // Row at a position in the current view, so callers can pass filtered or sorted views
  getRow: (index: number) => TRow
  columns: ReadonlyArray<TableColumn<TRow>>
  label: string
  // Row height in Tailwind spacing steps
  rowSize?: number
  className?: string
}

const DEFAULT_COLUMN_SIZE = 32

const spacing = (steps: number) => `calc(var(--spacing) * ${steps})`

// Generic virtualized grid. Knows nothing about the row type it renders.
export function Table<TRow>({
  rowCount,
  getRow,
  columns,
  label,
  rowSize = 12,
  className,
}: TableProps<TRow>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const probeRef = useRef<HTMLDivElement>(null)

  const sized = columns.map((column) => ({
    size: column.size ?? DEFAULT_COLUMN_SIZE,
    priority: column.priority ?? 0,
  }))
  const visibleIndices = useVisibleColumns(sized, containerRef, probeRef)
  const visible = visibleIndices.map((index) => columns[index])
  const sizes = visibleIndices.map((index) => sized[index].size)

  const layout: CSSProperties = {
    gridTemplateColumns: sizes.map((size) => `minmax(${spacing(size)}, 1fr)`).join(' '),
    minWidth: spacing(sizes.reduce((sum, size) => sum + size, 0)),
  }

  const header = (
    <div
      role="row"
      aria-rowindex={1}
      className="sticky top-0 z-10 grid border-b border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
      style={{ ...layout, height: spacing(rowSize) }}
    >
      {visible.map((column) => (
        <div key={column.id} role="columnheader" className="flex min-w-0 items-center px-4">
          <span className="truncate">{column.header}</span>
        </div>
      ))}
    </div>
  )

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <div
        ref={probeRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute"
        style={{ width: PROBE_WIDTH }}
      />
      <VirtualScroller
        role="grid"
        aria-label={label}
        aria-rowcount={rowCount + 1}
        aria-colcount={visible.length}
        count={rowCount}
        itemSize={rowSize}
        header={header}
        className="h-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        renderItem={({ index, style }) => (
          <div
            role="row"
            aria-rowindex={index + 2}
            className="grid border-b border-zinc-100 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40"
            style={{ ...layout, ...style }}
          >
            {visible.map((column) => {
              const row = getRow(index)
              return (
                <div
                  key={column.id}
                  role="gridcell"
                  className={`flex min-w-0 items-center px-4 ${column.cellClassName?.(row) ?? ''}`}
                >
                  {column.cell(row)}
                </div>
              )
            })}
          </div>
        )}
      />
    </div>
  )
}
