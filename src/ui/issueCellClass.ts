import type { IssueRecord } from '../domain/validation'

// Cell look per fix kind. Kept subtle on purpose: many cells can have issues at once.
export function issueCellClass(issue: IssueRecord | undefined, changed = false) {
  if (!issue) {
    return changed
      ? 'bg-emerald-50 shadow-[inset_2px_0_0] shadow-emerald-400 dark:bg-emerald-950/30 dark:shadow-emerald-500/70'
      : undefined
  }
  return issue.suggestion === undefined
    ? 'bg-red-50 shadow-[inset_2px_0_0] shadow-red-400 dark:bg-red-950/40 dark:shadow-red-500/70'
    : 'bg-amber-50 shadow-[inset_2px_0_0] shadow-amber-400 dark:bg-amber-950/30 dark:shadow-amber-500/70'
}
