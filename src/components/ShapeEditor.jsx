import { useRef, useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import { CELL, ROOM_SHAPES } from '../data/presets'
import './ShapeEditor.css'

const MAX = 28

/**
 * Paint your room's actual footprint.
 *
 * There is no data source that turns an address into a floorplan, so this is
 * the honest alternative: drag over a grid to mark which half-metre squares are
 * inside your room. That covers the shapes presets can't — the L off a hallway,
 * a window alcove, the angled wall where the building turns.
 *
 * Pair it with the floorplan image you uploaded, shown underneath at low
 * opacity, and you can trace your real unit.
 */
export default function ShapeEditor() {
  const store = useRoomStore()
  const shape = store.shape()
  const [paint, setPaint] = useState(null) // 'on' | 'off' while dragging
  const gridRef = useRef(null)

  const cells = new Set(shape.cells)
  const cols = shape.cols
  const rows = shape.rows

  const commit = (next) => {
    store.set('customShape', { cols, rows, cells: [...next] })
  }

  const apply = (c, r, mode) => {
    const key = `${c},${r}`
    const has = cells.has(key)
    if (mode === 'on' && has) return
    if (mode === 'off' && !has) return
    const next = new Set(cells)
    if (mode === 'on') next.add(key)
    else next.delete(key)
    if (next.size === 0) return // never leave a room with no floor
    commit(next)
  }

  const onDown = (c, r) => {
    const mode = cells.has(`${c},${r}`) ? 'off' : 'on'
    setPaint(mode)
    apply(c, r, mode)
  }

  const onEnter = (c, r) => {
    if (paint) apply(c, r, paint)
  }

  const resize = (dCols, dRows) => {
    const nc = Math.max(4, Math.min(MAX, cols + dCols))
    const nr = Math.max(4, Math.min(MAX, rows + dRows))
    const next = new Set()
    for (const key of cells) {
      const [c, r] = key.split(',').map(Number)
      if (c < nc && r < nr) next.add(key)
    }
    // Growing: fill the new strip so the room actually gets bigger.
    if (dCols > 0) for (let r = 0; r < nr; r++) for (let c = cols; c < nc; c++) next.add(`${c},${r}`)
    if (dRows > 0) for (let r = rows; r < nr; r++) for (let c = 0; c < nc; c++) next.add(`${c},${r}`)
    if (next.size) store.set('customShape', { cols: nc, rows: nr, cells: [...next] })
  }

  const area = (cells.size * CELL * CELL).toFixed(1)

  return (
    <div className="shape-editor">
      <div className="shape-presets">
        {ROOM_SHAPES.map((s) => (
          <button
            key={s.id}
            className={`chip ${store.floorplan === s.id && !store.customShape ? 'active' : ''}`}
            onClick={() => {
              store.set('floorplan', s.id)
              store.set('customShape', null)
            }}
            title={s.blurb}
          >
            {s.name}
          </button>
        ))}
      </div>

      <p className="note">
        Drag across the grid to add or remove squares. Each square is half a metre —
        paint the shape your room actually is.
      </p>

      <div
        ref={gridRef}
        className="shape-grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          aspectRatio: `${cols} / ${rows}`,
          backgroundImage: store.planImage ? `url(${store.planImage})` : undefined,
        }}
        onPointerUp={() => setPaint(null)}
        onPointerLeave={() => setPaint(null)}
      >
        {Array.from({ length: cols * rows }, (_, i) => {
          const c = i % cols
          const r = Math.floor(i / cols)
          const on = cells.has(`${c},${r}`)
          return (
            <button
              key={i}
              className={`shape-cell ${on ? 'on' : ''}`}
              onPointerDown={(e) => {
                e.preventDefault()
                onDown(c, r)
              }}
              onPointerEnter={() => onEnter(c, r)}
              aria-label={`${on ? 'Remove' : 'Add'} square at column ${c + 1}, row ${r + 1}`}
            />
          )
        })}
      </div>

      <div className="shape-meta">
        <span className="readout mono">
          {(cols * CELL).toFixed(1)} × {(rows * CELL).toFixed(1)} m · {area} m² floor
        </span>
        {store.customShape && (
          <button className="link-btn" onClick={() => store.set('customShape', null)}>
            Back to a preset
          </button>
        )}
      </div>

      <div className="shape-resize">
        <span className="resize-label">Grid</span>
        <div className="resize-group">
          <button className="chip tiny" onClick={() => resize(-2, 0)}>− wide</button>
          <button className="chip tiny" onClick={() => resize(2, 0)}>+ wide</button>
        </div>
        <div className="resize-group">
          <button className="chip tiny" onClick={() => resize(0, -2)}>− deep</button>
          <button className="chip tiny" onClick={() => resize(0, 2)}>+ deep</button>
        </div>
      </div>

      <label className="override ceiling-field">
        <span>Ceiling height (m)</span>
        <input
          type="number"
          min="2"
          max="6"
          step="0.1"
          value={shape.h}
          onChange={(e) => store.set('customDims', { h: Number(e.target.value) })}
        />
      </label>

      {store.planImage && (
        <p className="note">
          Your floorplan is showing behind the grid — trace over it to match your real unit.
        </p>
      )}
    </div>
  )
}
