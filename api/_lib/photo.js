/**
 * Find the product photo behind a retailer link.
 *
 * This is a server doing it, not the browser. src/data/synth.js explains why
 * the client can only read the URL slug: retailers block cross-origin requests
 * and the app had nowhere to proxy through. This function is that proxy.
 *
 * THE OBVIOUS ANSWER IS THE WRONG ONE. Every product page carries an `og:image`
 * so the link looks right when someone pastes it into a chat, and reaching for
 * it is the natural move. But that image is chosen to sell the product, not to
 * describe it: IKEA's KIVIK sofa page offers a styled room — rattan chair,
 * floor lamp, two framed prints, a fig, a shaggy rug. Hand that to an
 * image-to-3D service and you have bought a model of the room.
 *
 * So `pickProductPhoto` below reads the whole gallery and chooses by looking at
 * the pixels. Measured across several live KIVIK variants:
 *
 *                        edge mean   edge sd   ink%
 *   styled room shot       104-216     29-81    90-100
 *   3/4 hard cut-out           254       0.1        33   <- want
 *   3/4 studio backdrop        243      15.8        26   <- want
 *   dimensions diagram         255       0.3         4
 *   full-bleed detail          254       0.2        93
 *
 * Ink coverage — how much of the frame is not background — is what separates
 * them, with daylight on both sides. Under 12% is a line drawing, and the
 * drawing is the dangerous one: it has the cleanest background on the page and
 * would generate a flat sheet of numbers. Over 72% there is no margin left, so
 * there is no silhouette to read.
 *
 * The border test is the second filter and stays deliberately loose. A first
 * version demanded a uniform white border and threw away the studio shot above
 * — a perfect three-quarter view whose only sin was a soft gradient behind it.
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

// --- picking the right one ------------------------------------------------

const slugOf = (url) => url.match(/\/p\/([a-z0-9-]{6,}?)-s?\d{6,}/i)?.[1] || null

/**
 * Every image on the page that plausibly belongs to this product.
 *
 * The slug filter is not an optimisation, it is the correctness check. A
 * product page also carries a couple of hundred recommendation thumbnails, and
 * every one of them is a clean cut-out on white that scores beautifully.
 * Without the filter the picker returns whatever the shop is promoting today.
 *
 * So no slug means no candidates. Guessing here is how an orange swivel chair
 * ends up cached under an armchair's article number — which is exactly what
 * happened the first time this ran against the real site.
 */
function galleryCandidates(html, pageUrl) {
  const slug = slugOf(pageUrl)
  if (!slug) return []

  const host = new URL(pageUrl).hostname.replace(/^www\./, '')
  const found = [...html.matchAll(/https:\/\/[^"'\\\s)]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\\s)]*)?/gi)].map((m) => m[0])

  const seen = new Set()
  const out = []
  for (const raw of found) {
    // Collapse the size variants — the same photo appears at eight widths.
    const base = raw.split('?')[0]
    if (seen.has(base)) continue
    if (!base.toLowerCase().includes(slug.toLowerCase())) continue
    if (!base.includes(host)) continue
    seen.add(base)
    out.push(base)
  }
  return out.slice(0, 14)
}

/**
 * Score one image. Small render only — the decision needs a few hundred pixels
 * across, not a few million, and the function pays for every byte it decodes.
 */
async function score(url, decodeJpeg) {
  const res = await fetch(`${url}?f=s`, { signal: AbortSignal.timeout(8000) }).catch(() => null)
  if (!res?.ok) return null
  const type = res.headers.get('content-type') || ''
  // The decoder handles JPEG only, which is what every retailer serves here.
  if (!type.includes('jpeg') && !type.includes('jpg')) return null

  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.length > 3_000_000) return null

  let img
  try {
    img = decodeJpeg(bytes, { useTArray: true })
  } catch {
    return null
  }

  const { width: w, height: h, data } = img
  if (w < 200 || h < 200) return null
  const lum = (x, y) => {
    const i = (y * w + x) * 4
    return (data[i] + data[i + 1] + data[i + 2]) / 3
  }

  const edge = []
  for (let x = 0; x < w; x += 2) edge.push(lum(x, 0), lum(x, h - 1))
  for (let y = 0; y < h; y += 2) edge.push(lum(0, y), lum(w - 1, y))
  const mean = edge.reduce((s, v) => s + v, 0) / edge.length
  const sd = Math.sqrt(edge.reduce((s, v) => s + (v - mean) ** 2, 0) / edge.length)

  let ink = 0
  let total = 0
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      total++
      if (lum(x, y) < 240) ink++
    }
  }

  return { url, mean, sd, ink: ink / total }
}

/**
 * The best image-to-3D input on the page, or null if none of them qualify.
 *
 * When nothing qualifies the caller falls back to generating from the product
 * description — a worse likeness, but an honest one, and far better than
 * sending a photograph of a living room and calling the result a sofa.
 */
export async function pickProductPhoto(pageUrl, { timeout = 8000 } = {}) {
  if (!isAllowedProductHost(pageUrl)) throw new Error('that retailer is not on the allowlist')

  const res = await fetch(pageUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(timeout),
  }).catch((err) => {
    throw new Error(`could not reach the product page: ${err.message}`)
  })
  if (!res.ok) throw new Error(`product page returned ${res.status}`)

  // A discontinued product does not 404. IKEA answers 200 and redirects to a
  // category page, which is full of other products' immaculate cut-outs — so
  // the picker succeeds, confidently, on the wrong object, and caches it under
  // the article number that was asked for. Check we are still on the page we
  // asked for before believing anything on it.
  const landed = res.url || pageUrl
  const wanted = slugOf(pageUrl)
  if (wanted && slugOf(landed) !== wanted) {
    throw new Error('that product page redirected elsewhere — the listing has probably been discontinued')
  }

  const html = new TextDecoder().decode(await readCapped(res, 2_000_000))
  const candidates = galleryCandidates(html, landed)

  let decodeJpeg
  try {
    ;({ decode: decodeJpeg } = await import('jpeg-js'))
  } catch {
    return { url: null, kind: 'none', note: 'no JPEG decoder available' }
  }

  const scored = (await Promise.all(candidates.map((c) => score(c, decodeJpeg)))).filter(Boolean)

  const usable = scored
    // Ink does the separating; the border test only has to rule out a photo
    // that happens to be framed against something dark.
    .filter((s) => s.ink >= 0.12 && s.ink <= 0.72 && s.mean >= 230 && s.sd <= 25)
    // More of the frame filled means more of the object to work from, and less
    // background for the generator to mistake for part of it.
    .sort((a, b) => b.ink - a.ink)

  if (usable.length) return { url: usable[0].url, kind: 'cut-out', candidates: scored.length }
  return { url: null, kind: 'none', candidates: scored.length }
}

/**
 * The product's actual colour, averaged from its photo.
 *
 * The catalog carries a hand-picked hex per item, which is a designer's guess
 * at "beige sofa". The photo is the real thing, and it is already located and
 * already decoded by the picker above, so this is nearly free.
 *
 * Only the middle of the frame is sampled, and only pixels that are not
 * background: a cut-out is mostly white by area, so a naive average returns
 * "slightly off-white" for every product in the shop.
 */
export async function averageColour(imageUrl) {
  let decodeJpeg
  try {
    ;({ decode: decodeJpeg } = await import('jpeg-js'))
  } catch {
    return null
  }

  const res = await fetch(`${imageUrl}?f=s`, { signal: AbortSignal.timeout(8000) }).catch(() => null)
  if (!res?.ok) return null

  let img
  try {
    img = decodeJpeg(new Uint8Array(await res.arrayBuffer()), { useTArray: true })
  } catch {
    return null
  }

  const { width: w, height: h, data } = img
  let r = 0
  let g = 0
  let b = 0
  let n = 0

  const x0 = Math.floor(w * 0.2)
  const x1 = Math.ceil(w * 0.8)
  const y0 = Math.floor(h * 0.2)
  const y1 = Math.ceil(h * 0.8)

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4
      const [pr, pg, pb] = [data[i], data[i + 1], data[i + 2]]
      // Skip the backdrop. 238 sits below the studio white measured on real
      // pages (254) and above all but the palest upholstery.
      if (pr > 238 && pg > 238 && pb > 238) continue
      r += pr
      g += pg
      b += pb
      n++
    }
  }
  if (n < 200) return null

  const hex = (v) => Math.round(v / n).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase()
}
