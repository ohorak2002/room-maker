// Onboarding option data: palettes, moods, light, room shapes.
// Each palette carries the actual hexes used to paint the 3D room. `secondary`
// is a second accent — most real rooms lean on two accent colors, not one, so
// this gives the swatch row (and later, object recommendations) more range
// than a single hero color could.

export const PALETTES = [
  {
    id: 'clay',
    name: 'Clay & Linen',
    blurb: 'Earthy, sun-warmed, forgiving',
    wall: '#E4DAD0', floor: '#B08968', trim: '#F2ECE6', accent: '#C0703C', secondary: '#7A8B6F',
  },
  {
    id: 'pine',
    name: 'Pine & Slate',
    blurb: 'Deep greens against cool stone',
    wall: '#DCE3DE', floor: '#6E6A63', trim: '#F1F4F1', accent: '#2E6B5E', secondary: '#A8A29B',
  },
  {
    id: 'ink',
    name: 'Ink & Brass',
    blurb: 'Low light, high contrast',
    wall: '#2B2D33', floor: '#4A423A', trim: '#3A3D45', accent: '#C9A227', secondary: '#6B7280',
  },
  {
    id: 'paper',
    name: 'Paper White',
    blurb: 'Everything recedes but the objects',
    wall: '#F4F4F2', floor: '#D9CFC2', trim: '#FFFFFF', accent: '#8A8F98', secondary: '#C9BFAE',
  },
  {
    id: 'dusk',
    name: 'Dusk Blue',
    blurb: 'Cool, quiet, a little melancholy',
    wall: '#C6D0DB', floor: '#8C7B6B', trim: '#E8EEF4', accent: '#3F6C93', secondary: '#B8A98F',
  },
  {
    id: 'ember',
    name: 'Ember',
    blurb: 'Saturated and unapologetic',
    wall: '#7A2E2E', floor: '#3C2B24', trim: '#A85A47', accent: '#E08A3C', secondary: '#2E2A24',
  },
  {
    id: 'sage',
    name: 'Sage & Oat',
    blurb: 'Soft green, nothing shouting',
    wall: '#DCE3D2', floor: '#C4B398', trim: '#F3F5EE', accent: '#6E8C5A', secondary: '#B99F7A',
  },
  {
    id: 'terra',
    name: 'Terracotta',
    blurb: 'Baked orange, deep shade',
    wall: '#E8CDB8', floor: '#8C5A3C', trim: '#F7E9DC', accent: '#B4562E', secondary: '#4A6B5C',
  },
  {
    id: 'mono',
    name: 'Monochrome',
    blurb: 'Black, white, and the gap between',
    wall: '#E8E8E8', floor: '#3A3A3A', trim: '#FFFFFF', accent: '#141414', secondary: '#9A9A9A',
  },
  {
    id: 'plum',
    name: 'Plum & Smoke',
    blurb: 'Moody purple, grey undertone',
    wall: '#4A3A4F', floor: '#5C5259', trim: '#6B5A70', accent: '#B07FC4', secondary: '#8C93A0',
  },
  {
    id: 'sand',
    name: 'Sand & Sea',
    blurb: 'Pale, salty, coastal light',
    wall: '#EFE6D6', floor: '#CBBBA0', trim: '#FBF6EC', accent: '#4C93A8', secondary: '#D8875E',
  },
  {
    id: 'forest',
    name: 'Forest Floor',
    blurb: 'Dark green, warm wood, low light',
    wall: '#324037', floor: '#6B4F35', trim: '#44544A', accent: '#93B07A', secondary: '#C99A54',
  },
  {
    id: 'blush',
    name: 'Blush & Bone',
    blurb: 'Warm pink, soft and unfussy',
    wall: '#F0DDD8', floor: '#C8A99C', trim: '#FDF4F1', accent: '#C4707A', secondary: '#8C9A87',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    blurb: 'Near-black blue, almost no reflection',
    wall: '#22283A', floor: '#2E3446', trim: '#333B52', accent: '#5C8CD6', secondary: '#B8A8D8',
  },
  {
    id: 'rust',
    name: 'Rust & Denim',
    blurb: 'Worn orange against faded blue',
    wall: '#D8CFC2', floor: '#7C4A32', trim: '#EDE6D8', accent: '#B5502E', secondary: '#3E5C74',
  },
  {
    id: 'butter',
    name: 'Butter & Walnut',
    blurb: 'Soft yellow, warm dark wood',
    wall: '#F0E3B8', floor: '#5A3E28', trim: '#FBF4DC', accent: '#D9A83C', secondary: '#8A6F4E',
  },
  {
    id: 'copper',
    name: 'Charcoal & Copper',
    blurb: 'Dark, industrial, one warm metal',
    wall: '#3A3B3E', floor: '#26272A', trim: '#4A4B4F', accent: '#C77B4C', secondary: '#8A8D93',
  },
  {
    id: 'mint',
    name: 'Mint & Birch',
    blurb: 'Fresh green, pale Scandinavian wood',
    wall: '#DCEFE2', floor: '#DCC9A3', trim: '#F2FBF5', accent: '#4E9E76', secondary: '#E0A0A8',
  },
  {
    id: 'wine',
    name: 'Wine & Brass',
    blurb: 'Deep red, warm metal, low light',
    wall: '#4A2530', floor: '#2E1B1E', trim: '#5C3540', accent: '#B8860B', secondary: '#7A5C5E',
  },
  {
    id: 'fog',
    name: 'Fog',
    blurb: 'Pale, cool, almost no color at all',
    wall: '#DDE1E4', floor: '#B8BEC4', trim: '#EFF2F4', accent: '#6B7580', secondary: '#A0A8AE',
  },
  {
    id: 'coral',
    name: 'Coral Reef',
    blurb: 'Warm pink-orange against deep teal',
    wall: '#F3D9CC', floor: '#2E5E5C', trim: '#FBEDE4', accent: '#E0785A', secondary: '#1E4442',
  },
  {
    id: 'olive',
    name: 'Olive Grove',
    blurb: 'Muted green-brown, sun-bleached',
    wall: '#D6D2B4', floor: '#7A6E42', trim: '#EDEBD8', accent: '#8C8A3C', secondary: '#B8926A',
  },
  {
    id: 'lagoon',
    name: 'Lagoon',
    blurb: 'Saturated teal, tropical and bright',
    wall: '#BFE3E0', floor: '#1E6E68', trim: '#E4F5F3', accent: '#0E8A80', secondary: '#E0A868',
  },
  {
    id: 'rose',
    name: 'Desert Rose',
    blurb: 'Dusty pink, sand, sun-warmed clay',
    wall: '#E4C4BC', floor: '#B08A72', trim: '#F5E4DE', accent: '#C4685C', secondary: '#8C9A82',
  },
]

export const MOODS = [
  { id: 'cozy', name: 'Cozy', blurb: 'Soft edges, layered textiles, low lamps' },
  { id: 'modern', name: 'Modern', blurb: 'Clean lines, restraint, negative space' },
  { id: 'warm', name: 'Warm', blurb: 'Wood, amber light, nothing cold' },
  { id: 'cool', name: 'Cool', blurb: 'Grey, glass, a calm flat light' },
  { id: 'natural', name: 'Natural', blurb: 'Plants, raw materials, daylight' },
  { id: 'bold', name: 'Bold', blurb: 'Strong color, contrast, statement pieces' },
  { id: 'minimal', name: 'Minimal', blurb: 'Few things, all of them chosen' },
  { id: 'maximal', name: 'Maximal', blurb: 'More is more — fill every surface' },
  { id: 'industrial', name: 'Industrial', blurb: 'Metal, exposed structure, dark tones' },
  { id: 'playful', name: 'Playful', blurb: 'Color, softness, nothing precious' },
  { id: 'academic', name: 'Academic', blurb: 'Books, lamps, wood, deep quiet' },
  { id: 'zen', name: 'Zen', blurb: 'Low furniture, open floor, one plant' },
]

export const LIGHTING = [
  { id: 'natural', name: 'Daylight', blurb: 'Neutral, even, sun through a window', kelvin: 5600 },
  { id: 'warm', name: 'Warm', blurb: 'Lamplight, evening, amber cast', kelvin: 2700 },
  { id: 'cool', name: 'Cool', blurb: 'Crisp and blue-leaning', kelvin: 6500 },
  { id: 'moody', name: 'Moody', blurb: 'Dim, pooled light, deep shadow', kelvin: 2200 },
  { id: 'golden', name: 'Golden hour', blurb: 'Long low sun, everything amber', kelvin: 3200 },
  { id: 'overcast', name: 'Overcast', blurb: 'Flat, soft, shadowless grey', kelvin: 7000 },
]

// ---------------------------------------------------------------------------
// Room shapes.
//
// Rooms are described as a grid of 0.5m cells rather than a width and depth,
// because real apartments are not rectangles. A cell mask handles L-shapes,
// alcoves, and cut corners; walls get generated on every boundary between an
// inside cell and an outside one.
// ---------------------------------------------------------------------------

export const CELL = 0.5

/** Build a mask from a predicate over (col,row) in a cols×rows grid. */
const mask = (cols, rows, keep) => {
  const cells = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) if (keep(c, r, cols, rows)) cells.push(`${c},${r}`)
  }
  return { cols, rows, cells }
}

const rect = (cols, rows) => mask(cols, rows, () => true)

export const ROOM_SHAPES = [
  {
    id: 'studio',
    name: 'Studio',
    blurb: 'Compact, one open square',
    h: 2.6,
    ...rect(8, 8),
  },
  {
    id: 'bedroom',
    name: 'Bedroom',
    blurb: 'A standard private room',
    h: 2.7,
    ...rect(10, 9),
  },
  {
    id: 'living',
    name: 'Living Room',
    blurb: 'Room to arrange around a center',
    h: 2.9,
    ...rect(14, 11),
  },
  {
    id: 'loft',
    name: 'Loft',
    blurb: 'Tall, wide, industrial volume',
    h: 3.6,
    ...rect(18, 14),
  },
  {
    id: 'lshape',
    name: 'L-shaped',
    blurb: 'A wing off the main space',
    h: 2.8,
    // Bite out the top-right quadrant.
    ...mask(13, 11, (c, r) => !(c >= 8 && r < 5)),
  },
  {
    id: 'alcove',
    name: 'With an alcove',
    blurb: 'A nook off one wall — a desk or reading corner',
    h: 2.8,
    ...mask(13, 11, (c, r) => (r >= 3 ? true : c >= 4 && c <= 8)),
  },
  {
    id: 'galley',
    name: 'Long & narrow',
    blurb: 'The shape most older units actually are',
    h: 2.7,
    ...rect(16, 7),
  },
  {
    id: 'cutcorner',
    name: 'Cut corner',
    blurb: 'An angled wall where the building turns',
    h: 2.8,
    ...mask(12, 10, (c, r) => c + r > 3),
  },
]

// ---------------------------------------------------------------------------
// Room type → typical size.
//
// There is no database that maps an address to a floorplan or square footage —
// that data lives in property managers' private marketing PDFs. What this
// gives instead is honest: a starting size that matches what a room of this
// *kind* usually is, sourced from published U.S. averages, clearly labeled as
// typical rather than implied to be measured from the user's actual unit.
// Feet, because that's what people measure rooms in; converted to meters for
// the 3D system, which is unit-agnostic internally.
// ---------------------------------------------------------------------------

export const FT_PER_M = 3.28084
export const ftToM = (ft) => ft / FT_PER_M
export const mToFt = (m) => m * FT_PER_M

export const ROOM_TYPES = [
  { id: 'studio', name: 'Studio', blurb: 'One open space, typically ~450 sq ft', wFt: 20, dFt: 22.5, hFt: 9 },
  { id: 'bedroom', name: 'Bedroom', blurb: 'A private room, typically ~140 sq ft', wFt: 11, dFt: 13, hFt: 9 },
  { id: 'primary', name: 'Primary bedroom', blurb: 'The larger bedroom, typically ~200 sq ft', wFt: 13, dFt: 16, hFt: 9 },
  { id: 'living', name: 'Living room', blurb: 'A shared space, typically ~340 sq ft', wFt: 18, dFt: 19, hFt: 9 },
  { id: 'dorm', name: 'Dorm room', blurb: 'A double dorm, typically ~180 sq ft', wFt: 12, dFt: 15, hFt: 8.5 },
  { id: 'office', name: 'Home office', blurb: 'A small den, typically ~120 sq ft', wFt: 10, dFt: 12, hFt: 9 },
  { id: 'custom', name: "I'll enter it myself", blurb: 'Skip the estimate and type exact numbers', wFt: 12, dFt: 14, hFt: 9 },
]

export const getRoomType = (id) => ROOM_TYPES.find((t) => t.id === id) || ROOM_TYPES[1]

/** A plain rectangular cell mask sized from feet, rounded to the 0.5m grid. */
export function rectShapeFromFeet(wFt, dFt, hFt) {
  const wM = Math.max(1.5, ftToM(wFt))
  const dM = Math.max(1.5, ftToM(dFt))
  const cols = Math.max(3, Math.round(wM / CELL))
  const rows = Math.max(3, Math.round(dM / CELL))
  const cells = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push(`${c},${r}`)
  return { cols, rows, cells, h: ftToM(hFt) }
}

export const getPalette = (id) => PALETTES.find((p) => p.id === id) || PALETTES[0]
export const getShape = (id) => ROOM_SHAPES.find((s) => s.id === id) || ROOM_SHAPES[1]
export const getLighting = (id) => LIGHTING.find((l) => l.id === id) || LIGHTING[0]

// Legacy alias — floorplans were rectangles before shapes existed.
export const FLOORPLANS = ROOM_SHAPES

/** Metric bounds of a cell mask, in metres. */
export function shapeBounds(shape) {
  return { w: shape.cols * CELL, d: shape.rows * CELL, h: shape.h }
}

export const hasCell = (shape, c, r) => shape.cells.includes(`${c},${r}`)

/** World-space centre of a cell, with the grid centred on the origin. */
export function cellCenter(shape, c, r) {
  const { w, d } = shapeBounds(shape)
  return { x: -w / 2 + (c + 0.5) * CELL, z: -d / 2 + (r + 0.5) * CELL }
}

/** Is this world-space point inside the room footprint? */
export function pointInShape(shape, x, z) {
  const { w, d } = shapeBounds(shape)
  const c = Math.floor((x + w / 2) / CELL)
  const r = Math.floor((z + d / 2) / CELL)
  return hasCell(shape, c, r)
}

/**
 * What the walls are actually made of.
 *
 * Separate from palette on purpose: palette is the colour you paint a surface,
 * this is the surface. Exposed brick stays brick whether the room is clay or
 * ink, and a brick wall painted white is still obviously brick — the relief
 * survives the paint, which is exactly why it reads as character rather than
 * as a colour choice.
 *
 * `surface` names a generator in three/textures.js. `repeat` is tiles across
 * the whole wall rather than per metre, because box UVs run 0..1 per face —
 * see the note in buildShell.
 */
export const WALL_MATERIALS = [
  {
    id: 'plaster',
    name: 'Painted plaster',
    blurb: 'Smooth painted drywall — most flats and new builds',
    surface: 'plaster',
    repeat: 5,
  },
  {
    id: 'brick',
    name: 'Exposed brick',
    blurb: 'Warehouse conversions, older terraces, loft walls',
    surface: 'brick',
    repeat: 3,
    // Brick keeps its own colour rather than taking the wall paint, or an
    // "exposed brick" wall comes out mint green in a cool palette.
    tint: '#9c6650',
    roughness: 1.0,
  },
  {
    id: 'shiplap',
    name: 'Painted wood',
    blurb: 'Horizontal boarding — cottages, cabins, coastal',
    surface: 'shiplap',
    repeat: 4,
  },
  {
    id: 'concrete',
    name: 'Poured concrete',
    blurb: 'Board-formed, industrial, minimalist new build',
    surface: 'concrete',
    repeat: 3,
    tint: '#9a9791',
    roughness: 1.05,
  },
]

export const getWallMaterial = (id) => WALL_MATERIALS.find((m) => m.id === id) || WALL_MATERIALS[0]
