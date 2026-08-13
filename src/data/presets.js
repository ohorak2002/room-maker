// Onboarding option data: palettes, moods, light, room shapes.
// Each palette carries the actual hexes used to paint the 3D room.

export const PALETTES = [
  {
    id: 'clay',
    name: 'Clay & Linen',
    blurb: 'Earthy, sun-warmed, forgiving',
    wall: '#E4DAD0', floor: '#B08968', trim: '#F2ECE6', accent: '#C0703C',
  },
  {
    id: 'pine',
    name: 'Pine & Slate',
    blurb: 'Deep greens against cool stone',
    wall: '#DCE3DE', floor: '#6E6A63', trim: '#F1F4F1', accent: '#2E6B5E',
  },
  {
    id: 'ink',
    name: 'Ink & Brass',
    blurb: 'Low light, high contrast',
    wall: '#2B2D33', floor: '#4A423A', trim: '#3A3D45', accent: '#C9A227',
  },
  {
    id: 'paper',
    name: 'Paper White',
    blurb: 'Everything recedes but the objects',
    wall: '#F4F4F2', floor: '#D9CFC2', trim: '#FFFFFF', accent: '#8A8F98',
  },
  {
    id: 'dusk',
    name: 'Dusk Blue',
    blurb: 'Cool, quiet, a little melancholy',
    wall: '#C6D0DB', floor: '#8C7B6B', trim: '#E8EEF4', accent: '#3F6C93',
  },
  {
    id: 'ember',
    name: 'Ember',
    blurb: 'Saturated and unapologetic',
    wall: '#7A2E2E', floor: '#3C2B24', trim: '#A85A47', accent: '#E08A3C',
  },
  {
    id: 'sage',
    name: 'Sage & Oat',
    blurb: 'Soft green, nothing shouting',
    wall: '#DCE3D2', floor: '#C4B398', trim: '#F3F5EE', accent: '#6E8C5A',
  },
  {
    id: 'terra',
    name: 'Terracotta',
    blurb: 'Baked orange, deep shade',
    wall: '#E8CDB8', floor: '#8C5A3C', trim: '#F7E9DC', accent: '#B4562E',
  },
  {
    id: 'mono',
    name: 'Monochrome',
    blurb: 'Black, white, and the gap between',
    wall: '#E8E8E8', floor: '#3A3A3A', trim: '#FFFFFF', accent: '#141414',
  },
  {
    id: 'plum',
    name: 'Plum & Smoke',
    blurb: 'Moody purple, grey undertone',
    wall: '#4A3A4F', floor: '#5C5259', trim: '#6B5A70', accent: '#B07FC4',
  },
  {
    id: 'sand',
    name: 'Sand & Sea',
    blurb: 'Pale, salty, coastal light',
    wall: '#EFE6D6', floor: '#CBBBA0', trim: '#FBF6EC', accent: '#4C93A8',
  },
  {
    id: 'forest',
    name: 'Forest Floor',
    blurb: 'Dark green, warm wood, low light',
    wall: '#324037', floor: '#6B4F35', trim: '#44544A', accent: '#93B07A',
  },
  {
    id: 'blush',
    name: 'Blush & Bone',
    blurb: 'Warm pink, soft and unfussy',
    wall: '#F0DDD8', floor: '#C8A99C', trim: '#FDF4F1', accent: '#C4707A',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    blurb: 'Near-black blue, almost no reflection',
    wall: '#22283A', floor: '#2E3446', trim: '#333B52', accent: '#5C8CD6',
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
