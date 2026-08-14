import { CELL, ftToM } from './presets'
import { FURNISHABLE } from './homeLayout'

/**
 * Turn rectangles traced over a real floorplan image into a home.
 *
 * This is the honest answer to "make it match my actual apartment". No public
 * data source maps an address to room dimensions — that hasn't changed — but
 * the user usually *has* the floorplan already, as a marketing image or a PDF
 * page from their lease. Tracing it takes a minute and produces a plan that is
 * genuinely theirs, rather than a plausible home of roughly the right size.
 *
 * The scale line is what makes it real. Two points on the image plus the real
 * distance between them fixes pixels-per-metre for everything else, so a room
 * traced at 180px wide becomes 3.6m and not "some rectangle".
 */

export const TRACE_KINDS = [
  'living',
  'kitchen',
  'dining',
  'primary',
  'bedroom',
  'primaryBath',
  'bath',
  'laundry',
  'hall',
  'entry',
]

/** Metres per pixel, from a drawn reference line and its real length in feet. */
export function scaleFrom(line, realFeet) {
  if (!line || !realFeet) return null
  const px = Math.hypot(line.x2 - line.x1, line.y2 - line.y1)
  if (px < 4) return null
  return ftToM(realFeet) / px
}

/**
 * @param rects   [{ id, kind, name, x, y, w, h }] in image pixels
 * @param mPerPx  metres per pixel, from scaleFrom()
 * @param ceilingFt
 * @param floors  { [rectId]: storey index }
 */
export function homeFromTrace({ rects, mPerPx, ceilingFt = 9, floors = {} }) {
  const usable = rects.filter((r) => r.w > 4 && r.h > 4 && r.kind)
  if (!usable.length || !mPerPx) return null

  // The building's extent in pixels, so rooms can be centred the way generated
  // homes are — everything downstream expects origins relative to the middle.
  const minX = Math.min(...usable.map((r) => r.x))
  const minY = Math.min(...usable.map((r) => r.y))
  const maxX = Math.max(...usable.map((r) => r.x + r.w))
  const maxY = Math.max(...usable.map((r) => r.y + r.h))

  const totalW = (maxX - minX) * mPerPx
  const totalD = (maxY - minY) * mPerPx

  const counts = {}
  const kindTotals = {}
  for (const r of usable) kindTotals[r.kind] = (kindTotals[r.kind] || 0) + 1

  const rooms = usable.map((r) => {
    // Snap to the same 0.5m grid the 3D system uses. A hand-drawn rectangle is
    // never exactly on it, and an unsnapped room can't share a wall with its
    // neighbour or hold a cell mask.
    const cols = Math.max(2, Math.round((r.w * mPerPx) / CELL))
    const rows = Math.max(2, Math.round((r.h * mPerPx) / CELL))
    const w = cols * CELL
    const d = rows * CELL

    counts[r.kind] = (counts[r.kind] || 0) + 1
    const n = counts[r.kind]
    const label = LABELS[r.kind] || r.kind
    const name = r.name?.trim() || (kindTotals[r.kind] > 1 ? `${label} ${n}` : label)

    const cells = []
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) cells.push(`${col},${row}`)
    }

    return {
      id: r.id,
      kind: r.kind,
      floor: floors[r.id] ?? 0,
      name,
      furnishable: FURNISHABLE.has(r.kind),
      cols,
      rows,
      cells,
      h: ftToM(ceilingFt),
      // Centre of the traced rectangle, relative to the centre of the building.
      ox: (r.x - minX) * mPerPx + w / 2 - totalW / 2,
      oz: (r.y - minY) * mPerPx + d / 2 - totalD / 2,
      items: [],
    }
  })

  const storeys = Math.max(1, ...rooms.map((r) => r.floor + 1))
  const beds = rooms.filter((r) => r.kind === 'bedroom' || r.kind === 'primary').length
  const baths =
    rooms.filter((r) => r.kind === 'bath').length +
    rooms.filter((r) => r.kind === 'primaryBath').length

  // Square footage is summed from the rooms actually drawn, not from the
  // bounding box — a traced plan has gaps where walls and stairs are, and
  // counting those as living space would overstate it.
  const sqft = Math.round(
    rooms.reduce((s, r) => s + r.cols * r.rows * CELL * CELL, 0) * 10.7639
  )

  return {
    beds,
    baths,
    sqft,
    storeys,
    traced: true,
    rooms: rooms.sort((a, b) => a.floor - b.floor || a.oz - b.oz || a.ox - b.ox),
    w: totalW,
    d: totalD,
    h: ftToM(ceilingFt),
  }
}

const LABELS = {
  living: 'Living room',
  kitchen: 'Kitchen',
  dining: 'Dining',
  primary: 'Primary bedroom',
  bedroom: 'Bedroom',
  primaryBath: 'Primary bath',
  bath: 'Bathroom',
  laundry: 'Laundry',
  hall: 'Hallway',
  entry: 'Entry',
}

export const kindLabel = (k) => LABELS[k] || k
