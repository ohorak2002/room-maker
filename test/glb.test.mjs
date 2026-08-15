import { glbToSpec, GlbError } from '../api/_lib/glb.js'

// --- build a GLB by hand so the reader is tested against real bytes --------
function makeGlb(gltf, binBytes) {
  const jsonStr = JSON.stringify(gltf)
  const jsonBuf = Buffer.from(jsonStr, 'utf8')
  const jsonPad = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)])
  const binPad = Buffer.concat([binBytes, Buffer.alloc((4 - (binBytes.length % 4)) % 4, 0)])
  const total = 12 + 8 + jsonPad.length + 8 + binPad.length
  const out = Buffer.alloc(total)
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(total, 8)
  let o = 12
  out.writeUInt32LE(jsonPad.length, o); out.writeUInt32LE(0x4e4f534a, o + 4)
  jsonPad.copy(out, o + 8); o += 8 + jsonPad.length
  out.writeUInt32LE(binPad.length, o); out.writeUInt32LE(0x004e4942, o + 4)
  binPad.copy(out, o + 8)
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.length)
}

// A unit cube from (0,0,0) to (1,2,3): 8 verts, 12 tris.
const verts = []
for (const x of [0, 1]) for (const y of [0, 2]) for (const z of [0, 3]) verts.push(x, y, z)
const tris = [
  0,1,3, 0,3,2, 4,6,7, 4,7,5, 0,4,5, 0,5,1,
  2,3,7, 2,7,6, 0,2,6, 0,6,4, 1,5,7, 1,7,3,
]
const vBuf = Buffer.from(new Float32Array(verts).buffer)
const iBuf = Buffer.from(new Uint16Array(tris).buffer)
const bin = Buffer.concat([vBuf, iBuf])

const gltf = {
  asset: { version: '2.0' },
  scene: 0,
  // The mesh sits under a node scaled 2x and lifted 10m, which is the shape
  // providers actually export. If transforms were ignored the numbers below
  // would be wrong.
  scenes: [{ nodes: [0] }],
  nodes: [
    { children: [1], scale: [2, 2, 2], translation: [0, 10, 0] },
    { mesh: 0, translation: [5, 0, -5] },
  ],
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

const spec = glbToSpec(makeGlb(gltf, bin))
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  console.log(ok ? 'ok  ' : 'FAIL', label, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)
  return ok
}

let fail = 0
// After scaling by 2 the box is 2 x 4 x 6. Normalised to height 1: 0.5 x 1 x 1.5.
if (!check('height reported as 1', spec.heightM, 1)) fail++
if (!check('width normalised', spec.widthM, 0.5)) fail++
if (!check('depth normalised', spec.depthM, 1.5)) fail++
if (!check('triangle count', spec.triangles, 12)) fail++
if (!check('one tintable group', spec.materials.map(m => m.tint), [true])) fail++

const xs = spec.positions.filter((_, i) => i % 3 === 0)
const ys = spec.positions.filter((_, i) => i % 3 === 1)
const zs = spec.positions.filter((_, i) => i % 3 === 2)
if (!check('floor seated at y=0', Math.min(...ys), 0)) fail++
if (!check('top at y=1', Math.max(...ys), 1)) fail++
if (!check('centred on X', +(Math.min(...xs) + Math.max(...xs)).toFixed(4), 0)) fail++
if (!check('centred on Z', +(Math.min(...zs) + Math.max(...zs)).toFixed(4), 0)) fail++
if (!check('group spans the index buffer', spec.groups, [[0, 36, 0]])) fail++
if (!check('indices survive', spec.indices.length, 36)) fail++

// Draco must fail loudly rather than return nonsense.
try {
  glbToSpec(makeGlb({ ...gltf, extensionsRequired: ['KHR_draco_mesh_compression'] }, bin))
  console.log('FAIL draco not rejected'); fail++
} catch (e) {
  console.log(e instanceof GlbError ? 'ok   draco rejected:' : 'FAIL wrong error:', e.message)
  if (!(e instanceof GlbError)) fail++
}

// Decimation backstop.
const big = glbToSpec(makeGlb(gltf, bin), { triangleBudget: 4 })
console.log(big.triangles <= 12 ? 'ok   decimator ran, tris:' : 'FAIL decimator', big.triangles)

// --- texture mode ----------------------------------------------------------
// A piece the user picked by product link keeps its photograph and drops out of
// palette tinting. Everything else must keep behaving exactly as above.

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

// One UV per vertex, so the count lines up with POSITION.
const uvBuf = Buffer.from(new Float32Array([0,0, 0,1, 1,0, 1,1, 0,0, 0,1, 1,0, 1,1]).buffer)
const texBin = Buffer.concat([vBuf, iBuf, uvBuf, PNG])

const texGltf = {
  ...gltf,
  meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 2 }, indices: 1, material: 0 }] }],
  materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
  textures: [{ source: 0 }],
  images: [{ bufferView: 3, mimeType: 'image/png' }],
  accessors: [
    ...gltf.accessors,
    { bufferView: 2, componentType: 5126, count: 8, type: 'VEC2' },
  ],
  bufferViews: [
    ...gltf.bufferViews,
    { buffer: 0, byteOffset: vBuf.length + iBuf.length, byteLength: uvBuf.length },
    { buffer: 0, byteOffset: vBuf.length + iBuf.length + uvBuf.length, byteLength: PNG.length },
  ],
  buffers: [{ byteLength: texBin.length }],
}

const tex = glbToSpec(makeGlb(texGltf, texBin), { triangleBudget: 12000, keepTextures: true })
if (!check('textured flag set', tex.textured, true)) fail++
if (!check('not tintable', tex.materials.map((m) => m.tint), [false])) fail++
if (!check('white so the map is not darkened', tex.materials[0].rgb, [255, 255, 255])) fail++
if (!check('texture is a data uri', tex.texture.startsWith('data:image/png;base64,'), true)) fail++
if (!check('one uv per vertex', tex.uvs.length, (tex.positions.length / 3) * 2)) fail++
if (!check('geometry left alone', tex.triangles, 12)) fail++
if (!check('still seated and normalised', [tex.heightM, tex.widthM, tex.depthM], [1, 0.5, 1.5])) fail++

// The same file read without the flag must be byte-for-byte what it always was.
const asBefore = glbToSpec(makeGlb(texGltf, texBin))
if (!check('silhouette mode ignores the texture', asBefore.texture, undefined)) fail++
if (!check('silhouette mode stays tintable', asBefore.materials.map((m) => m.tint), [true])) fail++

// Asking for textures from a GLB that has none degrades rather than failing.
const noTexture = glbToSpec(makeGlb(gltf, bin), { keepTextures: true })
if (!check('untextured GLB falls back to tintable', noTexture.materials.map((m) => m.tint), [true])) fail++
if (!check('and carries no texture field', noTexture.texture, undefined)) fail++

console.log('\npayload bytes for 12 tris:', JSON.stringify(spec).length)
console.log('payload bytes textured:  ', JSON.stringify(tex).length)
console.log(fail ? `${fail} FAILURES` : 'all passed')
