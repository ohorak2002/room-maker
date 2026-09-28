import { useRoomStore } from './store/roomStore'
import Onboarding from './components/Onboarding'
import Workspace from './components/Workspace'
import ErrorBoundary from './components/ErrorBoundary'
import DesktopProjects from './components/DesktopProjects'
import './App.css'

export default function App() {
  const onboarded = useRoomStore((s) => s.onboarded)
  const editor = onboarded ? <Workspace /> : <Onboarding />
  return <ErrorBoundary>{window.nestedDesktop
    ? <div className="desktop-shell"><DesktopProjects /><div className="desktop-editor">{editor}</div></div>
    : editor}</ErrorBoundary>
}
