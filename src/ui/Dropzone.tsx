import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

interface DropzoneProps {
  accept: string
  disabled?: boolean
  onFile: (file: File) => void
}

const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false

export function Dropzone({ accept, disabled = false, onFile }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const dragDepth = useRef(0)
  const onFileRef = useRef(onFile)
  const disabledRef = useRef(disabled)

  useEffect(() => {
    onFileRef.current = onFile
    disabledRef.current = disabled
  })

  // Listen on window so a file can be dropped anywhere on the page
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      dragDepth.current += 1
      setIsDragging(true)
    }
    const handleDragOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const handleDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setIsDragging(false)
    }
    const handleDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth.current = 0
      setIsDragging(false)
      const file = e.dataTransfer?.files[0]
      if (file && !disabledRef.current) onFileRef.current(file)
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
    }
  }, [])

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
    e.target.value = ''
  }

  return (
    <label
      data-dragging={isDragging || undefined}
      aria-disabled={disabled || undefined}
      className="group flex w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-zinc-300 bg-white px-8 py-14 text-center transition-colors outline-none hover:border-indigo-400 hover:bg-indigo-50/40 has-focus-visible:ring-2 has-focus-visible:ring-indigo-500 has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-zinc-50 aria-disabled:cursor-wait aria-disabled:opacity-60 data-dragging:border-indigo-500 data-dragging:bg-indigo-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/30 dark:has-focus-visible:ring-offset-zinc-950 dark:data-dragging:border-indigo-400 dark:data-dragging:bg-indigo-950/50"
    >
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={handleChange}
        className="sr-only"
      />
      <span className="flex size-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 transition-transform group-data-dragging:scale-110 dark:bg-indigo-500/15 dark:text-indigo-400">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-7"
        >
          <path d="M12 16V4m0 0-4 4m4-4 4 4" />
          <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
      </span>
      <span className="text-base font-medium">
        {isDragging ? 'Drop the file to start' : 'Choose a file or drag it here'}
      </span>
      <span className="text-sm text-zinc-500 dark:text-zinc-400">
        CSV, TSV or TXT with a header row
      </span>
    </label>
  )
}
