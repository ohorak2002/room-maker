import { useRef, useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import { TRACE_KINDS, kindLabel, scaleFrom, homeFromTrace } from '../data/tracePlan'
import { mToFt } from '../data/presets'
import './FloorplanTracer.css'

/**
 * Trace a real floorplan into a real home.
 *
 * The honest workaround for a problem that has no API: nobody publishes
 * room-by-room dimensions for an address, but the person standing in the
 * apartment usually has the floorplan already — in the listing, in the lease,
 * on the leasing office's wall. Drawing over it takes a minute and produces a
 * plan that is actually theirs.
 *
 * Two steps, in order, because the second is meaningless without the first:
 * set the scale, then draw the rooms.
 */
export default function FloorplanTracer({ onDone, onCancel }) {
  const store = useRoomStore()
  const [step, setStep] = useState('scale') // 'scale' | 'rooms'
  const [line, setLine] = useState(null) // { x1, y1, x2, y2 } in image px
  const [feet, setFeet] = useState(12)
  const [rects, setRects] = useState([])
  const [draft, setDraft] = useState(null)
  const [kind, setKind] = useState('living')
  const [floor, setFloor] = useState(0)
  const [selected, setSelected] = useState(null)

  const wrapRef = useRef(null)
  const startRef = useRef(null)

  const mPerPx = scaleFrom(line, feet)

  /** Pointer position in the image's own pixel space, not the page's. */
  const at = (e) => {
    const box = wrapRef.current.getBoundingClientRect()
    return { x: e.clientX - box.left, y: e.clientY - box.top }
  }

  const onDown = (e) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    startRef.current = at(e)
    if (step === 'scale') setLine({ ...startRef.current, x1: startRef.current.x, y1: startRef.current.y, x2: startRef.current.x, y2: startRef.current.y })
    else setDraft({ x: startRef.current.x, y: startRef.current.y, w: 0, h: 0 })
  }

  const onMove = (e) => {
    if (!startRef.current) return
    const p = at(e)
    const s = startRef.current
    if (step === 'scale') setLine({ x1: s.x, y1: s.y, x2: p.x, y2: p.y })
    else setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) })
  }

  const onUp = () => {
    if (step === 'rooms' && draft && draft.w > 8 && draft.h > 8) {
      const id = `traced-${Date.now()}-${rects.length}`
      setRects((r) => [...r, { ...draft, id, kind, floor, name: '' }])
      setSelected(id)
    }
    setDraft(null)
    startRef.current = null
  }

  const remove = (id) => {
    setRects((r) => r.filter((x) => x.id !== id))
    setSelected((s) => (s === id ? null : s))
  }

  const patch = (id, next) => setRects((r) => r.map((x) => (x.id === id ? { ...x, ...next } : x)))

  const finish = () => {
    const floors = Object.fromEntries(rects.map((r) => [r.id, r.floor ?? 0]))
    const home = homeFromTrace({ rects, mPerPx, ceilingFt: 9, floors })
    if (!home) return
    store.setHome(home)
    onDone?.()
  }

  const ready = rects.length > 0 && mPerPx

  if (!store.planImage) {
    return (
      <div className="tracer-empty">
        <p>No floorplan image uploaded yet.</p>
        <p className="tracer-hint">
          Add one on the first survey step — a photo of the leasing office's plan, or the image from
          your listing. Then come back here and draw over it.
        </p>
        <button className="btn-quiet bordered" onClick={onCancel}>
          Close
        </button>
      </div>
    )
  }

  return (
    <div className="tracer">
      <div className="tracer-bar">
        <span className="tracer-steps">
          <span className={step === 'scale' ? 'on' : 'done'}>1 · Set the scale</span>
          <span className={step === 'rooms' ? 'on' : ''}>2 · Draw the rooms</span>
        </span>
        <button className="link-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>

      {step === 'scale' ? (
        <p className="tracer-hint">
          Drag along something you know the length of — a wall with a dimension printed on it works
          best. Then type that length. Everything else is measured from it.
        </p>
      ) : (
        <p className="tracer-hint">
          Drag a box over each room, then set what it is. Rooms snap to a 0.5&nbsp;m grid so they
          line up in 3D.
        </p>
      )}

      <div
        className={`tracer-stage ${step}`}
        ref={wrapRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        <img src={store.planImage} alt="Your floorplan" draggable={false} />

        <svg className="tracer-overlay">
          {rects.map((r) => (
            <g key={r.id} className={`t-rect ${selected === r.id ? 'sel' : ''} ${r.floor ? 'upper' : ''}`}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} />
              <text x={r.x + 6} y={r.y + 16}>
                {r.name?.trim() || kindLabel(r.kind)}
                {r.floor ? ` · L${r.floor + 1}` : ''}
              </text>
            </g>
          ))}

          {draft && (
            <rect className="t-draft" x={draft.x} y={draft.y} width={draft.w} height={draft.h} />
          )}

          {line && (
            <g className="t-scale">
              <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
              <circle cx={line.x1} cy={line.y1} r="4" />
              <circle cx={line.x2} cy={line.y2} r="4" />
            </g>
          )}
        </svg>
      </div>

      {step === 'scale' ? (
        <div className="tracer-foot">
          <label className="tracer-field">
            <span>That line is</span>
            <input
              type="number"
              min="1"
              max="200"
              value={feet}
              onChange={(e) => setFeet(Number(e.target.value))}
            />
            <span>feet</span>
          </label>
          <button className="btn-primary" disabled={!mPerPx} onClick={() => setStep('rooms')}>
            {mPerPx ? 'Scale set — draw rooms' : 'Drag a line first'}
          </button>
        </div>
      ) : (
        <div className="tracer-foot col">
          <div className="tracer-row">
            <label className="tracer-field">
              <span>New rooms are</span>
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                {TRACE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {kindLabel(k)}
                  </option>
                ))}
              </select>
            </label>
            <label className="tracer-field">
              <span>on</span>
              <select value={floor} onChange={(e) => setFloor(Number(e.target.value))}>
                <option value={0}>Ground floor</option>
                <option value={1}>First floor</option>
                <option value={2}>Second floor</option>
              </select>
            </label>
            <button className="btn-quiet" onClick={() => setStep('scale')}>
              Redo scale
            </button>
          </div>

          {rects.length > 0 && (
            <ul className="tracer-list">
              {rects.map((r) => (
                <li key={r.id} className={selected === r.id ? 'sel' : ''}>
                  <input
                    value={r.name}
                    placeholder={kindLabel(r.kind)}
                    onChange={(e) => patch(r.id, { name: e.target.value })}
                    onFocus={() => setSelected(r.id)}
                  />
                  <select value={r.kind} onChange={(e) => patch(r.id, { kind: e.target.value })}>
                    {TRACE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {kindLabel(k)}
                      </option>
                    ))}
                  </select>
                  <span className="t-size mono">
                    {mPerPx
                      ? `${Math.round(mToFt(r.w * mPerPx))}′ × ${Math.round(mToFt(r.h * mPerPx))}′`
                      : '—'}
                  </span>
                  <button className="link-btn" onClick={() => remove(r.id)} aria-label={`Remove ${r.name || r.kind}`}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button className="btn-primary" disabled={!ready} onClick={finish}>
            {ready ? `Build this home — ${rects.length} rooms` : 'Draw at least one room'}
          </button>
        </div>
      )}
    </div>
  )
}
