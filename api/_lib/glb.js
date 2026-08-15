/**
 * Read a GLB and hand back geometry in this app's contract.
 *
 * The contract is the one src/three/meshes/fiddleFig.js already follows, and
 * matching it is the whole point: metres, Y-up, origin on the floor, centred on
 * X and Z, materials authored light and neutral. A mesh that arrives in that
 * shape drops into `sketchupMesh()` with no special case, which means the
 * generated sofa and the hand-modelled fig travel the same code path.
 *
 * There are two modes, and the default throws almost everything away.
 *
 * ── Silhouette mode (default) ───────────────────────────────────────────────
 *
 * Textures are dropped. An image-to-3D service bakes the product photo into the
 * albedo, and three multiplies `material.color` by that map — so a photo of a
 * charcoal sofa can never be tinted lighter, and the palette stops reaching it.
 * That is exactly how the downloaded-model experiment failed the first time.
 * What we want from these services is the silhouette; the app already knows how
 * to light and colour a surface.
 *
 * The material split goes too. Everything becomes one tintable group. Guessing
 * which generated submesh is "the wooden leg" from a texture we just discarded
 * would be inventing information.
 *
 * ── Texture mode (`keepTextures`) ───────────────────────────────────────────
 *
 * For a piece the user identified by pasting its product page, the fabric is
 * the point. Tinting it to the room palette discards the one thing they asked
 * for. Those meshes keep their UVs, their baseColor image and their normals,
 * and are marked `tint: false` so the palette leaves them alone.
 *
 * Decimation is skipped in this mode. Vertex clustering invents new vertices at
 * cell centres, and a UV is a property of a vertex that existed — there is no
 * honest way to carry one across. Instead the provider is asked for a workable
 * polycount up front and anything wildly over the ceiling falls back to
 * silhouette mode, which can always be decimated.
 *
 * No dependencies on purpose. A serverless function that pulls in a full glTF
 * loader for a parse this narrow pays the cold-start cost on every request.
 */

const MAGIC = 0x46546c67 // 'glTF'
const CHUNK_JSON = 0x4e4f534a
const CHUNK_BIN = 0x004e4942

const COMPONENT = {
  5120: { array: Int8Array, size: 1 },
  5121: { array: Uint8Array, size: 1 },
  5122: { array: Int16Array, size: 2 },
  5123: { array: Uint16Array, size: 2 },
  5125: { array: Uint32Array, size: 4 },
  5126: { array: Float32Array, size: 4 },
}

const COMPONENTS_PER = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }

/** Compressed geometry needs a decoder we're not shipping. Say so precisely. */
const UNSUPPORTED = ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_mesh_quantization']

/**
 * A textured spec carries its image inline as base64, which costs a third again
 * on top of the raw bytes and lands in the JSON the client downloads. Past this
 * the piece is not worth the wait, so it degrades to silhouette mode rather than
 * shipping a room that takes ten seconds to populate.
 */
const MAX_TEXTURE_BYTES = 3 * 1024 * 1024

/**
 * Texture mode cannot decimate, so this is the point at which a provider that
 * ignored the requested polycount stops being usable and we fall back to the
 * mode that can.
 */
const TEXTURED_TRIANGLE_CEILING = 60_000

export class GlbError extends Error {}

// --- container ------------------------------------------------------------

function splitChunks(buffer) {
  const view = new DataView(buffer)
  if (buffer.byteLength < 12 || view.getUint32(0, true) !== MAGIC) {
    throw new GlbError('not a GLB file')
  }

  let json = null
  let bin = null
  let offset = 12

  while (offset + 8 <= buffer.byteLength) {
    const length = view.getUint32(offset, true)
    const type = view.getUint32(offset + 4, true)
    const start = offset + 8
    if (start + length > buffer.byteLength) throw new GlbError('truncated GLB chunk')

    if (type === CHUNK_JSON) json = new TextDecoder().decode(new Uint8Array(buffer, start, length))
    else if (type === CHUNK_BIN) bin = new Uint8Array(buffer, start, length)

    // Chunks are four-byte aligned; the padding is not in `length`.
    offset = start + length + ((4 - (length % 4)) % 4)
  }

  if (!json) throw new GlbError('GLB has no JSON chunk')
  return { gltf: JSON.parse(json), bin }
}

function readAccessor(gltf, bin, index) {
  const accessor = gltf.accessors?.[index]
  if (!accessor) throw new GlbError(`missing accessor ${index}`)
  if (accessor.sparse) throw new GlbError('sparse accessors are not supported')

  const per = COMPONENTS_PER[accessor.type]
  const comp = COMPONENT[accessor.componentType]
  if (!per || !comp) throw new GlbError(`unsupported accessor ${accessor.type}/${accessor.componentType}`)

  const out = new Float64Array(accessor.count * per)
  if (accessor.bufferView == null) return out // spec says treat as zeros

  const view = gltf.bufferViews[accessor.bufferView]
  if (gltf.buffers?.[view.buffer]?.uri) throw new GlbError('external buffers are not supported')
  if (!bin) throw new GlbError('GLB has no binary chunk')

  const base = (view.byteOffset || 0) + (accessor.byteOffset || 0)
  // byteStride only applies to vertex attributes, and when absent the data is
  // tightly packed. Interleaved buffers are common in optimised exports, so
  // this is not a rare path.
  const stride = view.byteStride || per * comp.size
  const source = new DataView(bin.buffer, bin.byteOffset, bin.byteLength)

  const get = {
    5120: (o) => source.getInt8(o),
    5121: (o) => source.getUint8(o),
    5122: (o) => source.getInt16(o, true),
    5123: (o) => source.getUint16(o, true),
    5125: (o) => source.getUint32(o, true),
    5126: (o) => source.getFloat32(o, true),
  }[accessor.componentType]

  for (let i = 0; i < accessor.count; i++) {
    for (let c = 0; c < per; c++) {
      out[i * per + c] = get(base + i * stride + c * comp.size)
    }
  }
  return out
}

// --- transforms -----------------------------------------------------------
// Column-major 4x4, the order glTF stores them in.

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

function multiply(a, b) {
  const out = new Array(16)
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]
    }
  }
  return out
}

function composed(node) {
  if (node.matrix) return node.matrix.slice()

  const [x, y, z, w] = node.rotation || [0, 0, 0, 1]
  const [sx, sy, sz] = node.scale || [1, 1, 1]
  const [tx, ty, tz] = node.translation || [0, 0, 0]

  const x2 = x + x, y2 = y + y, z2 = z + z
  const xx = x * x2, xy = x * y2, xz = x * z2
  const yy = y * y2, yz = y * z2, zz = z * z2
  const wx = w * x2, wy = w * y2, wz = w * z2

  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ]
}

// --- decimation -----------------------------------------------------------

/**
 * Vertex clustering: snap every vertex to a grid, collapse the ones that land
 * in the same cell, drop the triangles that collapse to a line.
 *
 * Chosen over a proper quadric-error simplifier because the shape it preserves
 * is the outline, which is the only thing we asked the provider for. It is also
 * about forty lines instead of four hundred, and it cannot fail — worst case it
 * returns a blockier version of the same object.
 *
 * This is a backstop. The provider is asked for a low polycount up front; this
 * only fires when it ignores that.
 */
function cluster(positions, indices, budget) {
  const triangles = indices.length / 3
  if (triangles <= budget) return { positions, indices }

  let min = [Infinity, Infinity, Infinity]
  let max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      if (positions[i + a] < min[a]) min[a] = positions[i + a]
      if (positions[i + a] > max[a]) max[a] = positions[i + a]
    }
  }
  const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1

  // Grid resolution from the triangle budget: a cluster grid of n³ cells lands
  // roughly n² triangles on a closed surface, so start at the square root and
  // tighten if the first pass overshoots.
  let n = Math.max(8, Math.round(Math.sqrt(budget)))

  for (let attempt = 0; attempt < 6; attempt++) {
    const cell = span / n
    const map = new Map()
    const out = []
    const remap = new Int32Array(positions.length / 3)

    for (let v = 0; v < positions.length / 3; v++) {
      const gx = Math.floor((positions[v * 3] - min[0]) / cell)
      const gy = Math.floor((positions[v * 3 + 1] - min[1]) / cell)
      const gz = Math.floor((positions[v * 3 + 2] - min[2]) / cell)
      const key = `${gx},${gy},${gz}`
      let id = map.get(key)
      if (id === undefined) {
        id = out.length / 3
        map.set(key, id)
        // Cell centre, not the first vertex that landed in it — averaging by
        // arrival order makes the result depend on vertex ordering.
        out.push(min[0] + (gx + 0.5) * cell, min[1] + (gy + 0.5) * cell, min[2] + (gz + 0.5) * cell)
      }
      remap[v] = id
    }

    const kept = []
    for (let t = 0; t < indices.length; t += 3) {
      const a = remap[indices[t]]
      const b = remap[indices[t + 1]]
      const c = remap[indices[t + 2]]
      if (a !== b && b !== c && a !== c) kept.push(a, b, c)
    }

    if (kept.length / 3 <= budget || n <= 8) {
      return { positions: Float64Array.from(out), indices: Uint32Array.from(kept) }
    }
    n = Math.max(8, Math.floor(n * 0.75))
  }

  return { positions, indices }
}

// --- textures ---------------------------------------------------------------

/**
 * The baseColour image, as a data URI the client can hand straight to
 * TextureLoader.
 *
 * Returns null for every case we cannot honour rather than throwing: a missing
 * or awkward texture should cost the piece its texture, not its mesh.
 *
 * @returns {{ uri: string, bytes: number } | null}
 */
function baseColorImage(gltf, bin) {
  const material = (gltf.materials || []).find(
    (m) => m?.pbrMetallicRoughness?.baseColorTexture?.index != null
  )
  const ref = material?.pbrMetallicRoughness?.baseColorTexture
  if (!ref) return null

  // We only read TEXCOORD_0. A texture pointing at a second UV set would be
  // sampled with the wrong coordinates, which looks worse than no texture.
  if (ref.texCoord) return null

  const source = gltf.textures?.[ref.index]?.source
  if (source == null) return null

  const image = gltf.images?.[source]
  if (!image) return null

  let bytes = null
  let mime = image.mimeType || 'image/png'

  if (image.bufferView != null) {
    const view = gltf.bufferViews?.[image.bufferView]
    if (!view || !bin) return null
    const start = view.byteOffset || 0
    bytes = bin.subarray(start, start + view.byteLength)
  } else if (typeof image.uri === 'string' && image.uri.startsWith('data:')) {
    const comma = image.uri.indexOf(',')
    const header = image.uri.slice(5, comma)
    if (!header.includes('base64')) return null
    mime = header.split(';')[0] || mime
    bytes = Buffer.from(image.uri.slice(comma + 1), 'base64')
  } else {
    // An external file the provider expects us to fetch separately. Not worth
    // a second network hop inside an already slow request.
    return null
  }

  if (!bytes?.length || bytes.length > MAX_TEXTURE_BYTES) return null

  return {
    uri: `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`,
    bytes: bytes.length,
  }
}

// --- public ---------------------------------------------------------------

/**
 * @param buffer    ArrayBuffer of a GLB
 * @param triangleBudget  hard ceiling; over it the mesh is clustered down
 * @param keepTextures    keep UVs, normals and the baseColour image, and mark
 *                        the result untintable. Falls back to silhouette mode
 *                        if the GLB has no usable texture.
 * @returns the same object shape as src/three/meshes/fiddleFig.js
 */
export function glbToSpec(buffer, { triangleBudget = 4000, name = 'Body', keepTextures = false } = {}) {
  const { gltf, bin } = splitChunks(buffer)

  const required = gltf.extensionsRequired || []
  const blocked = required.filter((e) => UNSUPPORTED.includes(e))
  if (blocked.length) throw new GlbError(`compressed geometry (${blocked.join(', ')}) needs a decoder this reader does not ship`)

  // Resolve the texture before walking the scene: no image means silhouette
  // mode, and that decides whether the walk needs to collect UVs at all.
  const image = keepTextures ? baseColorImage(gltf, bin) : null
  const textured = Boolean(image)

  // Walk the scene so node transforms are honoured. Providers routinely export
  // the model parented under a rotated or scaled root, and ignoring that gives
  // you a sofa lying on its side.
  const positions = []
  const indices = []
  const uvs = textured ? [] : null
  const normals = textured ? [] : null
  const scene = gltf.scenes?.[gltf.scene ?? 0]
  const roots = scene?.nodes ?? gltf.nodes?.map((_, i) => i) ?? []
  const seen = new Set()

  const visit = (nodeIndex, parent) => {
    if (seen.has(nodeIndex)) return // malformed files can loop
    seen.add(nodeIndex)
    const node = gltf.nodes?.[nodeIndex]
    if (!node) return
    const world = multiply(parent, composed(node))

    if (node.mesh != null) {
      for (const prim of gltf.meshes[node.mesh].primitives || []) {
        // 4 is TRIANGLES, and it is the default when mode is absent.
        if (prim.mode != null && prim.mode !== 4) continue
        if (prim.attributes?.POSITION == null) continue

        const raw = readAccessor(gltf, bin, prim.attributes.POSITION)
        const first = positions.length / 3
        const count = raw.length / 3

        for (let i = 0; i < raw.length; i += 3) {
          const [x, y, z] = [raw[i], raw[i + 1], raw[i + 2]]
          positions.push(
            world[0] * x + world[4] * y + world[8] * z + world[12],
            world[1] * x + world[5] * y + world[9] * z + world[13],
            world[2] * x + world[6] * y + world[10] * z + world[14]
          )
        }

        if (textured) {
          // Every vertex needs an entry whether or not this primitive supplies
          // one, or the arrays stop lining up with `positions` and the whole
          // mesh samples the texture at the wrong place.
          const uvIndex = prim.attributes.TEXCOORD_0
          if (uvIndex != null) {
            const acc = gltf.accessors?.[uvIndex]
            // Normalized integer UVs are legal and Meshy has shipped them.
            const k = acc?.normalized ? (acc.componentType === 5121 ? 1 / 255 : 1 / 65535) : 1
            const uv = readAccessor(gltf, bin, uvIndex)
            for (let i = 0; i < count * 2; i += 2) uvs.push(uv[i] * k, uv[i + 1] * k)
          } else {
            for (let i = 0; i < count; i++) uvs.push(0, 0)
          }

          const nIndex = prim.attributes.NORMAL
          if (nIndex != null) {
            const n = readAccessor(gltf, bin, nIndex)
            for (let i = 0; i < count * 3; i += 3) {
              // Upper 3x3 only — translation must not move a direction. This is
              // exact for rotation and uniform scale, which is what providers
              // export; a non-uniformly scaled node would want the inverse
              // transpose, and would be skewed slightly here.
              const x = world[0] * n[i] + world[4] * n[i + 1] + world[8] * n[i + 2]
              const y = world[1] * n[i] + world[5] * n[i + 1] + world[9] * n[i + 2]
              const z = world[2] * n[i] + world[6] * n[i + 1] + world[10] * n[i + 2]
              const len = Math.hypot(x, y, z) || 1
              normals.push(x / len, y / len, z / len)
            }
          } else {
            // Absent normals are legal; the client computes them.
            for (let i = 0; i < count; i++) normals.push(0, 0, 0)
          }
        }

        if (prim.indices != null) {
          const idx = readAccessor(gltf, bin, prim.indices)
          for (let i = 0; i < idx.length; i++) indices.push(first + idx[i])
        } else {
          for (let i = 0; i < count; i++) indices.push(first + i)
        }
      }
    }

    for (const child of node.children || []) visit(child, world)
  }

  for (const root of roots) visit(root, IDENTITY)

  if (indices.length < 3) throw new GlbError('GLB contained no triangles')

  // A provider that blew past the requested polycount loses its texture rather
  // than its usability: silhouette mode can always be decimated, texture mode
  // cannot. See the header.
  const withTexture = textured && indices.length / 3 <= TEXTURED_TRIANGLE_CEILING

  const decimated = withTexture
    ? { positions: Float64Array.from(positions), indices: Uint32Array.from(indices) }
    : cluster(Float64Array.from(positions), Uint32Array.from(indices), triangleBudget)
  const p = decimated.positions

  // Seat it the way every procedural builder is seated: floor at y=0, centred
  // on X and Z, and scaled so its own height is exactly one metre. The client
  // multiplies by the piece's real height, so reporting 1 here means the scale
  // factor is just `item.h` and there is no accumulated float drift.
  let min = [Infinity, Infinity, Infinity]
  let max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < p.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      if (p[i + a] < min[a]) min[a] = p[i + a]
      if (p[i + a] > max[a]) max[a] = p[i + a]
    }
  }

  const height = max[1] - min[1]
  if (!(height > 0)) throw new GlbError('GLB geometry is flat')
  const s = 1 / height
  const cx = (min[0] + max[0]) / 2
  const cz = (min[2] + max[2]) / 2

  const out = new Array(p.length)
  for (let i = 0; i < p.length; i += 3) {
    out[i] = +((p[i] - cx) * s).toFixed(4)
    out[i + 1] = +((p[i + 1] - min[1]) * s).toFixed(4)
    out[i + 2] = +((p[i + 2] - cz) * s).toFixed(4)
  }

  const triangles = decimated.indices.length / 3

  // All-zero normals mean no primitive supplied any, which is legal glTF. Say
  // nothing rather than shipping a field of zeros — the client computes better
  // ones than that.
  const hasNormals = withTexture && normals.some((n) => n !== 0)

  return {
    unit: 'metres',
    heightM: 1,
    // Footprint at that height, so the client can tell when a generated piece
    // is far wider than the procedural one it is replacing and refuse to let it
    // barge through the furniture around it.
    widthM: +((max[0] - min[0]) * s).toFixed(3),
    depthM: +((max[2] - min[2]) * s).toFixed(3),
    triangles,
    groups: [[0, decimated.indices.length, 0]],
    materials: [
      withTexture
        // White, because three multiplies `material.color` by the map and any
        // other value darkens the photograph.
        ? { name, rgb: [255, 255, 255], tint: false }
        // Light and neutral, so `material.color` still decides the hue.
        : { name, rgb: [222, 218, 212], tint: true },
    ],
    ...(withTexture
      ? {
          textured: true,
          texture: image.uri,
          textureBytes: image.bytes,
          uvs: uvs.map((v) => +v.toFixed(4)),
          ...(hasNormals ? { normals: normals.map((v) => +v.toFixed(3)) } : {}),
        }
      : {}),
    positions: out,
    indices: Array.from(decimated.indices),
  }
}
