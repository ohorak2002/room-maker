import { useRoomStore } from '../store/roomStore'
import { PALETTES, MOODS, LIGHTING, FLOORPLANS, getFloorplan } from '../data/presets'
import './ControlsPanel.css'

export default function ControlsPanel() {
  const store = useRoomStore()
  const colors = store.colors()
  const plan = getFloorplan(store.floorplan)

  return (
    <div className="controls">
      <section className="ctl-section">
        <h3>Palette</h3>
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
      </section>

      <section className="ctl-section">
        <h3>Feel</h3>
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
      </section>

      <section className="ctl-section">
        <h3>Light</h3>
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
      </section>

      <section className="ctl-section">
        <h3>Floorplan</h3>
        <div className="chip-grid">
          {FLOORPLANS.map((f) => (
            <button
              key={f.id}
              className={`chip ${store.floorplan === f.id ? 'active' : ''}`}
              aria-pressed={store.floorplan === f.id}
              onClick={() => store.set('floorplan', f.id)}
            >
              {f.name}
            </button>
          ))}
        </div>
        <p className="readout">
          {plan.w}m × {plan.d}m × {plan.h}m ceiling
        </p>
      </section>

      <section className="ctl-section">
        <h3>Thermostat</h3>
        <div className="slider-row">
          <input
            type="range"
            min="60"
            max="85"
            value={store.temperature}
            onChange={(e) => store.set('temperature', Number(e.target.value))}
            className="slider"
            aria-label="Room temperature in Fahrenheit"
          />
          <span className="readout mono">{store.temperature}°F</span>
        </div>
        <p className="note">
          Comfort setting saved with the design — it doesn't change the 3D view.
        </p>
      </section>

      <section className="ctl-section">
        <button className="link-btn danger" onClick={store.reset}>
          Reset everything
        </button>
      </section>
    </div>
  )
}
