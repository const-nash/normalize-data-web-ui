import type { Dataset } from '../store/useDataStore'
import { useDataStore } from '../store/useDataStore'
import { customerColumns } from './customerColumns'
import { Table } from './Table'

export function DataScreen({ dataset }: { dataset: Dataset }) {
  const reset = useDataStore((s) => s.reset)

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
      <main className="min-h-0 flex-1" style={{ viewTransitionName: 'app-surface' }}>
        <Table rows={dataset.rows} columns={customerColumns} label="Customers" className="h-full" />
      </main>
    </div>
  )
}
