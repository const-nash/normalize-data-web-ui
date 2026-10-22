import { createCsvChunkParser } from './chunkParser'
import type { CsvHandlers, CsvSummary } from './chunkParser'

export interface StreamParseOptions extends CsvHandlers {
  signal?: AbortSignal
  // Bytes read so far; `totalBytes` is 0 when unknown
  onProgress?: (bytesRead: number, totalBytes: number) => void
}

// Reads a byte stream and parses it as UTF-8 CSV. TextDecoder in stream mode keeps characters
// that are split between chunks intact. Works anywhere ReadableStream exists.
export async function parseCsvStream(
  stream: ReadableStream<Uint8Array>,
  totalBytes: number,
  { signal, onProgress, ...handlers }: StreamParseOptions = {},
): Promise<CsvSummary> {
  const parser = createCsvChunkParser(handlers)
  const decoder = new TextDecoder()
  const reader = stream.getReader()
  let bytesRead = 0

  try {
    for (;;) {
      signal?.throwIfAborted()
      // Chunks must be parsed in order, so sequential awaits are intended
      // oxlint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read()
      if (done) break
      bytesRead += value.byteLength
      parser.push(decoder.decode(value, { stream: true }))
      onProgress?.(bytesRead, totalBytes)
    }
    signal?.throwIfAborted()
    parser.push(decoder.decode())
    return parser.finish()
  } finally {
    // Stops reading the source when parsing fails or is aborted
    reader.cancel().catch(() => undefined)
  }
}

export function parseCsvBlob(blob: Blob, options?: StreamParseOptions): Promise<CsvSummary> {
  return parseCsvStream(blob.stream(), blob.size, options)
}
