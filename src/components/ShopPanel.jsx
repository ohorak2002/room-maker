import { useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import { CATALOG, CATEGORIES, byId, formatUSD } from '../data/catalog'
import './ShopPanel.css'

export default function ShopPanel() {
  const store = useRoomStore()
  const [cat, setCat] = useState('greenery')
  const [query, setQuery] = useState('')

  const visible = CATALOG.filter((i) => {
    const inCat = cat === 'all' || i.cat === cat
    const q = query.trim().toLowerCase()
    const matches = !q || i.name.toLowerCase().includes(q) || i.retailerName.toLowerCase().includes(q)
    return inCat && matches
  })

  const total = store.items.reduce((sum, i) => sum + (byId(i.id)?.price || 0) * i.qty, 0)

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
        <button className={`cat ${cat === 'all' ? 'active' : ''}`} onClick={() => setCat('all')}>
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`cat ${cat === c.id ? 'active' : ''}`}
            onClick={() => setCat(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="item-list">
        {visible.map((item) => {
          const qty = store.qtyOf(item.id)
          return (
            <div key={item.id} className={`item ${qty ? 'in-room' : ''}`}>
              <span className="item-swatch" style={{ background: item.color }} aria-hidden="true" />

              <div className="item-body">
                <p className="item-name">{item.name}</p>
                <p className="item-meta">
                  <span className="item-price">{formatUSD(item.price)}</span>
                  <span className="item-sep">·</span>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="item-store">
                    {item.retailerName}
                  </a>
                </p>
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

      {store.items.length > 0 && (
        <div className="basket">
          <div className="basket-head">
            <h4>In your room</h4>
            <button className="link-btn" onClick={store.clearAll}>
              Clear
            </button>
          </div>
          {store.items.map((entry) => {
            const item = byId(entry.id)
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
        </div>
      )}
    </div>
  )
}
