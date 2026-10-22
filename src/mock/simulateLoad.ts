import type { LoadProgress } from '../worker/protocol'

// TEMPORARY: fakes the two worker stages (parsing, validating) until the real import is wired up

const PARSE_MS = 1200
const VALIDATE_MS = 900
const TICK_MS = 50
// Lets the progress bar finish its animation before the screen changes
const HOLD_MS = 400

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason as Error)
      },
      { once: true },
    )
  })

export async function simulateLoad(
  file: File,
  rowCount: number,
  signal: AbortSignal,
  onProgress: (progress: LoadProgress) => void,
) {
  const stages = [
    { stage: 'parsing', duration: PARSE_MS },
    { stage: 'validating', duration: VALIDATE_MS },
  ] as const

  for (const { stage, duration } of stages) {
    for (let elapsed = 0; elapsed <= duration; elapsed += TICK_MS) {
      const t = elapsed / duration
      onProgress({
        stage,
        bytesRead: stage === 'parsing' ? Math.round(file.size * t) : file.size,
        totalBytes: file.size,
        rowsProcessed: Math.round(rowCount * t),
        totalRows: stage === 'parsing' ? 0 : rowCount,
      })
      // Ticks must run one after another to fake a timeline
      // oxlint-disable-next-line no-await-in-loop
      await sleep(TICK_MS, signal)
    }
  }
  await sleep(HOLD_MS, signal)
}
