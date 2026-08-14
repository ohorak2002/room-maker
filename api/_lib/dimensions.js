/**
 * Real width, depth and height for a product, read off the retailer's page.
 *
 * This matters more than mesh quality. The app stores one `fp` — a footprint
 * *radius* — so a 228cm sofa and a 180cm loveseat both collapse to a single
 * number, and the builders re-derive width and depth from it with fixed ratios
 * (`fp * 1.6`, `fp * 1.25`). A room laid out from those guesses can tell you
 * something is fine when it would not physically fit against your wall, and
 * no amount of silhouette accuracy fixes that.
 *
 * Dimensions are also the part of "make it look like the real thing" that is
 * genuinely free and genuinely reachable: they live in the page's own text and
 * structured data rather than behind the asset gates that defeated fetching
 * retailers' 3D models. See docs/retailer-3d-models.md.
 *
 * TWO TRAPS, both hit on the first real page:
 *
 *   `measurementGroups` in IKEA's embedded JSON looks like exactly what you
 *   want and is the *packaging* — the flat-pack carton, headed "Package 1".
 *   A KIVIK reads 37½ × 19¾ × 72½ there, which is a box, not a sofa.
 *
 *   schema.org `width`/`height` on the same page are 2000 and 2000. Those are
 *   the pixel dimensions of an image.
 *
 * So the assembled size comes from the visible text, where IKEA prints
 * `Width: 89 ¾ "  Depth: 37 ⅜ "  Height: 32 ⅝ "` — which is 228 × 95 × 83 cm,
 * matching the dimensions diagram on the same page exactly.
 */

const CM_PER_INCH = 2.54

// IKEA writes fractions as single glyphs, so "89 ¾" is two characters, not four.
const VULGAR = {
  '¼': 0.25, '½': 0.5, '¾': 0.75,
  '⅐': 1 / 7, '⅑': 1 / 9, '⅒': 0.1,
  '⅓': 1 / 3, '⅔': 2 / 3,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅙': 1 / 6, '⅚': 5 / 6,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
}

/** "89 ¾" or "89 3/4" or "228" → a number. */
export function parseMeasure(raw) {
  if (!raw) return null
  let total = 0
  let seen = false

  const whole = raw.match(/(\d+(?:\.\d+)?)/)
  if (whole) {
    total += parseFloat(whole[1])
    seen = true
  }
  for (const [glyph, value] of Object.entries(VULGAR)) {
    if (raw.includes(glyph)) {
      total += value
      seen = true
    }
  }
  const ascii = raw.match(/(\d+)\s*\/\s*(\d+)/)
  if (ascii) {
    // "89 3/4" — the 89 was already taken as the whole number above.
    total += Number(ascii[1]) / Number(ascii[2])
    seen = true
  }
  return seen ? total : null
}

/** Strip markup and scripts, leaving the text a shopper actually reads. */
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

/**
 * Is this a plausible piece of furniture, rather than a carton or a cushion?
 *
 * The guard exists because the failure it catches is silent: a package
 * measurement parses perfectly and lays out a sofa the size of a box.
 */
function plausible(d) {
  // Width is not optional, and this is the guard that matters most.
  //
  // Article publishes seat depth and seat height above the overall size, so a
  // 91-inch sofa parsed cleanly as 64cm deep and 45cm high — both individually
  // believable, both the wrong measurement, and a sofa drawn 64cm wide is far
  // worse than one drawn at the catalog's estimate. Missing width is the tell
  // that what was found is a sub-measurement rather than the product.
  if (typeof d.widthM !== 'number') return false

  const vals = [d.widthM, d.depthM, d.heightM].filter((v) => typeof v === 'number')
  if (vals.length < 2) return false
  // Nothing in a room is under 5cm or over 4m on any axis.
  if (vals.some((v) => v < 0.05 || v > 4)) return false
  // A carton is long and flat; furniture is not 15x its own depth.
  const max = Math.max(...vals)
  const min = Math.min(...vals)
  if (max / min > 15) return false
  return true
}

/**
 * Read `Width: … Depth: … Height: …` out of the page text.
 *
 * Order matters and is load-bearing: retailers print the assembled product
 * first, then sub-measurements (seat width, seat depth) and packaging. Taking
 * the first of each label is what keeps a seat height from becoming the sofa's.
 */
function fromText(html, model) {
  const text = visibleText(html)
  const out = {}

  // A number, optionally with a fraction, followed by a unit.
  const AMOUNT = String.raw`([\d]+(?:\.\d+)?(?:\s*[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|\s*\d+\s*\/\s*\d+)?)\s*("|''|in\b|inches|cm\b|mm\b)`
  const labelled = (word) => new RegExp(String.raw`\b${word}\s*:?\s*` + AMOUNT, 'i')

  const read = (word) => {
    const m = text.match(labelled(word))
    if (!m) return null
    const value = parseMeasure(m[1])
    if (value === null) return null
    const unit = m[2].toLowerCase()
    if (unit === 'cm') return value / 100
    if (unit === 'mm') return value / 1000
    return (value * CM_PER_INCH) / 100
  }

  const width = read('Width')
  const depth = read('Depth')
  const height = read('Height')
  const length = read('Length')

  if (height != null) out.heightM = height
  if (width != null) out.widthM = width

  if (depth != null) {
    // A page that says Depth means depth. Nothing to work out.
    out.depthM = depth
  } else if (length != null) {
    // `Length` is the long axis, but which way that axis points depends on
    // what the thing is, and getting it wrong turns furniture sideways.
    //
    // A LACK coffee table publishes Length 90, Width 55 and sits with the 90
    // running along the wall — so Length is the width. A bed publishes Length
    // 200, Width 140 and sits with the 200 running away from the wall — so
    // there Length is the depth. Same label, opposite axes.
    //
    // Blindly forcing width >= depth fixes the tables and breaks every bed,
    // so use the one piece of information that actually settles it: what the
    // app already knows the piece is.
    if (LONG_AXIS_IS_DEPTH.has(model)) {
      out.depthM = length
    } else {
      out.widthM = length
      if (width != null) out.depthM = width
    }
  }
  return out
}

/** Pieces whose long side runs away from the wall rather than along it. */
const LONG_AXIS_IS_DEPTH = new Set(['bed', 'daybed', 'bunk', 'chaise', 'runner', 'mattress'])

/**
 * schema.org `QuantitativeValue`, where a shop publishes it properly.
 *
 * Guarded against the image-size collision: a bare `"width": 2000` with no unit
 * is a pixel count, so only values carrying a real unit are believed.
 */
function fromSchema(html) {
  const out = {}
  const KEYS = { width: 'widthM', depth: 'depthM', height: 'heightM' }
  for (const [key, field] of Object.entries(KEYS)) {
    const re = new RegExp(`"${key}"\\s*:\\s*\\{[^}]*?"unitCode"\\s*:\\s*"(CMT|INH|MMT)"[^}]*?"value"\\s*:\\s*([\\d.]+)`, 'i')
    const alt = new RegExp(`"${key}"\\s*:\\s*\\{[^}]*?"value"\\s*:\\s*([\\d.]+)[^}]*?"unitCode"\\s*:\\s*"(CMT|INH|MMT)"`, 'i')
    const m = html.match(re) || html.match(alt)
    if (!m) continue
    const unit = (m[1].length === 3 ? m[1] : m[2]).toUpperCase()
    const value = parseFloat(m[1].length === 3 ? m[2] : m[1])
    if (!Number.isFinite(value)) continue
    if (unit === 'CMT') out[field] = value / 100
    else if (unit === 'MMT') out[field] = value / 1000
    else out[field] = (value * CM_PER_INCH) / 100
  }
  return out
}

/**
 * @returns {{widthM,depthM,heightM,source}|null} metres, or null if the page
 *          did not publish a size we can trust.
 */
export function readDimensions(html, { model = '' } = {}) {
  const schema = fromSchema(html)
  if (plausible(schema)) return { ...round(schema), source: 'schema.org' }

  const text = fromText(html, model)
  if (plausible(text)) return { ...round(text), source: 'page text' }

  return null
}

const round = (d) => {
  const out = {}
  for (const [k, v] of Object.entries(d)) out[k] = Math.round(v * 1000) / 1000
  return out
}
