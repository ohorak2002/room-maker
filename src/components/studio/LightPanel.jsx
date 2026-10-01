import { useRoomStore } from '../../store/roomStore'
import { useUiStore } from '../../store/uiStore'
import { LIGHTING } from '../../data/presets'
import { ROOM_DEFAULTS } from '../../../shared/project.mjs'
import Icon from '../Icons'

// The three headline presets map onto the room's existing lighting rigs. The
// rest stay available underneath, so no saved project loses its lighting.
const HEADLINE = [
  { id: 'natural', label: 'Soft daylight', note: 'Bright, balanced, natural', icon: 'light' },
  { id: 'golden', label: 'Golden hour', note: 'Warm light, long low sun', icon: 'sunset' },
  { id: 'moody', label: 'Evening', note: 'Dim, pooled light, deep shadow', icon: 'moon' },
]

export default function LightPanel() {
  const lighting = useRoomStore((s) => s.lighting)
  const studio = useRoomStore((s) => s.studio)
  const set = useRoomStore((s) => s.set)
  const setStudio = useRoomStore((s) => s.setStudio)
  const sunDefault = useUiStore((s) => s.sunDefault)
  const others = LIGHTING.filter((l) => !HEADLINE.some((h) => h.id === l.id))
  const sun = studio.sun ?? sunDefault
  // A room measured in a Brief records its own lighting; reset returns to that,
  // otherwise to the app's default. Brightness, sun height and accent lights return to their defaults.
  const defaultLighting = useRoomStore((s) => s.activeRoom()?.lighting) ?? ROOM_DEFAULTS.lighting
  const D = ROOM_DEFAULTS.studio
  const atDefault = lighting === defaultLighting && studio.brightness === D.brightness && studio.sun === D.sun && studio.accent === D.accent
  const reset = () => { set('lighting', defaultLighting); setStudio({ ...D }) }

  return (
    <div className="studio-section">
      <span className="studio-label" id="light-presets">Lighting preset</span>
      <div className="preset-list" role="group" aria-labelledby="light-presets">
        {HEADLINE.map((p) => (
          <button key={p.id} className="preset" aria-pressed={lighting === p.id} onClick={() => set('lighting', p.id)}>
            <span className={`preset-icon tone-${p.id}`}><Icon name={p.icon} size={17} /></span>
            <span className="preset-text">
              <strong>{p.label}</strong>
              <small>{p.note}</small>
            </span>
            <Icon name="check" size={14} className="preset-check" />
          </button>
        ))}
      </div>

      <div className="chip-grid studio-others" role="group" aria-label="More lighting presets">
        {others.map((l) => (
          <button key={l.id} className={`chip ${lighting === l.id ? 'active' : ''}`} aria-pressed={lighting === l.id} title={l.blurb} onClick={() => set('lighting', l.id)}>
            {l.name}
          </button>
        ))}
      </div>

      <div className="studio-rule" />

      <label className="studio-label studio-spread" htmlFor="light-brightness">
        Brightness <output>{studio.brightness}%</output>
      </label>
      <input id="light-brightness" type="range" min="65" max="140" step="1" value={studio.brightness} onChange={(e) => setStudio({ brightness: Number(e.target.value) })} />

      <label className="studio-label studio-spread studio-space" htmlFor="light-sun">
        Sun height <output>{Math.round(sun)}°{studio.sun == null ? ' · room default' : ''}</output>
      </label>
      <input id="light-sun" type="range" min="5" max="85" step="1" value={sun} onChange={(e) => setStudio({ sun: Number(e.target.value) })} />
      {studio.sun != null && (
        <button className="link-btn" onClick={() => setStudio({ sun: null })}>Back to the room’s default</button>
      )}

      <div className="studio-rule" />

      <label className="studio-check">
        <span>
          <strong>Accent lighting</strong>
          <small>Lamps, strips and glowing pieces</small>
        </span>
        <input type="checkbox" checked={studio.accent} onChange={(e) => setStudio({ accent: e.target.checked })} />
      </label>

      <button className="studio-btn" disabled={atDefault} onClick={reset} title="Back to this room's recorded lighting, 100% brightness, the room's sun height and accent lights on">Reset lighting</button>

      <p className="studio-note">
        <Icon name="info" size={14} />
        <span>Lighting changes how a finish looks. Confirm any real finish against a physical sample.</span>
      </p>
    </div>
  )
}
