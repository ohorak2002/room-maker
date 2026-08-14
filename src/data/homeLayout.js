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
/**
 * How many storeys a place of this size and shape usually has.
 *
 * A 700 sq ft two-bed is an apartment and is flat. A 2,400 sq ft four-bed is a
 * house and almost never is. The thresholds want both signals: square footage
 * alone would put a big open loft upstairs, and bedroom count alone would
 * stack a small three-bed flat.
 */
export function storeysFor({ beds, sqft }) {
  if (sqft >= 3000 && beds >= 5) return 3
  if (sqft >= 1400 && beds >= 3) return 2
  return 1
}

/**
 * Which storey a kind of room belongs on, lowest number first.
 *
 * This is the ordinary arrangement of a house rather than a rule: living,
 * cooking and eating happen on the ground floor, sleeping happens above it.
 * The entry has to be on the ground floor or the front door opens into air.
 */
const FLOOR_PREFERENCE = {
  entry: 0,
  living: 0,
  kitchen: 0,
  dining: 0,
  laundry: 0,
  primary: 1,
  primaryBath: 1,
  bedroom: 1,
  bath: 1,
  hall: 0,
}

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
/**
 * Spread the room list over the storeys.
 *
 * Preference decides the storey; the rest is making sure no floor is left with
 * nothing on it and every floor has its own circulation — you can't reach the
 * rooms on one storey through the hallway of another.
 */
function assignFloors(program, levels) {
  const byFloor = Array.from({ length: levels }, () => [])

  if (levels === 1) {
    program.forEach((r, i) => byFloor[0].push({ ...r, id: `${r.kind}-${i}` }))
    return byFloor
  }

  // Bedrooms rotate through the upper storeys instead of all landing on the
  // first one above ground, which is what makes a three-storey house read as a
  // house rather than a bungalow with an attic.
  let next = 1
  program.forEach((r, i) => {
    const pref = FLOOR_PREFERENCE[r.kind] ?? 0
    let level = 0
    if (pref > 0) {
      level = next
      if (r.kind === 'bedroom' || r.kind === 'bath') next = 1 + (next % (levels - 1))
    }
    byFloor[Math.min(level, levels - 1)].push({ ...r, id: `${r.kind}-${i}` })
  })

  for (let l = 0; l < levels; l++) {
    const needsHall = byFloor[l].length >= 3 && !byFloor[l].some((r) => r.kind === 'hall')
    if (needsHall || !byFloor[l].length) {
      byFloor[l].push({ kind: 'hall', id: `hall-f${l}` })
    }
  }
  return byFloor
}

/**
 * @param beds  bedroom count
 * @param baths bathroom count, may be fractional (4.5)
 * @param sqft  total interior square feet, across every storey
 * @param ceilingFt ceiling height in feet
 * @param storeys optional override; otherwise inferred from size and bedrooms
 * @returns { rooms, storeys, w, d, h } — rooms carry their own cell mask, the
 *          storey they sit on, and an origin offset in metres from the centre
 *          of the footprint.
 */
export function generateHome({ beds = 2, baths = 1, sqft = 1000, ceilingFt = 9, storeys }) {
  const program = roomProgram({ beds, baths, sqft })
  const levels = Math.max(1, Math.min(4, storeys ?? storeysFor({ beds, sqft })))

  // Storeys stack, so they share one footprint. The area that decides that
  // footprint is a single floor's share, not the total square footage — sizing
  // it from the total would produce a house twice as wide as it should be.
  const areaM2 = Math.max(20, sqft / 10.7639)
  const floorArea = areaM2 / levels
  const ratio = 1.35
  const totalW = Math.sqrt(floorArea * ratio)
  const totalD = floorArea / totalW

  const byFloor = assignFloors(program, levels)
  const snap = (v) => Math.round(v / CELL) * CELL
  const counts = {}
  const rooms = []

  for (let level = 0; level < levels; level++) {
    const onThis = byFloor[level]
    if (!onThis.length) continue

    // Each storey is packed on its own, filling the shared footprint.
    const weighted = onThis.map((r) => ({ ...r, area: AREA_WEIGHTS[r.kind] ?? 1 }))
    const weightSum = weighted.reduce((s, r) => s + r.area, 0)
    for (const r of weighted) r.area = (r.area / weightSum) * floorArea
    weighted.sort((a, b) => b.area - a.area)

    const packed = []
    squarify(weighted, 0, 0, totalW, totalD, packed)

    for (const p of packed) {
      // Snap the room's edges, not its size and centre separately — see the
      // note this replaced: rounding those independently overlaps neighbours.
      const x1 = snap(p.x)
      const x2 = snap(p.x + p.w)
      const z1 = snap(p.y)
      const z2 = snap(p.y + p.h)

      const cols = Math.max(2, Math.round((x2 - x1) / CELL))
      const rows = Math.max(2, Math.round((z2 - z1) / CELL))
      const w = cols * CELL
      const d = rows * CELL

      counts[p.kind] = (counts[p.kind] || 0) + 1
      const n = counts[p.kind]
      const multiple = program.filter((r) => r.kind === p.kind).length > 1

      rooms.push({
        id: p.id,
        kind: p.kind,
        floor: level,
        name: multiple ? `${LABEL[p.kind]} ${n}` : LABEL[p.kind],
        furnishable: FURNISHABLE.has(p.kind),
        cols,
        rows,
        cells: cellsFor(cols, rows),
        h: ftToM(ceilingFt),
        ox: x1 + w / 2 - totalW / 2,
        oz: z1 + d / 2 - totalD / 2,
        items: [],
      })
    }
  }

  rooms.sort((a, b) => a.floor - b.floor || a.oz - b.oz || a.ox - b.ox)

  return {
    beds,
    baths,
    sqft,
    storeys: levels,
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
