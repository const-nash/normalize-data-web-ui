import { describe, expect, it } from 'vitest'
import { parseCsvBlob, parseCsvStream } from './parseStream'

// A stream that delivers the given byte slices one by one
function streamOf(parts: Uint8Array[]) {
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < parts.length) controller.enqueue(parts[i++])
      else controller.close()
    },
  })
}

describe('parseCsvStream', () => {
  it('keeps multi-byte characters split between chunks intact', async () => {
    const bytes = new TextEncoder().encode('name,city\nMüller,Köln\n🙂,Zürich\n')
    const parts: Uint8Array[] = []
    for (let i = 0; i < bytes.length; i++) parts.push(bytes.slice(i, i + 1)) // one byte per chunk

    const rows: string[][] = []
    const summary = await parseCsvStream(streamOf(parts), bytes.length, {
      onRows: (chunk) => rows.push(...chunk),
    })

    expect(summary.columns).toEqual(['name', 'city'])
    expect(rows).toEqual([
      ['Müller', 'Köln'],
      ['🙂', 'Zürich'],
    ])
  })

  it('reports progress up to the total size', async () => {
    const bytes = new TextEncoder().encode('a,b\n1,2\n3,4\n')
    const progress: number[] = []
    await parseCsvStream(streamOf([bytes.slice(0, 5), bytes.slice(5)]), bytes.length, {
      onProgress: (read) => progress.push(read),
    })
    expect(progress).toEqual([5, bytes.length])
  })

  it('rejects with an AbortError and stops reading when aborted', async () => {
    const controller = new AbortController()
    let pulls = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        pulls++
        c.enqueue(new TextEncoder().encode('1,2\n'))
      },
    })

    const promise = parseCsvStream(stream, 0, {
      signal: controller.signal,
      onRows: () => controller.abort(new DOMException('Stopped', 'AbortError')),
    })

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    const pullsAtAbort = pulls
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(pulls).toBe(pullsAtAbort)
  })
})

describe('parseCsvBlob', () => {
  it('parses a Blob', async () => {
    const blob = new Blob(['id,name\n', '1,Anna\n', '2,"Smith, John"\n'])
    const rows: string[][] = []
    const summary = await parseCsvBlob(blob, { onRows: (chunk) => rows.push(...chunk) })
    expect(summary.rowCount).toBe(2)
    expect(rows[1]).toEqual(['2', 'Smith, John'])
  })
})
