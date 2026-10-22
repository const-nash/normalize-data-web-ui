import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import type { StoreApi } from 'zustand'

// Like a store selector, but each change is applied inside a View Transition, so screen changes
// cross-fade instead of jumping. Falls back to an instant switch where the API is missing.
// `selector` must be stable (defined outside the component).
export function useViewTransitionSelector<S, T>(store: StoreApi<S>, selector: (state: S) => T): T {
  const [shown, setShown] = useState(() => selector(store.getState()))

  useEffect(
    () =>
      store.subscribe((state, prev) => {
        const next = selector(state)
        if (Object.is(next, selector(prev))) return
        if (!document.startViewTransition) {
          setShown(next)
          return
        }
        document.startViewTransition(() => flushSync(() => setShown(next)))
      }),
    [store, selector],
  )

  return shown
}
