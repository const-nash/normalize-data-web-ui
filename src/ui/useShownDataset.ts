import { useState } from 'react'
import { useDataStore } from '../store/useDataStore'
import type { Dataset } from '../store/useDataStore'

// The dataset for the data screen. Read from the store instead of passed as a prop: in development
// React diffs changed props for its performance tracks, and diffing 200,000 rows took seconds.
// After a reset the store is empty while the screen still animates away, so the last dataset is
// kept for that moment (only the data screen calls this, so it is never shown on another screen).
export function useShownDataset(): Dataset {
  const live = useDataStore((s) => s.dataset)
  const [last, setLast] = useState(live)
  if (live && live !== last) setLast(live)
  const dataset = live ?? last
  if (!dataset) throw new Error('The data screen needs a dataset')
  return dataset
}
