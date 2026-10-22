import { useVirtualizer } from '@tanstack/react-virtual'
import { useMemo, useRef } from 'react'
import type { Dataset } from '../store/useDataStore'

const ROW_HEIGHT = 32

interface DataTableProps {
  dataset: Dataset
}

export function DataTable({ dataset }: DataTableProps) {
  const { columns, rows } = dataset
  const parentRef = useRef<HTMLDivElement>(null)
  // Header names may repeat, so prefix with the position to keep keys unique
  const columnKeys = useMemo(() => columns.map((name, c) => `${c}:${name}`), [columns])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  const gridTemplateColumns = `repeat(${columns.length}, minmax(140px, 1fr))`

  return (
    <div
      ref={parentRef}
      className="h-full overflow-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div
        className="sticky top-0 z-10 grid border-b border-zinc-200 bg-zinc-50 text-sm font-semibold dark:border-zinc-800 dark:bg-zinc-800"
        style={{ gridTemplateColumns }}
      >
        {columns.map((col, c) => (
          <div key={columnKeys[c]} className="truncate px-3 py-2">
            {col}
          </div>
        ))}
      </div>
      <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index]
          return (
            <div
              key={item.key}
              className="absolute left-0 grid w-full border-b border-zinc-100 text-sm dark:border-zinc-800/60"
              style={{
                gridTemplateColumns,
                height: item.size,
                transform: `translateY(${item.start}px)`,
              }}
            >
              {columnKeys.map((key, c) => (
                <div key={key} className="truncate px-3 leading-8">
                  {row[c] ?? ''}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
