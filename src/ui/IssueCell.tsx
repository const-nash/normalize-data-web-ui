import { ISSUE_TYPES } from '../domain/rules/issueTypes'
import type { IssueRecord } from '../domain/validation'

interface IssueCellProps {
  value: string
  issue?: IssueRecord
  // Value before a fix changed this cell
  original?: string
}

// Renders a cell value as plain text. With an issue it adds the reason as a tooltip and for
// screen readers, and shows the suggested value when there is one.
export function IssueCell({ value, issue, original }: IssueCellProps) {
  if (!issue && original !== undefined) {
    const was = `Fixed automatically. Was: ${original === '' ? 'empty' : original}`
    return (
      <span className="truncate text-emerald-900 dark:text-emerald-100" title={was}>
        {value}
        <span className="sr-only"> ({was})</span>
      </span>
    )
  }
  if (!issue) return <span className="truncate">{value}</span>

  const { title, explanation } = ISSUE_TYPES[issue.type]
  const hint = issue.suggestion === undefined ? '' : ` Suggested: ${issue.suggestion}`
  const isEmpty = value.trim() === ''

  return (
    <span className="flex min-w-0 items-baseline gap-1.5" title={`${title}. ${explanation}${hint}`}>
      {isEmpty ? (
        <span className="truncate text-red-700/70 italic dark:text-red-300/70">empty</span>
      ) : (
        <span
          className={`truncate ${
            issue.suggestion === undefined
              ? 'text-red-800 dark:text-red-200'
              : 'text-amber-900 dark:text-amber-100'
          }`}
        >
          {value}
        </span>
      )}
      {issue.suggestion !== undefined && (
        <span className="shrink-0 truncate text-xs text-emerald-700 dark:text-emerald-400">
          <span aria-hidden="true">→ </span>
          {issue.suggestion}
        </span>
      )}
      <span className="sr-only">
        {title}.{hint}
      </span>
    </span>
  )
}

// A saved value that is still being checked
export function PendingCell({ value }: { value: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-zinc-500 dark:text-zinc-400">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className="size-4 shrink-0 animate-spin text-indigo-500 dark:text-indigo-400"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="truncate">{value}</span>
      <span className="sr-only" aria-live="polite">
        Saving and checking
      </span>
    </span>
  )
}
