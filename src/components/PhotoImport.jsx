import { useRef, useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import { recommend, formatUSD, cheapestSubstitute } from '../data/catalog'
import './PhotoImport.css'

/**
 * Import a photo of a room you like (a listing shot, an open house, a Pinterest
 * save) and pull its palette out in the browser.
 *
 * What this does: quantizes the image down to its dominant colors and lets you
 * apply them to your walls and floor, then recommends catalog pieces that match
 * that palette and your chosen vibe.
 *
 * What this does NOT do: recognize the objects in the photo. That needs a vision
 * model, which would be a real addition rather than a tweak — see the note in
 * the UI. Until then you tag what you see and the matcher does the rest.
 */
export default function PhotoImport() {
  const store = useRoomStore()
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const photo = store.photo

  const onFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setBusy(true)
    try {
      const dataUrl = await readAsDataUrl(file)
      const palette = await extractPalette(dataUrl)
      store.set('photo', { dataUrl, palette })
    } finally {
      setBusy(false)
    }
  }

  const applyPalette = () => {
    if (!photo?.palette?.length) return
    const sorted = [...photo.palette].sort((a, b) => luminance(b) - luminance(a))
    store.set('wallOverride', sorted[0])
    store.set('floorOverride', sorted[sorted.length - 1])
  }

  const matches = photo ? recommend(store.mood, photo.palette, 8) : []

  return (
    <div className="photo-import">
      <p className="photo-blurb">
        Have a photo of a room you like — a listing, a model home, a screenshot? Drop it in and
        we'll pull the colors out and find pieces that match.
      </p>

      {!photo ? (
        <div
          className={`dropzone ${busy ? 'busy' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            onFile(e.dataTransfer.files?.[0])
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
        >
          <span className="drop-icon" aria-hidden="true" />
          <span className="drop-label">{busy ? 'Reading colors…' : 'Drop a photo, or click to browse'}</span>
          <span className="drop-sub">Stays on your device — nothing is uploaded</span>
        </div>
      ) : (
        <>
          <div className="photo-preview">
            <img src={photo.dataUrl} alt="Imported room reference" />
            <button className="photo-clear" onClick={() => store.set('photo', null)}>
              Remove
            </button>
          </div>

          <div className="extracted">
            <h4>Colors found</h4>
            <div className="extracted-row">
              {photo.palette.map((c) => (
                <button
                  key={c}
                  className="extracted-chip"
                  style={{ background: c }}
                  title={`Use ${c} for walls`}
                  onClick={() => store.set('wallOverride', c)}
                >
                  <span className="sr-only">{c}</span>
                </button>
              ))}
            </div>
            <p className="extracted-hint">Click a color to paint the walls with it.</p>
            <button className="btn-primary full" onClick={applyPalette}>
              Apply lightest to walls, darkest to floor
            </button>
          </div>

          <div className="matches">
            <h4>Pieces that fit this photo</h4>
            <p className="matches-sub">
              Ranked by how close each item sits to the photo's palette and your "{store.mood}" vibe.
            </p>
            {matches.map((item) => {
              const cheaper = cheapestSubstitute(item.id)
              return (
                <div key={item.id} className="match-row">
                  <span className="match-swatch" style={{ background: item.color }} aria-hidden="true" />
                  <div className="match-body">
                    <p className="match-name">{item.name}</p>
                    <p className="match-meta">
                      <span className="match-price">{formatUSD(item.price)}</span>
                      <span className="dot">·</span>
                      <a href={item.url} target="_blank" rel="noopener noreferrer">
                        {item.retailerName}
                      </a>
                    </p>
                    {cheaper && (
                      <p className="match-cheaper">
                        Cheapest similar: {formatUSD(cheaper.price)} at{' '}
                        <a href={cheaper.url} target="_blank" rel="noopener noreferrer">
                          {cheaper.retailerName}
                        </a>
                      </p>
                    )}
                  </div>
                  <button className="add-btn" onClick={() => store.addItem(item.id)}>
                    Add
                  </button>
                </div>
              )
            })}
          </div>

          <p className="detector-note">
            <strong>Not yet:</strong> automatic object recognition. Identifying the actual chair or
            lamp in a photo needs a vision model, which isn't wired up. Right now the match is by
            color and vibe — so treat these as starting points, not a parts list.
          </p>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result)
    fr.onerror = reject
    fr.readAsDataURL(file)
  })
}

/**
 * Quantize to a coarse RGB grid, count buckets, and return the most common
 * colors that are far enough apart to read as distinct.
 */
function extractPalette(dataUrl, want = 6) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const size = 100
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0, size, size)
      const { data } = ctx.getImageData(0, 0, size, size)

      const buckets = new Map()
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const key = `${r >> 4}-${g >> 4}-${b >> 4}`
        const e = buckets.get(key)
        if (e) {
          e.r += r; e.g += g; e.b += b; e.n++
        } else {
          buckets.set(key, { r, g, b, n: 1 })
        }
      }

      const ranked = [...buckets.values()]
        .map((e) => ({ rgb: [e.r / e.n, e.g / e.n, e.b / e.n], n: e.n }))
        .sort((a, b) => b.n - a.n)

      const picked = []
      for (const c of ranked) {
        if (picked.length >= want) break
        // Keep colors visually separated so the palette isn't six greys.
        if (picked.every((p) => dist(p, c.rgb) > 48)) picked.push(c.rgb)
      }
      // Top up if the image really is monochrome.
      for (const c of ranked) {
        if (picked.length >= Math.min(want, 4)) break
        if (!picked.includes(c.rgb)) picked.push(c.rgb)
      }

      resolve(picked.map(toHex))
      canvas.width = canvas.height = 0
    }
    img.onerror = () => resolve([])
    img.src = dataUrl
  })
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

const toHex = (rgb) =>
  '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

function luminance(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return 0
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
