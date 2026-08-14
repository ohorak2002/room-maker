// End-to-end exercise of api/model.js with the provider, the retailer and the
// GLB download all stubbed. Nothing real is called; the point is the handler's
// own flow -- the gate, the cache key, job creation, polling, and the GLB
// becoming geometry.
process.env.MESHY_API_KEY = 'test-key'
process.env.MODEL_TRIANGLE_BUDGET = '3000'



// --- a real GLB, built by hand --------------------------------------------
function makeGlb() {
  const verts = []
  for (const x of [0, 1]) for (const y of [0, 2]) for (const z of [0, 3]) verts.push(x, y, z)
  const tris = [0,1,3, 0,3,2, 4,6,7, 4,7,5, 0,4,5, 0,5,1, 2,3,7, 2,7,6, 0,2,6, 0,6,4, 1,5,7, 1,7,3]
  const vBuf = Buffer.from(new Float32Array(verts).buffer)
  const iBuf = Buffer.from(new Uint16Array(tris).buffer)
  const bin = Buffer.concat([vBuf, iBuf])
  const gltf = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 8, type: 'VEC3' },
      { bufferView: 1, componentType: 5123, count: 36, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: vBuf.length },
      { buffer: 0, byteOffset: vBuf.length, byteLength: iBuf.length },
    ],
    buffers: [{ byteLength: bin.length }],
  }
  const jsonBuf = Buffer.from(JSON.stringify(gltf), 'utf8')
  const jsonPad = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)])
  const binPad = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4, 0)])
  const total = 12 + 8 + jsonPad.length + 8 + binPad.length
  const out = Buffer.alloc(total)
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(total, 8)
  let o = 12
  out.writeUInt32LE(jsonPad.length, o); out.writeUInt32LE(0x4e4f534a, o + 4); jsonPad.copy(out, o + 8)
  o += 8 + jsonPad.length
  out.writeUInt32LE(binPad.length, o); out.writeUInt32LE(0x004e4942, o + 4); binPad.copy(out, o + 8)
  return out
}
const GLB = makeGlb()

// --- synthetic gallery images ----------------------------------------------
// Real JPEGs, so the picker's decode-and-score path is genuinely exercised
// rather than stubbed past. Each one imitates a category seen on a live IKEA
// page: a styled room, a plain cut-out, and a dimensions diagram.
const { encode } = await import('jpeg-js')

function jpeg(kind) {
  const w = 300, h = 300
  const data = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      let v = 255
      if (kind === 'room') v = 90 + ((x * 7 + y * 13) % 120)           // busy everywhere
      else if (kind === 'cutout') v = (x > 45 && x < 255 && y > 70 && y < 230) ? 110 : 255
      else if (kind === 'diagram') v = (x % 90 < 2 || y % 90 < 2) ? 60 : 255
      else if (kind === 'fullbleed') v = (x > 4 && x < 296 && y > 4 && y < 296) ? 130 : 255
      data[i] = data[i + 1] = data[i + 2] = v
      data[i + 3] = 255
    }
  }
  return encode({ data, width: w, height: h }, 88).data
}
const IMAGES = {
  '/images/products/kivik-sofa-hillared-anthracite__01_pe111111_s5.jpg': jpeg('room'),
  '/images/products/kivik-sofa-hillared-anthracite__02_pe222222_s5.jpg': jpeg('cutout'),
  '/images/products/kivik-sofa-hillared-anthracite__03_pe333333_s5.jpg': jpeg('diagram'),
  '/images/products/kivik-sofa-hillared-anthracite__04_pe444444_s5.jpg': jpeg('fullbleed'),
}
const CUTOUT = 'https://www.ikea.com/images/products/kivik-sofa-hillared-anthracite__02_pe222222_s5.jpg'

// --- the fake internet -----------------------------------------------------
const calls = []
let pollsLeft = 2

globalThis.fetch = async (url, opts = {}) => {
  const u = String(url)
  calls.push((opts.method || 'GET') + ' ' + u)
  const json = (body) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })

  const path = u.startsWith('https://www.ikea.com/') ? new URL(u).pathname : null
  if (path && IMAGES[path]) {
    return new Response(IMAGES[path], { headers: { 'content-type': 'image/jpeg' } })
  }
  if (u.startsWith('https://www.ikea.com/')) {
    // og:image points at the room shot, exactly as IKEA's really does. If the
    // picker ever regresses to trusting it, this test goes red.
    const html =
      '<html><head><meta property="og:image" content="https://www.ikea.com/images/products/kivik-sofa-hillared-anthracite__01_pe111111_s5.jpg"></head><body>' +
      Object.keys(IMAGES).map((p) => `<img src="https://www.ikea.com${p}?f=xl">`).join('') +
      '<img src="https://www.ikea.com/images/products/some-other-product__99_pe999999_s5.jpg">' +
      '</body></html>'
    return new Response(html, { headers: { 'content-type': 'text/html' } })
  }
  if (u === 'https://api.meshy.ai/openapi/v1/image-to-3d' && opts.method === 'POST') {
    const body = JSON.parse(opts.body)
    if (body.should_texture !== false) throw new Error('TEST FAIL: asked the provider for a texture')
    if (body.target_polycount !== 3000) throw new Error('TEST FAIL: polycount not passed through')
    if (body.image_url !== CUTOUT) throw new Error('TEST FAIL: sent ' + body.image_url + ' instead of the cut-out')
    return json({ result: 'task-abc' })
  }
  if (u === 'https://api.meshy.ai/openapi/v1/image-to-3d/task-abc') {
    if (pollsLeft-- > 0) return json({ id: 'task-abc', status: 'IN_PROGRESS', progress: 45 })
    return json({ id: 'task-abc', status: 'SUCCEEDED', progress: 100, model_urls: { glb: 'https://assets.meshy.ai/task-abc/model.glb' } })
  }
  if (u === 'https://assets.meshy.ai/task-abc/model.glb') {
    return new Response(GLB, { headers: { 'content-type': 'model/gltf-binary', 'content-length': String(GLB.length) } })
  }
  throw new Error('unexpected fetch: ' + u)
}

// --- fake req/res ----------------------------------------------------------
const { default: handler } = await import('../api/model.js')

async function call(query) {
  let payload, code
  const headers = {}
  const res = {
    setHeader: (k, v) => { headers[k] = v },
    status(c) { code = c; return this },
    json(b) { payload = b; return this },
  }
  await handler({ method: 'GET', query }, res)
  return { code, payload, headers }
}

let fail = 0
const ok = (label, cond, extra) => {
  console.log(cond ? 'ok  ' : 'FAIL', label, extra === undefined ? '' : extra)
  if (!cond) fail++
}

const IKEA = 'https://www.ikea.com/us/en/p/kivik-sofa-hillared-anthracite-s79305103/?ref=srp&pos=3'

// 1. Boxy shapes are refused before a penny is spent.
let r = await call({ model: 'dresser', name: 'Oak Dresser', url: IKEA })
ok('boxy shape is skipped', r.payload.status === 'skipped', r.payload.reason)
ok('  and the skip is CDN-cacheable', String(r.headers['Cache-Control']).includes('s-maxage'))
ok('  and nothing was fetched', calls.length === 0)

// 2. A gated shape starts a job off the product photo.
r = await call({ model: 'sofa', name: 'Kivik Sofa', url: IKEA })
ok('pending on first ask', r.payload.status === 'pending', r.payload.job)
ok('  built from the photo, not the words', r.payload.from === 'photo')
ok('  keyed by article number', r.payload.key === 'p_ikea_s79305103', r.payload.key)
ok('  pending is never cached', r.headers['Cache-Control'] === 'private, no-store')
ok('  chose the cut-out over the og:image room shot', calls.some((c) => c.includes('pe222222')))
ok('  rejected the dimensions diagram', !calls.some((c) => c.includes('POST') && c.includes('pe333333')))
ok('  ignored another product on the same page', !calls.some((c) => c.includes('pe999999')))

// 3. Polling reports progress, then delivers.
const job = r.payload.job
r = await call({ model: 'sofa', name: 'Kivik Sofa', url: IKEA, job })
ok('still working', r.payload.status === 'pending' && r.payload.progress === 45)
r = await call({ model: 'sofa', name: 'Kivik Sofa', url: IKEA, job })
ok('still working', r.payload.status === 'pending')

r = await call({ model: 'sofa', name: 'Kivik Sofa', url: IKEA, job })
ok('mesh delivered', r.payload.status === 'ready', r.payload.reason)
const mesh = r.payload.mesh
ok('  in the app contract', mesh && mesh.unit === 'metres' && mesh.heightM === 1)
ok('  seated on the floor', Math.min(...mesh.positions.filter((_, i) => i % 3 === 1)) === 0)
ok('  single tintable material', mesh.materials.length === 1 && mesh.materials[0].tint === true)
ok('  light enough to tint', mesh.materials[0].rgb.every((c) => c > 200), JSON.stringify(mesh.materials[0].rgb))
ok('  indexed', Array.isArray(mesh.indices) && mesh.indices.length === 36)
ok('  reports its own proportions', mesh.widthM === 0.5 && mesh.depthM === 1.5)
ok('  ready is CDN-cacheable', String(r.headers['Cache-Control']).includes('s-maxage=86400'))

// 4. The same product, a different link. Must come from cache, not the provider.
const before = calls.length
r = await call({ model: 'sofa', name: 'Kivik', url: 'https://www.ikea.com/us/en/p/kivik-sofa-hillared-anthracite-s79305103/?utm_source=newsletter' })
ok('tracking params still hit the cache', r.payload.status === 'ready' && r.payload.cached === 'memory', r.payload.cached)
ok('  and cost nothing', calls.length === before)

// 5. A shop we do not fetch from falls back to the description.
r = await call({ model: 'armchair', name: 'Boucle Reading Chair', url: 'https://randomfurniture.example/p/chair-889231' })
ok('unlisted shop is not fetched', !calls.some((c) => c.includes('randomfurniture')))

// 6. No key configured means the app quietly keeps what it has.
delete process.env.MESHY_API_KEY
r = await call({ model: 'armchair', name: 'Reading Chair' })
ok('degrades without a provider', r.payload.status === 'unavailable')

console.log('\n' + (fail ? fail + ' FAILURES' : 'all passed'))
console.log('network calls:', calls.length)
process.exit(fail ? 1 : 0)
