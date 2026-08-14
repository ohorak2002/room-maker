/**
 * GET /api/model — a real 3D model for a product, generated from its photo.
 *
 * The app has about forty-five hand-written builders, and everything a user
 * types maps onto one of them. That works, and for boxy furniture it works
 * well, but it means every sofa in the app is the same sofa. This endpoint is
 * the way out: paste a link to the sofa you actually want, and the mesh that
 * comes back is that sofa's silhouette rather than the generic one.
 *
 * ── Why it answers before it has an answer ──────────────────────────────────
 *
 * Generation takes one to three minutes. A serverless function cannot hold a
 * request open that long — Vercel will cut it well before then — so this never
 * tries. The first call starts a job and hands back its id; the client polls
 * with that id until a mesh comes out. The job id lives in the client, which is
 * what keeps the function stateless.
 *
 * Meanwhile the app has already drawn the procedural piece, so there is nothing
 * to wait for on screen. The upgrade lands when it lands.
 *
 * ── What it costs, and how that is kept down ────────────────────────────────
 *
 * Every generation is real money and real minutes, so three things gate it:
 *
 *   The shape gate. Only silhouettes the builders genuinely can't do — see
 *   src/data/upgradable.js. Checked here as well as in the client, because a
 *   client-side gate is a suggestion.
 *
 *   The cache key. A retailer's product id, never the URL. Tracking parameters
 *   differ on every copy of the same link, so keying on the URL would mean
 *   paying for the same sofa over and over. See src/data/productId.js.
 *
 *   The rate cap. A crude per-instance ceiling. It is a floor, not a solution —
 *   a public deployment wants a real identity check in front of this.
 *
 * ── Degrading ──────────────────────────────────────────────────────────────
 *
 * With no API key configured, no photo on the page, or a shop we don't fetch
 * from, this returns a plain "not happening" and the app keeps the procedural
 * piece it already drew. Nothing here is load-bearing.
 */

import { cacheKeyFor, canonicalProductUrl } from '../src/data/productId.js'
import { isUpgradable } from '../src/data/upgradable.js'
import { readCached, writeCached } from './_lib/cache.js'
import { glbToSpec, GlbError } from './_lib/glb.js'
import { pickProductPhoto, isAllowedProductHost } from './_lib/photo.js'
import { createFromImage, createFromText, poll, hasCredentials, ProviderError } from './_lib/meshy.js'

const TRIANGLE_BUDGET = Number(process.env.MODEL_TRIANGLE_BUDGET || 3000)
const JOBS_PER_HOUR = Number(process.env.MODEL_MAX_JOBS_PER_HOUR || 40)
const MAX_GLB_BYTES = 25 * 1024 * 1024

// A day at the edge for a finished mesh. It is derived from a product photo
// that does not change, so there is nothing to go stale.
const READY_CACHE = 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800'
const NO_CACHE = 'private, no-store'

// --- rate cap -------------------------------------------------------------
// Per instance and in memory, so it resets on a cold start and does not see
// what other instances are doing. That is fine for what it is: a brake on one
// runaway client, not an accounting system.
const started = []
const allowNewJob = () => {
  const cutoff = Date.now() - 3_600_000
  while (started.length && started[0] < cutoff) started.shift()
  if (started.length >= JOBS_PER_HOUR) return false
  started.push(Date.now())
  return true
}

const send = (res, status, body, cacheControl = NO_CACHE) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', cacheControl)
  res.status(status).json(body)
}

/** Download the finished GLB and turn it into geometry this app can draw. */
async function fetchSpec(glbUrl) {
  // The URL came out of an authenticated provider response, not from the user,
  // so this is not the request that needs an allowlist — the product page fetch
  // in _lib/photo.js is. Size and time are still capped.
  const res = await fetch(glbUrl, { signal: AbortSignal.timeout(25_000) })
  if (!res.ok) throw new Error(`could not download the generated model (${res.status})`)

  const declared = Number(res.headers.get('content-length') || 0)
  if (declared > MAX_GLB_BYTES) throw new Error('generated model is too large')

  const buffer = await res.arrayBuffer()
  if (buffer.byteLength > MAX_GLB_BYTES) throw new Error('generated model is too large')

  return glbToSpec(buffer, { triangleBudget: TRIANGLE_BUDGET })
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { status: 'failed', reason: 'GET only' })

  const q = req.query || {}
  const model = typeof q.model === 'string' ? q.model : ''
  const name = typeof q.name === 'string' ? q.name.trim().slice(0, 200) : ''
  const rawUrl = typeof q.url === 'string' ? q.url.trim() : ''
  const job = typeof q.job === 'string' ? q.job : ''

  // Boxy furniture is already right and already instant. Say so plainly rather
  // than failing, so the client can stop asking about it.
  if (!isUpgradable(model)) {
    return send(res, 200, {
      status: 'skipped',
      reason: `the built-in ${model || 'shape'} builder is a better answer than a generated mesh`,
    }, READY_CACHE)
  }

  if (!hasCredentials()) {
    return send(res, 200, { status: 'unavailable', reason: 'no generation provider is configured' }, NO_CACHE)
  }

  const source = rawUrl ? canonicalProductUrl(rawUrl) : null
  const key = cacheKeyFor({ url: source, name, model })
  if (!key) return send(res, 400, { status: 'failed', reason: 'need a product name or URL' })

  // --- polling an existing job --------------------------------------------
  if (job) {
    let state
    try {
      state = await poll(job)
    } catch (err) {
      const retryable = err instanceof ProviderError && err.retryable
      return send(res, retryable ? 200 : 502, {
        status: retryable ? 'pending' : 'failed',
        reason: err.message,
        ...(retryable ? { job, retryIn: 15 } : {}),
      })
    }

    if (state.state === 'pending') {
      return send(res, 200, { status: 'pending', job, progress: state.progress, retryIn: 10 })
    }
    if (state.state === 'failed') {
      return send(res, 200, { status: 'failed', reason: state.reason })
    }

    try {
      const mesh = await fetchSpec(state.glbUrl)
      await writeCached(key, mesh)
      return send(res, 200, { status: 'ready', key, mesh }, READY_CACHE)
    } catch (err) {
      // A GLB we cannot read is a dead end for this product, not a transient
      // fault — retrying downloads the same bytes and fails the same way.
      const reason = err instanceof GlbError ? `unreadable model: ${err.message}` : err.message
      return send(res, 200, { status: 'failed', reason })
    }
  }

  // --- first request -------------------------------------------------------
  const cached = await readCached(key)
  if (cached) {
    return send(res, 200, { status: 'ready', key, cached: cached.layer, mesh: cached.spec }, READY_CACHE)
  }

  if (!allowNewJob()) {
    return send(res, 429, { status: 'busy', reason: 'too many generations started recently', retryIn: 300 })
  }

  let handle = null
  let from = null
  let note = null

  if (source && isAllowedProductHost(source)) {
    try {
      // Not the page's og:image — that is a styled room, and it would generate
      // a model of the room. See _lib/photo.js.
      const photo = await pickProductPhoto(source)
      if (photo.url) {
        handle = await createFromImage(photo.url, { polycount: TRIANGLE_BUDGET })
        from = 'photo'
      } else {
        note = 'the product page had no plain product shot, only styled scenes'
      }
    } catch (err) {
      // Falling back to the description is better than giving up, but the
      // client should be able to tell the user which one it got.
      note = err.message
    }
  } else if (source) {
    note = 'that shop is not on the fetch allowlist'
  }

  if (!handle) {
    if (!name) {
      return send(res, 200, { status: 'failed', reason: note || 'no photo and no description to work from' })
    }
    try {
      handle = await createFromText(
        `${name}, a single piece of furniture, complete object, plain studio background`,
        { polycount: TRIANGLE_BUDGET }
      )
      from = 'description'
    } catch (err) {
      return send(res, 502, { status: 'failed', reason: err.message })
    }
  }

  return send(res, 200, {
    status: 'pending',
    job: handle,
    key,
    // Generated from the words rather than the photo is a materially worse
    // likeness. The client labels it, so nobody is told this is their sofa
    // when it is a sofa-shaped guess.
    from,
    note,
    retryIn: 20,
  })
}
