/**
 * Pull a retailer's own product code out of a product URL.
 *
 * Why this exists: generated models are expensive — real money per piece and a
 * minute or two of waiting — so the cache has to hit. Keying by the full URL
 * guarantees it never will. The link you copy off a phone carries a session id,
 * the one off a search page carries the search rank, and an affiliate link
 * carries a tag that changes per visit:
 *
 *   .../p/kivik-sofa-hillared-anthracite-s79305103/?ref=srp&pos=3
 *   .../p/kivik-sofa-hillared-anthracite-s79305103/?utm_campaign=oct
 *
 * Same sofa, two keys, two generations, two bills. The article number is the
 * part that identifies the product, so that — plus the retailer it belongs to —
 * is the key. Everything else in the URL is discarded.
 *
 * This is shared by the browser and the serverless function on purpose: the
 * client uses it to avoid asking twice in one session, the server uses it to
 * name the cache entry. Two implementations would eventually disagree, and a
 * disagreement here is a silent cache miss nobody notices.
 */

/**
 * What can legally follow a product code.
 *
 * Worth spelling out because getting it wrong is invisible: a pattern anchored
 * on `/` alone matches `.../847362991/` and misses `.../847362991?athbdg=L1600`,
 * so half the links people actually copy fall through to the generic reader and
 * land in a different cache namespace than the other half.
 */
const END = '(?:[/?#]|$)'

/**
 * How each retailer writes its product code into the path.
 *
 * Ordered most specific first. `id` is capture group 1.
 */
const RETAILERS = [
  {
    retailer: 'ikea',
    hosts: [/(^|\.)ikea\.com$/],
    // Article numbers are eight digits. Combination products (a sofa sold as a
    // frame plus a cover) get an `s` in front, and that prefix matters — s7930
    // and 7930 are different things.
    patterns: [new RegExp(`/p/(?:.*-)?(s?\\d{8})${END}`, 'i')],
  },
  {
    retailer: 'amazon',
    hosts: [/(^|\.)amazon\.[a-z.]+$/],
    // ASIN: ten characters, always containing a digit, which is what separates
    // it from the slug words sitting either side of it.
    patterns: [new RegExp(`/(?:dp|gp/product|gp/aw/d)/([A-Z0-9]{10})${END}`)],
  },
  {
    retailer: 'wayfair',
    hosts: [/(^|\.)wayfair\.[a-z.]+$/],
    patterns: [/-([a-z]{1,4}\d{6,})\.html/i, /\bsku=([a-z0-9]{6,})\b/i],
  },
  {
    retailer: 'target',
    hosts: [/(^|\.)target\.com$/],
    patterns: [/\/-\/(A-\d+)/i],
  },
  {
    retailer: 'walmart',
    hosts: [/(^|\.)walmart\.[a-z.]+$/],
    patterns: [new RegExp(`/ip/(?:.*/)?(\\d{6,})${END}`)],
  },
  {
    retailer: 'westelm',
    hosts: [/(^|\.)westelm\.com$/, /(^|\.)potterybarn\.com$/, /(^|\.)williams-sonoma\.com$/],
    patterns: [new RegExp(`/products/(?:.*-)?([a-z]\\d{3,})${END}`, 'i')],
  },
  {
    retailer: 'homedepot',
    hosts: [/(^|\.)homedepot\.com$/],
    patterns: [new RegExp(`/p/(?:.*/)?(\\d{7,})${END}`)],
  },
  {
    retailer: 'article',
    hosts: [/(^|\.)article\.com$/],
    patterns: [new RegExp(`/product/(\\d{3,})${END}`)],
  },
  {
    retailer: 'cb2',
    hosts: [/(^|\.)cb2\.com$/, /(^|\.)crateandbarrel\.com$/],
    patterns: [new RegExp(`/s(\\d{6,})${END}`, 'i'), /[?&]a=(\d{3,})\b/],
  },
]

/** Stable 32-bit hash, so a name with no product code still gets one key. */
function fnv1a(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

/**
 * @returns {{retailer: string, id: string} | null}
 */
export function productIdFromUrl(raw) {
  let url
  try {
    url = new URL(String(raw).trim())
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  // Match against the path and the query, but never the fragment — retailers
  // put anchors like #reviews on the same product.
  const hay = url.pathname + url.search

  // Keep the retailer's name even when its pattern misses, so a link they
  // reformatted doesn't quietly open a second cache namespace for the same shop.
  let label = host

  for (const entry of RETAILERS) {
    if (!entry.hosts.some((h) => h.test(host))) continue
    for (const re of entry.patterns) {
      const m = hay.match(re)
      if (m) return { retailer: entry.retailer, id: m[1].toLowerCase() }
    }
    // Known retailer, unrecognised URL shape — a category page, or a layout
    // they changed. Fall through to the generic reader rather than guessing.
    label = entry.retailer
    break
  }

  // Unknown retailer. Most shops still put a numeric id in the path, so take
  // the longest digit run of a plausible length. Six digits is the floor: below
  // that we'd start keying on prices, dates and page numbers.
  const runs = url.pathname.match(/\d{6,}/g)
  if (runs) {
    const best = runs.reduce((a, b) => (b.length >= a.length ? b : a))
    return { retailer: label, id: best }
  }

  return null
}

/**
 * The link with the tracking stripped off: scheme, host and path, nothing else.
 *
 * Two jobs. The server fetches this rather than the raw paste, so a referral
 * parameter can't send it somewhere unexpected. And because the app asks for a
 * model over plain HTTP GET, an identical URL is what lets the CDN answer a
 * repeat request without waking the function at all — which it can only do if
 * the two people who pasted the same sofa produced the same URL.
 *
 * A handful of shops do put the product id in the query string. Those keep it.
 */
const MEANINGFUL_PARAMS = ['sku', 'a', 'productid', 'skuid', 'variant']

export function canonicalProductUrl(raw) {
  let url
  try {
    url = new URL(String(raw).trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  const keep = new URLSearchParams()
  for (const [k, v] of url.searchParams) {
    if (MEANINGFUL_PARAMS.includes(k.toLowerCase())) keep.set(k.toLowerCase(), v)
  }

  const query = keep.toString()
  return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`
}

/**
 * The cache key for a request.
 *
 * A product code wins whenever one is readable. Failing that — a plain typed
 * name, or a URL with no id in it — the key is a hash of the words plus the
 * shape they resolved to, which is everything that actually changes the model.
 */
export function cacheKeyFor({ url, name, model } = {}) {
  if (url) {
    const found = productIdFromUrl(url)
    if (found) return `p_${found.retailer}_${found.id}`
  }

  const words = String(name || url || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ')

  if (!words) return null
  return `n_${model || 'any'}_${fnv1a(words)}`
}
