// All error texts in one place. `{name}` is a placeholder, filled in with formatMessage.
// User facing texts use plain language, not technical terms (see CLAUDE.md).

export const ERROR_MESSAGE = {
  // Import file check
  FILE_TYPE_NOT_SUPPORTED:
    '".{extension}" files are not supported. Please choose a {formats} file.',
  FILE_TYPE_UNKNOWN: 'This file type is not supported. Please choose a {formats} file.',
  FILE_EMPTY: 'This file is empty. Please choose a file with data.',
  FILE_TOO_LARGE: 'This file is larger than {maxMb} MB. Please split it into smaller files.',

  // Import
  FILE_NO_HEADER: 'The file appears to be empty or has no header row.',
  FILE_READ_FAILED: 'Could not read the file.',

  // Validation (used by the column rules)
  COUNTRY_INVALID: 'Country "{value}" should be a 2-letter code like {example}.',

  // Internal, not shown as user guidance
  LOAD_CANCELLED: 'Load cancelled',
  WORKER_CRASHED: 'Worker crashed',
  WORKER_TERMINATED: 'Worker terminated',
  ROOT_NOT_FOUND: 'Root element #{id} not found',
} as const
