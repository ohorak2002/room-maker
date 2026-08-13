import { useRoomStore } from '../store/roomStore'
import { PALETTES, MOODS, LIGHTING, FLOORPLANS } from '../data/presets'
import './ControlsPanel.css'

export default function ControlsPanel() {
  const store = useRoomStore()
  const colors = store.colors()
  const dims = store.dims()
  const placed = Object.keys(store.placements).length

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
        <h3>Layout</h3>
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
      </section>

      <section className="ctl-section">
        <h3>Floorplan</h3>
        <div className="chip-grid">
          {FLOORPLANS.map((f) => (
            <button
              key={f.id}
              className={`chip ${store.floorplan === f.id && !store.customDims ? 'active' : ''}`}
              aria-pressed={store.floorplan === f.id && !store.customDims}
              onClick={() => {
                store.set('floorplan', f.id)
                store.set('customDims', null)
              }}
            >
              {f.name}
            </button>
          ))}
        </div>

        <div className="dims-grid">
          {[
            ['w', 'Width'],
            ['d', 'Depth'],
            ['h', 'Ceiling'],
          ].map(([k, label]) => (
            <label key={k} className="override">
              <span>{label} (m)</span>
              <input
                type="number"
                min="1.5"
                max="20"
                step="0.1"
                value={dims[k]}
                onChange={(e) => store.set('customDims', { ...dims, [k]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>

        {store.customDims && (
          <button className="link-btn" onClick={() => store.set('customDims', null)}>
            Back to the {store.floorplan} preset
          </button>
        )}

        {store.planImage && (
          <details className="plan-ref">
            <summary>Your floorplan</summary>
            <img src={store.planImage} alt="Your uploaded floorplan" />
          </details>
        )}
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
