import { dataStore } from '../store/useDataStore'
import type { DataState } from '../store/useDataStore'
import { DataScreen } from './DataScreen'
import { useViewTransitionSelector } from './useViewTransition'
import { WelcomeScreen } from './WelcomeScreen'

// Only whether data exists: fixes replace the dataset but must not re-render or animate the app
const selectHasData = (state: DataState) => state.dataset !== null
const isScreenChange = (prev: boolean, next: boolean) => prev !== next

function App() {
  const hasData = useViewTransitionSelector(dataStore, selectHasData, isScreenChange)

  return hasData ? <DataScreen /> : <WelcomeScreen />
}

export default App
