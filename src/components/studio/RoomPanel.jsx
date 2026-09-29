import { useRoomStore } from '../../store/roomStore'
import Section from '../Section'
import ShapeEditor from '../ShapeEditor'
import IncludedChat from '../IncludedChat'
import HomePanel from '../HomePanel'

/** The room itself: measurements, shape, layout, and whole-home planning. */
export default function RoomPanel() {
  const store = useRoomStore()
  const dims = store.dims()
  const cells = store.shape().cells.length
  const placed = Object.keys(store.placements).length

  return (
    <div className="controls">
      <section className="studio-section studio-facts-wrap">
        <span className="studio-label">{store.activeRoom()?.name || 'Your room'}</span>
        <dl className="studio-facts">
          <dt>Width</dt><dd>{dims.w.toFixed(1)} m</dd>
          <dt>Depth</dt><dd>{dims.d.toFixed(1)} m</dd>
          <dt>Ceiling height</dt><dd>{dims.h.toFixed(1)} m</dd>
          <dt>Floor area</dt><dd>{(cells * 0.25).toFixed(1)} m²</dd>
        </dl>
        <p className="studio-note">Sizes follow the room’s half-metre grid, so they are approximate. Measure the real room before ordering anything.</p>
        <label className="switch">
          <input type="checkbox" checked={store.windows} onChange={(e) => store.set('windows', e.target.checked)} />
          <span>Window on the back wall</span>
        </label>
      </section>

      <Section title="Room shape" summary={`${dims.w.toFixed(1)} × ${dims.d.toFixed(1)} m`} defaultOpen>
        <ShapeEditor />
      </Section>

      <Section title="Layout" summary={placed === 0 ? 'Auto' : `${placed} moved`}>
        <p className="note">
          Click any piece in the room to select it, then drag to move it. Arrow keys nudge,
          <strong> R</strong> rotates. Auto-arrange re-runs the solver on everything.
        </p>
        <div className="layout-actions">
          <button className="chip" onClick={store.clearPlacements}>Auto-arrange all</button>
          <span className="readout">{placed === 0 ? 'All auto-placed' : `${placed} moved by hand`}</span>
        </div>
      </Section>

      <Section title="Whole home" summary={store.scope === 'home' ? 'Home plan' : 'Single room'}>
        <HomePanel />
      </Section>

      <Section title="What's included" summary={`${store.prefurnished.length || 'none'}`}>
        <IncludedChat />
      </Section>

      <section className="ctl-section reset-row">
        <button className="link-btn danger" onClick={store.reset}>Reset everything</button>
      </section>
    </div>
  )
}
