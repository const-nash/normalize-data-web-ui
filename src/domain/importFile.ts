import { FILE_EXTENSION } from '../constants/fileExtensions'
import type { FileExtension } from '../constants/fileExtensions'
import { ERROR_MESSAGE } from '../constants/errorMessages'
import { MEGABYTE } from '../constants/fileSize'
import { formatMessage } from './formatMessage'

export const SUPPORTED_EXTENSIONS: readonly FileExtension[] = [
  FILE_EXTENSION.CSV,
  FILE_EXTENSION.TSV,
  FILE_EXTENSION.TXT,
]
export const MAX_FILE_MB = 100
export const MAX_FILE_BYTES = MAX_FILE_MB * MEGABYTE

// Value for the file input `accept` attribute. Drag and drop ignores it, so checkImportFile
// must run for every file.
export const ACCEPT_ATTRIBUTE = SUPPORTED_EXTENSIONS.map((ext) => `.${ext}`).join(',')

const supported = new Set<string>(SUPPORTED_EXTENSIONS)

// "CSV, TSV, or TXT"
const FORMATS_LABEL = new Intl.ListFormat('en', { type: 'disjunction' }).format(
  SUPPORTED_EXTENSIONS.map((ext) => ext.toUpperCase()),
)

function extensionOf(name: string) {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

// Returns a message for the user, or null when the file can be imported
export function checkImportFile({ name, size }: { name: string; size: number }): string | null {
  const extension = extensionOf(name)
  if (!supported.has(extension)) {
    return extension
      ? formatMessage(ERROR_MESSAGE.FILE_TYPE_NOT_SUPPORTED, { extension, formats: FORMATS_LABEL })
      : formatMessage(ERROR_MESSAGE.FILE_TYPE_UNKNOWN, { formats: FORMATS_LABEL })
  }
  if (size === 0) return ERROR_MESSAGE.FILE_EMPTY
  if (size > MAX_FILE_BYTES)
    return formatMessage(ERROR_MESSAGE.FILE_TOO_LARGE, { maxMb: MAX_FILE_MB })
  return null
}
