// Writes test/fixtures/nested-side-table.glb: an original test asset authored
// by this script (no third-party geometry, textures or product data). It is a
// fictional side table used only to exercise material-preserving import:
// three separate materials, a colour and a normal texture with UVs, a
// transmission extension, instanced nodes and an authored root offset.
// Usage: node scripts/make-fixture-glb.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'

// --- PNG -----------------------------------------------------------------
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0); out.write(type, 4, 'ascii'); data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}
function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x / size, y / size)
      raw.set([r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v)))), y * (size * 3 + 1) + 1 + x * 3)
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
// Deterministic oak-like figure: grain runs along U.
const grain = (u, v) => Math.sin(v * 90 + Math.sin(u * 7) * 2.2 + Math.sin(u * 23 + v * 5) * 0.4)
const oak = png(256, (u, v) => { const g = grain(u, v) * 0.5 + 0.5; return [168 - g * 38, 124 - g * 30, 82 - g * 22] })
const oakNormal = png(128, (u, v) => { const d = (grain(u, v + 0.004) - grain(u, v - 0.004)) * 0.18; return [128, 128 + d * 127, 250] })

// --- geometry --------------------------------------------------------------
function boxGeometry(w, h, d) {
  const [x, y, z] = [w / 2, h / 2, d / 2]
  const faces = [ // normal, corner positions (counter-clockwise from outside)
    [[1, 0, 0], [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]]],
    [[-1, 0, 0], [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]]],
    [[0, 1, 0], [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]]],
    [[0, -1, 0], [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]]],
    [[0, 0, 1], [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]]],
    [[0, 0, -1], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]]],
  ]
  const pos = [], nor = [], uv = [], idx = []
  for (const [n, corners] of faces) {
    const base = pos.length / 3
    corners.forEach((c, i) => { pos.push(...c); nor.push(...n); uv.push(i === 1 || i === 2 ? 1 : 0, i >= 2 ? 0 : 1) })
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  return { pos, nor, uv, idx }
}

// --- glTF assembly -----------------------------------------------------------
const bin = []
let byteLength = 0
const bufferViews = [], accessors = []
function addView(buf, target) {
  const pad = (4 - (byteLength % 4)) % 4
  if (pad) { bin.push(Buffer.alloc(pad)); byteLength += pad }
  bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: buf.length, ...(target ? { target } : {}) })
  bin.push(buf); byteLength += buf.length
  return bufferViews.length - 1
}
function addAccessor(values, type, componentType) {
  const n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[type]
  const buf = componentType === 5123 ? Buffer.from(new Uint16Array(values).buffer) : Buffer.from(new Float32Array(values).buffer)
  const acc = { bufferView: addView(buf, componentType === 5123 ? 34963 : 34962), componentType, count: values.length / n, type }
  if (type === 'VEC3') {
    acc.min = [0, 1, 2].map((k) => Math.min(...values.filter((_, i) => i % 3 === k)))
    acc.max = [0, 1, 2].map((k) => Math.max(...values.filter((_, i) => i % 3 === k)))
  }
  accessors.push(acc)
  return accessors.length - 1
}
function mesh(name, geo, material) {
  return {
    name,
    primitives: [{
      attributes: { POSITION: addAccessor(geo.pos, 'VEC3', 5126), NORMAL: addAccessor(geo.nor, 'VEC3', 5126), TEXCOORD_0: addAccessor(geo.uv, 'VEC2', 5126) },
      indices: addAccessor(geo.idx, 'SCALAR', 5123),
      material,
    }],
  }
}

const W = 0.6, H = 0.5, TOP = 0.03, LEG = 0.025, INSET = 0.04, SHELF_Y = 0.15
const meshes = [
  mesh('Top', boxGeometry(W, TOP, W), 0),
  mesh('Leg', boxGeometry(LEG, H - TOP, LEG), 1),
  mesh('Shelf', boxGeometry(W - 2 * INSET - LEG, 0.008, W - 2 * INSET - LEG), 2),
]
const legAt = (W / 2 - INSET)
const nodes = [
  // Authored offset on the root: the importer must re-seat the model on its
  // own bounds, not assume the file's origin is centred on the floor.
  { name: 'Nested fixture side table', translation: [0.2, 0.0, -0.1], children: [1, 2, 3, 4, 5, 6] },
  { name: 'Top', mesh: 0, translation: [0, H - TOP / 2, 0] },
  ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz], i) => ({ name: `Leg ${i + 1}`, mesh: 1, translation: [sx * legAt, (H - TOP) / 2, sz * legAt] })),
  { name: 'Glass shelf', mesh: 2, translation: [0, SHELF_Y, 0] },
]
const images = [
  { name: 'oak-colour', mimeType: 'image/png', bufferView: addView(oak) },
  { name: 'oak-normal', mimeType: 'image/png', bufferView: addView(oakNormal) },
]
const json = {
  asset: { version: '2.0', generator: 'Nested make-fixture-glb.mjs (original test asset)', copyright: 'Original Nested test fixture; generated procedurally, no third-party content' },
  extensionsUsed: ['KHR_materials_transmission'],
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes,
  meshes,
  materials: [
    { name: 'Oak veneer (fixture)', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.55 }, normalTexture: { index: 1, scale: 1 } },
    { name: 'Blackened steel (fixture)', pbrMetallicRoughness: { baseColorFactor: [0.045, 0.045, 0.05, 1], metallicFactor: 1, roughnessFactor: 0.38 } },
    { name: 'Clear glass (fixture)', alphaMode: 'BLEND', pbrMetallicRoughness: { baseColorFactor: [0.92, 0.97, 0.96, 0.3], metallicFactor: 0, roughnessFactor: 0.04 }, extensions: { KHR_materials_transmission: { transmissionFactor: 0.9 } } },
  ],
  samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
  textures: [{ sampler: 0, source: 0 }, { sampler: 0, source: 1 }],
  images,
  bufferViews,
  accessors,
  buffers: [{ byteLength }],
}
const pad4 = (buf, fill) => Buffer.concat([buf, Buffer.alloc((4 - (buf.length % 4)) % 4, fill)])
const jsonChunk = pad4(Buffer.from(JSON.stringify(json)), 0x20)
const binChunk = pad4(Buffer.concat(bin), 0)
json.buffers[0].byteLength = byteLength
const header = Buffer.alloc(12)
const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(total, 8)
const chunkHeader = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b }
const glb = Buffer.concat([header, chunkHeader(jsonChunk.length, 0x4e4f534a), jsonChunk, chunkHeader(binChunk.length, 0x004e4942), binChunk])
await mkdir(new URL('../test/fixtures/', import.meta.url), { recursive: true })
await writeFile(new URL('../test/fixtures/nested-side-table.glb', import.meta.url), glb)
console.log(`wrote nested-side-table.glb (${glb.length} bytes)`)
