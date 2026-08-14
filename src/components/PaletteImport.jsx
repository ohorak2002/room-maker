import { useMemo, useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import './PaletteImport.css'

/**
 * Paste a palette in and use it.
 *
 * Coolors, Adobe Color, Figma, a screenshot's eyedropper — people already have
 * a palette they like long before they get here, and the six built-in ones
 * can't cover that. Anything with hex codes in it works, including a bare
 * Coolors URL, because the codes are right there in the path.
 *
 * Which colour becomes which surface is decided by lightness, not by the order
 * they were pasted. Palette tools list colours by hue or by taste; a room needs
 * to know which one is the wall. The lightest is almost always the wall, the
 * darkest the floor, and the most saturated of what's left is the accent.
 */

const HEX = /#?\b([0-9a-f]{6}|[0-9a-f]{3})\b/gi

/** Every hex in a blob of text or a URL, expanded to six digits. */
export function extractHexes(text) {
  const out = []
  const seen = new Set()
  for (const m of String(text).matchAll(HEX)) {
    let h = m[1].toLowerCase()
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    const hex = `#${h}`
    if (!seen.has(hex)) {
      seen.add(hex)
      out.push(hex)
    }
  }
  return out
}

const toRgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]

// Perceived brightness, not the arithmetic mean — green reads far lighter than
// blue at the same numeric value, and averaging would call a navy and an olive
// equally dark.
const lightness = (hex) => {
  const [r, g, b] = toRgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

const saturation = (hex) => {
  const [r, g, b] = toRgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max === 0 ? 0 : (max - min) / max
}

/** Sort a pasted palette into the roles a room actually has. */
export function assignRoles(hexes) {
  if (hexes.length < 2) return null
  const byLight = [...hexes].sort((a, b) => lightness(b) - lightness(a))

  const wall = byLight[0]
  const floor = byLight[byLight.length - 1]
  const middle = byLight.slice(1, -1)
  const pool = middle.length ? middle : byLight
  const accent = [...pool].sort((a, b) => saturation(b) - saturation(a))[0]

  return { wall, floor, accent }
}

export default function PaletteImport() {
  const store = useRoomStore()
  const [text, setText] = useState('')

  const hexes = useMemo(() => extractHexes(text), [text])
  const roles = useMemo(() => assignRoles(hexes), [hexes])

  const apply = () => {
    if (!roles) return
    store.pushHistory()
    store.set('wallOverride', roles.wall)
    store.set('floorOverride', roles.floor)
    setText('')
  }

  return (
    <div className="pal-import">
      <label className="field">
        <span className="field-label">Paste a palette</span>
        <textarea
          className="pal-input"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="#264653 #2A9D8F #E9C46A — or a coolors.co link"
          spellCheck={false}
        />
      </label>

      {text.trim() && !hexes.length && (
        <p className="pal-miss">
          No colour codes in there. Paste hex codes like <code>#2A9D8F</code>, or the address of a
          Coolors palette — the codes are in the link itself.
        </p>
      )}

      {hexes.length > 0 && (
        <>
          <div className="pal-swatches">
            {hexes.map((h) => (
              <span key={h} className="pal-chip" style={{ background: h }} title={h} />
            ))}
            <span className="pal-count mono">
              {hexes.length} colour{hexes.length === 1 ? '' : 's'}
            </span>
          </div>

          {roles ? (
            <>
              <div className="pal-roles">
                {[
                  ['Walls', roles.wall],
                  ['Floor', roles.floor],
                  ['Accent', roles.accent],
                ].map(([label, hex]) => (
                  <div key={label} className="pal-role">
                    <span className="pal-role-dot" style={{ background: hex }} />
                    <span className="pal-role-name">{label}</span>
                    <span className="pal-role-hex mono">{hex}</span>
                  </div>
                ))}
              </div>
              <p className="pal-note">
                Sorted by how light each colour reads, not the order you pasted them — the lightest
                becomes the walls, the darkest the floor.
              </p>
              <button className="btn-primary full" onClick={apply}>
                Use this palette
              </button>
            </>
          ) : (
            <p className="pal-miss">Needs at least two colours to tell a wall from a floor.</p>
          )}
        </>
      )}
    </div>
  )
}
