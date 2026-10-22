import type {
  Chunk,
  ClientMessage,
  Method,
  Params,
  Progress,
  Result,
  SerializedError,
  WorkerMessage,
} from './protocol'

export interface RequestOptions<M extends Method> {
  signal?: AbortSignal
  onProgress?: (progress: Progress<M>) => void
  onChunk?: (chunk: Chunk<M>) => void
  transfer?: Transferable[]
}

interface Pending {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  onProgress?: (progress: never) => void
  onChunk?: (chunk: never) => void
  cleanup: () => void
}

const toError = ({ name, message }: SerializedError) => {
  const error = new Error(message)
  error.name = name
  return error
}

export const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === 'AbortError'

export class WorkerClient {
  private readonly worker: Worker
  private readonly pending = new Map<number, Pending>()
  private nextId = 1

  constructor(worker: Worker) {
    this.worker = worker
    worker.addEventListener('message', (e: MessageEvent<WorkerMessage>) => this.handle(e.data))
    worker.addEventListener('error', (e) => this.failAll(new Error(e.message || 'Worker crashed')))
  }

  request<M extends Method>(
    method: M,
    params: Params<M>,
    { signal, onProgress, onChunk, transfer = [] }: RequestOptions<M> = {},
  ): Promise<Result<M>> {
    if (signal?.aborted) return Promise.reject(signal.reason as Error)

    const id = this.nextId++
    return new Promise<Result<M>>((resolve, reject) => {
      const onAbort = () => {
        this.post({ kind: 'cancel', id })
        this.pending.get(id)?.cleanup()
        reject(signal?.reason as Error)
      }
      signal?.addEventListener('abort', onAbort, { once: true })

      this.pending.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
        onProgress,
        onChunk,
        cleanup: () => {
          signal?.removeEventListener('abort', onAbort)
          this.pending.delete(id)
        },
      })
      this.post({ kind: 'request', id, method, params } as ClientMessage, transfer)
    })
  }

  terminate() {
    this.worker.terminate()
    this.failAll(new Error('Worker terminated'))
  }

  private post(message: ClientMessage, transfer: Transferable[] = []) {
    this.worker.postMessage(message, transfer)
  }

  private handle(message: WorkerMessage) {
    const pending = this.pending.get(message.id)
    if (!pending) return // cancelled or already settled

    switch (message.kind) {
      case 'progress':
        pending.onProgress?.(message.progress as never)
        break
      case 'chunk':
        pending.onChunk?.(message.chunk as never)
        break
      case 'result':
        pending.cleanup()
        pending.resolve(message.result)
        break
      case 'error':
        pending.cleanup()
        pending.reject(toError(message.error))
        break
    }
  }

  private failAll(error: Error) {
    for (const pending of this.pending.values()) {
      pending.cleanup()
      pending.reject(error)
    }
  }
}

let instance: WorkerClient | null = null

export function getImportWorker() {
  instance ??= new WorkerClient(
    new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module' }),
  )
  return instance
}
