import { useRoomStore } from './store/roomStore'
import Onboarding from './components/Onboarding'
import Workspace from './components/Workspace'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'

export default function App() {
  const onboarded = useRoomStore((s) => s.onboarded)
  return <ErrorBoundary>{onboarded ? <Workspace /> : <Onboarding />}</ErrorBoundary>
}
