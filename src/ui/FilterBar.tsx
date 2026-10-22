import debounce from 'lodash.debounce'
import { useEffect, useMemo, useState } from 'react'
import { QUICK_FILTER } from '../domain/filter'
import type { QuickFilter } from '../domain/filter'
import { useDataStore } from '../store/useDataStore'
import { useShownDataset } from './useShownDataset'

const SEARCH_DEBOUNCE_MS = 250

const OPTIONS: Array<{ value: QuickFilter; label: string }> = [
  { value: QUICK_FILTER.ALL, label: 'All' },
  { value: QUICK_FILTER.WITH_ISSUES, label: 'With issues' },
  { value: QUICK_FILTER.MANUAL, label: 'Needs manual fix' },
  { value: QUICK_FILTER.FIXABLE, label: 'Auto-fixable' },
  { value: QUICK_FILTER.VALID, label: 'Only valid' },
]

export function FilterBar() {
  const dataset = useShownDataset()
  const quickFilter = useDataStore((s) => s.quickFilter)
  const visibleCount = useDataStore((s) => s.visibleRows.length)
  const setSearch = useDataStore((s) => s.setSearch)
  const setQuickFilter = useDataStore((s) => s.setQuickFilter)
  // The input updates on every key; the store (and the grid) only after typing pauses
  const search = useDataStore((s) => s.search)
  const [input, setInput] = useState(search)
  // The search can be cleared elsewhere (the overview); mirror that into the field. Only clearing
  // is mirrored: other changes come from this field and may lag behind it while debouncing.
  const [lastSearch, setLastSearch] = useState(search)
  if (search !== lastSearch) {
    setLastSearch(search)
    if (search === '') setInput('')
  }

  const debouncedSearch = useMemo(() => debounce(setSearch, SEARCH_DEBOUNCE_MS), [setSearch])
  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch])

  const handleInput = (value: string) => {
    setInput(value)
    debouncedSearch(value)
    // Clearing the field should show all rows right away
    if (value === '') debouncedSearch.flush()
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="search"
        value={input}
        onChange={(e) => handleInput(e.target.value)}
        placeholder="Search all columns"
        aria-label="Search all columns"
        className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none placeholder:text-zinc-400 focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/30 sm:w-72 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
      />
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Quick filters</legend>
        {OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={quickFilter === value}
            onClick={() => setQuickFilter(value)}
            className="flex h-10 items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm font-medium transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none aria-pressed:border-indigo-500 aria-pressed:bg-indigo-50 aria-pressed:text-indigo-700 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:aria-pressed:border-indigo-400 dark:aria-pressed:bg-indigo-950/50 dark:aria-pressed:text-indigo-300"
          >
            {label}
          </button>
        ))}
      </fieldset>
      <span aria-live="polite" className="ml-auto text-sm text-zinc-500 dark:text-zinc-400">
        Showing {visibleCount.toLocaleString()} of {dataset.rows.length.toLocaleString()} rows
      </span>
    </div>
  )
}
