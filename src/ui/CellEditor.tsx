import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ISSUE_TYPES } from '../domain/rules/issueTypes'
import type { CellIssue } from '../domain/rules/issueTypes'

// Room needed below the cell for the hint; otherwise it opens above
const HINT_SPACE_PX = 140

interface CellEditorProps {
  initial: string
  // Rule for live feedback while typing; columns outside the spec have none
  validate?: (value: string) => CellIssue | null
  onSave: (value: string) => void
  onCancel: () => void
}

// Inline editor: Enter or leaving the field saves, Escape cancels. While typing it says whether
// the value is fine and offers the suggested value as a one-click fix.
export function CellEditor({ initial, validate, onSave, onCancel }: CellEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  const [value, setValue] = useState(initial)
  const [above, setAbove] = useState(false)
  const issue = validate?.(value) ?? null

  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    input.select()
    setAbove(input.getBoundingClientRect().bottom + HINT_SPACE_PX > window.innerHeight)
  }, [])

  // Saving runs once: Enter unmounts the editor, which would also fire blur
  const finish = (save: boolean, next = value) => {
    if (done.current) return
    done.current = true
    // An unchanged value is not an edit: no history entry, no revalidation
    if (save && next !== initial) onSave(next)
    else onCancel()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      finish(true)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      finish(false)
    }
  }

  const type = issue ? ISSUE_TYPES[issue.type] : null
  const manual = issue?.suggestion === undefined

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => finish(true)}
        aria-label="Edit cell"
        aria-invalid={issue ? true : undefined}
        aria-describedby="cell-editor-hint"
        className="h-9 w-full rounded-md border border-indigo-500 bg-white px-3 text-sm ring-2 ring-indigo-500/30 outline-none dark:bg-zinc-950"
      />
      {validate && (
        <div
          id="cell-editor-hint"
          aria-live="polite"
          className={`absolute left-0 z-30 w-72 max-w-[80vw] rounded-lg border p-3 text-xs shadow-lg ${
            above ? 'bottom-full mb-1' : 'top-full mt-1'
          } ${
            !issue
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
              : manual
                ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
                : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100'
          }`}
        >
          {!issue || !type ? (
            <p>Looks good. Press Enter to save.</p>
          ) : (
            <div className="space-y-1.5">
              <p className="font-medium">{type.title}</p>
              <p className="opacity-90">{type.explanation}</p>
              {issue.suggestion !== undefined && (
                <button
                  type="button"
                  // Keep focus in the input, so blur does not save the typed value first
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => finish(true, issue.suggestion)}
                  className="mt-1 rounded-md bg-white px-2 py-1 font-medium text-emerald-700 shadow-sm ring-1 ring-emerald-200 hover:bg-emerald-50 dark:bg-zinc-900 dark:text-emerald-300 dark:ring-emerald-900 dark:hover:bg-zinc-800"
                >
                  Use {issue.suggestion}
                </button>
              )}
            </div>
          )}
          <p className="mt-2 opacity-70">Enter saves · Esc cancels</p>
        </div>
      )}
    </div>
  )
}
