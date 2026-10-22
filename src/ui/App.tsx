import { useDataStore } from '../store/useDataStore'
import { DataTable } from './DataTable'
import { WelcomeScreen } from './WelcomeScreen'

function App() {
  const dataset = useDataStore((s) => s.dataset)
  const reset = useDataStore((s) => s.reset)

  if (!dataset) return <WelcomeScreen />

  return (
    <div className="flex h-screen flex-col gap-4 p-4">
      <header className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">Normalize Data</h1>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {dataset.fileName} · {dataset.rows.length.toLocaleString()} rows
        </span>
        <button
          type="button"
          onClick={reset}
          className="ml-auto rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Choose another file
        </button>
      </header>
      <main className="min-h-0 flex-1">
        <DataTable dataset={dataset} />
      </main>
    </div>
  )
}

export default App
