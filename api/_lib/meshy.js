/**
 * The image-to-3D provider, behind a two-function interface.
 *
 * Meshy is the default because it takes a plain image URL, returns GLB, and
 * will produce an untextured low-poly mesh on request — which is precisely and
 * only what this app wants. Tripo and CSM have the same async task shape, so
 * swapping providers means rewriting this file and nothing else.
 *
 * Two settings here are doing the important work:
 *
 *   should_texture: false   The photo must not end up baked into the albedo.
 *                           three multiplies material.color by the map, so a
 *                           textured mesh can never be re-tinted and the whole
 *                           palette stops reaching it.
 *   target_polycount        The app renders a whole room. A 30,000-triangle
 *                           sofa is invisible next to a 3,000-triangle one at
 *                           room distance and ten times the payload.
 *
 * Generation is genuinely slow — a minute or two — so nothing here waits for a
 * result. Create returns a task id, poll reports on it, and the caller decides
 * how patient to be.
 */

const BASE = 'https://api.meshy.ai/openapi'
const TIMEOUT = 12_000

export class ProviderError extends Error {
  constructor(message, { retryable = false } = {}) {
    super(message)
    this.retryable = retryable
  }
}

export const hasCredentials = () => Boolean(process.env.MESHY_API_KEY)

async function call(path, { method = 'GET', body } = {}) {
  const key = process.env.MESHY_API_KEY
  if (!key) throw new ProviderError('MESHY_API_KEY is not set')

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT),
    })
  } catch (err) {
    // A network blip mid-poll should not lose a job that is still running.
    throw new ProviderError(`provider unreachable: ${err.message}`, { retryable: true })
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300)
    // 429 and 5xx are worth another go; 401 and 400 are not.
    throw new ProviderError(`provider returned ${res.status}: ${detail}`, {
      retryable: res.status === 429 || res.status >= 500,
    })
  }

  return res.json()
}

/** @returns an opaque job handle the caller hands back to `poll`. */
export async function createFromImage(imageUrl, { polycount = 3000 } = {}) {
  const out = await call('/v1/image-to-3d', {
    method: 'POST',
    body: {
      image_url: imageUrl,
      ai_model: 'latest',
      // The silhouette is the entire reason we are here. See the file header.
      should_texture: false,
      should_remesh: true,
      topology: 'triangle',
      target_polycount: polycount,
    },
  })
  if (!out?.result) throw new ProviderError('provider accepted the job but returned no id')
  return `img:${out.result}`
}

/**
 * No URL to read a photo out of, so there is no photo. Text-to-3D in preview
 * mode is untextured by definition, which lines up with what we want anyway.
 * It is a worse likeness than a real product photo and the caller should say so.
 */
export async function createFromText(prompt, { polycount = 3000 } = {}) {
  const out = await call('/v2/text-to-3d', {
    method: 'POST',
    body: {
      mode: 'preview',
      prompt: prompt.slice(0, 600),
      ai_model: 'latest',
      should_remesh: true,
      topology: 'triangle',
      target_polycount: polycount,
    },
  })
  if (!out?.result) throw new ProviderError('provider accepted the job but returned no id')
  return `txt:${out.result}`
}

/** @returns {{ state: 'pending'|'ready'|'failed', progress, glbUrl, reason }} */
export async function poll(job) {
  const [kind, id] = String(job).split(':')
  if (!id || (kind !== 'img' && kind !== 'txt')) throw new ProviderError('malformed job handle')

  const path = kind === 'img' ? `/v1/image-to-3d/${id}` : `/v2/text-to-3d/${id}`
  const task = await call(path)

  if (task.status === 'SUCCEEDED') {
    const glbUrl = task.model_urls?.glb
    if (!glbUrl) return { state: 'failed', reason: 'provider finished without a GLB' }
    return { state: 'ready', glbUrl, progress: 100 }
  }
  if (task.status === 'FAILED' || task.status === 'CANCELED') {
    return { state: 'failed', reason: task.task_error?.message || task.status.toLowerCase() }
  }
  return { state: 'pending', progress: task.progress ?? 0 }
}
