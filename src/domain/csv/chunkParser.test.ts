import { describe, expect, it } from 'vitest'
import { createCsvChunkParser } from './chunkParser'
import type { CsvRow } from './chunkParser'

// A tiny sample makes the parser start early, so slice boundaries are really exercised
function parseInSlices(text: string, sliceSizes: number[], sampleSize = 8) {
  const rows: CsvRow[] = []
  let header: string[] | null = null
  const parser = createCsvChunkParser(
    {
      onHeader: (columns) => (header = columns),
      onRows: (chunk) => rows.push(...chunk),
    },
    { sampleSize },
  )
  let offset = 0
  let i = 0
  while (offset < text.length) {
    const size = sliceSizes[i++ % sliceSizes.length]
    parser.push(text.slice(offset, offset + size))
    offset += size
  }
  const summary = parser.finish()
  return { header, rows, summary }
}

const parseWhole = (text: string) => parseInSlices(text, [text.length || 1], Infinity)

const TRICKY = [
  'id,name,note',
  '1,Anna,plain',
  '2,"Müller, Jonas","has, commas"',
  '3,"Line',
  'break","say ""hi"""',
  '4,Émile,🙂 emoji',
  '',
  '5,,"",',
].join('\n')

describe('createCsvChunkParser', () => {
  it('parses header and rows', () => {
    const { header, rows, summary } = parseWhole('a,b\n1,2\n3,4\n')
    expect(header).toEqual(['a', 'b'])
    expect(rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ])
    expect(summary).toMatchObject({ columns: ['a', 'b'], rowCount: 2, errorCount: 0 })
  })

  it('handles quotes, escaped quotes, commas and line breaks inside fields', () => {
    const { rows } = parseWhole(TRICKY)
    expect(rows).toEqual([
      ['1', 'Anna', 'plain'],
      ['2', 'Müller, Jonas', 'has, commas'],
      ['3', 'Line\nbreak', 'say "hi"'],
      ['4', 'Émile', '🙂 emoji'],
      ['5', '', '', ''],
    ])
  })

  it('emits rows while input is still coming', () => {
    const batches: CsvRow[][] = []
    const parser = createCsvChunkParser({ onRows: (rows) => batches.push(rows) }, { sampleSize: 4 })
    parser.push('a,b\n1,2\n3,')
    expect(batches).toEqual([[['1', '2']]])
    parser.push('4\n')
    expect(batches).toEqual([[['1', '2']], [['3', '4']]])
    parser.finish()
    expect(batches).toHaveLength(2)
  })

  it('gives the same result for every way of slicing the input', () => {
    const expected = parseWhole(TRICKY)
    for (let size = 1; size <= TRICKY.length; size++) {
      expect(parseInSlices(TRICKY, [size])).toEqual(expected)
    }
    expect(parseInSlices(TRICKY, [3, 1, 7, 2, 11])).toEqual(expected)
  })

  it('handles inputs larger than the detection sample', () => {
    const lines = ['id,value']
    for (let i = 0; i < 20_000; i++) lines.push(`${i},"value ${i}, quoted"`)
    const text = lines.join('\n')
    const { rows, summary } = parseInSlices(text, [4096, 777, 65_536], 64 * 1024)
    expect(summary.rowCount).toBe(20_000)
    expect(rows[19_999]).toEqual(['19999', 'value 19999, quoted'])
  })

  it.each([
    ['semicolon', ';'],
    ['tab', '\t'],
    ['pipe', '|'],
  ])('detects the %s delimiter', (_, delimiter) => {
    const text = `${['a', 'b', 'c'].join(delimiter)}\n${['1', '2', '3'].join(delimiter)}`
    const { rows, summary } = parseWhole(text)
    expect(summary.delimiter).toBe(delimiter)
    expect(rows).toEqual([['1', '2', '3']])
  })

  it('handles Windows line endings', () => {
    const { header, rows } = parseInSlices('a,b\r\n1,2\r\n3,4\r\n', [5])
    expect(header).toEqual(['a', 'b'])
    expect(rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ])
  })

  it('strips the byte order mark', () => {
    expect(parseWhole('﻿id,name\n1,Anna').header).toEqual(['id', 'name'])
  })

  it('skips empty lines, including leading ones', () => {
    const { header, rows } = parseWhole('\n\na,b\n\n1,2\n   \n3,4\n\n')
    expect(header).toEqual(['a', 'b'])
    expect(rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ])
  })

  it('keeps rows with a different number of fields as they are', () => {
    expect(parseWhole('a,b,c\n1,2\n1,2,3,4').rows).toEqual([
      ['1', '2'],
      ['1', '2', '3', '4'],
    ])
  })

  it('returns an empty summary for empty input', () => {
    const { header, summary } = parseWhole('')
    expect(header).toBeNull()
    expect(summary).toMatchObject({ columns: [], rowCount: 0 })
  })

  it('handles a header without rows', () => {
    const { header, summary } = parseWhole('a,b')
    expect(header).toEqual(['a', 'b'])
    expect(summary.rowCount).toBe(0)
  })

  it('reports an unclosed quote', () => {
    const { summary } = parseWhole('a,b\n1,"open\n2,3')
    expect(summary.errorCount).toBe(1)
    expect(summary.errors[0].message).toMatch(/quote/i)
  })
})
