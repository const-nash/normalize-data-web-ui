import { useDataStore } from '../store/useDataStore'
import type { LoadProgress } from '../worker/protocol'
import { Dropzone } from './Dropzone'

const ACCEPT = '.csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain'
// Share of the bar for parsing; validation fills the rest, so the bar never jumps back
const PARSING_SHARE = 0.6

function overallFraction({ stage, bytesRead, totalBytes, rowsProcessed, totalRows }: LoadProgress) {
  const parsed = totalBytes > 0 ? bytesRead / totalBytes : 0
  const validated = totalRows > 0 ? rowsProcessed / totalRows : 0
  const share =
    stage === 'parsing' ? parsed * PARSING_SHARE : PARSING_SHARE + validated * (1 - PARSING_SHARE)
  return share
}

export function WelcomeScreen() {
  const progress = useDataStore((s) => s.progress)
  const error = useDataStore((s) => s.error)
  const loadFile = useDataStore((s) => s.loadFile)
  const cancelLoad = useDataStore((s) => s.cancelLoad)

  const fraction = progress ? overallFraction(progress) : 0

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex w-full max-w-xl flex-col items-center gap-8">
        <div className="space-y-3 text-center">
          <h1
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ viewTransitionName: 'app-title' }}
          >
            Normalize Data
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Upload a file to analyze its contents and fix inconsistencies.
          </p>
        </div>

        <div className="w-full" style={{ viewTransitionName: 'app-surface' }}>
          <Dropzone
            accept={ACCEPT}
            disabled={progress !== null}
            onFile={(file) => void loadFile(file)}
          />
        </div>

        <div aria-live="polite" className="min-h-12 w-full text-sm">
          {progress && (
            <div className="space-y-2 transition-opacity duration-300 starting:opacity-0">
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                <span>
                  {progress.stage === 'parsing' ? 'Reading file' : 'Analyzing rows'}…{' '}
                  {Math.round(fraction * 100)}% · {progress.rowsProcessed.toLocaleString()} rows
                </span>
                <button
                  type="button"
                  onClick={cancelLoad}
                  className="rounded font-medium text-indigo-600 hover:underline focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none dark:text-indigo-400"
                >
                  Cancel
                </button>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                {/* scaleX instead of width: no layout work, and the transition outlasts one tick */}
                <div
                  className="h-full origin-left rounded-full bg-indigo-500 transition-transform duration-300 ease-out"
                  style={{ transform: `scaleX(${fraction})` }}
                />
              </div>
            </div>
          )}
          {error && <p className="text-center text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Files are processed locally in your browser and never uploaded.
        </p>
      </div>
    </div>
  )
}
