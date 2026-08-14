/**
 * GET /api/product — the true size and colour of a product, from its page.
 *
 * Separate from /api/model on purpose. That endpoint is gated to the handful of
 * silhouettes the builders cannot draw, because generation costs money and
 * minutes. This one costs a single page fetch and applies to *everything* — a
 * bookcase gets no new mesh but it absolutely should be 80cm wide rather than a
 * ratio of a footprint radius.
 *
 * What comes back is what the app was missing most. It stores one `fp`, a
 * footprint radius, so every piece is round in plan and sized by guess. Real
 * width, depth and height turn "a sofa" into "your 228cm sofa", which is the
 * difference between a picture of a room and a plan you can trust.
 *
 * Cheap enough to be uncached in principle, cached anyway because retailers
 * rate-limit and the answer never changes: a product's dimensions are fixed
 * for the life of the listing.
 */

import { cacheKeyFor, canonicalProductUrl } from '../src/data/productId.js'
import { readCached, writeCached } from './_lib/cache.js'
import { isAllowedProductHost, pickProductPhoto, averageColour } from './_lib/photo.js'
import { readDimensions } from './_lib/dimensions.js'

const DAY = 'public, max-age=600, s-maxage=86400, stale-while-revalidate=604800'
const NO_CACHE = 'private, no-store'

const send = (res, status, body, cacheControl = NO_CACHE) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', cacheControl)
  res.status(status).json(body)
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { status: 'failed', reason: 'GET only' })

  const q = req.query || {}
  const model = typeof q.model === 'string' ? q.model : ''
  const rawUrl = typeof q.url === 'string' ? q.url.trim() : ''

  const source = rawUrl ? canonicalProductUrl(rawUrl) : null
  if (!source) return send(res, 400, { status: 'failed', reason: 'need a product URL' })
  if (!isAllowedProductHost(source)) {
    return send(res, 200, { status: 'skipped', reason: 'that shop is not on the fetch allowlist' }, DAY)
  }

  // Keyed on the retailer's article number and the model, since the model
  // decides how a `Length` measurement is read. Same reasoning as /api/model:
  // tracking parameters differ on every copy of a link.
  const key = 'facts_' + cacheKeyFor({ url: source, model })
  const cached = await readCached(key)
  if (cached) return send(res, 200, { status: 'ok', cached: cached.layer, ...cached.spec }, DAY)

  let html
  let landed
  try {
    const page = await fetch(source, {
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' },
      // Product pages are heavy — IKEA's runs to 1.1MB — and this is a single
      // fetch whose answer is cached for a day, so patience is cheap here.
      signal: AbortSignal.timeout(20_000),
    })
    if (!page.ok) return send(res, 200, { status: 'failed', reason: `product page returned ${page.status}` })
    landed = page.url || source
    html = await page.text()
  } catch (err) {
    return send(res, 200, { status: 'failed', reason: `could not reach the product page: ${err.message}` })
  }

  // A discontinued listing answers 200 and redirects to a category page. Any
  // number read there belongs to a different product. Same guard as the photo
  // picker, for the same reason.
  if (!/\/p\//.test(landed) && /\/p\//.test(source)) {
    return send(res, 200, { status: 'failed', reason: 'that listing has been discontinued' })
  }

  const dimensions = readDimensions(html, { model })

  // The colour is a bonus, not the point, so a failure here must not lose the
  // dimensions — which are the reason anyone called this.
  let colour = null
  let photo = null
  try {
    const picked = await pickProductPhoto(source)
    if (picked.url) {
      photo = picked.url
      colour = await averageColour(picked.url)
    }
  } catch {
    // Already have what matters.
  }

  if (!dimensions && !colour) {
    return send(res, 200, { status: 'failed', reason: 'the page published neither a size nor a usable photo' })
  }

  const facts = { dimensions, colour, photo }
  await writeCached(key, facts)
  return send(res, 200, { status: 'ok', key, ...facts }, DAY)
}
