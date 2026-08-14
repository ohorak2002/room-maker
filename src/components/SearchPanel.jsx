import { useMemo, useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import { formatUSD } from '../data/catalog'
import { synthesize, synthesizeFromUrl, catalogMatches, EXAMPLE_QUERIES } from '../data/synth'
import ItemThumb from './ItemThumb'
import './SearchPanel.css'

export default function SearchPanel() {
  const store = useRoomStore()
  const [query, setQuery] = useState('')
  const [quality, setQuality] = useState(55)
  const [budget, setBudget] = useState(0) // 0 = no ceiling

  // One field takes both. Pasting a link is a different intent from describing
  // a piece, but making people pick the right box first is friction for no gain
  // — a string starting with http is unambiguous.
  const isUrl = /^https?:\/\//i.test(query.trim())

  const spec = useMemo(() => {
    const q = query.trim()
    if (!q) return null
    return isUrl ? synthesizeFromUrl(q, quality) : synthesize(q, quality, budget || null)
  }, [query, quality, budget, isUrl])

  const existing = useMemo(
    () => (query.trim() && !isUrl ? catalogMatches(query) : []),
    [query, isUrl]
  )

  return (
    <div className="search-panel">
      <label className="search-field">
        <span className="field-label">Describe it, or paste a product link</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="white cotton sofa — or an Amazon / IKEA link"
          autoComplete="off"
          aria-label="Describe the piece you want, or paste a product URL"
        />
      </label>

      {!query.trim() && (
        <div className="examples">
          <span className="examples-label">Try</span>
          {EXAMPLE_QUERIES.map((q) => (
            <button key={q} className="chip tiny" onClick={() => setQuery(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="dials">
        <label className="dial">
          <span className="dial-head">
            <span className="field-label">Quality</span>
            <span className="dial-value mono">{spec?.tier ?? tierName(quality)}</span>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="slider"
          />
          <span className="dial-ends">
            <span>Budget</span>
            <span>High-end</span>
          </span>
        </label>

        <label className="dial">
          <span className="dial-head">
            <span className="field-label">Max price</span>
            <span className="dial-value mono">{budget ? formatUSD(budget) : 'Any'}</span>
          </span>
          <input
            type="range"
            min="0"
            max="2000"
            step="25"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="slider"
          />
          <span className="dial-ends">
            <span>Any</span>
            <span>$2,000</span>
          </span>
        </label>
      </div>

      {query.trim() && !spec && (
        <div className="search-miss">
          <p>
            {isUrl
              ? "Couldn't read a product name out of that link."
              : `Couldn't work out what "${query}" is.`}
          </p>
          <p className="search-miss-hint">
            {isUrl
              ? 'Most store links carry the product name in the address. If this one is a short share link, open it and copy the full address, or just describe the piece instead.'
              : 'Try naming the furniture itself — "sofa", "floor lamp", "bookshelf".'}
          </p>
        </div>
      )}

      {spec && (
        <>
          <div className="spec-card">
            <div className="spec-top">
              <ItemThumb item={spec} size={72} />
              <div className="spec-head">
                <p className="spec-name">{spec.name}</p>
                <p className="spec-price">
                  <span className="spec-amount">{formatUSD(spec.price)}</span>
                  <span className="spec-tier">{spec.tier}</span>
                </p>
                {spec.downgraded && (
                  <p className="spec-note">
                    Dropped to {spec.tier} to stay under {formatUSD(budget)}.
                  </p>
                )}
              </div>
            </div>

            <dl className="spec-attrs">
              {[
                ['Type', spec.parsed.type],
                ['Colour', spec.parsed.color],
                ['Material', spec.parsed.material],
                ['Size', spec.parsed.size],
                ['Height', `${spec.h} m`],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
            </dl>

            <div className="spec-actions">
              <button className="btn-primary" onClick={() => store.addSynthetic(spec)}>
                Put it in the room
              </button>
              <a className="btn-quiet bordered" href={spec.url} target="_blank" rel="noopener noreferrer">
                Find it at {spec.retailerName}
              </a>
            </div>

            {spec.generic && (
              <p className="spec-note">
                No model of this yet, so it goes in as a plain box at roughly the right size. It
                still moves, prices and links like anything else.
              </p>
            )}

            <p className="spec-disclaimer">
              {spec.fromUrl ? (
                <>
                  Read from the <strong>address</strong> of that link, not from the page. Retailers
                  block apps from loading their pages, and this app has no server to do it from — so
                  the shape and colour come from the product name in the URL, and the price is what
                  this kind of piece typically costs, <strong>not</strong> the listed price. The link
                  goes back to your page.
                </>
              ) : (
                <>
                  This is a <strong>specification</strong>, not a listing. Nothing here searched a
                  store — no free product API exists to search with — so the price is what this piece
                  typically costs at {spec.retailerName}, and the link runs the real search.
                </>
              )}
            </p>
          </div>

          <div className="ladder">
            <h4>What more or less money buys</h4>
            {spec.ladder.map((rung) => (
              <a
                key={rung.name}
                className={`ladder-row ${rung.name === spec.tier ? 'current' : ''}`}
                href={rung.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="ladder-tier">{rung.name}</span>
                <span className="ladder-store">{rung.store}</span>
                <span className="ladder-price mono">{formatUSD(rung.price)}</span>
              </a>
            ))}
          </div>
        </>
      )}

      {existing.length > 0 && (
        <div className="already">
          <h4>Already in the catalog</h4>
          {existing.map((item) => (
            <div key={item.id} className="already-row">
              <ItemThumb item={item} size={38} />
              <div className="already-body">
                <p className="already-name">{item.name}</p>
                <p className="already-meta">
                  <span className="item-price">{formatUSD(item.price)}</span>
                  <span className="item-sep">·</span>
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    {item.retailerName}
                  </a>
                </p>
              </div>
              <button className="add-btn" onClick={() => store.addItem(item.id)}>
                Add
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const tierName = (q) =>
  q < 20 ? 'Budget' : q < 45 ? 'Value' : q < 70 ? 'Mid-range' : q < 88 ? 'Premium' : 'High-end'
