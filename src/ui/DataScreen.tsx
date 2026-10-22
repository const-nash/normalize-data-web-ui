import type { Dataset } from '../store/useDataStore'
import { useDataStore } from '../store/useDataStore'
import { useCallback, useMemo } from 'react'
import { columnsForHeader } from './customerColumns'
import { FilterBar } from './FilterBar'
import { Table } from './Table'

export function DataScreen({ dataset }: { dataset: Dataset }) {
  const reset = useDataStore((s) => s.reset)
  const visibleRows = useDataStore((s) => s.visibleRows)
  const columns = useMemo(() => columnsForHeader(dataset.columns), [dataset.columns])
  const getRow = useCallback(
    (index: number) => dataset.rows[visibleRows[index]],
    [dataset, visibleRows],
  )

  return (
    <div className="flex h-screen flex-col gap-4 p-4">
      <header className="flex items-center gap-4">
        <h1 className="text-xl font-semibold" style={{ viewTransitionName: 'app-title' }}>
          Normalize Data
        </h1>
        <span className="truncate text-sm text-zinc-500 dark:text-zinc-400">
          {dataset.fileName} · {dataset.rows.length.toLocaleString()} rows
        </span>
        <button
          type="button"
          onClick={reset}
          className="ml-auto shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Choose another file
        </button>
      </header>
      <FilterBar dataset={dataset} />
      <main className="relative min-h-0 flex-1" style={{ viewTransitionName: 'app-surface' }}>
        <Table
          rowCount={visibleRows.length}
          getRow={getRow}
          columns={columns}
          label="Customers"
          className="h-full"
        />
        {visibleRows.length === 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-24 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No rows match your search and filter.
          </p>
        )}
      </main>
    </div>
  )
}
