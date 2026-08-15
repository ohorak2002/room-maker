import { useRef, useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import { TRACE_KINDS, kindLabel, scaleFrom, homeFromTrace } from '../data/tracePlan'
import { detectRooms } from '../data/detectRooms'
import { mToFt } from '../data/presets'
import './FloorplanTracer.css'

/**
 * Guess which kind of room a rectangle is, from its proportions and size.
 *
 * Crude on purpose. The detector has no idea what it is looking at, and a wrong
 * label the user can change in one click is far better than making them label
 * eight rooms from scratch. Ordered so the most confident guesses win.
 */
function guessKind(r, mPerPx) {
  if (!mPerPx) return 'bedroom'
  const wM = r.w * mPerPx
  const hM = r.h * mPerPx
  const areaM2 = wM * hM
  const long = Math.max(wM, hM)
  const short = Math.min(wM, hM)

  if (areaM2 < 2.2) return 'bath'
  if (short < 1.4 && long / short > 2.6) return 'hallway'
  if (areaM2 > 22) return 'living'
  return 'bedroom'
}

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
  const imgRef = useRef(null)
  const [detecting, setDetecting] = useState(false)
  const [detectNote, setDetectNote] = useState(null)

  const mPerPx = scaleFrom(line, feet)

  /**
   * Read the rooms straight off the uploaded plan.
   *
   * Everything here already worked by hand; this only fills the rectangles in
   * so there is something to correct instead of a blank drawing to start. The
   * results go into the same `rects` state a person would have drawn, so every
   * existing control — rename, re-kind, delete, assign a storey — still applies.
   */
  const detect = async () => {
    const img = imgRef.current
    if (!img?.naturalWidth) return
    setDetecting(true)
    setDetectNote(null)
    // Yield a frame so the button can show its pending state before the main
    // thread goes away for a moment.
    await new Promise((r) => setTimeout(r, 30))

    try {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0)
      const found = detectRooms(ctx.getImageData(0, 0, canvas.width, canvas.height))

      // The detector works in the image's own pixels; the overlay is drawn over
      // the <img> at whatever size it is displayed.
      const k = img.clientWidth / img.naturalWidth
      const scaled = found.rooms.map((r, i) => ({
        id: `auto-${Date.now()}-${i}`,
        x: r.x * k,
        y: r.y * k,
        w: r.w * k,
        h: r.h * k,
        kind: guessKind({ w: r.w * k, h: r.h * k }, mPerPx),
        floor: 0,
        name: '',
      }))

      setRects(scaled)
      setSelected(null)
      setDetectNote(
        scaled.length
          ? `Found ${scaled.length} room${scaled.length === 1 ? '' : 's'}. Check the labels, drag any that are wrong, and draw anything it missed.`
          : "Couldn't pick out any rooms — the walls may be too faint or the plan too busy. Draw them by hand instead."
      )
    } catch {
      setDetectNote('Could not read that image. Draw the rooms by hand instead.')
    } finally {
      setDetecting(false)
    }
  }

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
        <img ref={imgRef} src={store.planImage} alt="Your floorplan" draggable={false} />

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
            {mPerPx ? 'Scale set — find rooms' : 'Drag a line first'}
          </button>
        </div>
      ) : (
        <div className="tracer-foot col">
          <div className="tracer-row detect-row">
            <button className="btn-primary" onClick={detect} disabled={detecting}>
              {detecting ? 'Reading the plan…' : rects.length ? 'Find rooms again' : 'Find the rooms for me'}
            </button>
            <span className="tracer-hint inline">
              {detectNote || 'Reads the walls straight off your image. Correct anything it gets wrong.'}
            </span>
          </div>

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
            {ready
              ? `Build this home — ${rects.length} ${rects.length === 1 ? 'room' : 'rooms'}`
              : 'Draw at least one room'}
          </button>
        </div>
      )}
    </div>
  )
}
