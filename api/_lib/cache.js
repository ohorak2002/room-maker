/**
 * Where a finished mesh is kept, so it is generated once ever rather than once
 * per visitor.
 *
 * Three layers, cheapest first:
 *
 *   1. The CDN. Set by the handler, not here: a ready response carries a long
 *      s-maxage, so a repeat request for the same product is answered at the
 *      edge and this function is never invoked. This is the layer that actually
 *      carries the traffic, and it costs nothing.
 *   2. This module's Map. Survives between requests on a warm instance. Small,
 *      free, and gone on the next cold start.
 *   3. Vercel Blob. The only layer that survives a deploy and is shared across
 *      instances and regions, which is what stops the same sofa being paid for
 *      twice. Optional: without a token the other two still work, they just miss
 *      more often.
 *
 * Every Blob call is wrapped, because a cache that throws is worse than no
 * cache — the request should fall back to generating, not fail.
 */

const PREFIX = 'nested/models/'
const MEMORY_LIMIT = 40

/** Small enough to stay well inside a serverless instance's memory budget. */
const memory = new Map()

const memoryGet = (key) => {
  const hit = memory.get(key)
  if (!hit) return null
  // Refresh insertion order so the least recently used entry is evicted first.
  memory.delete(key)
  memory.set(key, hit)
  return hit
}

const memoryPut = (key, value) => {
  memory.set(key, value)
  while (memory.size > MEMORY_LIMIT) memory.delete(memory.keys().next().value)
}

const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN)

/** Loaded lazily so the package is a genuine optional dependency. */
async function blobApi() {
  try {
    return await import('@vercel/blob')
  } catch {
    return null
  }
}

export async function readCached(key) {
  const local = memoryGet(key)
  if (local) return { spec: local, layer: 'memory' }
  if (!blobEnabled()) return null

  try {
    const blob = await blobApi()
    if (!blob) return null

    // The public URL is only knowable after a write, so ask for it. One extra
    // round trip on a cold instance, then the Map answers for the rest of it.
    const { blobs } = await blob.list({ prefix: `${PREFIX}${key}.json`, limit: 1 })
    if (!blobs?.length) return null

    const res = await fetch(blobs[0].url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null

    const spec = await res.json()
    memoryPut(key, spec)
    return { spec, layer: 'blob' }
  } catch {
    return null
  }
}

export async function writeCached(key, spec) {
  memoryPut(key, spec)
  if (!blobEnabled()) return

  try {
    const blob = await blobApi()
    if (!blob) return
    await blob.put(`${PREFIX}${key}.json`, JSON.stringify(spec), {
      access: 'public',
      contentType: 'application/json',
      // Without this the key gets a random suffix and the read above can still
      // find it by prefix, but every regeneration leaves another copy behind.
      addRandomSuffix: false,
      allowOverwrite: true,
    })
  } catch {
    // Generated fine, just not kept. The caller already has the mesh.
  }
}
