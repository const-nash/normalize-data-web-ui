import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import type { StoreApi } from 'zustand'

// Like a store selector, but changes for which `isTransition(prev, next)` is true are applied
// inside a View Transition, so screen changes cross-fade instead of jumping. Other changes (new
// data on the same screen) apply at once, without animation. Falls back to an instant switch
// where the API is missing. `selector` and `isTransition` must be stable.
export function useViewTransitionSelector<S, T>(
  store: StoreApi<S>,
  selector: (state: S) => T,
  isTransition: (prev: T, next: T) => boolean,
): T {
  const [shown, setShown] = useState(() => selector(store.getState()))

  useEffect(
    () =>
      store.subscribe((state, prevState) => {
        const next = selector(state)
        const prev = selector(prevState)
        if (Object.is(next, prev)) return
        if (!document.startViewTransition || !isTransition(prev, next)) {
          setShown(next)
          return
        }
        document.startViewTransition(() => flushSync(() => setShown(next)))
      }),
    [store, selector, isTransition],
  )

  return shown
}
