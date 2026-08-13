/**
 * A small swatch showing what that light actually looks like on a wall —
 * a warm lamp-lit glow reads completely differently from a flat grey overcast
 * wash, and "6500K" tells nobody that on its own.
 */
export default function LightPreview({ kelvin, id }) {
  const c = kelvinToRgb(kelvin)
  const dim = id === 'moody'
  const flat = id === 'overcast'

  return (
    <svg className="light-preview" viewBox="0 0 100 60" aria-hidden="true">
      <defs>
        <radialGradient id={`lp-glow-${id}`} cx="30%" cy="35%" r="75%">
          <stop offset="0%" stopColor={c.hi} />
          <stop offset="55%" stopColor={c.mid} />
          <stop offset="100%" stopColor={c.lo} />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="100" height="60" fill={flat ? c.mid : `url(#lp-glow-${id})`} />
      {!flat && (
        <circle cx="30" cy="21" r={dim ? 5 : 8} fill={c.hi} opacity={dim ? 0.9 : 0.75} />
      )}
      {/* a simple window-frame silhouette so the wash reads as light in a room */}
      <rect x="66" y="12" width="22" height="30" rx="1.5" fill="none" stroke={c.lo} strokeOpacity="0.5" strokeWidth="1.4" />
      <line x1="77" y1="12" x2="77" y2="42" stroke={c.lo} strokeOpacity="0.5" strokeWidth="1.2" />
      <line x1="66" y1="27" x2="88" y2="27" stroke={c.lo} strokeOpacity="0.5" strokeWidth="1.2" />
    </svg>
  )
}

/** Rough, presentation-only kelvin→color mapping — not a physical model. */
function kelvinToRgb(k) {
  if (k <= 2400) return { hi: '#FFD8A0', mid: '#E6A85C', lo: '#7A5230' }
  if (k <= 3000) return { hi: '#FFE6C2', mid: '#EDBE86', lo: '#8C6B45' }
  if (k <= 5000) return { hi: '#FFF4E2', mid: '#F0E4D0', lo: '#B8AC94' }
  if (k <= 6000) return { hi: '#FFFFFF', mid: '#EFF1F3', lo: '#C7CBD1' }
  return { hi: '#F0F6FF', mid: '#DCE6F0', lo: '#9AA8B8' }
}
