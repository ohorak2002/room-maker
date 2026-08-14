/**
 * Real size and colour for a pasted product, from /api/product.
 *
 * The catalog's `h` and `fp` are a designer's estimate of "a sofa", and `fp` is
 * a single radius, so every piece is round in plan. When the user pastes an
 * actual listing we can do better than estimate: the retailer publishes the
 * assembled width, depth and height, and the product photo carries the real
 * colour rather than a hand-picked hex meaning "beige".
 *
 * This applies to everything, unlike the generated meshes in modelUpgrade.js.
 * A bookcase gets no new geometry — the builder already draws a grid of boards
 * correctly — but it should still be 80cm wide because that is what it is.
 *
 * Never throws. A shop that blocks us, a listing that has been discontinued, a
 * page with no measurements: all of them mean "keep the estimate", which is
 * what the app did before this existed.
 */

const inFlight = new Map()

/**
 * @param {{sourceUrl?:string, model?:string}} item
 * @returns {Promise<{dimensions,colour,photo}|null>}
 */
export function requestFacts(item) {
  const source = item?.sourceUrl
  if (!source) return Promise.resolve(null)

  // Keyed by url+model because the model decides how an ambiguous `Length`
  // measurement is read — see api/_lib/dimensions.js.
  const key = `${item.model || ''}|${source}`
  if (inFlight.has(key)) return inFlight.get(key)

  const params = new URLSearchParams({ url: source })
  if (item.model) params.set('model', item.model)

  const promise = fetch(`/api/product?${params}`)
    .then((res) => (res.ok ? res.json() : null))
    .then((body) => {
      if (!body || body.status !== 'ok') return null
      if (!body.dimensions && !body.colour) return null
      return { dimensions: body.dimensions || null, colour: body.colour || null, photo: body.photo || null }
    })
    .catch(() => null)

  inFlight.set(key, promise)
  return promise
}

/**
 * Fold real measurements into an item, in the units the app already speaks.
 *
 * `h` is a height in metres and `fp` a footprint *radius*, so a 228x95 sofa
 * becomes a radius of 1.14 — the half-width, since that is the reach the
 * layout solver and the drag clamp care about. Depth rides along separately
 * for the builders that can use it.
 */
export function applyFacts(item, facts) {
  if (!facts) return item
  const next = { ...item }
  const d = facts.dimensions

  if (d?.heightM) next.h = d.heightM
  if (d?.widthM) {
    next.wM = d.widthM
    next.fp = Math.max(d.widthM, d.depthM || 0) / 2
  }
  if (d?.depthM) next.dM = d.depthM
  if (facts.colour) next.color = facts.colour

  if (d || facts.colour) next.measured = true
  return next
}
