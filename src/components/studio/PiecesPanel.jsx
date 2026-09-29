import { useState } from 'react'
import ShopPanel from '../ShopPanel'
import SearchPanel from '../SearchPanel'
import ModelsPanel from '../ModelsPanel'
import { useRoomStore } from '../../store/roomStore'
import { projectTotals } from '../../data/shoppingList'

const TABS = [
  { id: 'shop', label: 'Shop' },
  { id: 'models', label: 'Models' },
  { id: 'search', label: 'Search' },
]

/** Furniture: the catalog, private imported models, and product-link search. */
export default function PiecesPanel() {
  const [tab, setTab] = useState('shop')
  const count = useRoomStore((s) => projectTotals(s).count)
  return (
    <div className="pieces-panel">
      <div className="tabs sub-tabs" role="tablist" aria-label="Pieces">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'shop' && count > 0 && <span className="tab-badge">{count}</span>}
          </button>
        ))}
      </div>
      {tab === 'shop' && <ShopPanel />}
      {tab === 'models' && <ModelsPanel />}
      {tab === 'search' && <SearchPanel />}
    </div>
  )
}
