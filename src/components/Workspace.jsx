import { useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import { byId, formatUSD } from '../data/catalog'
import ControlsPanel from './ControlsPanel'
import ShopPanel from './ShopPanel'
import RoomCanvas from './RoomCanvas'
import './Workspace.css'

export default function Workspace() {
  const store = useRoomStore()
  const [tab, setTab] = useState('design')
  const [panelOpen, setPanelOpen] = useState(true)

  const total = store.items.reduce((sum, i) => {
    const item = byId(i.id)
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
      temperature: store.temperature,
      items: store.items.map((i) => {
        const item = byId(i.id)
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
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Room Maker</span>
        </div>

        <div className="topbar-actions">
          <span className="basket-readout">
            <span className="basket-count">{count}</span> items ·{' '}
            <span className="basket-total">{formatUSD(total)}</span> est.
          </span>
          <button className="btn-quiet" onClick={exportDesign}>
            Export
          </button>
          <button className="btn-quiet" onClick={store.restartOnboarding}>
            Retake quiz
          </button>
          <button
            className="btn-quiet panel-toggle"
            onClick={() => setPanelOpen((v) => !v)}
            aria-expanded={panelOpen}
          >
            {panelOpen ? 'Hide panel' : 'Show panel'}
          </button>
        </div>
      </header>

      <div className="workspace-body">
        {panelOpen && (
          <aside className="panel">
            <div className="tabs" role="tablist">
              <button
                role="tab"
                aria-selected={tab === 'design'}
                className={`tab ${tab === 'design' ? 'active' : ''}`}
                onClick={() => setTab('design')}
              >
                Design
              </button>
              <button
                role="tab"
                aria-selected={tab === 'shop'}
                className={`tab ${tab === 'shop' ? 'active' : ''}`}
                onClick={() => setTab('shop')}
              >
                Shop
                {count > 0 && <span className="tab-badge">{count}</span>}
              </button>
            </div>

            <div className="panel-scroll">
              {tab === 'design' ? <ControlsPanel /> : <ShopPanel />}
            </div>
          </aside>
        )}

        <main className="stage">
          <RoomCanvas />
        </main>
      </div>
    </div>
  )
}
