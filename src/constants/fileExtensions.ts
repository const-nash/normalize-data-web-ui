export const FILE_EXTENSION = {
  CSV: 'csv',
  TSV: 'tsv',
  TXT: 'txt',
} as const

export type FileExtension = (typeof FILE_EXTENSION)[keyof typeof FILE_EXTENSION]
