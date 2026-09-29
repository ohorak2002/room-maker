import { useState } from 'react'
import ItemThumb from './ItemThumb'
import Icon from './Icons'
import { useRoomStore } from '../store/roomStore'
import { useUiStore } from '../store/uiStore'
import { CATALOG, CATEGORIES, byId, formatUSD, recommend, cheapestSubstitute, resolveItem } from '../data/catalog'
import './ShopPanel.css'

const CATEGORY_NAME = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.name]))

export default function ShopPanel() {
  const store = useRoomStore()
  const selectedItemId = useUiStore((s) => s.selectedItemId)
  const [cat, setCat] = useState('for-you')
  const [query, setQuery] = useState('')

  // In whole-home scope this is the focused room's list, not the global one.
  const activeItems = store.activeItems()
  const photoPalette = store.photo?.palette || []
  // The focused room's kind steers the feed, so a bathroom recommends fixtures
  // rather than whatever the home's overall mood would have suggested.
  const recs = recommend(store.mood, photoPalette, 40, store.activeRoom()?.kind || null)

  const q = query.trim().toLowerCase()
  const base = cat === 'for-you' ? recs : CATALOG.filter((i) => cat === 'all' || i.cat === cat)
  const visible = base.filter(
    (i) => !q || i.name.toLowerCase().includes(q) || i.retailerName.toLowerCase().includes(q)
  )

  const total = activeItems.reduce(
    (sum, i) => sum + (resolveItem(i.id, store.synthetics)?.price || 0) * i.qty,
    0
  )
  const savings = activeItems.reduce((sum, entry) => {
    const item = byId(entry.id)
    const cheaper = cheapestSubstitute(entry.id)
    return cheaper ? sum + (item.price - cheaper.price) * entry.qty : sum
  }, 0)

  const chips = [
    { id: 'for-you', name: 'For your style' },
    { id: 'all', name: 'All' },
    ...CATEGORIES,
  ]

  return (
    <div className="shop">
      <div className="shop-head">
        <label className="shop-search">
          <Icon name="search" size={16} />
          <input
            type="search"
            placeholder="Search sofas, rugs, lighting…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search the catalog"
          />
        </label>

        <div className="cat-row" role="group" aria-label="Category">
          {chips.map((c) => (
            <button
              key={c.id}
              className={`cat ${cat === c.id ? 'active' : ''}`}
              aria-pressed={cat === c.id}
              onClick={() => setCat(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        <p className="shop-meta">
          {visible.length} concept {visible.length === 1 ? 'piece' : 'pieces'}
          {cat === 'for-you' && (
            <>
              {' '}ranked for your <strong>{store.mood}</strong> room
              {photoPalette.length > 0 && <> and photo colours</>}
            </>
          )}
          {' '}· prices estimated, sizes approximate
        </p>
      </div>

      <div className="card-grid">
        {visible.map((item, i) => {
          const qty = store.qtyOf(item.id)
          const cheaper = cheapestSubstitute(item.id)
          const owned = store.prefurnished.includes(item.id)
          const selected = selectedItemId === item.id
          return (
            <article
              key={item.id}
              className={`card ${qty ? 'in-room' : ''} ${selected ? 'selected' : ''}`}
              style={{ '--i': i }}
            >
              <div className="card-photo">
                <ItemThumb item={item} size={null} className="card-thumb" />
                <span className="card-badge">{owned ? 'Already have' : 'Concept'}</span>
              </div>
              <div className="card-body">
                <span className="card-eyebrow">{CATEGORY_NAME[item.cat] || 'Piece'}</span>
                <h3 className="card-name">{item.name}</h3>
                <p className="card-price">
                  {formatUSD(item.price)} <span>est.</span>
                </p>
                <p className="card-dims">
                  H ≈ {Math.round(item.h * 100)} cm · {item.retailerName}
                </p>
                {cheaper && (
                  <button
                    className="cheaper-line"
                    onClick={() => (qty ? store.swapItem(item.id, cheaper.id) : store.addItem(cheaper.id))}
                    title={`${cheaper.name} at ${cheaper.retailerName}`}
                  >
                    Similar for {formatUSD(cheaper.price)} at {cheaper.retailerName}
                  </button>
                )}
                {qty === 0 ? (
                  <button className="card-add" onClick={() => store.addItem(item.id)}>
                    <Icon name="plus" size={14} strokeWidth={2} />
                    Add to room
                  </button>
                ) : (
                  <div className="card-qty">
                    <span className="card-in-room">
                      <Icon name="check" size={14} strokeWidth={2.2} />
                      In room{qty > 1 ? ` · ${qty}` : ''}
                    </span>
                    <button onClick={() => store.removeItem(item.id)} aria-label={`Remove one ${item.name}`}>
                      −
                    </button>
                    <button onClick={() => store.addItem(item.id)} aria-label={`Add one ${item.name}`}>
                      +
                    </button>
                  </div>
                )}
              </div>
            </article>
          )
        })}
        {visible.length === 0 && <p className="empty">Nothing matches "{query}".</p>}
      </div>

      {activeItems.length > 0 && (
        <div className="basket">
          <div className="basket-head">
            <h4>In your room</h4>
            <button className="link-btn" onClick={store.clearAll}>
              Clear
            </button>
          </div>
          {activeItems.map((entry) => {
            const item = resolveItem(entry.id, store.synthetics)
            if (!item) return null
            return (
              <div key={entry.id} className="basket-row">
                <span className="basket-name">
                  {item.name}
                  {entry.qty > 1 && <span className="basket-qty"> ×{entry.qty}</span>}
                </span>
                <span className="basket-price">{formatUSD(item.price == null ? null : item.price * entry.qty)}</span>
              </div>
            )
          })}
          <div className="basket-row total">
            <span>Estimated total</span>
            <span className="basket-price">{formatUSD(total)}</span>
          </div>
          {savings > 0 && (
            <p className="savings-note">
              Swapping every piece for its cheapest equivalent would save about{' '}
              <strong>{formatUSD(savings)}</strong>.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
