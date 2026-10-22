import { Dropzone } from './Dropzone'

const ACCEPT = '.csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain'

interface WelcomeScreenProps {
  isLoading: boolean
  error: string | null
  onFile: (file: File) => void
}

export function WelcomeScreen({ isLoading, error, onFile }: WelcomeScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex w-full max-w-xl flex-col items-center gap-8">
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Normalize Data</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Upload a file to analyze its contents and fix inconsistencies.
          </p>
        </div>

        <Dropzone accept={ACCEPT} disabled={isLoading} onFile={onFile} />

        <div aria-live="polite" className="min-h-6 text-sm">
          {isLoading && <p className="text-zinc-500 dark:text-zinc-400">Reading file…</p>}
          {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Files are processed locally in your browser and never uploaded.
        </p>
      </div>
    </div>
  )
}
