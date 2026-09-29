import { lazy, Suspense, useEffect } from 'react'
import { useRoomStore } from '../store/roomStore'
import { useUiStore } from '../store/uiStore'
import { projectTotals } from '../data/shoppingList'
import Icon from './Icons'
import RoomPanel from './studio/RoomPanel'
import PiecesPanel from './studio/PiecesPanel'
import FinishesPanel from './studio/FinishesPanel'
import LightPanel from './studio/LightPanel'
import ViewsPanel from './studio/ViewsPanel'
import BriefPanel from './BriefPanel'
import Filmstrip from './studio/Filmstrip'
import Shortcuts from './Shortcuts'
import './Workspace.css'
import './studio/Studio.css'

// Three.js only loads when the 3D view actually mounts, so the survey and the
// shell paint without waiting on it.
const RoomCanvas = lazy(() => import('./RoomCanvas'))

const PANELS = [
  { id: 'room', label: 'Room', title: 'Room details', icon: 'room', View: RoomPanel },
  { id: 'pieces', label: 'Pieces', title: 'Furniture', icon: 'pieces', View: PiecesPanel },
  { id: 'finishes', label: 'Finishes', title: 'Materials & finishes', icon: 'finishes', View: FinishesPanel },
  { id: 'light', label: 'Light', title: 'Light & atmosphere', icon: 'light', View: LightPanel },
  { id: 'views', label: 'Views', title: 'Camera & views', icon: 'views', View: ViewsPanel },
]
// Only projects that came from an official Brief have one to show.
const BRIEF_PANEL = { id: 'brief', label: 'Brief', title: 'Design Brief', icon: 'brief', View: BriefPanel }

// The project bar (DesktopProjects) sits above this and carries the totals and
// file actions. The workspace is a tool rail, the room, an inspector, and the
// strip of camera views.
export default function Workspace() {
  const panelOpen = useUiStore((s) => s.panelOpen)
  const activePanel = useUiStore((s) => s.activePanel)
  const choosePanel = useUiStore((s) => s.choosePanel)
  const setPanelOpen = useUiStore((s) => s.setPanelOpen)
  const presenting = useUiStore((s) => s.presenting)
  const setPresenting = useUiStore((s) => s.setPresenting)
  const shortcutsOpen = useUiStore((s) => s.shortcutsOpen)
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen)
  const count = useRoomStore((s) => projectTotals(s).count)
  const hasBrief = useRoomStore((s) => Boolean(s.brief))
  const inOverview = useRoomStore((s) => s.scope === 'home' && Boolean(s.home) && !s.focusedRoom)

  // "?" opens the shortcuts sheet, "P" toggles presentation, Escape leaves it.
  // Ignored while typing so they don't hijack a text field.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && useUiStore.getState().presenting) {
        setPresenting(false)
        return
      }
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === '?') {
        e.preventDefault()
        setShortcutsOpen(true)
      } else if (e.key === 'p' || e.key === 'P') {
        setPresenting(!useUiStore.getState().presenting)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setShortcutsOpen, setPresenting])

  const panels = hasBrief ? [BRIEF_PANEL, ...PANELS] : PANELS
  const active = panels.find((p) => p.id === activePanel) || PANELS[1]
  const showStrip = !inOverview

  return (
    <div className={`workspace studio ${presenting ? 'is-presenting' : ''} ${panelOpen ? '' : 'inspector-hidden'} ${showStrip ? '' : 'no-strip'}`}>
      <Shortcuts open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <nav className="rail" aria-label="Room tools">
        {panels.map((p) => (
          <button key={p.id} className="rail-btn" aria-pressed={panelOpen && activePanel === p.id} aria-label={p.label} title={p.title} onClick={() => choosePanel(p.id)}>
            <Icon name={p.icon} size={20} />
            <span>{p.label}</span>
            {p.id === 'pieces' && count > 0 && <span className="rail-badge" aria-label={`${count} pieces`}>{count}</span>}
          </button>
        ))}
      </nav>

      <main className="stage">
        <Suspense
          fallback={
            <div className="stage-loading">
              <span className="stage-spinner" aria-hidden="true" />
              <span>Building your room…</span>
            </div>
          }
        >
          <RoomCanvas />
        </Suspense>
      </main>

      {panelOpen && (
        <aside className="inspector" aria-label={active.title}>
          <div className="inspector-head">
            <div>
              <span className="studio-eyebrow">ROOM STUDIO</span>
              <h2>{active.title}</h2>
            </div>
            <button className="icon-btn" aria-label="Close inspector" title="Close" onClick={() => setPanelOpen(false)}>
              <Icon name="close" size={16} />
            </button>
          </div>
          <div className="panel-scroll">
            <active.View />
          </div>
        </aside>
      )}

      {showStrip && <Filmstrip />}
    </div>
  )
}
