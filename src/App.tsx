import type { ChangeEvent } from 'react'
import { DataTable } from './components/DataTable'
import { parseCsv } from './lib/parseCsv'
import { useDataStore } from './store/useDataStore'

function App() {
  const fileName = useDataStore((s) => s.fileName)
  const rowCount = useDataStore((s) => s.rows.length)
  const setData = useDataStore((s) => s.setData)

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const { columns, rows } = await parseCsv(file)
    setData(file.name, columns, rows)
  }

  return (
    <div className="flex h-screen flex-col gap-4 p-4 text-gray-900">
      <header className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">Normalize Data</h1>
        <input type="file" accept=".csv,text/csv" onChange={handleFile} className="text-sm" />
        {fileName && (
          <span className="text-sm text-gray-500">
            {fileName} · {rowCount.toLocaleString()} rows
          </span>
        )}
      </header>
      <main className="min-h-0 flex-1">{fileName && <DataTable />}</main>
    </div>
  )
}

export default App
