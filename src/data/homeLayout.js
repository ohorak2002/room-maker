import { CELL, ftToM } from './presets'

/**
 * Generates a plausible multi-room floorplan from bed count, bath count and
 * total square footage.
 *
 * This exists because the obvious alternative doesn't: there is no source,
 * free or paid, that returns room-by-room dimensions for an arbitrary address.
 * Zillow retired its public API in 2021 and forbids scraping; the paid
 * property-data providers (ATTOM, CoreLogic, Estated) return total square
 * footage and bed/bath counts but never floorplan geometry. Room dimensions
 * live in property managers' private PDFs and nowhere else.
 *
 * So instead of pretending to look up a real floorplan, this generates one
 * from the three numbers that *are* knowable, using published U.S. averages
 * for how floor area is typically distributed between rooms. The result is a
 * realistic home of the right size and composition — clearly a generated plan,
 * not a claim about a specific unit.
 */

// Share of total floor area each room type typically takes. Sourced from
// common U.S. residential planning proportions; normalized at generation time
// so any combination of rooms still fills exactly the given square footage.
const AREA_WEIGHTS = {
  living: 1.9,
  kitchen: 1.3,
  dining: 0.95,
  primary: 1.55,
  bedroom: 1.05,
  primaryBath: 0.55,
  bath: 0.42,
  laundry: 0.32,
  hall: 0.9,
  entry: 0.4,
}

const LABEL = {
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

/**
 * Rooms people furnish, versus circulation they mostly don't.
 *
 * Bathrooms and laundry are in here because they hold fixtures — a toilet and a
 * washer are things you buy and place. Halls and entries stay out: there's
 * nothing to put in them beyond what the shell already draws.
 */
export const FURNISHABLE = new Set([
  'living', 'kitchen', 'dining', 'primary', 'bedroom',
  'bath', 'primaryBath', 'laundry',
])

/**
 * Decide which rooms exist, before any geometry. Bathrooms may be fractional
 * in listings ("4.5 bath"); a half bath is a powder room with no shower, which
 * for layout purposes is just a smaller bathroom.
 */
function roomProgram({ beds, baths, sqft }) {
  const rooms = []
  const push = (kind, n = 1) => {
    for (let i = 0; i < n; i++) rooms.push({ kind })
  }

  push('living')
  push('kitchen')
  if (sqft >= 900) push('dining')
  if (sqft >= 700) push('entry')

  // The largest bedroom is the primary; the rest are equal.
  if (beds >= 1) push('primary')
  push('bedroom', Math.max(0, beds - 1))

  const fullBaths = Math.floor(baths)
  const hasHalf = baths % 1 >= 0.4
  if (fullBaths >= 1) push('primaryBath')
  push('bath', Math.max(0, fullBaths - 1))
  if (hasHalf) push('bath')

  if (sqft >= 800) push('laundry')
  // Circulation scales with how many rooms have to connect to each other.
  if (rooms.length >= 5) push('hall')

  return rooms
}

/**
 * Squarified treemap. Packs weighted rectangles into a container while keeping
 * each one as close to square as it can — which is what stops a generated plan
 * from looking like a row of corridors.
 */
function squarify(items, x, y, w, h, out) {
  if (!items.length) return
  if (items.length === 1) {
    out.push({ ...items[0], x, y, w, h })
    return
  }

  const total = items.reduce((s, i) => s + i.area, 0)
  const vertical = w >= h

  // Grow the first strip while it improves the worst aspect ratio in it.
  let best = Infinity
  let split = 1
  for (let n = 1; n <= items.length; n++) {
    const strip = items.slice(0, n)
    const stripArea = strip.reduce((s, i) => s + i.area, 0)
    const stripSide = (stripArea / total) * (vertical ? w : h)
    const other = vertical ? h : w
    let worst = 0
    for (const it of strip) {
      const side = (it.area / stripArea) * other
      worst = Math.max(worst, Math.max(stripSide / side, side / stripSide))
    }
    if (worst <= best) {
      best = worst
      split = n
    } else break
  }

  const strip = items.slice(0, split)
  const rest = items.slice(split)
  const stripArea = strip.reduce((s, i) => s + i.area, 0)
  const stripSide = (stripArea / total) * (vertical ? w : h)

  let cursor = vertical ? y : x
  for (const it of strip) {
    const side = (it.area / stripArea) * (vertical ? h : w)
    if (vertical) {
      out.push({ ...it, x, y: cursor, w: stripSide, h: side })
    } else {
      out.push({ ...it, x: cursor, y, w: side, h: stripSide })
    }
    cursor += side
  }

  if (rest.length) {
    if (vertical) squarify(rest, x + stripSide, y, w - stripSide, h, out)
    else squarify(rest, x, y + stripSide, w, h - stripSide, out)
  }
}

const cellsFor = (cols, rows) => {
  const cells = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push(`${c},${r}`)
  return cells
}

/**
 * @param beds  bedroom count
 * @param baths bathroom count, may be fractional (4.5)
 * @param sqft  total interior square feet
 * @param ceilingFt ceiling height in feet
 * @returns { rooms, w, d, h } — rooms carry their own cell mask plus an origin
 *          offset in metres from the home's centre.
 */
export function generateHome({ beds = 2, baths = 1, sqft = 1000, ceilingFt = 9 }) {
  const program = roomProgram({ beds, baths, sqft })

  // Total interior area in m², and a footprint with a typical residential
  // aspect ratio rather than a square.
  const areaM2 = Math.max(20, sqft / 10.7639)
  const ratio = 1.35
  const totalW = Math.sqrt(areaM2 * ratio)
  const totalD = areaM2 / totalW

  const weighted = program.map((r, i) => ({
    ...r,
    id: `${r.kind}-${i}`,
    area: AREA_WEIGHTS[r.kind] ?? 1,
  }))
  const weightSum = weighted.reduce((s, r) => s + r.area, 0)
  for (const r of weighted) r.area = (r.area / weightSum) * areaM2

  // Bigger rooms first — squarified treemaps produce better proportions that way.
  weighted.sort((a, b) => b.area - a.area)

  const packed = []
  squarify(weighted, 0, 0, totalW, totalD, packed)

  // Snap every room to the 0.5m cell grid the 3D system uses.
  //
  // Critically, this snaps the room's *edges*, not its width and centre
  // separately. squarify() produces a perfect tiling where neighbours share an
  // exact edge coordinate; snapping each shared edge to the same grid line
  // keeps them flush. Rounding size and position independently does not — a
  // room widened by rounding while its neighbour's centre moved the other way
  // produces overlapping rooms, which is exactly what happened before.
  const snap = (v) => Math.round(v / CELL) * CELL
  const counts = {}
  const rooms = packed
    .map((p) => {
      const x1 = snap(p.x)
      const x2 = snap(p.x + p.w)
      const z1 = snap(p.y)
      const z2 = snap(p.y + p.h)

      // A room can round away to nothing in a very small home; keep it usable
      // by growing the far edge, which only ever eats into outside space.
      const cols = Math.max(2, Math.round((x2 - x1) / CELL))
      const rows = Math.max(2, Math.round((z2 - z1) / CELL))
      const w = cols * CELL
      const d = rows * CELL

      counts[p.kind] = (counts[p.kind] || 0) + 1
      const n = counts[p.kind]
      const multiple = program.filter((r) => r.kind === p.kind).length > 1
      return {
        id: p.id,
        kind: p.kind,
        name: multiple ? `${LABEL[p.kind]} ${n}` : LABEL[p.kind],
        furnishable: FURNISHABLE.has(p.kind),
        cols,
        rows,
        cells: cellsFor(cols, rows),
        h: ftToM(ceilingFt),
        // Origin is the room's centre, derived from the snapped edges so it
        // stays consistent with the snapped size.
        ox: x1 + w / 2 - totalW / 2,
        oz: z1 + d / 2 - totalD / 2,
        items: [],
      }
    })
    .sort((a, b) => a.oz - b.oz || a.ox - b.ox)

  return {
    beds,
    baths,
    sqft,
    rooms,
    w: totalW,
    d: totalD,
    h: ftToM(ceilingFt),
  }
}

/** Actual area of a generated room, in square feet, for display. */
export const roomSqft = (room) => Math.round(room.cols * room.rows * CELL * CELL * 10.7639)

export const ROOM_KIND_COLORS = {
  living: '#C0703C',
  kitchen: '#4C93A8',
  dining: '#B4562E',
  primary: '#2E6B5E',
  bedroom: '#6E8C5A',
  primaryBath: '#3F6C93',
  bath: '#5C8CD6',
  laundry: '#8A8F98',
  hall: '#B8AFA2',
  entry: '#9A8E7C',
}
