import * as THREE from 'three'
import { MATERIAL_SETS } from '../data/materialSources'

/**
 * Photographic PBR material sets (see data/materialSources.js for provenance).
 *
 * Rules this file exists to keep:
 *  - base colour maps are sRGB; normal and roughness maps are non-colour data.
 *    Every map is its own Texture object, so nothing is shared across colour
 *    spaces.
 *  - the normal maps are the OpenGL-convention files (nor_gl), which is what
 *    three.js expects with its default normalScale sign.
 *  - texture scale is set by the *geometry's UVs in metres* divided by the
 *    published real-world tile size, not by texture.repeat, so one set of
 *    textures is shared by every part and a part's scale stays physical.
 *  - maps are bound only once decoded. A texture assigned before its image
 *    arrives renders black.
 */

const loader = new THREE.TextureLoader()
const sets = new Map() // setId -> { textures, ready }
const pending = new Set()

const url = (set, file) => `/materials/polyhaven/${set.dir}/${file}`

function loadSet(setId) {
  if (sets.has(setId)) return sets.get(setId)
  const set = MATERIAL_SETS[setId]
  if (!set) throw new Error(`Unknown material set ${setId}`)
  const textures = {}
  const ready = Promise.all(
    Object.entries(set.maps).map(
      ([slot, file]) =>
        new Promise((resolve, reject) => {
          loader.load(
            url(set, file),
            (tex) => {
              tex.wrapS = tex.wrapT = THREE.RepeatWrapping
              tex.anisotropy = 8
              tex.colorSpace = slot === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace
              textures[slot] = tex
              resolve()
            },
            undefined,
            () => reject(new Error(`Could not load ${file}`))
          )
        })
    )
  )
  const entry = { textures, ready, failed: false, loaded: false }
  ready.then(() => { entry.loaded = true }, () => {})
  ready.catch(() => { entry.failed = true })
  pending.add(ready)
  ready.finally(() => pending.delete(ready)).catch(() => {})
  sets.set(setId, entry)
  return entry
}

/** Start fetching sets ahead of use (thumbnails wait on this before drawing). */
export function preloadMaterials(setIds) {
  return Promise.allSettled(setIds.map((id) => loadSet(id).ready))
}

/** Resolves when every requested photographic map has been decoded (or failed). */
export function materialsReady() {
  return Promise.allSettled([...pending])
}

/** Decoded-map facts for tests and the debug hook. */
export function materialStats() {
  const out = {}
  for (const [id, { textures }] of sets) {
    out[id] = Object.fromEntries(
      Object.entries(textures).map(([slot, t]) => [slot, { colorSpace: t.colorSpace === '' ? 'none (data)' : t.colorSpace, size: [t.image.width, t.image.height] }])
    )
  }
  return out
}

/**
 * A physical material carrying one photographic set. Until the maps decode it
 * shows `color` as a plain fallback, so nothing flashes black.
 */
export function photoMaterial(setId, opts = {}) {
  const set = MATERIAL_SETS[setId]
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(opts.color ?? 0xffffff),
    roughness: 1, // the roughness map is the value; this only multiplies it
    metalness: 0,
    envMapIntensity: opts.env ?? 0.3,
  })
  m.userData.materialSet = setId
  m.userData.concept = true
  // Optional neutral weave/grain for authored demo finishes. Keep the measured
  // relief and roughness, but remove the source sample's dye/stain. Verified
  // imported products never use this material factory.
  if (opts.neutralBase) {
    m.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 grainSample = texture2D(map, vMapUv);
          float grain = dot(grainSample.rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb *= mix(1.0, clamp(grain / ${Number(opts.neutralBase).toFixed(3)}, 0.65, 1.15), ${Number(opts.grainContrast ?? 1).toFixed(3)});
        #endif
      `)
    }
    m.customProgramCacheKey = () => `neutral-demo-${opts.neutralBase}-${opts.grainContrast ?? 1}`
  }
  if (opts.specular != null) m.specularIntensity = opts.specular
  if (opts.sheen) {
    m.sheen = opts.sheen
    m.sheenRoughness = 0.85
    m.sheenColor = new THREE.Color(opts.sheenColor ?? 0xffffff)
  }
  const s = opts.normalScale ?? 1
  const entry = loadSet(setId)
  const bind = () => {
    m.map = entry.textures.map
    m.normalMap = entry.textures.normalMap
    m.roughnessMap = entry.textures.roughnessMap
    m.normalScale = new THREE.Vector2(s, s)
    m.needsUpdate = true
  }
  if (entry.loaded) bind()
  else entry.ready.then(bind, () => {})
  m.userData.tile = set.tile
  return m
}

// ---------------------------------------------------------------------------
// UV generation, in metres
// ---------------------------------------------------------------------------

function ensureNormals(geo) {
  if (!geo.attributes.normal) geo.computeVertexNormals()
}

/**
 * Box-style projection in the geometry's own coordinates, scaled by the real
 * tile size. The texture's V axis is its warp/grain direction, so choosing
 * which local axis V follows is choosing the grain direction:
 *   top:   'z' | 'x' - direction V follows on faces that point up or down
 *   sides: 'y' | 'h' - V runs up the face, or along it (long-grain edges)
 * `offset` shifts the sample so identical parts don't repeat the same patch.
 */
export function boxUV(geo, tile, { top = 'z', sides = 'y', offset = [0, 0] } = {}) {
  ensureNormals(geo)
  const { position: p, normal: n } = geo.attributes
  const uv = new Float32Array(p.count * 2)
  const [tu, tv] = tile
  for (let i = 0; i < p.count; i++) {
    const c = { x: p.getX(i), y: p.getY(i), z: p.getZ(i) }
    const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i)
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz)
    let ua, va, face, sign
    if (ay >= ax && ay >= az) { [ua, va] = top === 'z' ? ['x', 'z'] : ['z', 'x']; face = 'y'; sign = Math.sign(ny) }
    else if (ax >= az) { [ua, va] = sides === 'y' ? ['z', 'y'] : ['y', 'z']; face = 'x'; sign = Math.sign(nx) }
    else { [ua, va] = sides === 'y' ? ['x', 'y'] : ['y', 'x']; face = 'z'; sign = Math.sign(nz) }
    // Keep the texture frame right-handed against the face normal (u x v along
    // n). A mirrored frame inverts the normal map: bumps read as dents.
    const flip = handed(ua, va, face) * sign < 0 ? -1 : 1
    uv[i * 2] = (flip * c[ua]) / tu + offset[0]
    uv[i * 2 + 1] = c[va] / tv + offset[1]
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}

// Sign of (u x v) . n for axis letters, with n along +face.
const AXIS = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }
function handed(u, v, face) {
  const a = AXIS[u], b = AXIS[v], n = AXIS[face]
  const cx = a[1] * b[2] - a[2] * b[1], cy = a[2] * b[0] - a[0] * b[2], cz = a[0] * b[1] - a[1] * b[0]
  return cx * n[0] + cy * n[1] + cz * n[2]
}

/**
 * UVs for a (tapered) cylinder standing on Y: grain runs along the length,
 * measured round the circumference at the mean radius; the end caps are
 * projected flat.
 */
export function axialUV(geo, tile, radius, offset = [0, 0], around = false) {
  ensureNormals(geo)
  const { position: p, normal: n } = geo.attributes
  const uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    if (Math.abs(n.getY(i)) > 0.9) {
      uv[i * 2] = x / tile[0] + offset[0]
      uv[i * 2 + 1] = (n.getY(i) > 0 ? -z : z) / tile[1] + offset[1]
    } else {
      const arc = (Math.atan2(x, z) * radius)
      // `around`: grain follows the circumference (a bent apron ring).
      uv[i * 2] = (around ? y : arc) / tile[0] + offset[0]
      uv[i * 2 + 1] = (around ? -arc : y) / tile[1] + offset[1]
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}

// Explicit VITE_NESTED_DEBUG=1 builds only (scripts/material-compare.mjs).
if (import.meta.env.VITE_NESTED_DEBUG === '1') window.__nestedMaterials = { ready: materialsReady, stats: materialStats }
