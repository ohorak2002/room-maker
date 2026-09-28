import { useRoomStore } from './store/roomStore'
import Onboarding from './components/Onboarding'
import Workspace from './components/Workspace'
import ErrorBoundary from './components/ErrorBoundary'
import DesktopProjects from './components/DesktopProjects'
import './App.css'

export default function App() {
  const onboarded = useRoomStore((s) => s.onboarded)
  const editor = onboarded ? <Workspace /> : <Onboarding />
  // Nested is a desktop application. Without the Electron bridge there is no
  // project storage, so the editor is not offered at all.
  if (!window.nestedDesktop) {
    return <main className="desktop-required"><h1>Nested</h1><p>Nested runs as a desktop application. Open it from the Nested app.</p></main>
  }
  return <ErrorBoundary><div className="desktop-shell"><DesktopProjects /><div className="desktop-editor">{editor}</div></div></ErrorBoundary>
}
