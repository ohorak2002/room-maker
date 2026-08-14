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
  { id: 'bath', name: 'Bath' },
  { id: 'kitchen', name: 'Kitchen' },
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

  // ---- Bath ---------------------------------------------------------------
  // `rooms` is what keeps a toilet out of the living-room feed. Pieces without
  // it are general-purpose and show up anywhere, which is the old behaviour.
  { id: 'toilet', name: 'Two-Piece Elongated Toilet', cat: 'bath', retailer: 'homedepot', price: 189, color: '#F6F6F4', model: 'toilet', h: 0.78, fp: 0.38, area: 0.28, group: 'toilet', rooms: ['bath', 'primaryBath'], vibes: ['modern', 'minimal', 'cool'] },
  { id: 'toilet-budget', name: 'Round-Front Toilet (Value)', cat: 'bath', retailer: 'lowes', price: 109, color: '#FBFBFA', model: 'toilet', h: 0.74, fp: 0.36, area: 0.26, group: 'toilet', rooms: ['bath', 'primaryBath'], vibes: ['modern', 'minimal'] },
  { id: 'vanity', name: '36" Single-Sink Vanity', cat: 'bath', retailer: 'homedepot', price: 449, color: '#6B5340', model: 'vanity', h: 0.85, fp: 0.5, area: 0.5, group: 'vanity', rooms: ['bath', 'primaryBath'], vibes: ['warm', 'modern', 'natural'] },
  { id: 'vanity-budget', name: '30" Vanity with Top (Value)', cat: 'bath', retailer: 'walmart', price: 229, color: '#8A7A66', model: 'vanity', h: 0.82, fp: 0.46, area: 0.44, group: 'vanity', rooms: ['bath', 'primaryBath'], vibes: ['warm', 'minimal'] },
  { id: 'bathtub', name: 'Alcove Soaking Tub, 60"', cat: 'bath', retailer: 'lowes', price: 529, color: '#F7F7F5', model: 'bathtub', h: 0.55, fp: 0.9, area: 1.24, group: 'tub', rooms: ['bath', 'primaryBath'], vibes: ['cozy', 'warm', 'minimal'] },
  { id: 'shower', name: 'Corner Shower Enclosure', cat: 'bath', retailer: 'homedepot', price: 679, color: '#DCE6EA', model: 'shower', h: 2.0, fp: 0.62, area: 0.85, group: 'shower', rooms: ['bath', 'primaryBath'], vibes: ['modern', 'cool', 'minimal'] },
  { id: 'towel-rack', name: 'Wall Towel Bar with Towels', cat: 'bath', retailer: 'target', price: 34, color: '#DDD6CA', model: 'towelrack', h: 0.5, fp: 0.3, group: 'towel', rooms: ['bath', 'primaryBath', 'laundry'], vibes: ['warm', 'cozy', 'minimal'] },

  // ---- Kitchen ------------------------------------------------------------
  { id: 'counter-run', name: 'Base Cabinet Run, 6 ft', cat: 'kitchen', retailer: 'ikea', price: 890, color: '#7A6A55', model: 'counter', h: 0.92, fp: 0.95, area: 1.21, group: 'counter', rooms: ['kitchen'], vibes: ['modern', 'warm', 'natural'] },
  { id: 'counter-budget', name: 'Base Cabinets, 6 ft (Value)', cat: 'kitchen', retailer: 'lowes', price: 540, color: '#8C8072', model: 'counter', h: 0.9, fp: 0.95, area: 1.21, group: 'counter', rooms: ['kitchen'], vibes: ['modern', 'minimal'] },
  { id: 'kitchen-sink', name: 'Undermount Sink Cabinet', cat: 'kitchen', retailer: 'homedepot', price: 420, color: '#7A6A55', model: 'kitchensink', h: 0.92, fp: 0.68, area: 0.82, group: 'kitchen-sink', rooms: ['kitchen'], vibes: ['modern', 'natural', 'warm'] },
  { id: 'island', name: 'Kitchen Island with Storage', cat: 'kitchen', retailer: 'wayfair', price: 749, color: '#6E5C48', model: 'island', h: 0.94, fp: 0.85, area: 1.72, group: 'island', rooms: ['kitchen'], vibes: ['warm', 'modern', 'bold'] },
  { id: 'range', name: '30" Freestanding Gas Range', cat: 'kitchen', retailer: 'lowes', price: 799, color: '#B9BDC2', model: 'range', h: 0.92, fp: 0.45, area: 0.5, group: 'range', rooms: ['kitchen'], vibes: ['modern', 'industrial', 'cool'] },
  { id: 'range-budget', name: '30" Electric Range (Value)', cat: 'kitchen', retailer: 'walmart', price: 469, color: '#C4C8CC', model: 'range', h: 0.9, fp: 0.44, area: 0.5, group: 'range', rooms: ['kitchen'], vibes: ['modern', 'minimal'] },
  { id: 'fridge', name: 'French-Door Refrigerator', cat: 'kitchen', retailer: 'homedepot', price: 1499, color: '#C2C6CB', model: 'fridge', h: 1.78, fp: 0.52, area: 0.66, group: 'fridge', rooms: ['kitchen'], vibes: ['modern', 'cool', 'industrial'] },
  { id: 'fridge-budget', name: 'Top-Freezer Fridge (Value)', cat: 'kitchen', retailer: 'walmart', price: 599, color: '#CDD1D5', model: 'fridge', h: 1.65, fp: 0.5, area: 0.62, group: 'fridge', rooms: ['kitchen'], vibes: ['modern', 'minimal'] },
  { id: 'dishwasher', name: 'Built-In Dishwasher', cat: 'kitchen', retailer: 'lowes', price: 649, color: '#B9BDC2', model: 'dishwasher', h: 0.86, fp: 0.36, area: 0.37, group: 'dishwasher', rooms: ['kitchen'], vibes: ['modern', 'cool'] },
  { id: 'washer', name: 'Front-Load Washer', cat: 'kitchen', retailer: 'homedepot', price: 749, color: '#E8EAEC', model: 'washer', h: 0.97, fp: 0.36, area: 0.36, group: 'washer', rooms: ['laundry'], vibes: ['modern', 'cool', 'minimal'] },
  { id: 'dryer', name: 'Front-Load Electric Dryer', cat: 'kitchen', retailer: 'homedepot', price: 699, color: '#E8EAEC', model: 'dryer', h: 0.97, fp: 0.36, area: 0.36, group: 'dryer', rooms: ['laundry'], vibes: ['modern', 'cool', 'minimal'] },

  // ---- Dining -------------------------------------------------------------
  // Dining rooms generated as furnishable but had nothing to put in them — the
  // same gap the bathrooms had. Chairs are sold as pairs, which is how they're
  // actually bought and how the layout solver wants to place them.
  { id: 'dining-table', name: 'Seats-6 Dining Table', cat: 'surfaces', retailer: 'wayfair', price: 549, color: '#7A5C42', model: 'diningtable', h: 0.76, fp: 1.05, area: 1.76, group: 'dining-table', rooms: ['dining', 'kitchen'], vibes: ['warm', 'modern', 'natural'] },
  { id: 'dining-table-budget', name: 'Seats-4 Dining Table (Value)', cat: 'surfaces', retailer: 'ikea', price: 229, color: '#8C7A62', model: 'diningtable', h: 0.74, fp: 0.9, area: 1.3, group: 'dining-table', rooms: ['dining', 'kitchen'], vibes: ['minimal', 'modern'] },
  { id: 'dining-chairs', name: 'Dining Chairs, Set of 2', cat: 'seating', retailer: 'wayfair', price: 189, color: '#B8A489', model: 'diningchair', h: 0.92, fp: 0.3, area: 0.22, group: 'dining-chair', rooms: ['dining', 'kitchen'], vibes: ['warm', 'natural', 'modern'] },
  { id: 'dining-chairs-budget', name: 'Dining Chairs, Set of 2 (Value)', cat: 'seating', retailer: 'walmart', price: 89, color: '#A89880', model: 'diningchair', h: 0.9, fp: 0.28, area: 0.2, group: 'dining-chair', rooms: ['dining', 'kitchen'], vibes: ['minimal', 'modern'] },
  { id: 'sideboard', name: 'Sideboard Buffet Cabinet', cat: 'surfaces', retailer: 'westelm', price: 799, color: '#6B5340', model: 'sideboard', h: 0.82, fp: 0.8, area: 0.68, group: 'sideboard', rooms: ['dining', 'living'], vibes: ['warm', 'modern', 'academic'] },
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

/**
 * Floor area a piece actually occupies, in m².
 *
 * `fp` is a clamp radius for dragging and collision, and treating it as a disc
 * badly overstates anything long and wall-hugging — a 1.65 x 0.75 m bathtub
 * really covers 1.24 m² but reads as 2.5 m² as a circle. That was enough to
 * make the app warn "this room is packed" about an ordinary bathroom. Fixtures
 * therefore carry a measured `area`; everything else keeps the disc estimate,
 * which is fair for chairs, plants and lamps.
 */
export const footprintArea = (item) =>
  item.area ?? Math.PI * (item.fp || 0.35) ** 2

export const formatUSD = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

// Rooms whose contents are decided by plumbing and gas lines rather than taste.
// A bathroom doesn't want a "cozy" sofa recommendation, it wants a toilet.
const FIXTURE_ROOMS = new Set(['bath', 'primaryBath', 'kitchen', 'laundry'])

// The general-purpose categories that still make sense in one of those rooms.
// A plant or a light belongs in a bathroom; a bed does not.
const UNIVERSAL_CATS = new Set(['greenery', 'decor', 'lighting'])

/**
 * Is this piece plausible in this kind of room?
 *
 * Items carrying a `rooms` list are fixtures and only belong where they're
 * listed. Items without one are general furniture: fine anywhere normally, but
 * excluded from bathrooms and kitchens unless they're decor, greenery or light.
 * With no room kind at all — single-room scope, where every room is a bedroom
 * or a living room — fixtures are held back entirely.
 */
function suitsRoom(item, roomKind) {
  if (!roomKind) return !item.rooms
  if (item.rooms) return item.rooms.includes(roomKind)
  if (FIXTURE_ROOMS.has(roomKind)) return UNIVERSAL_CATS.has(item.cat)
  return true
}

/**
 * Rank the catalog for a given room mood. Vibe match dominates; a mild bias
 * toward color similarity lets an imported photo's palette steer the feed.
 *
 * `roomKind` narrows the feed to what belongs in that room. Fixtures get a
 * standing bonus there, because a toilet has to appear in a bathroom whether or
 * not its vibes happen to match the mood the user picked for the whole home.
 */
export function recommend(mood, paletteHexes = [], limit = 12, roomKind = null) {
  const targets = paletteHexes.map(hexToRgb).filter(Boolean)
  return CATALOG.filter((item) => suitsRoom(item, roomKind))
    .map((item) => {
      let score = item.vibes?.includes(mood) ? 100 : 0
      if (roomKind && item.rooms?.includes(roomKind)) score += 80
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

/**
 * Fixture rooms get furnished by what they are, not by the mood chosen for the
 * home — offering to fill a bathroom with a "Cozy bedroom" pack was the old
 * behaviour and it put a bed in the bathroom.
 */
export const ROOM_PACKS = {
  bath: { name: 'Full bathroom', items: ['toilet', 'vanity', 'bathtub', 'towel-rack'] },
  primaryBath: { name: 'Primary bathroom', items: ['toilet', 'vanity', 'shower', 'bathtub', 'towel-rack'] },
  kitchen: { name: 'Working kitchen', items: ['counter-run', 'kitchen-sink', 'range', 'fridge', 'dishwasher'] },
  dining: { name: 'Dining set', items: ['dining-table', 'dining-chairs', 'dining-chairs', 'sideboard', 'pendant'] },
  laundry: { name: 'Laundry pair', items: ['washer', 'dryer', 'towel-rack'] },
}

export const starterForRoom = (kind, mood) => ROOM_PACKS[kind] || starterFor(mood)

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null
}

function rgbDist(a, b) {
  if (!a || !b) return 999
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}

/**
 * Look up an item by id, falling back to the generated pieces held in the store.
 * Everything that renders or prices a room goes through here, so a synthesized
 * sofa behaves exactly like a catalog one.
 */
export function resolveItem(id, synthetics = {}) {
  return byId(id) || synthetics[id] || null
}
