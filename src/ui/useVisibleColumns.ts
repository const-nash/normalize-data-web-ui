import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'

interface Sized {
  size: number
  priority: number
}

// Width of the probe in spacing steps; a bigger value gives a more precise step size
const PROBE_STEPS = 100

// Picks the columns that fit the container, highest priority first. Sizes are in Tailwind
// spacing steps. At least one column always stays visible. Returns indices in original order.
export function pickVisible(columns: readonly Sized[], availableSteps: number): number[] {
  const byPriority = columns
    .map(({ size, priority }, index) => ({ size, priority, index }))
    .toSorted((a, b) => b.priority - a.priority || a.index - b.index)

  const visible: number[] = []
  let used = 0
  for (const { size, index } of byPriority) {
    if (visible.length > 0 && used + size > availableSteps) break
    visible.push(index)
    used += size
  }
  return visible.toSorted((a, b) => a - b)
}

// Measures the container in spacing steps, using a probe of known Tailwind width
export function useVisibleColumns(
  columns: readonly Sized[],
  containerRef: RefObject<HTMLElement | null>,
  probeRef: RefObject<HTMLElement | null>,
) {
  const [availableSteps, setAvailableSteps] = useState<number | null>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    const probe = probeRef.current
    if (!container || !probe) return

    const update = () => {
      const stepPx = probe.getBoundingClientRect().width / PROBE_STEPS
      if (stepPx > 0) setAvailableSteps(container.clientWidth / stepPx)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    observer.observe(probe)
    return () => observer.disconnect()
  }, [containerRef, probeRef])

  return availableSteps === null
    ? columns.map((_, index) => index)
    : pickVisible(columns, availableSteps)
}

export const PROBE_WIDTH = `calc(var(--spacing) * ${PROBE_STEPS})`
