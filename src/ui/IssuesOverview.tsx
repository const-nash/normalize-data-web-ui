import { useMemo } from 'react'
import { ISSUE_TYPES } from '../domain/rules/issueTypes'
import type { IssueId, IssueType } from '../domain/rules/issueTypes'
import { useDataStore } from '../store/useDataStore'
import type { Dataset } from '../store/useDataStore'
import { useShownDataset } from './useShownDataset'

interface IssueGroup {
  title: string
  types: Array<{ type: IssueType; count: number }>
}

// Same issue types are grouped into one item; items are split by how they can be fixed
function groupIssues(issueCounts: Dataset['issueCounts']): IssueGroup[] {
  const found = (Object.entries(issueCounts) as Array<[IssueId, number]>)
    .map(([id, count]) => ({ type: ISSUE_TYPES[id], count }))
    .toSorted((a, b) => b.count - a.count)
  return [
    {
      title: 'Can be fixed automatically',
      types: found.filter(({ type }) => type.fixKind !== 'manual'),
    },
    { title: 'Needs your input', types: found.filter(({ type }) => type.fixKind === 'manual') },
  ].filter((group) => group.types.length > 0)
}

interface SelectedIssueActionsProps {
  type: IssueType
  count: number
  onApply: (issueType: IssueId) => void
}

// Shown under the selected issue type. The table, filtered to this type, is the preview: every
// cell shows its current value and the suggested one.
function SelectedIssueActions({ type, count, onApply }: SelectedIssueActionsProps) {
  if (type.fixKind === 'manual') {
    return (
      <p className="mt-1.5 px-2.5 text-xs text-zinc-500 dark:text-zinc-400">
        These need your input. Hover a cell in the table and click the pencil to fix it.
      </p>
    )
  }
  return (
    <div className="mt-1.5 space-y-1.5 px-2.5">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {type.fixKind === 'suggested'
          ? 'This fix is an assumption. Check the suggested values in the table first.'
          : 'The table shows each value with its fix. You can undo it afterwards.'}
      </p>
      <button
        type="button"
        onClick={() => onApply(type.id)}
        className="h-9 w-full rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white transition-colors hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:ring-offset-zinc-900"
      >
        Apply automatic fix ({count.toLocaleString()})
      </button>
    </div>
  )
}

interface IssuesOverviewProps {
  onClose: () => void
}

export function IssuesOverview({ onClose }: IssuesOverviewProps) {
  const dataset = useShownDataset()
  const issueType = useDataStore((s) => s.issueType)
  const setIssueType = useDataStore((s) => s.setIssueType)
  const applyAutoFix = useDataStore((s) => s.applyAutoFix)
  const { statusCounts, issueCounts, missingColumns } = dataset
  const groups = useMemo(() => groupIssues(issueCounts), [issueCounts])

  return (
    <aside
      id="issues-overview"
      aria-label="Issues overview"
      className="flex max-h-72 shrink-0 flex-col gap-4 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 lg:max-h-none lg:w-80 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Issues overview</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Hide issues overview"
          title="Hide"
          className="flex size-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className="size-4"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          {
            label: 'Valid',
            value: statusCounts.valid,
            tone: 'text-emerald-700 dark:text-emerald-400',
          },
          {
            label: 'Auto-fixable',
            value: statusCounts.fixable,
            tone: 'text-amber-700 dark:text-amber-400',
          },
          { label: 'Manual', value: statusCounts.manual, tone: 'text-red-700 dark:text-red-400' },
        ].map(({ label, value, tone }) => (
          // Number first, label below: labels wrap differently, numbers stay on one line.
          // dt stays before dd in the markup for screen readers; the order is only visual.
          <div
            key={label}
            className="flex flex-col-reverse justify-end rounded-lg bg-zinc-50 px-2 py-2 dark:bg-zinc-800/60"
          >
            <dt className="text-xs leading-tight text-zinc-500 dark:text-zinc-400">{label} rows</dt>
            <dd className={`text-base leading-tight font-semibold tabular-nums ${tone}`}>
              {value.toLocaleString()}
            </dd>
          </div>
        ))}
      </dl>

      {missingColumns.length > 0 && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          The file has no {missingColumns.join(', ')} column. Add it to the file and load it again.
        </p>
      )}

      {groups.map((group) => (
        <section key={group.title} className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            {group.title}
          </h3>
          <ul className="space-y-1.5">
            {group.types.map(({ type, count }) => {
              const selected = issueType === type.id
              return (
                <li key={type.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setIssueType(selected ? null : type.id)}
                    className="w-full rounded-lg border border-transparent p-2.5 text-left transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none aria-pressed:border-indigo-500 aria-pressed:bg-indigo-50 dark:hover:bg-zinc-800/60 dark:aria-pressed:border-indigo-400 dark:aria-pressed:bg-indigo-950/40"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{type.title}</span>
                      <span className="text-sm text-zinc-500 tabular-nums dark:text-zinc-400">
                        {count.toLocaleString()}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                      {type.explanation}
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {type.column}
                      </span>
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        Good: {type.example}
                      </span>
                      {type.fixKind === 'suggested' && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          Check before fixing
                        </span>
                      )}
                    </span>
                  </button>
                  {selected && (
                    <SelectedIssueActions type={type} count={count} onApply={applyAutoFix} />
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </aside>
  )
}
