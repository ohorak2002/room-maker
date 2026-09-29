import { useRoomStore } from '../../store/roomStore'
import Section from '../Section'
import ShapeEditor from '../ShapeEditor'
import IncludedChat from '../IncludedChat'
import HomePanel from '../HomePanel'

/**
 * A room measured from an official Brief. Its size, shape and openings are the
 * designer's verified measurements, so they are shown but never edited here.
 */
function BriefRoom() {
  const store = useRoomStore()
  const room = store.activeRoom()
  const placed = Object.keys(store.activePlacements()).length
  if (!room) {
    return (
      <div className="controls">
        <section className="studio-section studio-facts-wrap">
          <span className="studio-label">Your home</span>
          <p className="studio-note">{store.home.rooms.length} measured room{store.home.rooms.length === 1 ? '' : 's'} from the Brief. Choose one to design it with your client.</p>
          <ul className="finish-list">
            {store.home.rooms.map((r) => (
              <li key={r.id}>
                <strong>{r.name}</strong>
                <small>{r.exactW.toFixed(3)} × {r.exactD.toFixed(3)} m · {r.area.toFixed(2)} m² · {r.items?.reduce((n, i) => n + i.qty, 0) || 0} pieces</small>
                <button className="chip" onClick={() => store.focusRoom(r.id)}>Design this room</button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    )
  }
  return (
    <div className="controls">
      <section className="studio-section studio-facts-wrap">
        <span className="studio-label">{room.name}</span>
        <dl className="studio-facts">
          <dt>Width</dt><dd>{room.exactW.toFixed(3)} m</dd>
          <dt>Depth</dt><dd>{room.exactD.toFixed(3)} m</dd>
          <dt>Ceiling height</dt><dd>{room.h.toFixed(3)} m</dd>
          <dt>Floor area</dt><dd>{room.area.toFixed(2)} m²</dd>
          <dt>Openings</dt><dd>{room.openings.length} recorded</dd>
        </dl>
        <p className="studio-note">Measured from your official Brief and locked. To change the room, start a project from a revised Brief.</p>
        {store.home.rooms.length > 1 && <button className="chip" onClick={store.exitRoom}>Back to all rooms</button>}
      </section>
      <Section title="Layout" summary={placed === 0 ? 'Auto' : `${placed} moved`} defaultOpen>
        <p className="note">
          Click any piece in the room to select it, then drag to move it. Arrow keys nudge,
          <strong> R</strong> rotates. Auto-arrange re-runs the solver on everything.
        </p>
        <div className="layout-actions">
          <button className="chip" onClick={store.clearPlacements}>Auto-arrange all</button>
          <span className="readout">{placed === 0 ? 'All auto-placed' : `${placed} moved by hand`}</span>
        </div>
      </Section>
    </div>
  )
}

/** The room itself: measurements, shape, layout, and whole-home planning. */
export default function RoomPanel() {
  const hasBrief = useRoomStore((s) => Boolean(s.brief))
  return hasBrief ? <BriefRoom /> : <ApproximateRoom />
}

function ApproximateRoom() {
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
