/// <reference lib="webworker" />
import { ERROR_MESSAGE } from '../constants/errorMessages'
import { parseCsvBlob } from '../domain/csv'
import { validateRows } from '../domain/validation'
import type { IssueRecord } from '../domain/validation'
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
  // Buffers to transfer (not copy) with the result
  transfer: (...buffers: ArrayBuffer[]) => void
}

type Handlers = {
  [M in Method]: (params: Params<M>, ctx: HandlerContext<M>) => Promise<Result<M>> | Result<M>
}

// Small enough that the main thread deserializes each chunk in a few milliseconds
const CHUNK_SIZE = 5000
const ISSUE_CHUNK_SIZE = 5000
const PROGRESS_INTERVAL_MS = 100

const scope = self as unknown as DedicatedWorkerGlobalScope
const controllers = new Map<number, AbortController>()

const post = (message: WorkerMessage, transfer: Transferable[] = []) =>
  scope.postMessage(message, transfer)

// Lets queued messages (such as cancel) run between slices of synchronous work
const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

const handlers: Handlers = {
  async load({ file }, { signal, progress, chunk, transfer }) {
    // Rows are kept for validation and also streamed to the main thread while parsing
    const rows: Row[] = []
    let batch: Row[] = []
    let lastReport = 0

    const onRows = (parsed: Row[]) => {
      for (const row of parsed) {
        rows.push(row)
        batch.push(row)
        if (batch.length === CHUNK_SIZE) {
          chunk({ kind: 'rows', rows: batch })
          batch = []
        }
      }
    }

    const onProgress = (bytesRead: number, totalBytes: number) => {
      const now = performance.now()
      if (now - lastReport < PROGRESS_INTERVAL_MS) return
      lastReport = now
      progress({
        stage: 'parsing',
        bytesRead,
        totalBytes,
        rowsProcessed: rows.length,
        totalRows: 0,
      })
    }

    const { columns } = await parseCsvBlob(file, { signal, onRows, onProgress })
    if (columns.length === 0) throw new Error(ERROR_MESSAGE.FILE_NO_HEADER)
    if (batch.length > 0) chunk({ kind: 'rows', rows: batch })

    const validating = (rowsProcessed: number) =>
      progress({
        stage: 'validating',
        bytesRead: file.size,
        totalBytes: file.size,
        rowsProcessed,
        totalRows: rows.length,
      })

    validating(0)
    const validation = validateRows(columns, rows)
    let step = validation.next()
    while (!step.done) {
      validating(step.value)
      // Validation runs in slices so cancel messages are handled in between
      // oxlint-disable-next-line no-await-in-loop
      await yieldToEventLoop()
      signal.throwIfAborted()
      step = validation.next()
    }
    const { issues, rowStatus, ...summary } = step.value

    for (let i = 0; i < issues.length; i += ISSUE_CHUNK_SIZE) {
      const slice: IssueRecord[] = issues.slice(i, i + ISSUE_CHUNK_SIZE)
      chunk({ kind: 'issues', issues: slice })
    }
    transfer(rowStatus.buffer)

    return { columns, rowCount: rows.length, rowStatus, ...summary }
  },
}

async function handleRequest({ id, method, params }: RequestMessage) {
  const controller = new AbortController()
  controllers.set(id, controller)
  const handler = handlers[method] as (
    params: unknown,
    ctx: HandlerContext<Method>,
  ) => Promise<unknown> | unknown

  const transfer: Transferable[] = []

  try {
    const result = await handler(params, {
      signal: controller.signal,
      progress: (progress) => post({ kind: 'progress', id, progress }),
      chunk: (chunk) => post({ kind: 'chunk', id, chunk }),
      transfer: (...buffers) => transfer.push(...buffers),
    })
    if (!controller.signal.aborted) post({ kind: 'result', id, result }, transfer)
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
