import { useEffect, useMemo, useRef, useState } from 'react'
import { FIX_MODE, planAutoFix } from '../domain/autoFix'
import type { FixMode } from '../domain/autoFix'
import { ISSUE_TYPES } from '../domain/rules/issueTypes'
import type { Dataset } from '../store/useDataStore'

const PREVIEW_LIMIT = 100

interface AutoFixDialogProps {
  dataset: Dataset
  open: boolean
  onClose: () => void
  onApply: (mode: FixMode) => void
}

const shown = (value: string) => (value === '' ? 'empty' : value)

// Native <dialog>: focus trap, Escape and the backdrop come from the browser
export function AutoFixDialog({ dataset, open, onClose, onApply }: AutoFixDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [mode, setMode] = useState<FixMode>(FIX_MODE.CLEAN_ROWS)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const plans = useMemo(
    () =>
      open
        ? {
            [FIX_MODE.CLEAN_ROWS]: planAutoFix(dataset, FIX_MODE.CLEAN_ROWS),
            [FIX_MODE.ALL]: planAutoFix(dataset, FIX_MODE.ALL),
          }
        : null,
    [dataset, open],
  )
  const plan = plans?.[mode]

  const options = [
    {
      value: FIX_MODE.CLEAN_ROWS,
      label: 'Only rows without manual issues',
      description:
        'These rows become fully valid. Rows that also need your input stay as they are.',
    },
    {
      value: FIX_MODE.ALL,
      label: 'Everything that can be fixed',
      description: 'Also fixes values in rows that still need your input for other cells.',
    },
  ] as const

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="autofix-title"
      className="m-auto w-[min(100%-2rem,48rem)] rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-zinc-950/50 backdrop:backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
    >
      {plans && plan && (
        <form method="dialog" className="flex max-h-[85vh] flex-col">
          <div className="space-y-4 overflow-y-auto p-6">
            <div className="space-y-1">
              <h2 id="autofix-title" className="text-lg font-semibold">
                Fix automatically
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Review what will change. You can undo it afterwards.
              </p>
            </div>

            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="sr-only">What to fix</legend>
              {options.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer gap-3 rounded-xl border border-zinc-200 p-3 transition-colors has-checked:border-indigo-500 has-checked:bg-indigo-50 dark:border-zinc-700 dark:has-checked:border-indigo-400 dark:has-checked:bg-indigo-950/40"
                >
                  <input
                    type="radio"
                    name="mode"
                    value={option.value}
                    checked={mode === option.value}
                    onChange={() => setMode(option.value)}
                    className="mt-1 accent-indigo-600"
                  />
                  <span className="space-y-1">
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                      {option.description}
                    </span>
                    <span className="block text-xs font-medium text-indigo-700 tabular-nums dark:text-indigo-300">
                      {plans[option.value].fixes.length.toLocaleString()} values in{' '}
                      {plans[option.value].rowCount.toLocaleString()} rows
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            {plan.fixes.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Nothing to fix in this mode.
              </p>
            ) : (
              <>
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">What will change</h3>
                  <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                    {plan.groups.map((group) => {
                      const type = ISSUE_TYPES[group.type]
                      return (
                        <li key={group.type} className="space-y-1 p-3">
                          <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="font-medium">{type.title}</span>
                            <span className="text-zinc-500 tabular-nums dark:text-zinc-400">
                              {group.count.toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {type.explanation}
                          </p>
                          <p className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
                            {group.examples.map((fix) => (
                              <span key={`${fix.row}:${fix.column}`}>
                                <span className="text-red-700 line-through decoration-red-400/60 dark:text-red-300">
                                  {shown(fix.before)}
                                </span>
                                <span aria-hidden="true"> → </span>
                                <span className="text-emerald-700 dark:text-emerald-400">
                                  {fix.after}
                                </span>
                              </span>
                            ))}
                          </p>
                          {type.fixKind === 'suggested' && (
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                              This is an assumption. Check a few examples before you apply it.
                            </p>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Affected rows</h3>
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-zinc-50 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        <tr>
                          <th className="px-3 py-2 font-medium">Row</th>
                          <th className="px-3 py-2 font-medium">Column</th>
                          <th className="px-3 py-2 font-medium">Before</th>
                          <th className="px-3 py-2 font-medium">After</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-mono dark:divide-zinc-800">
                        {plan.fixes.slice(0, PREVIEW_LIMIT).map((fix) => (
                          <tr key={`${fix.row}:${fix.column}`}>
                            <td className="px-3 py-1.5 tabular-nums">{fix.row + 1}</td>
                            <td className="px-3 py-1.5">{dataset.columns[fix.column]}</td>
                            <td className="px-3 py-1.5 text-red-700 dark:text-red-300">
                              {shown(fix.before)}
                            </td>
                            <td className="px-3 py-1.5 text-emerald-700 dark:text-emerald-400">
                              {fix.after}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {plan.fixes.length > PREVIEW_LIMIT && (
                      <p className="border-t border-zinc-100 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                        And {(plan.fixes.length - PREVIEW_LIMIT).toLocaleString()} more changes.
                      </p>
                    )}
                  </div>
                </section>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-200 p-4 dark:border-zinc-800">
            <button
              type="submit"
              value="cancel"
              className="h-10 rounded-lg border border-zinc-300 px-4 text-sm font-medium transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={plan.fixes.length === 0}
              onClick={() => onApply(mode)}
              className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:ring-offset-zinc-900"
            >
              Apply {plan.fixes.length.toLocaleString()} fixes
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
