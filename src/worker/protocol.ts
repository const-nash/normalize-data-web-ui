// Typed message protocol between the main thread (client.ts) and the import worker.
// It is the stand-in for a future backend API.
//
// Every request has an id. For that id the worker may send any number of `progress` and
// `chunk` messages, then exactly one `result` or `error`. `cancel` aborts a request.

import type { IssueRecord, ValidationSummary } from '../domain/validation'

export type Row = string[]

export interface LoadProgress {
  stage: 'parsing' | 'validating'
  bytesRead: number
  totalBytes: number
  rowsProcessed: number
  // 0 while unknown (during parsing)
  totalRows: number
}

// Rows are streamed while parsing, issues after validation
export type LoadChunk = { kind: 'rows'; rows: Row[] } | { kind: 'issues'; issues: IssueRecord[] }

export interface LoadResult extends ValidationSummary {
  columns: string[]
  rowCount: number
  // Transferred without copying: ROW_STATUS per row, and where each row's issues start
  rowStatus: Uint8Array
  issueOffsets: Uint32Array
}

interface MethodSpec<P, R, G = never, C = never> {
  params: P
  result: R
  progress: G
  chunk: C
}

export interface WorkerMethods {
  load: MethodSpec<{ file: File }, LoadResult, LoadProgress, LoadChunk>
}

export type Method = keyof WorkerMethods
export type Params<M extends Method> = WorkerMethods[M]['params']
export type Result<M extends Method> = WorkerMethods[M]['result']
export type Progress<M extends Method> = WorkerMethods[M]['progress']
export type Chunk<M extends Method> = WorkerMethods[M]['chunk']

export type RequestMessage = {
  [M in Method]: { kind: 'request'; id: number; method: M; params: Params<M> }
}[Method]

export type ClientMessage = RequestMessage | { kind: 'cancel'; id: number }

export interface SerializedError {
  name: string
  message: string
}

export type WorkerMessage =
  | { kind: 'progress'; id: number; progress: unknown }
  | { kind: 'chunk'; id: number; chunk: unknown }
  | { kind: 'result'; id: number; result: unknown }
  | { kind: 'error'; id: number; error: SerializedError }
