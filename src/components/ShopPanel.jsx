import { useState } from 'react'
import ItemThumb from './ItemThumb'
import { useRoomStore } from '../store/roomStore'
import { CATALOG, CATEGORIES, byId, formatUSD, recommend, cheapestSubstitute, resolveItem } from '../data/catalog'
import './ShopPanel.css'

export default function ShopPanel() {
  const store = useRoomStore()
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

  return (
    <div className="shop">
      <p className="price-disclaimer">
        Prices are <strong>estimates</strong> for planning, not live retail data. Each item links to
        that store's search so you can check the real price.
      </p>

      <input
        type="search"
        className="shop-search"
        placeholder="Search items or stores"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search the catalog"
      />

      <div className="cat-row">
        <button className={`cat feature ${cat === 'for-you' ? 'active' : ''}`} onClick={() => setCat('for-you')}>
          For your vibe
        </button>
        <button className={`cat ${cat === 'all' ? 'active' : ''}`} onClick={() => setCat('all')}>
          All
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.id} className={`cat ${cat === c.id ? 'active' : ''}`} onClick={() => setCat(c.id)}>
            {c.name}
          </button>
        ))}
      </div>

      {cat === 'for-you' && (
        <p className="rec-note">
          Ranked for your <strong>{store.mood}</strong> room
          {photoPalette.length > 0 && <> and the colors from your photo</>}.
        </p>
      )}

      <div className="item-list">
        {visible.map((item, i) => {
          const qty = store.qtyOf(item.id)
          const cheaper = cheapestSubstitute(item.id)
          const owned = store.prefurnished.includes(item.id)
          return (
            <div key={item.id} className={`item ${qty ? 'in-room' : ''}`} style={{ '--i': i }}>
              <ItemThumb item={item} size={46} />

              <div className="item-body">
                <p className="item-name">
                  {item.name}
                  {owned && <span className="owned-tag">already have</span>}
                </p>
                <p className="item-meta">
                  <span className="item-price">{formatUSD(item.price)}</span>
                  <span className="item-sep">·</span>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="item-store">
                    {item.retailerName}
                  </a>
                </p>
                {cheaper && (
                  <button
                    className="cheaper-line"
                    onClick={() => (qty ? store.swapItem(item.id, cheaper.id) : store.addItem(cheaper.id))}
                    title={`${cheaper.name} at ${cheaper.retailerName}`}
                  >
                    Save {formatUSD(item.price - cheaper.price)} — {cheaper.retailerName} has a similar
                    one for {formatUSD(cheaper.price)}
                  </button>
                )}
              </div>

              {qty === 0 ? (
                <button className="add-btn" onClick={() => store.addItem(item.id)}>
                  Add
                </button>
              ) : (
                <div className="qty">
                  <button onClick={() => store.removeItem(item.id)} aria-label={`Remove one ${item.name}`}>
                    −
                  </button>
                  <span className="qty-num">{qty}</span>
                  <button onClick={() => store.addItem(item.id)} aria-label={`Add one ${item.name}`}>
                    +
                  </button>
                </div>
              )}
            </div>
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
                <span className="basket-price">{formatUSD(item.price * entry.qty)}</span>
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
