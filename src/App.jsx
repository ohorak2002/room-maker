import { useRoomStore } from './store/roomStore'
import { useUiStore } from './store/uiStore'
import BriefGate from './components/BriefGate'
import Workspace from './components/Workspace'
import ErrorBoundary from './components/ErrorBoundary'
import DesktopProjects from './components/DesktopProjects'
import './App.css'

export default function App() {
  const onboarded = useRoomStore((s) => s.onboarded)
  const presenting = useUiStore((s) => s.presenting)
  const projectSession = useUiStore((s) => s.projectSession)
  const editor = onboarded ? <Workspace key={projectSession} /> : <BriefGate key={projectSession} />
  // Nested is a desktop application. Without the Electron bridge there is no
  // project storage, so the editor is not offered at all.
  if (!window.nestedDesktop) {
    return <main className="desktop-required"><h1>Nested</h1><p>Nested runs as a desktop application. Open it from the Nested app.</p></main>
  }
  return <ErrorBoundary><div className={`desktop-shell ${presenting && onboarded ? 'is-presenting' : ''}`}><DesktopProjects /><div className="desktop-editor">{editor}</div></div></ErrorBoundary>
}
