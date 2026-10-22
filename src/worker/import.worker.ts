/// <reference lib="webworker" />
import { ERROR_MESSAGE } from '../constants/errorMessages'
import { createNaiveParser } from './naiveParser'
import type {
  Chunk,
  ClientMessage,
  Method,
  Params,
  Progress,
  RequestMessage,
  Result,
  Row,
  WorkerMessage,
} from './protocol'

interface HandlerContext<M extends Method> {
  signal: AbortSignal
  progress: (progress: Progress<M>) => void
  chunk: (chunk: Chunk<M>) => void
}

type Handlers = {
  [M in Method]: (params: Params<M>, ctx: HandlerContext<M>) => Promise<Result<M>> | Result<M>
}

// Small enough that the main thread deserializes each chunk in a few milliseconds
const CHUNK_SIZE = 5000
const PROGRESS_INTERVAL_MS = 100

const scope = self as unknown as DedicatedWorkerGlobalScope
const controllers = new Map<number, AbortController>()

const post = (message: WorkerMessage, transfer: Transferable[] = []) =>
  scope.postMessage(message, transfer)

const handlers: Handlers = {
  async load({ file }, { signal, progress, chunk }) {
    const parser = createNaiveParser()
    let columns: string[] | null = null
    let batch: Row[] = []
    let rowCount = 0

    const onRow = (row: Row) => {
      if (!columns) {
        columns = row
        return
      }
      batch.push(row)
      rowCount++
      if (batch.length === CHUNK_SIZE) {
        chunk(batch)
        batch = []
      }
    }

    // Stream the file instead of reading it whole: bounded memory and cheap cancellation checks
    const reader = file.stream().getReader()
    const decoder = new TextDecoder()
    let bytesRead = 0
    let lastReport = 0

    try {
      for (;;) {
        signal.throwIfAborted()
        // Chunks must be processed in order, so sequential awaits are intended
        // oxlint-disable-next-line no-await-in-loop
        const { done, value } = await reader.read()
        if (done) break

        bytesRead += value.byteLength
        parser.push(decoder.decode(value, { stream: true }), onRow)

        const now = performance.now()
        if (now - lastReport >= PROGRESS_INTERVAL_MS) {
          lastReport = now
          progress({
            stage: 'parsing',
            bytesRead,
            totalBytes: file.size,
            rowsProcessed: rowCount,
            totalRows: 0,
          })
        }
      }
      parser.push(decoder.decode(), onRow)
      parser.flush(onRow)
    } finally {
      reader.releaseLock()
    }

    if (!columns) throw new Error(ERROR_MESSAGE.FILE_NO_HEADER)
    if (batch.length > 0) chunk(batch)

    return { columns, rowCount }
  },
}

async function handleRequest({ id, method, params }: RequestMessage) {
  const controller = new AbortController()
  controllers.set(id, controller)
  const handler = handlers[method] as (
    params: unknown,
    ctx: HandlerContext<Method>,
  ) => Promise<unknown> | unknown

  try {
    const result = await handler(params, {
      signal: controller.signal,
      progress: (progress) => post({ kind: 'progress', id, progress }),
      chunk: (chunk) => post({ kind: 'chunk', id, chunk }),
    })
    if (!controller.signal.aborted) post({ kind: 'result', id, result })
  } catch (error) {
    if (controller.signal.aborted) return // the client already rejected the promise
    const { name, message } =
      error instanceof Error ? error : { name: 'Error', message: String(error) }
    post({ kind: 'error', id, error: { name, message } })
  } finally {
    controllers.delete(id)
  }
}

scope.addEventListener('message', (e: MessageEvent<ClientMessage>) => {
  const message = e.data
  if (message.kind === 'cancel') {
    controllers.get(message.id)?.abort()
    return
  }
  void handleRequest(message)
})
