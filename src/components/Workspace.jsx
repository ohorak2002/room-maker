import { lazy, Suspense, useEffect, useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import { byId, formatUSD, resolveItem } from '../data/catalog'
import ControlsPanel from './ControlsPanel'
import ShopPanel from './ShopPanel'
import SearchPanel from './SearchPanel'
import PhotoImport from './PhotoImport'
import Shortcuts from './Shortcuts'
import PillowMark from './PillowMark'
import './Workspace.css'

// Three.js only loads when the 3D view actually mounts, so the survey and the
// shell paint without waiting on it.
const RoomCanvas = lazy(() => import('./RoomCanvas'))

const TABS = [
  { id: 'design', label: 'Design' },
  { id: 'shop', label: 'Shop' },
  { id: 'search', label: 'Search' },
  { id: 'photo', label: 'Photo' },
]

export default function Workspace() {
  const store = useRoomStore()
  const [tab, setTab] = useState('design')
  const [panelOpen, setPanelOpen] = useState(true)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

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
  }, [])

  const total = store.items.reduce((sum, i) => {
    const item = resolveItem(i.id, store.synthetics)
    return sum + (item ? item.price * i.qty : 0)
  }, 0)
  const count = store.items.reduce((n, i) => n + i.qty, 0)

  const exportDesign = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      palette: store.palette,
      mood: store.mood,
      lighting: store.lighting,
      floorplan: store.floorplan,
      windows: store.windows,
      items: store.items.map((i) => {
        const item = resolveItem(i.id, store.synthetics)
        return {
          name: item?.name,
          qty: i.qty,
          retailer: item?.retailerName,
          estimatedPrice: item?.price,
          link: item?.url,
        }
      }),
      estimatedTotal: total,
      note: 'Prices are estimates for prototyping, not live retail data.',
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'my-room.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="workspace">
      <Shortcuts open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <header className="topbar">
        <div className="brand">
          <PillowMark size={24} />
          <span className="brand-name">Room Maker</span>
        </div>

        <div className="topbar-actions">
          <span className="basket-readout">
            <span className="basket-count">{count}</span> {count === 1 ? 'item' : 'items'} ·{' '}
            <span className="basket-total">{formatUSD(total)}</span> est.
          </span>
          <button
            className="kbd-hint"
            onClick={() => setShortcutsOpen(true)}
            title="Keyboard shortcuts"
          >
            <kbd>?</kbd> Shortcuts
          </button>
          <button className="btn-quiet" onClick={exportDesign}>
            Export
          </button>
          <button className="btn-quiet" onClick={store.restartOnboarding}>
            <span className="label-long">Retake quiz</span>
            <span className="label-short">Quiz</span>
          </button>
          <button
            className="btn-quiet panel-toggle"
            onClick={() => setPanelOpen((v) => !v)}
            aria-expanded={panelOpen}
          >
            <span className="label-long">{panelOpen ? 'Hide panel' : 'Show panel'}</span>
            <span className="label-short">{panelOpen ? 'Hide' : 'Show'}</span>
          </button>
        </div>
      </header>

      <div className="workspace-body">
        {panelOpen && (
          <aside className="panel">
            <div className="tabs" role="tablist">
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
              {tab === 'design' && <ControlsPanel />}
              {tab === 'shop' && <ShopPanel />}
              {tab === 'search' && <SearchPanel />}
              {tab === 'photo' && <PhotoImport />}
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
