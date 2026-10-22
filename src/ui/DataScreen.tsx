import { useCallback, useMemo, useState } from 'react'
import type { FixMode } from '../domain/autoFix'
import type { Dataset } from '../store/useDataStore'
import { useDataStore } from '../store/useDataStore'
import { AutoFixDialog } from './AutoFixDialog'
import { columnsForDataset } from './customerColumns'
import { FilterBar } from './FilterBar'
import { IssuesOverview } from './IssuesOverview'
import { Table } from './Table'

const secondaryButton =
  'shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:border-zinc-700 dark:hover:bg-zinc-800'

export function DataScreen({ dataset }: { dataset: Dataset }) {
  const reset = useDataStore((s) => s.reset)
  const undo = useDataStore((s) => s.undo)
  const applyAutoFix = useDataStore((s) => s.applyAutoFix)
  const history = useDataStore((s) => s.history)
  const lastChange = history.at(-1)?.label
  const visibleRows = useDataStore((s) => s.visibleRows)
  const [dialogOpen, setDialogOpen] = useState(false)
  const columns = useMemo(() => columnsForDataset(dataset, history), [dataset, history])
  const getRow = useCallback((index: number) => visibleRows[index], [visibleRows])

  const handleApply = (mode: FixMode) => {
    applyAutoFix(mode)
    setDialogOpen(false)
  }

  return (
    <div className="flex h-screen flex-col gap-4 p-4">
      <header className="flex items-center gap-4">
        <h1 className="text-xl font-semibold" style={{ viewTransitionName: 'app-title' }}>
          Normalize Data
        </h1>
        <span className="truncate text-sm text-zinc-500 dark:text-zinc-400">
          {dataset.fileName} · {dataset.rows.length.toLocaleString()} rows
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span
            aria-live="polite"
            className="hidden text-sm text-zinc-500 md:inline dark:text-zinc-400"
          >
            {lastChange}
          </span>
          {lastChange && (
            <button type="button" onClick={undo} className={secondaryButton}>
              Undo
            </button>
          )}
          <button type="button" onClick={reset} className={secondaryButton}>
            Choose another file
          </button>
        </div>
      </header>
      <FilterBar dataset={dataset} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <IssuesOverview dataset={dataset} onAutoFix={() => setDialogOpen(true)} />
        <main
          className="relative min-h-64 min-w-0 flex-1"
          style={{ viewTransitionName: 'app-surface' }}
        >
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
      <AutoFixDialog
        dataset={dataset}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onApply={handleApply}
      />
    </div>
  )
}
