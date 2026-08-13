// Shoppable catalog.
//
// PRICES ARE ESTIMATES, not live data. There is no pricing API wired up yet, so
// every `price` below is a representative figure for that kind of product at that
// retailer. What IS real: the retailer and the search link, which opens that
// store's own search for the item. Swap `price` for an API response later and the
// rest of the app is unchanged.

const RETAILERS = {
  homedepot: { name: 'Home Depot', url: (q) => `https://www.homedepot.com/s/${encodeURIComponent(q)}` },
  ikea: { name: 'IKEA', url: (q) => `https://www.ikea.com/us/en/search/?q=${encodeURIComponent(q)}` },
  wayfair: { name: 'Wayfair', url: (q) => `https://www.wayfair.com/keyword.php?keyword=${encodeURIComponent(q)}` },
  target: { name: 'Target', url: (q) => `https://www.target.com/s?searchTerm=${encodeURIComponent(q)}` },
  lowes: { name: "Lowe's", url: (q) => `https://www.lowes.com/search?searchTerm=${encodeURIComponent(q)}` },
  amazon: { name: 'Amazon', url: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}` },
  westelm: { name: 'West Elm', url: (q) => `https://www.westelm.com/search/results.html?words=${encodeURIComponent(q)}` },
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
  { id: 'fiddle-fig', name: 'Faux Fiddle Leaf Fig, 6 ft', cat: 'greenery', retailer: 'homedepot', price: 129, color: '#3F6B3A', model: 'tree', h: 1.9 },
  { id: 'monstera', name: 'Artificial Monstera, 4 ft', cat: 'greenery', retailer: 'wayfair', price: 88, color: '#2F6B4F', model: 'tree', h: 1.3 },
  { id: 'snake-plant', name: 'Faux Snake Plant in Pot', cat: 'greenery', retailer: 'target', price: 42, color: '#4A7C4A', model: 'plant', h: 0.85 },
  { id: 'olive-tree', name: 'Faux Olive Tree, 5 ft', cat: 'greenery', retailer: 'homedepot', price: 149, color: '#6B7F5C', model: 'tree', h: 1.6 },
  { id: 'leaf-bouquet', name: 'Faux Leaf Bouquet', cat: 'greenery', retailer: 'homedepot', price: 18, color: '#5C8A4F', model: 'vase', h: 0.5 },
  { id: 'hanging-pothos', name: 'Hanging Pothos, Artificial', cat: 'greenery', retailer: 'amazon', price: 26, color: '#4E8C3F', model: 'hanging', h: 0.7 },
  { id: 'succulent-trio', name: 'Succulent Trio, Potted', cat: 'greenery', retailer: 'ikea', price: 24, color: '#7FA06B', model: 'smallplant', h: 0.22 },
  { id: 'palm', name: 'Areca Palm, 6 ft Faux', cat: 'greenery', retailer: 'wayfair', price: 165, color: '#3E7A45', model: 'palm', h: 1.85 },
  { id: 'moss-wall', name: 'Preserved Moss Wall Panel', cat: 'greenery', retailer: 'amazon', price: 74, color: '#4F7A44', model: 'wallpanel', h: 0.6 },
  { id: 'herb-planter', name: 'Windowsill Herb Planter', cat: 'greenery', retailer: 'lowes', price: 32, color: '#6B9E5F', model: 'smallplant', h: 0.25 },

  // ---- Seating ----------------------------------------------------------
  { id: 'desk-chair', name: 'Ergonomic Mesh Desk Chair', cat: 'seating', retailer: 'amazon', price: 189, color: '#2B2D31', model: 'chair', h: 1.1 },
  { id: 'lounge-chair', name: 'Upholstered Lounge Chair', cat: 'seating', retailer: 'westelm', price: 799, color: '#8A6F5C', model: 'armchair', h: 0.85 },
  { id: 'sofa', name: '3-Seat Fabric Sofa', cat: 'seating', retailer: 'ikea', price: 649, color: '#6E7A72', model: 'sofa', h: 0.8 },
  { id: 'beanbag', name: 'Oversized Bean Bag', cat: 'seating', retailer: 'target', price: 129, color: '#9A5B4A', model: 'beanbag', h: 0.65 },
  { id: 'pouf', name: 'Knit Floor Pouf', cat: 'seating', retailer: 'wayfair', price: 79, color: '#C4B49A', model: 'pouf', h: 0.4 },

  // ---- Surfaces ---------------------------------------------------------
  { id: 'desk', name: 'Solid Wood Writing Desk', cat: 'surfaces', retailer: 'ikea', price: 279, color: '#8B6B4A', model: 'desk', h: 0.75 },
  { id: 'standing-desk', name: 'Electric Standing Desk', cat: 'surfaces', retailer: 'amazon', price: 429, color: '#3A3D42', model: 'desk', h: 0.95 },
  { id: 'bed', name: 'Upholstered Platform Bed, Queen', cat: 'surfaces', retailer: 'wayfair', price: 549, color: '#7E8892', model: 'bed', h: 0.55 },
  { id: 'bookshelf', name: 'Open Bookshelf, 5-Tier', cat: 'surfaces', retailer: 'ikea', price: 159, color: '#9A7B58', model: 'shelf', h: 1.8 },
  { id: 'coffee-table', name: 'Round Coffee Table', cat: 'surfaces', retailer: 'westelm', price: 399, color: '#A8845C', model: 'table', h: 0.42 },
  { id: 'nightstand', name: 'Two-Drawer Nightstand', cat: 'surfaces', retailer: 'target', price: 119, color: '#8B7355', model: 'nightstand', h: 0.6 },
  { id: 'rug', name: 'Hand-Woven Area Rug, 8x10', cat: 'surfaces', retailer: 'wayfair', price: 249, color: '#B5A188', model: 'rug', h: 0.02 },

  // ---- Lighting ---------------------------------------------------------
  { id: 'led-strip', name: 'Smart LED Strip, 32 ft', cat: 'lighting', retailer: 'amazon', price: 34, color: '#8A5CFF', model: 'ledstrip', h: 0.05, emissive: true },
  { id: 'floor-lamp', name: 'Arc Floor Lamp', cat: 'lighting', retailer: 'westelm', price: 299, color: '#C8B48A', model: 'floorlamp', h: 1.7, emissive: true },
  { id: 'desk-lamp', name: 'Adjustable Desk Lamp', cat: 'lighting', retailer: 'ikea', price: 49, color: '#3A3D42', model: 'desklamp', h: 0.45, emissive: true },
  { id: 'pendant', name: 'Rattan Pendant Light', cat: 'lighting', retailer: 'homedepot', price: 89, color: '#C9A46B', model: 'pendant', h: 0.4, emissive: true },
  { id: 'neon-sign', name: 'Custom Neon Wall Sign', cat: 'lighting', retailer: 'amazon', price: 69, color: '#FF4FA3', model: 'wallpanel', h: 0.35, emissive: true },

  // ---- Decor ------------------------------------------------------------
  { id: 'canvas-art', name: 'Large Canvas Wall Art', cat: 'decor', retailer: 'wayfair', price: 139, color: '#5C6B7A', model: 'painting', h: 0.9 },
  { id: 'gallery-set', name: 'Gallery Frame Set of 6', cat: 'decor', retailer: 'target', price: 59, color: '#2B2D31', model: 'painting', h: 0.7 },
  { id: 'floor-mirror', name: 'Full-Length Floor Mirror', cat: 'decor', retailer: 'homedepot', price: 179, color: '#C9D2D8', model: 'mirror', h: 1.6 },
  { id: 'curtains', name: 'Blackout Curtain Panels', cat: 'decor', retailer: 'ikea', price: 45, color: '#6B6257', model: 'curtain', h: 2.2 },

  // ---- Tech -------------------------------------------------------------
  { id: 'monitor', name: '34" Ultrawide Monitor', cat: 'tech', retailer: 'amazon', price: 499, color: '#1E2024', model: 'monitor', h: 0.45 },
  { id: 'pc-tower', name: 'Desktop PC Tower', cat: 'tech', retailer: 'amazon', price: 899, color: '#26282D', model: 'tower', h: 0.5 },
  { id: 'tv', name: '65" 4K Smart TV', cat: 'tech', retailer: 'target', price: 549, color: '#141518', model: 'tv', h: 0.85 },
  { id: 'speaker', name: 'Floorstanding Speaker', cat: 'tech', retailer: 'amazon', price: 229, color: '#33363C', model: 'speaker', h: 1.0 },
]

export const CATALOG = raw.map((item) => {
  const r = RETAILERS[item.retailer]
  return { ...item, retailerName: r.name, url: r.url(item.name) }
})

export const byId = (id) => CATALOG.find((i) => i.id === id)

export const formatUSD = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
