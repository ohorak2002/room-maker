/**
 * Find the product photo behind a retailer link.
 *
 * Retailers publish this deliberately — every product page carries an
 * `og:image` so the listing looks right when someone pastes it into a chat.
 * That is a stable, public, high-resolution photo of the product on a plain
 * background, which happens to be the ideal input for image-to-3D.
 *
 * This is a server doing it, not the browser. src/data/synth.js explains why
 * the client can only read the URL slug: retailers block cross-origin requests
 * and the app had nowhere to proxy through. This function is that proxy.
 *
 * SECURITY. The URL comes from whoever is using the app, and a server that
 * fetches arbitrary user-supplied URLs is a way into whatever else lives on
 * that network. The defence is an allowlist of retailer hostnames rather than
 * an IP check, because an IP check loses to DNS rebinding and an allowlist does
 * not. The cost is that a shop nobody added yet gets no photo, which is a much
 * better failure than the alternative.
 */

/** Shops we will fetch a page from. Everything else is refused. */
const ALLOWED = [
  /(^|\.)ikea\.com$/,
  /(^|\.)wayfair\.(com|ca|co\.uk|de)$/,
  /(^|\.)westelm\.com$/,
  /(^|\.)potterybarn\.com$/,
  /(^|\.)williams-sonoma\.com$/,
  /(^|\.)target\.com$/,
  /(^|\.)walmart\.com$/,
  /(^|\.)homedepot\.com$/,
  /(^|\.)article\.com$/,
  /(^|\.)cb2\.com$/,
  /(^|\.)crateandbarrel\.com$/,
  /(^|\.)roomandboard\.com$/,
  /(^|\.)floydhome\.com$/,
  /(^|\.)burrow\.com$/,
  /(^|\.)made\.com$/,
  /(^|\.)habitat\.co\.uk$/,
  /(^|\.)johnlewis\.com$/,
  /(^|\.)amazon\.(com|co\.uk|de|ca)$/,
]

export const isAllowedProductHost = (raw) => {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return false
    return ALLOWED.some((re) => re.test(url.hostname.toLowerCase()))
  } catch {
    return false
  }
}

/**
 * Read at most `maxBytes` of a response, so a server that answers a product
 * page request with a 300MB video cannot exhaust the function's memory.
 */
async function readCapped(res, maxBytes) {
  const reader = res.body?.getReader()
  if (!reader) return new Uint8Array(await res.arrayBuffer()).slice(0, maxBytes)

  const chunks = []
  let total = 0
  while (total < maxBytes) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.length
  }
  reader.cancel().catch(() => {})

  const out = new Uint8Array(Math.min(total, maxBytes))
  let at = 0
  for (const chunk of chunks) {
    const take = Math.min(chunk.length, out.length - at)
    if (take <= 0) break
    out.set(chunk.subarray(0, take), at)
    at += take
  }
  return out
}

const META = [
  /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
]

/**
 * @returns a public image URL, or null if the page did not offer one.
 * @throws  on a host we do not fetch from
 */
export async function findProductPhoto(pageUrl, { timeout = 8000 } = {}) {
  if (!isAllowedProductHost(pageUrl)) {
    throw new Error('that retailer is not on the allowlist')
  }

  let res
  try {
    res = await fetch(pageUrl, {
      redirect: 'follow',
      headers: {
        // Retailers serve a stripped page to anything that looks automated,
        // and a stripped page has no og:image. This is not a disguise — the
        // request is one page fetch for a link the user pasted themselves.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(timeout),
    })
  } catch (err) {
    throw new Error(`could not reach the product page: ${err.message}`)
  }

  if (!res.ok) throw new Error(`product page returned ${res.status}`)

  const html = new TextDecoder().decode(await readCapped(res, 1_500_000))

  // Some shops emit protocol-relative or relative image URLs, so resolve
  // against the page. `res.url` is the address after any redirects, which is
  // the correct base — but it is empty on responses that never went over the
  // wire, and `new URL(x, '')` throws even when x is already absolute.
  const base = res.url || pageUrl
  const resolve = (value) => {
    try {
      return new URL(value.replace(/&amp;/g, '&'), base).href
    } catch {
      return null
    }
  }

  for (const re of META) {
    const m = html.match(re)
    if (m) {
      const resolved = resolve(m[1])
      if (resolved?.startsWith('https://')) return resolved
    }
  }

  // Schema.org product data, which is the other place a photo reliably lives.
  const ld = html.match(/"image"\s*:\s*"(https:\/\/[^"]+)"/i) || html.match(/"image"\s*:\s*\[\s*"(https:\/\/[^"]+)"/i)
  if (ld) return ld[1].replace(/\\\//g, '/')

  return null
}
