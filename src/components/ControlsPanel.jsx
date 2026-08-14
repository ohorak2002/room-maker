import { useRoomStore } from '../store/roomStore'
import Section from './Section'
import ShapeEditor from './ShapeEditor'
import IncludedChat from './IncludedChat'
import PaletteImport from './PaletteImport'
import { PALETTES, MOODS, LIGHTING } from '../data/presets'
import './ControlsPanel.css'

export default function ControlsPanel() {
  const store = useRoomStore()
  const colors = store.colors()
  const dims = store.dims()
  const placed = Object.keys(store.placements).length

  return (
    <div className="controls">
      <Section title="Palette" summary={PALETTES.find((p) => p.id === store.palette)?.name} defaultOpen>
        <div className="palette-list">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              className={`palette-row ${store.palette === p.id ? 'active' : ''}`}
              aria-pressed={store.palette === p.id}
              onClick={() => store.set('palette', p.id)}
            >
              <span className="palette-chips">
                {[p.wall, p.floor, p.trim, p.accent].map((c) => (
                  <span key={c} style={{ background: c }} />
                ))}
              </span>
              <span className="palette-name">{p.name}</span>
            </button>
          ))}
        </div>

        <div className="override-grid">
          <label className="override">
            <span>Wall</span>
            <input
              type="color"
              value={store.wallOverride || colors.wall}
              onChange={(e) => store.set('wallOverride', e.target.value)}
            />
          </label>
          <label className="override">
            <span>Floor</span>
            <input
              type="color"
              value={store.floorOverride || colors.floor}
              onChange={(e) => store.set('floorOverride', e.target.value)}
            />
          </label>
        </div>
        {(store.wallOverride || store.floorOverride) && (
          <button
            className="link-btn"
            onClick={() => {
              store.set('wallOverride', null)
              store.set('floorOverride', null)
            }}
          >
            Reset to palette colors
          </button>
        )}
      </Section>

      <Section title="Your own palette" summary="Paste hex codes">
        <PaletteImport />
      </Section>

      <Section title="Feel" summary={MOODS.find((m) => m.id === store.mood)?.name}>
        <div className="chip-grid">
          {MOODS.map((m) => (
            <button
              key={m.id}
              className={`chip ${store.mood === m.id ? 'active' : ''}`}
              aria-pressed={store.mood === m.id}
              onClick={() => store.set('mood', m.id)}
            >
              {m.name}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Light" summary={LIGHTING.find((l) => l.id === store.lighting)?.name}>
        <div className="chip-grid">
          {LIGHTING.map((l) => (
            <button
              key={l.id}
              className={`chip ${store.lighting === l.id ? 'active' : ''}`}
              aria-pressed={store.lighting === l.id}
              onClick={() => store.set('lighting', l.id)}
            >
              {l.name}
            </button>
          ))}
        </div>

        <label className="switch">
          <input
            type="checkbox"
            checked={store.windows}
            onChange={(e) => store.set('windows', e.target.checked)}
          />
          <span>Window on the back wall</span>
        </label>
      </Section>

      <Section title="Layout" summary={placed === 0 ? "Auto" : `${placed} moved`} defaultOpen>
        <p className="note">
          Click any piece in the room to select it, then drag to move it. Arrow keys nudge,
          <strong> R</strong> rotates. Auto-arrange re-runs the solver on everything.
        </p>
        <div className="layout-actions">
          <button className="chip" onClick={store.clearPlacements}>
            Auto-arrange all
          </button>
          <span className="readout">
            {placed === 0 ? 'All auto-placed' : `${placed} moved by hand`}
          </span>
        </div>
      </Section>

      <Section title="Room shape" summary={`${dims.w.toFixed(1)} × ${dims.d.toFixed(1)} m`}>
        <ShapeEditor />
      </Section>

      <Section title="What's included" summary={`${store.prefurnished.length || 'none'}`}>
        <IncludedChat />
      </Section>

      <section className="ctl-section reset-row">
        <button className="link-btn danger" onClick={store.reset}>
          Reset everything
        </button>
      </section>
    </div>
  )
}
