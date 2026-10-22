import { useState } from 'react'
import { DataTable } from './components/DataTable'
import { WelcomeScreen } from './components/WelcomeScreen'
import { parseCsv } from './lib/parseCsv'
import { useDataStore } from './store/useDataStore'

const SUPPORTED_EXTENSIONS = new Set(['csv', 'tsv', 'txt'])

function App() {
  const fileName = useDataStore((s) => s.fileName)
  const rowCount = useDataStore((s) => s.rows.length)
  const setData = useDataStore((s) => s.setData)
  const reset = useDataStore((s) => s.reset)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      setError(`Unsupported file type ".${extension}". Please choose a CSV, TSV or TXT file.`)
      return
    }

    setError(null)
    setIsLoading(true)
    try {
      const { columns, rows } = await parseCsv(file)
      if (columns.length === 0) {
        setError('The file appears to be empty or has no header row.')
        return
      }
      setData(file.name, columns, rows)
    } catch {
      setError('Could not read the file. Make sure it is a valid delimited text file.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!fileName) {
    return <WelcomeScreen isLoading={isLoading} error={error} onFile={handleFile} />
  }

  return (
    <div className="flex h-screen flex-col gap-4 p-4">
      <header className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">Normalize Data</h1>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {fileName} · {rowCount.toLocaleString()} rows
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
        <DataTable />
      </main>
    </div>
  )
}

export default App
