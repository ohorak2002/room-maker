import { useEffect, useRef, useState } from 'react'
import './AddressField.css'

/**
 * A text field with real address suggestions as you type.
 *
 * This calls Photon (photon.komoot.io), a free, no-key geocoding API built on
 * OpenStreetMap data. That's a real trade-off worth stating plainly: unlike
 * every other field in this app, what you type here is sent to a third-party
 * server to generate suggestions — it is not "stored locally only." Only the
 * text you type goes out, nothing else about you, and it's a widely-used
 * public service, not a private tracker. If a request fails or the API is
 * unreachable, the field still works as a plain text input; nothing breaks.
 *
 * This is address lookup, not floorplan lookup — it can complete "3434 Johnson
 * Fer-" into a real street address, but it cannot tell you the square footage
 * or layout of a specific unit. No public data source does that.
 */
export default function AddressField({ value, onChange, placeholder }) {
  const [query, setQuery] = useState(value || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const abortRef = useRef(null)
  const boxRef = useRef(null)
  // Set right before picking a suggestion, so the query-change that pick()
  // itself causes doesn't turn around and re-fetch for the address just
  // selected. Ordinary typing never touches this flag.
  const suppressNextFetch = useRef(false)

  useEffect(() => setQuery(value || ''), [value])

  useEffect(() => {
    if (suppressNextFetch.current) {
      suppressNextFetch.current = false
      return
    }
    if (query.trim().length < 3) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lang=en`, {
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return
          const formatted = (data.features || [])
            .map((f) => formatAddress(f.properties))
            .filter(Boolean)
          setResults(formatted)
          setOpen(formatted.length > 0)
          setHighlight(-1)
        })
        .catch(() => {}) // aborted, offline, or the public API is rate-limiting — fail quietly
        .finally(() => setLoading(false))
    }, 320)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const onClickOutside = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onClickOutside)
    return () => document.removeEventListener('pointerdown', onClickOutside)
  }, [])

  const pick = (address) => {
    suppressNextFetch.current = true
    setQuery(address)
    onChange(address)
    setResults([])
    setOpen(false)
  }

  const onKeyDown = (e) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault()
      pick(results[highlight])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="address-field" ref={boxRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          onChange(e.target.value)
        }}
        onKeyDown={onKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {loading && <span className="address-spinner" aria-hidden="true" />}

      {open && results.length > 0 && (
        <ul className="address-suggestions" role="listbox">
          {results.map((r, i) => (
            <li key={r + i} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                className={i === highlight ? 'active' : ''}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(r)}
              >
                {r}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function formatAddress(p) {
  if (!p) return null
  const line1 = [p.housenumber, p.street].filter(Boolean).join(' ') || p.name
  const line2 = [p.city || p.town || p.village, p.state, p.postcode].filter(Boolean).join(', ')
  const parts = [line1, line2].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}
