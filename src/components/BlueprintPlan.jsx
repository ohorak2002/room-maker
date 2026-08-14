import { useMemo, useState } from 'react'
import { CELL } from '../data/presets'
import { resolveItem } from '../data/catalog'
import './BlueprintPlan.css'

/**
 * A flat, to-scale plan of the whole home — the drawing an estate agent would
 * hand you, rather than the 3D dollhouse.
 *
 * The 3D overview looks better and reads worse: you can't see a room you're not
 * angled toward, labels fight the perspective, and you can't tell at a glance
 * which rooms you've already furnished. A plan solves all three, because it's
 * the view the information was shaped for.
 *
 * Everything here is derived from the same room data the 3D scene uses, so the
 * two can never disagree about where a wall is.
 */

// SVG units per metre. Working in metres directly would mean font sizes and
// stroke widths below 1, which is awkward to read and to tune.
const PX = 40

// Ground floor is "G" rather than "1" — that's how people say it, and it makes
// the button for the storey you start on unmistakable.
const FLOOR_NAME = ['Ground floor', 'First floor', 'Second floor', 'Third floor']

/** Metres to the feet-and-inches people actually describe rooms in. */
function ftIn(m) {
  const totalIn = m * 39.3701
  let ft = Math.floor(totalIn / 12)
  let inch = Math.round(totalIn - ft * 12)
  if (inch === 12) {
    ft += 1
    inch = 0
  }
  return `${ft}'${inch}"`
}

const sqft = (wM, dM) => Math.round(wM * dM * 10.7639)

/**
 * Work out where the doors and windows go.
 *
 * Nothing in the data says — the generator produces rooms, not openings. But a
 * plan without them reads as a diagram of boxes rather than somewhere you could
 * walk, and the rules are simple enough to derive: two rooms that share a wall
 * need a door between them, and a wall with nothing on the other side is an
 * outside wall, which is where windows go.
 *
 * Both are drawn as a gap in the wall rather than a symbol on top of it, which
 * is what makes an opening read as an opening.
 */
function openings(rooms) {
  const doors = []
  const windows = []
  const EPS = 1.5
  const DOOR = 34 // ~0.85m at PX=40
  const MIN_SHARED = 56

  const overlap = (a1, a2, b1, b2) => [Math.max(a1, b1), Math.min(a2, b2)]

  // Every edge starts out exterior; sharing one with a neighbour marks it used.
  const shared = rooms.map(() => ({ L: [], R: [], T: [], B: [] }))

  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i]
      const b = rooms[j]

      // Vertical seam: one room's right edge against the other's left.
      for (const [p, q, pi, qi] of [[a, b, i, j], [b, a, j, i]]) {
        if (Math.abs(p.x + p.w - q.x) < EPS) {
          const [y1, y2] = overlap(p.y, p.y + p.h, q.y, q.y + q.h)
          if (y2 - y1 > MIN_SHARED) {
            shared[pi].R.push([y1, y2])
            shared[qi].L.push([y1, y2])
            doors.push({ x: q.x, y: (y1 + y2) / 2, vertical: true, len: DOOR })
          }
        }
        if (Math.abs(p.y + p.h - q.y) < EPS) {
          const [x1, x2] = overlap(p.x, p.x + p.w, q.x, q.x + q.w)
          if (x2 - x1 > MIN_SHARED) {
            shared[pi].B.push([x1, x2])
            shared[qi].T.push([x1, x2])
            doors.push({ x: (x1 + x2) / 2, y: q.y, vertical: false, len: DOOR })
          }
        }
      }
    }
  }

  // A window per outside wall, but only on rooms people occupy — a window into
  // a hallway from nowhere is noise, and utility rooms often genuinely have none.
  rooms.forEach((r, i) => {
    if (!r.furnishable) return
    const s = shared[i]
    const covered = (list, from, to) => list.some(([a, b]) => b - a > (to - from) * 0.55)

    if (!covered(s.T, r.x, r.x + r.w) && r.w > 90) {
      windows.push({ x1: r.x + r.w * 0.3, y1: r.y, x2: r.x + r.w * 0.7, y2: r.y })
    }
    if (!covered(s.B, r.x, r.x + r.w) && r.w > 90) {
      windows.push({ x1: r.x + r.w * 0.3, y1: r.y + r.h, x2: r.x + r.w * 0.7, y2: r.y + r.h })
    }
    if (!covered(s.L, r.y, r.y + r.h) && r.h > 90) {
      windows.push({ x1: r.x, y1: r.y + r.h * 0.3, x2: r.x, y2: r.y + r.h * 0.7 })
    }
    if (!covered(s.R, r.y, r.y + r.h) && r.h > 90) {
      windows.push({ x1: r.x + r.w, y1: r.y + r.h * 0.3, x2: r.x + r.w, y2: r.y + r.h * 0.7 })
    }
  })

  return { doors, windows }
}

export default function BlueprintPlan({ home, synthetics = {}, onPick, floor = 0, onFloor }) {
  const [hover, setHover] = useState(null)
  const storeys = home.storeys ?? 1

  const rooms = useMemo(() => {
    return home.rooms
      .filter((r) => (r.floor ?? 0) === floor)
      .map((r) => {
      const wM = r.cols * CELL
      const dM = r.rows * CELL
      // Room origins are centres relative to the middle of the home; the plan
      // wants top-left corners from the top-left of the home.
      const x = (r.ox - wM / 2 + home.w / 2) * PX
      const y = (r.oz - dM / 2 + home.d / 2) * PX

      const entries = (r.items || []).flatMap((entry) => {
        const item = resolveItem(entry.id, synthetics)
        return item ? Array.from({ length: entry.qty }, () => item) : []
      })

        return { ...r, wM, dM, x, y, w: wM * PX, h: dM * PX, entries }
      })
  }, [home, synthetics, floor])

  const W = home.w * PX
  const H = home.d * PX

  const furnishable = rooms.filter((r) => r.furnishable)
  const done = furnishable.filter((r) => r.entries.length > 0).length

  const cuts = useMemo(() => openings(rooms), [rooms])

  // Counted across the whole building, not just this storey — "6 of 9" should
  // mean the house, or switching floors would make the number jump around.
  const allFurnishable = home.rooms.filter((r) => r.furnishable)
  const allDone = allFurnishable.filter((r) => (r.items || []).length > 0).length

  return (
    <div className="blueprint">
      <div className="bp-head">
        <span className="bp-title">
          {home.beds} bed · {home.baths} bath · {home.sqft.toLocaleString()} sq ft
        </span>
        {storeys > 1 && (
          <span className="bp-floors" role="group" aria-label="Storey">
            {Array.from({ length: storeys }, (_, i) => (
              <button
                key={i}
                className={`bp-floor ${i === floor ? 'on' : ''}`}
                onClick={() => onFloor?.(i)}
                aria-pressed={i === floor}
                title={FLOOR_NAME[i] || `Level ${i + 1}`}
              >
                {i === 0 ? 'G' : i + 1}
              </button>
            ))}
          </span>
        )}

        <span className="bp-progress">
          <span className="bp-progress-bar">
            <span
              className="bp-progress-fill"
              style={{
                width: `${allFurnishable.length ? (allDone / allFurnishable.length) * 100 : 0}%`,
              }}
            />
          </span>
          {allDone} of {allFurnishable.length} rooms furnished
        </span>
      </div>

      <div className="bp-canvas">
        <svg
          // Just enough margin for the outer wall's stroke width. Any more and
          // the drawing shrinks to leave empty space that says nothing.
          viewBox={`${-PX * 0.12} ${-PX * 0.12} ${W + PX * 0.24} ${H + PX * 0.24}`}
          className="bp-svg"
          role="img"
          aria-label="Floor plan. Select a room to design it."
        >
          {rooms.map((r) => {
            const empty = r.entries.length === 0
            const isHover = hover === r.id
            const cls = [
              'bp-room',
              r.furnishable ? 'is-furnishable' : 'is-utility',
              empty ? 'is-empty' : 'is-filled',
              isHover ? 'is-hover' : '',
            ]
              .filter(Boolean)
              .join(' ')

            // Labels are dropped rather than shrunk past legibility — a closet
            // at 2 x 1m has no room for a name, a size and a set of markers.
            const roomy = r.w > 108 && r.h > 76
            const tight = r.w > 74 && r.h > 46

            return (
              <g
                key={r.id}
                className={cls}
                onMouseEnter={() => setHover(r.id)}
                onMouseLeave={() => setHover((h) => (h === r.id ? null : h))}
                onClick={() => r.furnishable && onPick?.(r.id)}
                role={r.furnishable ? 'button' : undefined}
                tabIndex={r.furnishable ? 0 : undefined}
                onKeyDown={(e) => {
                  if (r.furnishable && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onPick?.(r.id)
                  }
                }}
                aria-label={
                  r.furnishable
                    ? `${r.name}, ${ftIn(r.wM)} by ${ftIn(r.dM)}, ${
                        empty ? 'empty' : `${r.entries.length} pieces`
                      }`
                    : r.name
                }
              >
                <rect className="bp-fill" x={r.x} y={r.y} width={r.w} height={r.h} />

                {tight && (
                  <text
                    className="bp-name"
                    x={r.x + r.w / 2}
                    y={r.y + (roomy ? 22 : r.h / 2 + 4)}
                    // A long name in a narrow room ran straight over the wall.
                    // Condensing it to fit keeps the label readable and inside
                    // the room it belongs to, which truncating would not.
                    {...(r.name.length * 6.7 > r.w - 12
                      ? { textLength: Math.max(24, r.w - 12), lengthAdjust: 'spacingAndGlyphs' }
                      : {})}
                  >
                    {r.name}
                  </text>
                )}

                {roomy && (
                  <text className="bp-dims" x={r.x + r.w / 2} y={r.y + 38}>
                    {ftIn(r.wM)} × {ftIn(r.dM)}
                  </text>
                )}

                {/* What's actually in the room. One marker per piece, coloured
                    from the piece itself, so a furnished room reads as furnished
                    from across the plan without needing to be labelled. */}
                {r.entries.length > 0 && roomy && (
                  <Markers room={r} />
                )}

                {r.furnishable && empty && roomy && (
                  <text className="bp-empty" x={r.x + r.w / 2} y={r.y + r.h - 16}>
                    empty
                  </text>
                )}

                {/* Drawn last so the wall line sits over the fill on every side. */}
                <rect className="bp-wall" x={r.x} y={r.y} width={r.w} height={r.h} />
              </g>
            )
          })}

          {/* Openings go on top of every room, so a door punched through a
              shared wall erases both rooms' wall lines rather than one of them
              and leaving a stub behind. */}
          <g className="bp-cuts">
            {cuts.windows.map((w, i) => (
              <g key={`w${i}`} className="bp-window">
                <line className="bp-cut" x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} />
                <line className="bp-glass" x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} />
              </g>
            ))}

            {cuts.doors.map((d, i) => {
              const half = d.len / 2
              const [x1, y1, x2, y2] = d.vertical
                ? [d.x, d.y - half, d.x, d.y + half]
                : [d.x - half, d.y, d.x + half, d.y]
              // A quarter arc from the hinge, the way a plan shows a door swing.
              const arc = d.vertical
                ? `M ${d.x} ${d.y - half} A ${d.len} ${d.len} 0 0 1 ${d.x + d.len} ${d.y + half - d.len + d.len}`
                : `M ${d.x - half} ${d.y} A ${d.len} ${d.len} 0 0 0 ${d.x - half + d.len} ${d.y + d.len}`
              return (
                <g key={`d${i}`} className="bp-door">
                  <line className="bp-cut" x1={x1} y1={y1} x2={x2} y2={y2} />
                  <path className="bp-swing" d={arc} />
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      <p className="bp-hint">
        {hover
          ? (() => {
              const r = rooms.find((x) => x.id === hover)
              if (!r) return null
              if (!r.furnishable) return `${r.name} — not a room you furnish`
              return `${r.name} · ${sqft(r.wM, r.dM)} sq ft · ${
                r.entries.length ? `${r.entries.length} pieces` : 'nothing in it yet'
              } · click to design`
            })()
          : 'Click a room to design it'}
      </p>
    </div>
  )
}

/**
 * Piece markers, laid out in rows that wrap inside the room.
 *
 * Capped, with a "+n" when it overflows. A room with thirty pieces would
 * otherwise turn into a solid block of dots and stop communicating anything.
 */
function Markers({ room }) {
  const R = 5
  const GAP = 14
  const padX = 12
  const top = 52
  const perRow = Math.max(1, Math.floor((room.w - padX * 2) / GAP))
  const rows = Math.max(1, Math.floor((room.h - top - 22) / GAP))
  const cap = Math.max(1, perRow * rows)

  const shown = room.entries.slice(0, cap)
  const extra = room.entries.length - shown.length

  return (
    <g className="bp-markers">
      {shown.map((item, i) => (
        <circle
          key={i}
          className="bp-dot"
          cx={room.x + padX + (i % perRow) * GAP + R}
          cy={room.y + top + Math.floor(i / perRow) * GAP}
          r={R}
          style={{ fill: item.color }}
        >
          <title>{item.name}</title>
        </circle>
      ))}
      {extra > 0 && (
        <text
          className="bp-more"
          x={room.x + padX}
          y={room.y + top + Math.ceil(shown.length / perRow) * GAP + 6}
        >
          +{extra}
        </text>
      )}
    </g>
  )
}
