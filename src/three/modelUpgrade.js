/**
 * Ask the server for a real model of a piece, in the background.
 *
 * The room is already on screen before this runs. placeItems() builds the
 * procedural piece synchronously, so there is a node to drag, a shadow on the
 * floor and a correct silhouette in the layout from the first frame. This is
 * strictly an improvement that arrives late — usually a minute or two late —
 * and if it never arrives nothing is missing.
 *
 * That timing is the whole design. Generation is slow enough that waiting for
 * it would mean an empty room, and unreliable enough that depending on it would
 * mean an empty room some of the time.
 *
 * Every request is memoised for the session by cache key, so eight dining
 * chairs are one job rather than eight, and a palette change — which rebuilds
 * the whole scene — reuses the mesh instead of asking again. The promise is
 * deliberately not tied to the caller that started it: whoever asked first may
 * well have been unmounted by a rebuild long before the answer lands, and the
 * answer is still worth keeping.
 */

import { cacheKeyFor, canonicalProductUrl } from '../data/productId'
import { isUpgradable } from '../data/upgradable'

/** key -> Promise<spec|null>. Lives as long as the tab does. */
const inflight = new Map()

/**
 * Set once the endpoint has told us it is not going to help — no provider
 * configured, or no endpoint at all because this is `vite dev` rather than
 * `vercel dev`. After that we stop asking for the rest of the session.
 */
let unavailable = false

const MAX_WAIT_MS = 4 * 60 * 1000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * `res.json()` is not safe here. Under plain `vite dev` there is no /api, so
 * the dev server answers with index.html and a 200 — parsing that as JSON
 * throws an exception on every piece in the room.
 */
async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  const type = res.headers.get('content-type') || ''
  if (!type.includes('application/json')) {
    unavailable = true
    return null
  }
  return res.json()
}

/**
 * The query for a piece.
 *
 * Only `sourceUrl` is sent, never `item.url`. They look interchangeable and are
 * not: `sourceUrl` is a product page the user pasted, while `url` on a catalog
 * item is a search link for that store. Sending a search link would ask the
 * server to scrape a results page for a photo of nothing in particular.
 */
function requestUrl(item) {
  const params = new URLSearchParams({ model: item.model })
  if (item.name) params.set('name', item.name)

  const source = item.sourceUrl ? canonicalProductUrl(item.sourceUrl) : null
  if (source) params.set('url', source)

  return `/api/model?${params}`
}

async function run(item) {
  const started = Date.now()
  let url = requestUrl(item)

  while (Date.now() - started < MAX_WAIT_MS) {
    let body
    try {
      body = await getJson(url)
    } catch {
      return null
    }
    if (!body) return null

    if (body.status === 'ready') return body.mesh
    if (body.status === 'unavailable') {
      unavailable = true
      return null
    }
    // 'skipped' means the built-in builder is the better answer, 'failed' and
    // 'busy' mean not this time. None of them are worth retrying in-session.
    if (body.status !== 'pending') return null

    await sleep(Math.max(5, Number(body.retryIn) || 10) * 1000)
    // The job id is the handle; the server stays stateless between polls.
    url = `${requestUrl(item)}&job=${encodeURIComponent(body.job)}`
  }

  return null
}

/**
 * @returns Promise<spec|null> — the fiddleFig-shaped geometry, or null if this
 *          piece keeps the procedural model it already has.
 */
export function requestUpgrade(item) {
  if (unavailable || !item?.model || !isUpgradable(item.model)) return Promise.resolve(null)

  const key = cacheKeyFor({
    url: item.sourceUrl ? canonicalProductUrl(item.sourceUrl) : null,
    name: item.name,
    model: item.model,
  })
  if (!key) return Promise.resolve(null)

  if (!inflight.has(key)) {
    // Never rejects. A failed upgrade is a non-event — the room is already
    // correct without it — so callers should not have to handle one.
    inflight.set(key, run(item).catch(() => null))
  }
  return inflight.get(key)
}
