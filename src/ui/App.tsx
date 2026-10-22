import { dataStore } from '../store/useDataStore'
import type { DataState } from '../store/useDataStore'
import { DataScreen } from './DataScreen'
import { useViewTransitionSelector } from './useViewTransition'
import { WelcomeScreen } from './WelcomeScreen'

const selectDataset = (state: DataState) => state.dataset

function App() {
  const dataset = useViewTransitionSelector(dataStore, selectDataset)

  return dataset ? <DataScreen dataset={dataset} /> : <WelcomeScreen />
}

export default App
