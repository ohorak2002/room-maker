import { sceneFor } from '../data/moodScenes'

/**
 * A small illustrated room standing in for the mood word — "cozy" as a
 * picture instead of a guess. Deliberately flat and graphic (not a photo, not
 * a 3D render) so it reads as an honest sketch of a feeling, not a promise
 * about what the generated room will look like pixel-for-pixel.
 */
export default function MoodPreview({ moodId }) {
  const s = sceneFor(moodId)

  return (
    <svg className="mood-preview" viewBox="0 0 100 100" aria-hidden="true">
      <rect x="0" y="0" width="100" height="66" fill={s.wall} />
      <rect x="0" y="66" width="100" height="34" fill={s.floor} />
      {s.furniture.map((f, i) => (
        <Piece key={i} f={f} scene={s} />
      ))}
    </svg>
  )
}

function Piece({ f, scene }) {
  const color = f.alt ? scene.accent2 || scene.accent : scene.accent
  const rx = f.sharp ? 1 : scene.corner ?? 10
  const s = f.s ?? 1

  switch (f.t) {
    case 'sofa':
      return (
        <g transform={`translate(${f.x} ${f.y}) scale(${s})`}>
          <rect x="-16" y="-6" width="32" height="14" rx={rx} fill={color} />
          <rect x="-16" y="-13" width="32" height="9" rx={rx} fill={color} opacity="0.85" />
        </g>
      )
    case 'cushion':
      return <circle cx={f.x} cy={f.y} r={9 * s} fill={color} />
    case 'plant': {
      const g = scene.accent2 && f.alt ? scene.accent2 : '#5F8A54'
      return (
        <g transform={`translate(${f.x} ${f.y}) scale(${s})`}>
          <rect x="-4" y="6" width="8" height="8" rx="2" fill="#B4785A" />
          <circle cx="0" cy="-2" r="9" fill={g} />
          <circle cx="-6" cy="4" r="6" fill={g} opacity="0.85" />
          <circle cx="6" cy="4" r="6" fill={g} opacity="0.85" />
        </g>
      )
    }
    case 'lamp':
      return (
        <g transform={`translate(${f.x} ${f.y}) scale(${s})`}>
          <line x1="0" y1="0" x2="0" y2="22" stroke={color} strokeWidth="1.6" />
          {f.glow && (
            <circle cx="0" cy="0" r="12" fill={f.hot ? '#FFB877' : '#FFE3A8'} opacity="0.4" />
          )}
          <circle cx="0" cy="0" r="6" fill={f.glow ? (f.hot ? '#FF9A54' : '#FFD98A') : color} />
        </g>
      )
    case 'frame':
      return (
        <g transform={`translate(${f.x} ${f.y}) scale(${s})`}>
          <rect x="-8" y="-6" width="16" height="12" rx={rx * 0.4} fill="none" stroke={color} strokeWidth="1.6" />
          <rect x="-5.5" y="-3.5" width="11" height="7" rx={rx * 0.3} fill={color} opacity="0.5" />
        </g>
      )
    case 'shelf':
      return (
        <g transform={`translate(${f.x} ${f.y}) scale(${s})`}>
          <rect x="-3" y="-20" width="6" height="40" fill={color} />
          {[-14, -2, 10].map((y) => (
            <rect key={y} x="-9" y={y} width="18" height="2.4" fill={color} />
          ))}
        </g>
      )
    case 'books':
      return (
        <g transform={`translate(${f.x} ${f.y}) scale(${s})`}>
          {[0, 3, 6, 9].map((dx, i) => (
            <rect key={dx} x={-6 + dx} y={-6 + (i % 2)} width="2.4" height={8 - (i % 2)} fill={color} opacity={0.7 + i * 0.06} />
          ))}
        </g>
      )
    case 'rug':
      return <ellipse cx={f.x} cy={f.y} rx={20 * s} ry={7 * s} fill={color} opacity="0.35" />
    default:
      return null
  }
}
