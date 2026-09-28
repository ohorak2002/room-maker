// Private designer-uploaded 3D assets: GLB inspection, authored-unit handling
// and dimension checks. Pure functions shared by Electron main, the renderer
// and the tests. Nothing here alters a model's materials.

export const MAX_ASSET_BYTES = 100 * 1024 * 1024
export const ASSET_ID = /^[a-f0-9]{64}$/

// glTF is defined in metres, +Y up, front facing +Z. Other units are an
// explicit designer correction for files exported at the wrong scale, never an
// automatic guess.
export const UNIT_SCALES = { m: 1, cm: 0.01, mm: 0.001, in: 0.0254 }
export const ROTATIONS = [0, 90, 180, 270]

// Extensions the standard GLTFLoader handles without extra decoders. Draco,
// meshopt and KTX2 need WebAssembly decoders that are not bundled yet.
export const SUPPORTED_REQUIRED = new Set([
  'KHR_materials_emissive_strength', 'KHR_materials_ior', 'KHR_materials_transmission',
  'KHR_materials_volume', 'KHR_materials_specular', 'KHR_materials_sheen',
  'KHR_materials_clearcoat', 'KHR_materials_iridescence', 'KHR_materials_anisotropy',
  'KHR_materials_unlit', 'KHR_texture_transform', 'KHR_mesh_quantization', 'KHR_lights_punctual',
  'EXT_texture_webp',
])

const fail = (message) => { throw new Error(`Unsupported GLB: ${message}`) }

/** Read a GLB container and summarize what it contains. Throws a readable error. */
export function inspectGlb(bytes) {
  if (!(bytes instanceof Uint8Array)) fail('expected binary data')
  if (bytes.byteLength < 20) fail('file is too small to be a GLB')
  if (bytes.byteLength > MAX_ASSET_BYTES) fail('file exceeds 100 MB')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(0, true) !== 0x46546c67) fail('not a binary glTF (.glb) file')
  if (view.getUint32(4, true) !== 2) fail('only glTF 2.0 is supported')
  if (view.getUint32(8, true) !== bytes.byteLength) fail('file length does not match its header (truncated or padded)')
  const jsonLength = view.getUint32(12, true)
  if (view.getUint32(16, true) !== 0x4e4f534a || 20 + jsonLength > bytes.byteLength) fail('missing JSON chunk')
  let json
  try { json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength))) } catch { fail('JSON chunk is not valid JSON') }
  if (!json || typeof json !== 'object' || !String(json.asset?.version).startsWith('2')) fail('missing glTF 2.0 asset version')

  const external = [...(json.buffers || []), ...(json.images || [])]
    .map((b) => b.uri).filter((uri) => typeof uri === 'string' && !uri.startsWith('data:'))
  if (external.length) fail(`references external files (${external.slice(0, 3).join(', ')}); export a self-contained GLB`)
  const unsupported = (json.extensionsRequired || []).filter((e) => !SUPPORTED_REQUIRED.has(e))
  if (unsupported.length) fail(`requires ${unsupported.join(', ')}, which Nested cannot decode yet`)
  if (!json.meshes?.length) fail('contains no meshes')

  let triangles = 0
  for (const mesh of json.meshes) for (const p of mesh.primitives || []) {
    if ((p.mode ?? 4) !== 4) continue
    const count = p.indices !== undefined ? json.accessors?.[p.indices]?.count : json.accessors?.[p.attributes?.POSITION]?.count
    triangles += Math.floor((count || 0) / 3)
  }
  const texCoords = json.meshes.some((m) => (m.primitives || []).some((p) => p.attributes?.TEXCOORD_0 !== undefined))
  return {
    generator: typeof json.asset.generator === 'string' ? json.asset.generator.slice(0, 200) : null,
    meshes: json.meshes.length,
    materials: json.materials?.length || 0,
    materialNames: (json.materials || []).map((m, i) => (typeof m.name === 'string' && m.name) || `Material ${i + 1}`).slice(0, 50),
    textures: json.textures?.length || 0,
    images: json.images?.length || 0,
    triangles,
    texCoords,
    animations: json.animations?.length || 0,
    extensionsUsed: (json.extensionsUsed || []).filter((e) => typeof e === 'string'),
    bounds: glbBounds(json),
  }
}

// --- bounds from accessor min/max and the node hierarchy -------------------

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
function multiply(a, b) { // column-major 4x4
  const out = new Array(16)
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]
  }
  return out
}
function nodeMatrix(node) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) return node.matrix
  const [x, y, z, w] = node.rotation || [0, 0, 0, 1]
  const [sx, sy, sz] = node.scale || [1, 1, 1]
  const [tx, ty, tz] = node.translation || [0, 0, 0]
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ]
}

/**
 * Axis-aligned bounds of the default scene in authored units, from each
 * POSITION accessor's required min/max transformed through the node hierarchy.
 * Returns { min, max, size } or null when no position data is declared.
 */
export function glbBounds(json) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const nodes = json.nodes || []
  const visit = (index, parent, depth) => {
    const node = nodes[index]
    if (!node || depth > 64) return
    const m = multiply(parent, nodeMatrix(node))
    for (const p of json.meshes?.[node.mesh]?.primitives || []) {
      const acc = json.accessors?.[p.attributes?.POSITION]
      if (!acc?.min || !acc?.max) continue
      for (let i = 0; i < 8; i++) {
        const v = [i & 1 ? acc.max[0] : acc.min[0], i & 2 ? acc.max[1] : acc.min[1], i & 4 ? acc.max[2] : acc.min[2]]
        for (let k = 0; k < 3; k++) {
          const t = m[k] * v[0] + m[4 + k] * v[1] + m[8 + k] * v[2] + m[12 + k]
          min[k] = Math.min(min[k], t); max[k] = Math.max(max[k], t)
        }
      }
    }
    for (const child of node.children || []) visit(child, m, depth + 1)
  }
  const scene = json.scenes?.[json.scene ?? 0]
  const roots = scene?.nodes || nodes.map((_, i) => i)
  for (const r of roots) visit(r, IDENTITY, 0)
  if (!Number.isFinite(min[0])) return null
  const round = (v) => Math.round(v * 1e6) / 1e6
  return { min: min.map(round), max: max.map(round), size: max.map((v, k) => round(v - min[k])) }
}

// --- dimensions -----------------------------------------------------------

/**
 * Placed width/depth/height in metres, from authored extents [x, y, z], the
 * designer-confirmed units and a quarter-turn about Y.
 */
export function placedDimensions(size, units = 'm', rotateY = 0) {
  const s = UNIT_SCALES[units]
  if (!s || !ROTATIONS.includes(rotateY) || !Array.isArray(size)) throw new Error('Invalid units, rotation or size')
  const [x, y, z] = size.map((v) => v * s)
  return rotateY % 180 === 0 ? { w: x, d: z, h: y } : { w: z, d: x, h: y }
}

/**
 * Compare placed dimensions with a product specification (both metres).
 * `tolerance` is the absolute allowance per axis in metres. Returns null when
 * there is no specification — unknown stays unknown.
 */
export function compareDimensions(placed, spec, tolerance = 0.01) {
  if (!spec) return null
  const axes = {}
  let ok = true
  for (const k of ['w', 'd', 'h']) {
    if (!Number.isFinite(spec[k])) { axes[k] = null; continue }
    const diff = placed[k] - spec[k]
    axes[k] = { placed: placed[k], spec: spec[k], diff, within: Math.abs(diff) <= tolerance }
    ok = ok && axes[k].within
  }
  return { within: ok, axes }
}

/** A hint only: files whose largest extent is implausible for furniture in metres. */
export function unitHint(size) {
  const largest = Math.max(...size)
  if (largest > 40) return 'Largest side is over 40 units. The file may be authored in centimetres or millimetres.'
  if (largest < 0.05) return 'Largest side is under 5 cm. Check the authored units.'
  return null
}

// --- project records ------------------------------------------------------

const text = (v, max) => typeof v === 'string' && v.length <= max
const positive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0
const count = (v) => Number.isInteger(v) && v >= 0
const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const RECORD_KEYS = ['id', 'name', 'fileName', 'bytes', 'format', 'scope', 'importedAt', 'units', 'rotateY', 'size', 'stats', 'spec', 'provenance', 'verification']

/** Throws unless `r` is a well-formed private asset record. */
export function validateAssetRecord(r) {
  const bad = (m) => { throw new Error(`Invalid Nested project: asset ${m}`) }
  if (!plain(r)) bad('record')
  for (const k of Object.keys(r)) if (!RECORD_KEYS.includes(k)) bad(`field ${k}`)
  if (typeof r.id !== 'string' || !ASSET_ID.test(r.id)) bad('id')
  if (!text(r.name, 200) || !text(r.fileName, 260)) bad('name')
  if (!Number.isInteger(r.bytes) || r.bytes <= 0 || r.bytes > MAX_ASSET_BYTES) bad('size in bytes')
  if (r.format !== 'glb' || r.scope !== 'private' || r.verification !== 'unverified') bad('format, scope or verification')
  if (!text(r.importedAt, 40) || Number.isNaN(Date.parse(r.importedAt))) bad('import date')
  if (!(r.units in UNIT_SCALES) || !ROTATIONS.includes(r.rotateY)) bad('units or rotation')
  if (!Array.isArray(r.size) || r.size.length !== 3 || !r.size.every(positive)) bad('authored size')
  if (!plain(r.stats) || !['meshes', 'materials', 'textures', 'triangles'].every((k) => count(r.stats[k]))) bad('statistics')
  if (r.spec !== null && (!plain(r.spec) || !['w', 'd', 'h'].every((k) => r.spec[k] === null || positive(r.spec[k])))) bad('product dimensions')
  if (!plain(r.provenance) || !text(r.provenance.source, 500) || !text(r.provenance.rights, 500)) bad('provenance')
  return r
}

/** A new record from main's import summary. Unknown provenance stays empty. */
export function createAssetRecord({ id, fileName, bytes, inspection }, now = new Date()) {
  const size = inspection.bounds?.size
  if (!size || !size.every(positive)) throw new Error('Unsupported GLB: model has no measurable extent')
  return validateAssetRecord({
    id, fileName, bytes,
    name: fileName.replace(/\.glb$/i, '').slice(0, 200) || 'Imported model',
    format: 'glb', scope: 'private', verification: 'unverified',
    importedAt: now.toISOString(), units: 'm', rotateY: 0, size,
    stats: { meshes: inspection.meshes, materials: inspection.materials, textures: inspection.textures, triangles: inspection.triangles },
    spec: null, provenance: { source: '', rights: '' },
  })
}
