import { ISSUE_TYPES } from '../domain/rules/issueTypes'
import type { IssueRecord } from '../domain/validation'

interface IssueCellProps {
  value: string
  issue?: IssueRecord
}

// Renders a cell value as plain text. With an issue it adds the reason as a tooltip and for
// screen readers, and shows the suggested value when there is one.
export function IssueCell({ value, issue }: IssueCellProps) {
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
