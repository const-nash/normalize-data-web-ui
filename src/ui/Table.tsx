// Rows are virtualized, positioned divs, so ARIA grid roles replace table tags (see CLAUDE.md)
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { PROBE_WIDTH, useVisibleColumns } from './useVisibleColumns'
import { VirtualScroller } from './VirtualScroller'
import type { VirtualScrollerHandle } from './VirtualScroller'

export interface TableColumn<TRow> {
  id: string
  header: ReactNode
  cell: (row: TRow) => ReactNode
  // Extra classes for the cell container, for example to mark an invalid value
  cellClassName?: (row: TRow) => string | undefined
  // Makes the column editable. `close` ends editing and returns focus to the cell.
  renderEditor?: (row: TRow, close: () => void) => ReactNode
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

// Shown on hover, and on the focused cell for keyboard and touch. Enter or F2 also edits.
function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label="Edit cell"
      title="Edit"
      onClick={onClick}
      className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md bg-white/95 text-zinc-500 opacity-0 shadow-sm ring-1 ring-zinc-200 transition-opacity group-hover:opacity-100 group-focus:opacity-100 hover:text-indigo-600 focus-visible:opacity-100 dark:bg-zinc-800/95 dark:text-zinc-400 dark:ring-zinc-700 dark:hover:text-indigo-400"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </button>
  )
}

const DEFAULT_COLUMN_SIZE = 32
const PAGE_ROWS = 10

interface CellPosition {
  // Position in the current view and among visible columns
  row: number
  col: number
}

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
  const scrollerRef = useRef<VirtualScrollerHandle>(null)
  const [active, setActive] = useState<CellPosition>({ row: 0, col: 0 })
  const [editing, setEditing] = useState(false)
  // Set when focus should follow the active cell after the next render
  const focusPending = useRef(false)

  const sized = columns.map((column) => ({
    size: column.size ?? DEFAULT_COLUMN_SIZE,
    priority: column.priority ?? 0,
  }))
  const visibleIndices = useVisibleColumns(sized, containerRef, probeRef)
  const visible = visibleIndices.map((index) => columns[index])
  const sizes = visibleIndices.map((index) => sized[index].size)

  // Keep the active cell inside the grid when rows are filtered or columns hidden
  const current = {
    row: Math.min(active.row, Math.max(rowCount - 1, 0)),
    col: Math.min(active.col, Math.max(visible.length - 1, 0)),
  }

  useEffect(() => {
    if (!focusPending.current) return
    focusPending.current = false
    // The row may render one frame after scrolling to it
    requestAnimationFrame(() =>
      containerRef.current
        ?.querySelector<HTMLElement>(`[data-cell="${current.row}:${current.col}"]`)
        ?.focus({ preventScroll: true }),
    )
  })

  const moveTo = (row: number, col: number) => {
    const next = {
      row: Math.max(0, Math.min(row, rowCount - 1)),
      col: Math.max(0, Math.min(col, visible.length - 1)),
    }
    scrollerRef.current?.scrollToIndex(next.row)
    focusPending.current = true
    setActive(next)
  }

  const closeEditor = () => {
    setEditing(false)
    focusPending.current = true
  }

  const startEditing = (position: CellPosition) => {
    if (!visible[position.col]?.renderEditor) return
    setActive(position)
    setEditing(true)
  }

  // Spreadsheet keys: arrows, Home/End, PageUp/PageDown move; Enter or F2 edits
  const handleKeyDown = (e: KeyboardEvent) => {
    if (editing || rowCount === 0) return
    const { row, col } = current
    const moves: Record<string, () => void> = {
      ArrowDown: () => moveTo(row + 1, col),
      ArrowUp: () => moveTo(row - 1, col),
      ArrowRight: () => moveTo(row, col + 1),
      ArrowLeft: () => moveTo(row, col - 1),
      Home: () => moveTo(row, 0),
      End: () => moveTo(row, visible.length - 1),
      PageDown: () => moveTo(row + PAGE_ROWS, col),
      PageUp: () => moveTo(row - PAGE_ROWS, col),
      Enter: () => startEditing(current),
      F2: () => startEditing(current),
    }
    const action = moves[e.key]
    if (!action) return
    e.preventDefault()
    action()
  }

  const layout: CSSProperties = {
    gridTemplateColumns: sizes.map((size) => `minmax(${spacing(size)}, 1fr)`).join(' '),
    minWidth: spacing(sizes.reduce((sum, size) => sum + size, 0)),
  }

  const header = (
    <div
      role="row"
      aria-rowindex={1}
      className="grid border-b border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
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
        handleRef={scrollerRef}
        onKeyDown={handleKeyDown}
        header={header}
        className="h-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        renderItem={({ index, style }) => (
          <div
            role="row"
            aria-rowindex={index + 2}
            className="grid border-b border-zinc-100 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40"
            style={{ ...layout, ...style }}
          >
            {visible.map((column, col) => {
              const row = getRow(index)
              const isActive = current.row === index && current.col === col
              const isEditing = isActive && editing
              return (
                <div
                  key={column.id}
                  role="gridcell"
                  data-cell={`${index}:${col}`}
                  tabIndex={isActive ? 0 : -1}
                  onFocus={() => setActive({ row: index, col })}
                  className={`group relative flex min-w-0 items-center px-4 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500 ${
                    isEditing ? 'z-20 px-1' : (column.cellClassName?.(row) ?? '')
                  }`}
                >
                  {isEditing ? column.renderEditor?.(row, closeEditor) : column.cell(row)}
                  {!isEditing && column.renderEditor && (
                    <EditButton onClick={() => startEditing({ row: index, col })} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      />
    </div>
  )
}
