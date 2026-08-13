// Shoppable catalog.
//
// PRICES ARE ESTIMATES, not live data. There is no pricing API wired up, so every
// `price` is a representative figure for that kind of product at that retailer.
// What IS real: the retailer and the search link, which opens that store's own
// search. Swap `price` for an API response later and the rest of the app is
// unchanged.
//
// Fields that drive app behavior:
//   vibes  - which room moods this suits, used by the recommendation feed
//   group  - substitute group; items sharing a group are interchangeable, which
//            is how the "cheapest option" swap works
//   fp     - footprint radius in meters, used by the layout solver + drag clamp

const RETAILERS = {
  homedepot: { name: 'Home Depot', url: (q) => `https://www.homedepot.com/s/${encodeURIComponent(q)}` },
  ikea: { name: 'IKEA', url: (q) => `https://www.ikea.com/us/en/search/?q=${encodeURIComponent(q)}` },
  wayfair: { name: 'Wayfair', url: (q) => `https://www.wayfair.com/keyword.php?keyword=${encodeURIComponent(q)}` },
  target: { name: 'Target', url: (q) => `https://www.target.com/s?searchTerm=${encodeURIComponent(q)}` },
  lowes: { name: "Lowe's", url: (q) => `https://www.lowes.com/search?searchTerm=${encodeURIComponent(q)}` },
  amazon: { name: 'Amazon', url: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}` },
  westelm: { name: 'West Elm', url: (q) => `https://www.westelm.com/search/results.html?words=${encodeURIComponent(q)}` },
  walmart: { name: 'Walmart', url: (q) => `https://www.walmart.com/search?q=${encodeURIComponent(q)}` },
}

export const CATEGORIES = [
  { id: 'greenery', name: 'Greenery' },
  { id: 'seating', name: 'Seating' },
  { id: 'surfaces', name: 'Surfaces' },
  { id: 'lighting', name: 'Lighting' },
  { id: 'decor', name: 'Decor' },
  { id: 'tech', name: 'Tech' },
]

const raw = [
  // ---- Greenery ---------------------------------------------------------
  { id: 'fiddle-fig', name: 'Faux Fiddle Leaf Fig, 6 ft', cat: 'greenery', retailer: 'homedepot', price: 129, color: '#3F6B3A', model: 'tree', h: 1.9, fp: 0.45, group: 'tall-tree', vibes: ['natural', 'cozy', 'modern'] },
  { id: 'fig-budget', name: 'Faux Fig Tree, 5 ft (Value)', cat: 'greenery', retailer: 'walmart', price: 54, color: '#44703C', model: 'tree', h: 1.6, fp: 0.4, group: 'tall-tree', vibes: ['natural', 'cozy'] },
  { id: 'olive-tree', name: 'Faux Olive Tree, 5 ft', cat: 'greenery', retailer: 'homedepot', price: 149, color: '#6B7F5C', model: 'tree', h: 1.6, fp: 0.42, group: 'tall-tree', vibes: ['natural', 'warm', 'modern'] },
  { id: 'palm', name: 'Areca Palm, 6 ft Faux', cat: 'greenery', retailer: 'wayfair', price: 165, color: '#3E7A45', model: 'palm', h: 1.85, fp: 0.5, group: 'tall-tree', vibes: ['natural', 'bold'] },
  { id: 'monstera', name: 'Artificial Monstera, 4 ft', cat: 'greenery', retailer: 'wayfair', price: 88, color: '#2F6B4F', model: 'tree', h: 1.3, fp: 0.4, group: 'mid-plant', vibes: ['natural', 'bold', 'cozy'] },
  { id: 'snake-plant', name: 'Faux Snake Plant in Pot', cat: 'greenery', retailer: 'target', price: 42, color: '#4A7C4A', model: 'plant', h: 0.85, fp: 0.28, group: 'mid-plant', vibes: ['natural', 'modern', 'cool'] },
  { id: 'snake-budget', name: 'Snake Plant, Faux (Value)', cat: 'greenery', retailer: 'walmart', price: 22, color: '#4E8148', model: 'plant', h: 0.75, fp: 0.26, group: 'mid-plant', vibes: ['natural', 'modern'] },
  { id: 'leaf-bouquet', name: 'Faux Leaf Bouquet', cat: 'greenery', retailer: 'homedepot', price: 18, color: '#5C8A4F', model: 'vase', h: 0.5, fp: 0.2, group: 'small-green', vibes: ['natural', 'warm', 'cozy'] },
  { id: 'succulent-trio', name: 'Succulent Trio, Potted', cat: 'greenery', retailer: 'ikea', price: 24, color: '#7FA06B', model: 'smallplant', h: 0.22, fp: 0.18, group: 'small-green', vibes: ['natural', 'modern', 'cool'] },
  { id: 'herb-planter', name: 'Windowsill Herb Planter', cat: 'greenery', retailer: 'lowes', price: 32, color: '#6B9E5F', model: 'smallplant', h: 0.25, fp: 0.2, group: 'small-green', vibes: ['natural', 'warm'] },
  { id: 'hanging-pothos', name: 'Hanging Pothos, Artificial', cat: 'greenery', retailer: 'amazon', price: 26, color: '#4E8C3F', model: 'hanging', h: 0.7, fp: 0.25, group: 'hanging-green', vibes: ['natural', 'cozy', 'bold'] },
  { id: 'moss-wall', name: 'Preserved Moss Wall Panel', cat: 'greenery', retailer: 'amazon', price: 74, color: '#4F7A44', model: 'wallpanel', h: 0.6, fp: 0.3, group: 'wall-green', vibes: ['natural', 'bold'] },

  // ---- Seating ----------------------------------------------------------
  { id: 'desk-chair', name: 'Ergonomic Mesh Desk Chair', cat: 'seating', retailer: 'amazon', price: 189, color: '#2B2D31', model: 'chair', h: 1.1, fp: 0.42, group: 'task-chair', vibes: ['modern', 'cool'] },
  { id: 'chair-budget', name: 'Mesh Task Chair (Value)', cat: 'seating', retailer: 'walmart', price: 79, color: '#33353A', model: 'chair', h: 1.05, fp: 0.4, group: 'task-chair', vibes: ['modern', 'cool'] },
  { id: 'lounge-chair', name: 'Upholstered Lounge Chair', cat: 'seating', retailer: 'westelm', price: 799, color: '#8A6F5C', model: 'armchair', h: 0.85, fp: 0.55, group: 'accent-chair', vibes: ['cozy', 'warm', 'bold'] },
  { id: 'accent-budget', name: 'Accent Armchair (Value)', cat: 'seating', retailer: 'wayfair', price: 249, color: '#8F7A66', model: 'armchair', h: 0.82, fp: 0.53, group: 'accent-chair', vibes: ['cozy', 'warm'] },
  { id: 'sofa', name: '3-Seat Fabric Sofa', cat: 'seating', retailer: 'ikea', price: 649, color: '#6E7A72', model: 'sofa', h: 0.8, fp: 1.15, group: 'sofa', vibes: ['cozy', 'modern', 'cool'] },
  { id: 'beanbag', name: 'Oversized Bean Bag', cat: 'seating', retailer: 'target', price: 129, color: '#9A5B4A', model: 'beanbag', h: 0.65, fp: 0.5, group: 'floor-seat', vibes: ['cozy', 'bold'] },
  { id: 'pouf', name: 'Knit Floor Pouf', cat: 'seating', retailer: 'wayfair', price: 79, color: '#C4B49A', model: 'pouf', h: 0.4, fp: 0.34, group: 'floor-seat', vibes: ['cozy', 'warm', 'natural'] },

  // ---- Surfaces ---------------------------------------------------------
  { id: 'desk', name: 'Solid Wood Writing Desk', cat: 'surfaces', retailer: 'ikea', price: 279, color: '#8B6B4A', model: 'desk', h: 0.75, fp: 0.85, group: 'desk', vibes: ['warm', 'natural', 'cozy'] },
  { id: 'standing-desk', name: 'Electric Standing Desk', cat: 'surfaces', retailer: 'amazon', price: 429, color: '#3A3D42', model: 'desk', h: 0.95, fp: 0.85, group: 'desk', vibes: ['modern', 'cool'] },
  { id: 'desk-budget', name: 'Computer Desk, 47" (Value)', cat: 'surfaces', retailer: 'walmart', price: 89, color: '#6E5B45', model: 'desk', h: 0.74, fp: 0.8, group: 'desk', vibes: ['modern', 'cool', 'warm'] },
  { id: 'bed', name: 'Upholstered Platform Bed, Queen', cat: 'surfaces', retailer: 'wayfair', price: 549, color: '#7E8892', model: 'bed', h: 0.55, fp: 1.3, group: 'bed', vibes: ['cozy', 'modern', 'cool'] },
  { id: 'bed-budget', name: 'Platform Bed Frame, Queen (Value)', cat: 'surfaces', retailer: 'walmart', price: 179, color: '#7A6A58', model: 'bed', h: 0.5, fp: 1.3, group: 'bed', vibes: ['cozy', 'warm'] },
  { id: 'bookshelf', name: 'Open Bookshelf, 5-Tier', cat: 'surfaces', retailer: 'ikea', price: 159, color: '#9A7B58', model: 'shelf', h: 1.8, fp: 0.5, group: 'shelving', vibes: ['warm', 'natural', 'modern'] },
  { id: 'coffee-table', name: 'Round Coffee Table', cat: 'surfaces', retailer: 'westelm', price: 399, color: '#A8845C', model: 'table', h: 0.42, fp: 0.55, group: 'coffee-table', vibes: ['warm', 'modern', 'natural'] },
  { id: 'table-budget', name: 'Round Coffee Table (Value)', cat: 'surfaces', retailer: 'target', price: 119, color: '#9C7C58', model: 'table', h: 0.42, fp: 0.55, group: 'coffee-table', vibes: ['warm', 'modern'] },
  { id: 'nightstand', name: 'Two-Drawer Nightstand', cat: 'surfaces', retailer: 'target', price: 119, color: '#8B7355', model: 'nightstand', h: 0.6, fp: 0.32, group: 'nightstand', vibes: ['warm', 'cozy', 'natural'] },
  { id: 'rug', name: 'Hand-Woven Area Rug, 8x10', cat: 'surfaces', retailer: 'wayfair', price: 249, color: '#B5A188', model: 'rug', h: 0.02, fp: 1.6, group: 'rug', vibes: ['cozy', 'warm', 'natural'] },
  { id: 'rug-budget', name: 'Area Rug, 8x10 (Value)', cat: 'surfaces', retailer: 'walmart', price: 89, color: '#AE9C86', model: 'rug', h: 0.02, fp: 1.6, group: 'rug', vibes: ['cozy', 'warm'] },

  // ---- Lighting ---------------------------------------------------------
  { id: 'led-strip', name: 'Smart LED Strip, 32 ft', cat: 'lighting', retailer: 'amazon', price: 34, color: '#8A5CFF', model: 'ledstrip', h: 0.05, fp: 0.3, emissive: true, group: 'led', vibes: ['bold', 'modern', 'cool'] },
  { id: 'floor-lamp', name: 'Arc Floor Lamp', cat: 'lighting', retailer: 'westelm', price: 299, color: '#C8B48A', model: 'floorlamp', h: 1.7, fp: 0.32, emissive: true, group: 'floor-lamp', vibes: ['warm', 'cozy', 'modern'] },
  { id: 'lamp-budget', name: 'Floor Lamp, Standing (Value)', cat: 'lighting', retailer: 'ikea', price: 39, color: '#C2B092', model: 'floorlamp', h: 1.6, fp: 0.3, emissive: true, group: 'floor-lamp', vibes: ['warm', 'cozy'] },
  { id: 'desk-lamp', name: 'Adjustable Desk Lamp', cat: 'lighting', retailer: 'ikea', price: 49, color: '#3A3D42', model: 'desklamp', h: 0.45, fp: 0.18, emissive: true, group: 'desk-lamp', vibes: ['modern', 'cool', 'warm'] },
  { id: 'pendant', name: 'Rattan Pendant Light', cat: 'lighting', retailer: 'homedepot', price: 89, color: '#C9A46B', model: 'pendant', h: 0.4, fp: 0.3, emissive: true, group: 'pendant', vibes: ['natural', 'warm', 'cozy'] },
  { id: 'neon-sign', name: 'Custom Neon Wall Sign', cat: 'lighting', retailer: 'amazon', price: 69, color: '#FF4FA3', model: 'wallpanel', h: 0.35, fp: 0.3, emissive: true, group: 'wall-light', vibes: ['bold', 'modern'] },

  // ---- Decor ------------------------------------------------------------
  { id: 'canvas-art', name: 'Large Canvas Wall Art', cat: 'decor', retailer: 'wayfair', price: 139, color: '#5C6B7A', model: 'painting', h: 0.9, fp: 0.4, group: 'wall-art', vibes: ['modern', 'bold', 'cool'] },
  { id: 'gallery-set', name: 'Gallery Frame Set of 6', cat: 'decor', retailer: 'target', price: 59, color: '#2B2D31', model: 'painting', h: 0.7, fp: 0.4, group: 'wall-art', vibes: ['cozy', 'modern', 'warm'] },
  { id: 'floor-mirror', name: 'Full-Length Floor Mirror', cat: 'decor', retailer: 'homedepot', price: 179, color: '#C9D2D8', model: 'mirror', h: 1.6, fp: 0.3, group: 'mirror', vibes: ['modern', 'cool', 'bold'] },
  { id: 'mirror-budget', name: 'Full-Length Mirror (Value)', cat: 'decor', retailer: 'walmart', price: 48, color: '#C4CDD3', model: 'mirror', h: 1.5, fp: 0.28, group: 'mirror', vibes: ['modern', 'cool'] },
  { id: 'curtains', name: 'Blackout Curtain Panels', cat: 'decor', retailer: 'ikea', price: 45, color: '#6B6257', model: 'curtain', h: 2.2, fp: 0.3, group: 'curtain', vibes: ['cozy', 'warm', 'cool'] },

  // ---- Tech -------------------------------------------------------------
  { id: 'monitor', name: '34" Ultrawide Monitor', cat: 'tech', retailer: 'amazon', price: 499, color: '#1E2024', model: 'monitor', h: 0.45, fp: 0.5, group: 'monitor', vibes: ['modern', 'cool'] },
  { id: 'monitor-budget', name: '27" Monitor (Value)', cat: 'tech', retailer: 'walmart', price: 129, color: '#23262A', model: 'monitor', h: 0.42, fp: 0.45, group: 'monitor', vibes: ['modern', 'cool'] },
  { id: 'pc-tower', name: 'Desktop PC Tower', cat: 'tech', retailer: 'amazon', price: 899, color: '#26282D', model: 'tower', h: 0.5, fp: 0.28, group: 'tower', vibes: ['modern', 'cool', 'bold'] },
  { id: 'tv', name: '65" 4K Smart TV', cat: 'tech', retailer: 'target', price: 549, color: '#141518', model: 'tv', h: 0.85, fp: 0.75, group: 'tv', vibes: ['modern', 'cool', 'bold'] },
  { id: 'speaker', name: 'Floorstanding Speaker', cat: 'tech', retailer: 'amazon', price: 229, color: '#33363C', model: 'speaker', h: 1.0, fp: 0.25, group: 'speaker', vibes: ['bold', 'modern', 'warm'] },
]

export const CATALOG = raw.map((item) => {
  const r = RETAILERS[item.retailer]
  return { ...item, retailerName: r.name, url: r.url(item.name) }
})

export const byId = (id) => CATALOG.find((i) => i.id === id)

/** All items interchangeable with this one, cheapest first. */
export const substitutesFor = (id) => {
  const item = byId(id)
  if (!item?.group) return []
  return CATALOG.filter((i) => i.group === item.group).sort((a, b) => a.price - b.price)
}

/** The cheapest interchangeable alternative, or null if this one already is. */
export const cheapestSubstitute = (id) => {
  const alts = substitutesFor(id)
  const best = alts[0]
  return best && best.id !== id ? best : null
}

export const formatUSD = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/**
 * Rank the catalog for a given room mood. Vibe match dominates; a mild bias
 * toward color similarity lets an imported photo's palette steer the feed.
 */
export function recommend(mood, paletteHexes = [], limit = 12) {
  const targets = paletteHexes.map(hexToRgb).filter(Boolean)
  return CATALOG.map((item) => {
    let score = item.vibes?.includes(mood) ? 100 : 0
    if (targets.length) {
      const c = hexToRgb(item.color)
      const nearest = Math.min(...targets.map((t) => rgbDist(c, t)))
      score += Math.max(0, 60 - nearest / 4)
    }
    return { item, score }
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.item)
}

/**
 * A furnished room in one click, per vibe. An empty room is the worst first
 * impression the app can make — this gives people something to react to.
 */
export const STARTER_PACKS = {
  cozy: { name: 'Cozy bedroom', items: ['bed-budget', 'nightstand', 'rug-budget', 'lamp-budget', 'monstera', 'gallery-set'] },
  modern: { name: 'Modern workspace', items: ['standing-desk', 'desk-chair', 'monitor', 'snake-plant', 'floor-mirror', 'canvas-art'] },
  warm: { name: 'Warm living room', items: ['sofa', 'coffee-table', 'rug', 'floor-lamp', 'olive-tree', 'gallery-set'] },
  cool: { name: 'Clean studio', items: ['bed', 'standing-desk', 'chair-budget', 'monitor', 'succulent-trio', 'mirror-budget'] },
  natural: { name: 'Plant-filled room', items: ['fiddle-fig', 'monstera', 'palm', 'snake-plant', 'hanging-pothos', 'desk', 'pouf'] },
  bold: { name: 'Statement room', items: ['beanbag', 'neon-sign', 'led-strip', 'tv', 'palm', 'rug'] },
}

export const starterFor = (mood) => STARTER_PACKS[mood] || STARTER_PACKS.cozy

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null
}

function rgbDist(a, b) {
  if (!a || !b) return 999
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}
