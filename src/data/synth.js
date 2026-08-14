import { CATALOG, CATEGORIES } from './catalog'

/**
 * Turn a plain-language request into a buildable piece.
 *
 * What this is: a spec generator. "white cotton sofa" becomes a real 3D object
 * with the right shape, colour and size, priced from the quality you asked for,
 * plus search links that take you to that exact product at real stores.
 *
 * What this is NOT: a product feed. Nothing here looked up a listing, because
 * no free product-search API exists to look one up with. Inventing a plausible
 * SKU and price and presenting it as a real listing would be a lie — so the
 * generated card is labelled a spec, and the links do the finding.
 */

// --- vocabulary -----------------------------------------------------------

const TYPES = [
  { model: 'sofa', cat: 'seating', words: ['sofa', 'couch', 'loveseat', 'sectional', 'settee'], h: 0.8, fp: 1.15, base: 700 },
  { model: 'armchair', cat: 'seating', words: ['armchair', 'accent chair', 'lounge chair', 'recliner', 'reading chair'], h: 0.85, fp: 0.55, base: 420 },
  { model: 'chair', cat: 'seating', words: ['desk chair', 'office chair', 'task chair', 'chair'], h: 1.1, fp: 0.42, base: 180 },
  { model: 'beanbag', cat: 'seating', words: ['bean bag', 'beanbag'], h: 0.65, fp: 0.5, base: 120 },
  { model: 'pouf', cat: 'seating', words: ['pouf', 'ottoman', 'footstool'], h: 0.4, fp: 0.34, base: 90 },
  { model: 'bed', cat: 'surfaces', words: ['bed', 'bed frame', 'platform bed', 'mattress'], h: 0.55, fp: 1.3, base: 520 },
  { model: 'desk', cat: 'surfaces', words: ['desk', 'writing table', 'standing desk', 'workstation'], h: 0.75, fp: 0.85, base: 280 },
  { model: 'table', cat: 'surfaces', words: ['coffee table', 'side table', 'round table', 'table'], h: 0.42, fp: 0.55, base: 260 },
  { model: 'nightstand', cat: 'surfaces', words: ['nightstand', 'bedside table', 'night stand'], h: 0.6, fp: 0.32, base: 130 },
  { model: 'shelf', cat: 'surfaces', words: ['bookshelf', 'shelving', 'bookcase', 'shelf', 'storage unit'], h: 1.8, fp: 0.5, base: 190 },
  { model: 'rug', cat: 'surfaces', words: ['rug', 'carpet', 'area rug'], h: 0.02, fp: 1.6, base: 220 },
  { model: 'floorlamp', cat: 'lighting', words: ['floor lamp', 'standing lamp', 'arc lamp'], h: 1.7, fp: 0.32, base: 210, emissive: true },
  { model: 'desklamp', cat: 'lighting', words: ['desk lamp', 'table lamp', 'reading lamp'], h: 0.45, fp: 0.18, base: 70, emissive: true },
  { model: 'pendant', cat: 'lighting', words: ['pendant', 'ceiling light', 'chandelier', 'hanging light'], h: 0.4, fp: 0.3, base: 130, emissive: true },
  { model: 'ledstrip', cat: 'lighting', words: ['led strip', 'light strip', 'led'], h: 0.05, fp: 0.3, base: 40, emissive: true },
  { model: 'tree', cat: 'greenery', words: ['tree', 'fig', 'olive tree', 'tall plant', 'monstera'], h: 1.8, fp: 0.45, base: 120 },
  { model: 'palm', cat: 'greenery', words: ['palm'], h: 1.85, fp: 0.5, base: 150 },
  { model: 'plant', cat: 'greenery', words: ['plant', 'snake plant', 'fern'], h: 0.85, fp: 0.28, base: 45 },
  { model: 'smallplant', cat: 'greenery', words: ['succulent', 'small plant', 'herb', 'cactus'], h: 0.24, fp: 0.18, base: 28 },
  { model: 'hanging', cat: 'greenery', words: ['hanging plant', 'pothos', 'trailing plant', 'ivy'], h: 0.7, fp: 0.25, base: 35 },
  { model: 'vase', cat: 'greenery', words: ['vase', 'bouquet', 'flowers', 'stems'], h: 0.5, fp: 0.2, base: 30 },
  { model: 'painting', cat: 'decor', words: ['art', 'painting', 'canvas', 'print', 'poster', 'wall art', 'frame'], h: 0.9, fp: 0.4, base: 110 },
  { model: 'mirror', cat: 'decor', words: ['mirror'], h: 1.6, fp: 0.3, base: 150 },
  { model: 'curtain', cat: 'decor', words: ['curtain', 'curtains', 'blinds', 'drapes'], h: 2.2, fp: 0.3, base: 60 },
  { model: 'wallpanel', cat: 'decor', words: ['neon sign', 'wall panel', 'moss wall', 'neon'], h: 0.4, fp: 0.3, base: 80, emissive: true },
  { model: 'monitor', cat: 'tech', words: ['monitor', 'display', 'ultrawide'], h: 0.45, fp: 0.5, base: 350 },
  { model: 'tv', cat: 'tech', words: ['tv', 'television', 'smart tv'], h: 0.85, fp: 0.75, base: 480 },
  { model: 'tower', cat: 'tech', words: ['pc', 'tower', 'desktop computer', 'gaming pc'], h: 0.5, fp: 0.28, base: 800 },
  { model: 'speaker', cat: 'tech', words: ['speaker', 'speakers', 'subwoofer'], h: 1.0, fp: 0.25, base: 200 },

  // Appliances and fixtures. Everything here has a builder, so a generated
  // "stainless gas stove" renders as a real object rather than failing to parse.
  { model: 'range', cat: 'kitchen', words: ['stove', 'oven', 'range', 'cooktop', 'stovetop', 'gas range', 'electric range'], h: 0.92, fp: 0.45, area: 0.5, base: 800 },
  { model: 'fridge', cat: 'kitchen', words: ['fridge', 'refrigerator', 'freezer', 'icebox'], h: 1.78, fp: 0.52, area: 0.66, base: 1200 },
  { model: 'dishwasher', cat: 'kitchen', words: ['dishwasher', 'dish washer'], h: 0.86, fp: 0.36, area: 0.37, base: 650 },
  { model: 'washer', cat: 'kitchen', words: ['washer', 'washing machine', 'clothes washer'], h: 0.97, fp: 0.36, area: 0.36, base: 750 },
  { model: 'dryer', cat: 'kitchen', words: ['dryer', 'clothes dryer', 'tumble dryer'], h: 0.97, fp: 0.36, area: 0.36, base: 700 },
  { model: 'counter', cat: 'kitchen', words: ['cabinets', 'cupboards', 'counter', 'countertop', 'base cabinets', 'kitchen cabinets'], h: 0.92, fp: 0.95, area: 1.21, base: 890 },
  { model: 'kitchensink', cat: 'kitchen', words: ['kitchen sink', 'sink cabinet'], h: 0.92, fp: 0.68, area: 0.82, base: 420 },
  { model: 'island', cat: 'kitchen', words: ['island', 'kitchen island', 'breakfast bar'], h: 0.94, fp: 0.85, area: 1.72, base: 750 },
  { model: 'toilet', cat: 'bath', words: ['toilet', 'commode', 'water closet'], h: 0.78, fp: 0.38, area: 0.28, base: 190 },
  { model: 'vanity', cat: 'bath', words: ['vanity', 'bathroom vanity', 'bathroom sink', 'sink'], h: 0.85, fp: 0.5, area: 0.5, base: 450 },
  { model: 'bathtub', cat: 'bath', words: ['bathtub', 'tub', 'soaking tub', 'bath tub'], h: 0.55, fp: 0.9, area: 1.24, base: 530 },
  { model: 'shower', cat: 'bath', words: ['shower', 'shower stall', 'shower enclosure', 'walk in shower'], h: 2.0, fp: 0.62, area: 0.85, base: 680 },
  { model: 'towelrack', cat: 'bath', words: ['towel rack', 'towel bar', 'towel rail'], h: 0.5, fp: 0.3, base: 35 },
]

const COLORS = [
  { words: ['white', 'ivory', 'chalk'], hex: '#F2EFE9' },
  { words: ['cream', 'oat', 'bone', 'off white', 'off-white'], hex: '#E8DFCE' },
  { words: ['beige', 'sand', 'tan', 'taupe'], hex: '#CBB79B' },
  { words: ['grey', 'gray', 'slate', 'charcoal'], hex: '#7C8087' },
  { words: ['black', 'onyx', 'jet'], hex: '#22242A' },
  { words: ['brown', 'walnut', 'chocolate', 'espresso'], hex: '#6B4A33' },
  { words: ['oak', 'natural wood', 'light wood', 'birch', 'ash'], hex: '#C09A6B' },
  { words: ['green', 'sage', 'olive', 'forest'], hex: '#5E7A55' },
  { words: ['blue', 'navy', 'denim', 'teal'], hex: '#3F5F86' },
  { words: ['pink', 'blush', 'rose'], hex: '#D8A0A4' },
  { words: ['red', 'rust', 'burgundy', 'terracotta'], hex: '#A5452F' },
  { words: ['yellow', 'mustard', 'ochre', 'gold'], hex: '#C79A3C' },
  { words: ['purple', 'plum', 'lilac', 'lavender'], hex: '#8A6FA8' },
  { words: ['orange', 'amber'], hex: '#C97B3C' },
]

// Materials shift both the look and what the thing tends to cost.
const MATERIALS = [
  { words: ['cotton', 'linen', 'canvas'], label: 'Cotton', priceMul: 1.0 },
  { words: ['velvet'], label: 'Velvet', priceMul: 1.35 },
  { words: ['leather'], label: 'Leather', priceMul: 1.9 },
  { words: ['boucle', 'bouclé', 'sherpa'], label: 'Bouclé', priceMul: 1.5 },
  { words: ['wool'], label: 'Wool', priceMul: 1.4 },
  { words: ['oak', 'solid wood', 'walnut', 'teak', 'wooden', 'wood'], label: 'Solid wood', priceMul: 1.45 },
  { words: ['metal', 'steel', 'brass', 'chrome', 'aluminium', 'aluminum'], label: 'Metal', priceMul: 1.2 },
  { words: ['rattan', 'wicker', 'cane'], label: 'Rattan', priceMul: 1.15 },
  { words: ['glass'], label: 'Glass', priceMul: 1.3 },
  { words: ['plastic', 'acrylic', 'resin'], label: 'Plastic', priceMul: 0.65 },
  { words: ['faux', 'artificial', 'fake'], label: 'Faux', priceMul: 0.85 },
]

const SIZES = [
  { words: ['small', 'compact', 'mini', 'petite', 'narrow'], scale: 0.78, label: 'Small' },
  { words: ['large', 'big', 'oversized', 'xl', 'wide', 'king'], scale: 1.28, label: 'Large' },
  { words: ['tall', 'high'], scale: 1.18, label: 'Tall' },
  { words: ['low', 'short'], scale: 0.82, label: 'Low' },
]

// Quality 0-100 maps to a price multiplier and a retailer that actually sits at
// that end of the market. Walmart does not sell a $4,000 sofa; West Elm does not
// sell an $80 one.
const TIERS = [
  { max: 20, name: 'Budget', mul: 0.42, retailer: 'walmart', store: 'Walmart', roughness: 0.92 },
  { max: 45, name: 'Value', mul: 0.68, retailer: 'ikea', store: 'IKEA', roughness: 0.85 },
  { max: 70, name: 'Mid-range', mul: 1.0, retailer: 'wayfair', store: 'Wayfair', roughness: 0.7 },
  { max: 88, name: 'Premium', mul: 1.75, retailer: 'westelm', store: 'West Elm', roughness: 0.5 },
  { max: 101, name: 'High-end', mul: 3.1, retailer: 'westelm', store: 'West Elm', roughness: 0.34 },
]

const STORE_URL = {
  walmart: (q) => `https://www.walmart.com/search?q=${encodeURIComponent(q)}`,
  ikea: (q) => `https://www.ikea.com/us/en/search/?q=${encodeURIComponent(q)}`,
  wayfair: (q) => `https://www.wayfair.com/keyword.php?keyword=${encodeURIComponent(q)}`,
  westelm: (q) => `https://www.westelm.com/search/results.html?words=${encodeURIComponent(q)}`,
  amazon: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`,
  target: (q) => `https://www.target.com/s?searchTerm=${encodeURIComponent(q)}`,
  homedepot: (q) => `https://www.homedepot.com/s/${encodeURIComponent(q)}`,
}

// --- parsing --------------------------------------------------------------

const findBest = (hay, table) => {
  let best = null
  for (const entry of table) {
    for (const w of entry.words) {
      // Plurals matter more than they look: people type "speakers" and
      // "curtains" far more often than the singular the table is written in.
      const hit = hay.includes(` ${w} `) || hay.includes(` ${w}s `) || hay.includes(` ${w}es `)
      if (hit && (!best || w.length > best.matched.length)) {
        best = { ...entry, matched: w }
      }
    }
  }
  return best
}

/**
 * The shape used when nothing in the vocabulary matches.
 *
 * Returning null meant typing something ordinary — "espresso machine", "litter
 * box" — got you nothing at all, which is a dead end in a tool whose whole
 * pitch is that you can ask for anything. A neutral box sized from your words
 * is more useful than a refusal, and the card says plainly that it's a stand-in
 * rather than a real model of that product.
 */
const GENERIC = {
  model: 'generic',
  cat: 'decor',
  words: [],
  h: 0.5,
  fp: 0.3,
  base: 90,
  generic: true,
}

export function parseQuery(text) {
  const hay = ` ${text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()} `
  return {
    type: findBest(hay, TYPES),
    color: findBest(hay, COLORS),
    material: findBest(hay, MATERIALS),
    size: findBest(hay, SIZES),
  }
}

const tierFor = (quality) => TIERS.find((t) => quality < t.max) || TIERS[TIERS.length - 1]

const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * @param query    free text, e.g. "white cotton sofa"
 * @param quality  0-100
 * @param maxPrice optional ceiling; the spec is downgraded to fit rather than hidden
 */
export function synthesize(query, quality = 55, maxPrice = null) {
  const parsed = parseQuery(query)
  const { color, material, size } = parsed
  // Fall back to a neutral shape rather than refusing. `generic` on the result
  // lets the UI say so instead of passing a box off as a model of the product.
  const type = parsed.type || (query.trim() ? GENERIC : null)
  if (!type) return null

  let tier = tierFor(quality)
  const priceAt = (t) =>
    Math.max(
      12,
      Math.round(((type.base * t.mul * (material?.priceMul ?? 1) * (size?.scale ?? 1)) / 5)) * 5
    )

  let price = priceAt(tier)
  let downgraded = false
  // Respect a budget by stepping down tiers, not by pretending the price is lower.
  if (maxPrice) {
    for (let i = TIERS.indexOf(tier); i >= 0; i--) {
      if (priceAt(TIERS[i]) <= maxPrice) {
        if (i !== TIERS.indexOf(tier)) downgraded = true
        tier = TIERS[i]
        price = priceAt(tier)
        break
      }
    }
  }

  const cleaned = query.trim().replace(/\s+/g, ' ')
  const bits = [size?.label, material?.label, color ? titleCase(color.matched) : null]
    .filter(Boolean)
    .join(' ')
  // With no recognised type there's nothing to build a tidy name from, so the
  // words you typed are the name — and the search link uses them verbatim,
  // which is the part that actually finds the product.
  const name = type.generic
    ? titleCase(cleaned)
    : `${bits} ${titleCase(type.matched)}`.replace(/\s+/g, ' ').trim()
  const searchTerm = type.generic
    ? cleaned
    : [material?.label, color?.matched, type.matched].filter(Boolean).join(' ')

  return {
    id: `synth:${name.toLowerCase().replace(/\s+/g, '-')}:${tier.name}`,
    synthetic: true,
    // True when we had no model for this and fell back to a neutral shape. The
    // UI must say so — a box labelled "Espresso Machine" with nothing marking
    // it as a stand-in is a small lie.
    generic: Boolean(type.generic),
    name,
    cat: type.cat,
    model: type.model,
    h: +(type.h * (size?.scale ?? 1)).toFixed(2),
    fp: +(type.fp * (size?.scale ?? 1)).toFixed(2),
    // Fixtures carry a measured footprint so crowding doesn't over-count them.
    // Area is two-dimensional, so it scales by the square of a size modifier.
    ...(type.area ? { area: +(type.area * (size?.scale ?? 1) ** 2).toFixed(2) } : {}),
    color: color?.hex ?? '#B8AFA2',
    emissive: type.emissive ?? false,
    price,
    tier: tier.name,
    downgraded,
    retailer: tier.retailer,
    retailerName: tier.store,
    url: STORE_URL[tier.retailer](searchTerm),
    // Every tier, so you can see what more or less money actually buys.
    ladder: TIERS.map((t) => ({
      name: t.name,
      price: priceAt(t),
      store: t.store,
      url: STORE_URL[t.retailer](searchTerm),
    })),
    parsed: {
      type: type.matched,
      color: color?.matched ?? null,
      material: material?.label ?? null,
      size: size?.label ?? null,
    },
  }
}

/**
 * Pull a usable description out of a product URL.
 *
 * What this does NOT do is fetch the page. A browser can't: the retailers all
 * block cross-origin requests, Amazon blocks automated ones outright, and this
 * app has no server to proxy through. So there is no price, no photo, and no
 * stock — claiming otherwise would be inventing data.
 *
 * What it can do is read the slug, which is where most retailers put the
 * product name. Amazon's
 *   /Modway-Loveseat-Upholstered-Fabric-Sofa/dp/B01N...
 * carries "upholstered fabric loveseat" in plain sight. That's fed to the same
 * generator everything else uses, so you get the right shape, colour and size,
 * and a link straight back to the page you copied.
 */
const URL_NOISE = new Set([
  'dp', 'gp', 'product', 'ref', 'sspa', 'aw', 'd', 'p', 'pd', 'ip', 'a', 'pdp', 'itm',
  'com', 'www', 'html', 'htm', 'shop', 'buy', 'us', 'en', 'store', 'products', 'item',
])

export function parseProductUrl(raw) {
  let url
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '')
  const words = url.pathname
    .split('/')
    .flatMap((seg) => seg.split(/[-_+]/))
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
    // Drop routing noise, ASINs and other id-looking chunks — an id is long,
    // alphanumeric and tells us nothing about what the thing is.
    .filter((w) => w.length > 2 && w.length < 20 && !URL_NOISE.has(w) && !/\d/.test(w))

  // De-duplicate while keeping order; slugs often repeat the brand.
  const seen = new Set()
  const terms = words.filter((w) => (seen.has(w) ? false : seen.add(w)))

  if (!terms.length) return null
  return { host, terms, query: terms.join(' ') }
}

/**
 * Build a piece from a product URL. Returns the spec plus the source link, so
 * the card can point back at the exact listing the user pasted.
 */
export function synthesizeFromUrl(raw, quality = 55) {
  const parsed = parseProductUrl(raw)
  if (!parsed) return null

  const spec = synthesize(parsed.query, quality)
  if (!spec) return null

  return {
    ...spec,
    // The pasted page beats a store search — it's the actual product.
    url: raw.trim(),
    retailerName: parsed.host,
    sourceUrl: raw.trim(),
    fromUrl: true,
    // Price came from the quality tier, not from the listing. Say so.
    priceUnknown: true,
  }
}

/** Catalog items that already match the query, so we don't invent a duplicate. */
export function catalogMatches(query, limit = 4) {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  if (!words.length) return []
  return CATALOG.map((item) => {
    const hay = `${item.name} ${item.cat}`.toLowerCase()
    return { item, hits: words.filter((w) => hay.includes(w)).length }
  })
    .filter((r) => r.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.item.price - b.item.price)
    .slice(0, limit)
    .map((r) => r.item)
}

export const EXAMPLE_QUERIES = [
  'white cotton sofa',
  'large walnut desk',
  'small brass floor lamp',
  'green velvet armchair',
  'stainless gas stove',
  'compact washing machine',
  'black metal bookshelf',
]

export { TIERS, CATEGORIES }
