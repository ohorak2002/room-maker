import { lazy, Suspense, useEffect, useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import { useUiStore } from '../store/uiStore'
import { projectTotals } from '../data/shoppingList'
import ControlsPanel from './ControlsPanel'
import ShopPanel from './ShopPanel'
import SearchPanel from './SearchPanel'
import HomePanel from './HomePanel'
import PhotoImport from './PhotoImport'
import ModelsPanel from './ModelsPanel'
import Shortcuts from './Shortcuts'
import './Workspace.css'

// Three.js only loads when the 3D view actually mounts, so the survey and the
// shell paint without waiting on it.
const RoomCanvas = lazy(() => import('./RoomCanvas'))

const TABS = [
  { id: 'place', label: 'Place' },
  { id: 'design', label: 'Design' },
  { id: 'shop', label: 'Shop' },
  { id: 'search', label: 'Search' },
  { id: 'photo', label: 'Photo' },
  { id: 'models', label: 'Models' },
]

// The project bar (DesktopProjects) sits above this and carries the totals and
// file actions; the workspace is the side panel and the room.
export default function Workspace() {
  const [tab, setTab] = useState('shop')
  const panelOpen = useUiStore((s) => s.panelOpen)
  const shortcutsOpen = useUiStore((s) => s.shortcutsOpen)
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen)
  const count = useRoomStore((s) => projectTotals(s).count)

  // "?" opens the shortcuts sheet, the convention on every desktop app that
  // has one. Ignored while typing so it doesn't hijack the search field.
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === '?') {
        e.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setShortcutsOpen])

  return (
    <div className="workspace">
      <Shortcuts open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <div className="workspace-body">
        {panelOpen && (
          <aside className="panel">
            <div className="tabs" role="tablist" aria-label="Panels">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`tab ${tab === t.id ? 'active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                  {t.id === 'shop' && count > 0 && <span className="tab-badge">{count}</span>}
                </button>
              ))}
            </div>

            <div className="panel-scroll">
              {tab === 'place' && <HomePanel />}
              {tab === 'design' && <ControlsPanel />}
              {tab === 'shop' && <ShopPanel />}
              {tab === 'search' && <SearchPanel />}
              {tab === 'photo' && <PhotoImport />}
              {tab === 'models' && <ModelsPanel />}
            </div>
          </aside>
        )}

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
      </div>
    </div>
  )
}
