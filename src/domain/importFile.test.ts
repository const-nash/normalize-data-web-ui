import { describe, expect, it } from 'vitest'
import { ACCEPT_ATTRIBUTE, MAX_FILE_BYTES, checkImportFile } from './importFile'

describe('checkImportFile', () => {
  it.each(['data.csv', 'data.tsv', 'data.txt', 'DATA.CSV', 'my.export.v2.csv'])(
    'accepts %s',
    (name) => {
      expect(checkImportFile({ name, size: 10 })).toBeNull()
    },
  )

  it.each(['photo.png', 'table.xlsx', 'data.csv.zip', 'report.json'])('rejects %s', (name) => {
    expect(checkImportFile({ name, size: 10 })).toMatch(/not supported/)
  })

  it('names the extension and the supported formats', () => {
    expect(checkImportFile({ name: 'photo.png', size: 10 })).toBe(
      '".png" files are not supported. Please choose a CSV, TSV, or TXT file.',
    )
  })

  it('rejects files without an extension', () => {
    expect(checkImportFile({ name: 'data', size: 10 })).toMatch(/This file type is not supported/)
    expect(checkImportFile({ name: '.csv', size: 10 })).toMatch(/not supported/)
  })

  it('accepts a file of exactly the maximum size', () => {
    expect(checkImportFile({ name: 'a.csv', size: MAX_FILE_BYTES })).toBeNull()
  })

  it('rejects a file above the maximum size', () => {
    expect(checkImportFile({ name: 'a.csv', size: MAX_FILE_BYTES + 1 })).toMatch(
      /larger than 100 MB/,
    )
  })

  it('rejects an empty file', () => {
    expect(checkImportFile({ name: 'a.csv', size: 0 })).toMatch(/empty/)
  })

  it('checks the type before the size', () => {
    expect(checkImportFile({ name: 'a.png', size: MAX_FILE_BYTES + 1 })).toMatch(/not supported/)
  })
})

describe('ACCEPT_ATTRIBUTE', () => {
  it('lists every supported extension', () => {
    expect(ACCEPT_ATTRIBUTE).toBe('.csv,.tsv,.txt')
  })
})
