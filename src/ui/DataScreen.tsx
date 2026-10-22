import { useCallback, useMemo, useState } from 'react'
import { useDataStore } from '../store/useDataStore'
import { columnsForDataset } from './customerColumns'
import { FilterBar } from './FilterBar'
import { IssuesOverview } from './IssuesOverview'
import { Table } from './Table'
import { useShownDataset } from './useShownDataset'

const secondaryButton =
  'shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:border-zinc-700 dark:hover:bg-zinc-800'

export function DataScreen() {
  const dataset = useShownDataset()
  const reset = useDataStore((s) => s.reset)
  const undo = useDataStore((s) => s.undo)
  const editCell = useDataStore((s) => s.editCell)
  const pendingEdits = useDataStore((s) => s.pendingEdits)
  const history = useDataStore((s) => s.history)
  const lastChange = history.at(-1)?.label
  const visibleRows = useDataStore((s) => s.visibleRows)
  const [overviewOpen, setOverviewOpen] = useState(true)
  const issueTotal = useMemo(
    () => Object.values(dataset.issueCounts).reduce((sum, count) => sum + count, 0),
    [dataset.issueCounts],
  )
  // Nothing left to fix: the overview is not shown at all. Missing columns cannot be fixed here,
  // so they keep it visible.
  const hasIssues = issueTotal > 0 || dataset.missingColumns.length > 0
  const columns = useMemo(
    () => columnsForDataset(dataset, history, editCell, pendingEdits),
    [dataset, history, editCell, pendingEdits],
  )
  const getRow = useCallback((index: number) => visibleRows[index], [visibleRows])

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
            <button
              type="button"
              onClick={undo}
              disabled={pendingEdits.length > 0}
              className={`${secondaryButton} disabled:cursor-wait disabled:opacity-50`}
            >
              Undo
            </button>
          )}
          {hasIssues && !overviewOpen && (
            <button
              type="button"
              onClick={() => setOverviewOpen(true)}
              aria-expanded={false}
              aria-controls="issues-overview"
              className={secondaryButton}
            >
              Issues ({issueTotal.toLocaleString()})
            </button>
          )}
          <button type="button" onClick={reset} className={secondaryButton}>
            Choose another file
          </button>
        </div>
      </header>
      <FilterBar />
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        {hasIssues && overviewOpen && <IssuesOverview onClose={() => setOverviewOpen(false)} />}
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
    </div>
  )
}
