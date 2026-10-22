import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import { useDataStore } from '../store/useDataStore'

const ROW_HEIGHT = 32

export function DataTable() {
  const columns = useDataStore((s) => s.columns)
  const rows = useDataStore((s) => s.rows)
  const parentRef = useRef<HTMLDivElement>(null)

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
        {columns.map((col) => (
          <div key={col} className="truncate px-3 py-2">
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
              {columns.map((col) => (
                <div key={col} className="truncate px-3 leading-8">
                  {row[col]}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
