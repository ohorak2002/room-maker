import * as THREE from 'three'

/**
 * Procedural PBR surface maps, generated on a canvas at runtime.
 *
 * Every material in the app was a single flat colour, which is the main reason
 * the room read as painted plastic rather than as objects — real surfaces vary
 * pixel to pixel, and it's that variation the eye uses to identify a material.
 * This generates albedo, normal and roughness maps for each surface type from
 * noise, so nothing has to be downloaded and nothing needs licensing.
 *
 * The one rule that shapes everything here: **albedo is greyscale and centred
 * near white.** Three multiplies `material.color` by `map`, so a near-white
 * map tints correctly and every palette in the app keeps working. Baking the
 * colour into the texture would look better in isolation and would break the
 * entire point of the product.
 */

// 256 is enough for grain and weave at the distances this camera sits at, and
// keeps generation under a frame. Detail here comes from the normal map, not
// from resolution.
const SIZE = 256

// ---------------------------------------------------------------------------
// Noise
//
// Periodic value noise: the lattice wraps at `period`, so a texture tiles
// without a visible seam. Non-periodic noise looked fine on a single object
// and showed hard lines the moment anything repeated.
// ---------------------------------------------------------------------------

const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

const smooth = (t) => t * t * (3 - 2 * t)
const fract = (v) => v - Math.floor(v)

function valueNoise(x, y, period) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = smooth(xf)
  const v = smooth(yf)
  const w = (n) => ((n % period) + period) % period

  const a = hash(w(xi), w(yi))
  const b = hash(w(xi + 1), w(yi))
  const c = hash(w(xi), w(yi + 1))
  const d = hash(w(xi + 1), w(yi + 1))

  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v
}

/** Fractal noise. Period doubles with frequency so every octave still tiles. */
function fbm(x, y, octaves = 4, period = 4) {
  let sum = 0
  let amp = 0.5
  let freq = 1
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq, period * freq) * amp
    norm += amp
    freq *= 2
    amp *= 0.5
  }
  return sum / norm
}

// ---------------------------------------------------------------------------
// Surface definitions
//
// Each returns, for a point in 0..1 texture space:
//   h - height, drives the normal map
//   a - albedo multiplier, near 1 so the material colour survives
//   r - roughness multiplier applied to the material's base roughness
// ---------------------------------------------------------------------------

const SURFACES = {
  /**
   * Cabinet doors, desks, shelves — the face of a sawn board.
   *
   * The warp has to stay small. Let it grow and the rings stop reading as wood
   * and start reading as marble or water; what identifies wood is that the
   * figure is *directional*, so the fine fibre below runs along one axis and
   * dominates.
   */
  wood: (u, v) => {
    const warp = (fbm(u * 2, v * 6, 3) - 0.5) * 0.9
    const rings = Math.abs(Math.sin((v * 16 + warp) * Math.PI))
    const fibre = fbm(u * 4, v * 130, 2, 16)
    const pore = fbm(u * 70, v * 22, 2)
    return {
      h: rings * 0.5 + fibre * 0.38 + pore * 0.12,
      a: 0.84 + rings * 0.1 + fibre * 0.08 - pore * 0.04,
      r: 1.02 - rings * 0.12 + pore * 0.12,
    }
  },

  /**
   * Floorboards. Distinct from `wood` because a floor is not one board face —
   * it's many, staggered, with a recessed seam between each. The seams are the
   * whole read; without them a wood floor looks like carpet, which is exactly
   * what the ring pattern alone produced.
   */
  plank: (u, v) => {
    // Eight courses, one board each. Proportion is what sells it: a board that
    // is only three times longer than it is wide reads as floor tile, so each
    // one spans the full width and the courses are kept narrow.
    const rows = 8
    const row = Math.floor(v * rows)
    const vIn = fract(v * rows)

    // Offset each course so the butt joints don't line up into a grid.
    const uu = fract(u + hash(row, 17))

    // The long edge between courses is a real gap; the butt joint is a hairline.
    const edge = Math.min(vIn, 1 - vIn)
    const butt = Math.min(uu, 1 - uu)
    if (edge < 0.028 || butt < 0.005) return { h: 0.06, a: 0.64, r: 1.3 }

    // Boards are cut from different parts of the log, so each gets its own tone.
    const tone = hash(row * 13, row * 7 + 3)
    const grain = fbm(uu * 6, vIn * 3 + row * 9, 3)
    const fibre = fbm(uu * 3, vIn * 36 + row * 5, 2, 16)
    return {
      h: 0.7 + grain * 0.2 + fibre * 0.1,
      a: 0.8 + tone * 0.13 + grain * 0.08 + fibre * 0.04,
      r: 0.92 + grain * 0.16,
    }
  },

  /** Upholstery. A real over-under weave, not a checker — threads alternate. */
  fabric: (u, v) => {
    const f = 34
    const x = u * f
    const y = v * f
    const over = (Math.floor(x) + Math.floor(y)) % 2 === 0
    const thread = over ? Math.sin(fract(x) * Math.PI) : Math.sin(fract(y) * Math.PI)
    const fuzz = fbm(u * 140, v * 140, 2, 8)
    const h = thread * 0.8 + fuzz * 0.2
    return {
      h,
      a: 0.86 + thread * 0.12 - fuzz * 0.04,
      r: 1.0 + (1 - thread) * 0.08 + fuzz * 0.06,
    }
  },

  /** Bathroom and kitchen surfaces: square tiles with recessed grout. */
  tile: (u, v) => {
    const n = 5
    const gx = fract(u * n)
    const gy = fract(v * n)
    const edge = Math.min(gx, 1 - gx, gy, 1 - gy)
    const grout = edge < 0.05
    const glaze = fbm(u * 18, v * 18, 3)
    if (grout) return { h: 0.08, a: 0.7, r: 1.6 }
    return { h: 0.85 + glaze * 0.15, a: 0.96 + glaze * 0.04, r: 0.55 + glaze * 0.12 }
  },

  /** Appliance and fixture metal: fine directional brushing along X. */
  brushed: (u, v) => {
    const streak = fbm(u * 4, v * 620, 2, 16)
    const flaw = fbm(u * 40, v * 40, 2)
    const h = 0.5 + (streak - 0.5) * 0.3
    return {
      h,
      a: 0.9 + streak * 0.12,
      r: 0.75 + streak * 0.5 + flaw * 0.1,
    }
  },

  /** Porcelain and glazed ceramic — nearly smooth, with faint orange peel. */
  porcelain: (u, v) => {
    const peel = fbm(u * 26, v * 26, 3)
    return { h: 0.45 + peel * 0.1, a: 0.96 + peel * 0.04, r: 0.85 + peel * 0.3 }
  },

  /** Stone counters: fine speckle over a slow tonal drift. */
  stone: (u, v) => {
    const grain = fbm(u * 70, v * 70, 3)
    const drift = fbm(u * 3, v * 3, 3)
    const fleck = grain > 0.72 ? 1 : 0
    return {
      h: 0.4 + grain * 0.25,
      a: 0.85 + drift * 0.12 + fleck * 0.1,
      r: 0.8 + grain * 0.35 - fleck * 0.2,
    }
  },

  /** Painted plaster on walls and ceilings. Deliberately very subtle. */
  plaster: (u, v) => {
    const tooth = fbm(u * 46, v * 46, 3)
    const sweep = fbm(u * 5, v * 5, 2)
    return { h: 0.45 + tooth * 0.14, a: 0.94 + sweep * 0.06, r: 0.96 + tooth * 0.12 }
  },

  /** Moulded plastic — near flat, just enough to catch light unevenly. */
  plastic: (u, v) => {
    const n = fbm(u * 36, v * 36, 2)
    return { h: 0.48 + n * 0.06, a: 0.95 + n * 0.05, r: 0.92 + n * 0.16 }
  },

  /** Leaves: a soft midrib-free vein network, matte. */
  leaf: (u, v) => {
    const veins = Math.abs(Math.sin((u * 7 + fbm(u * 5, v * 5, 3) * 4) * Math.PI))
    const mottle = fbm(u * 22, v * 22, 3)
    return {
      h: veins * 0.5 + mottle * 0.5,
      a: 0.8 + mottle * 0.2 + veins * 0.06,
      r: 1.0 + mottle * 0.12,
    }
  },

  /** Paper, canvas, rugs seen flat — fibrous and completely matte. */
  paper: (u, v) => {
    const fibre = fbm(u * 120, v * 120, 3, 8)
    return { h: 0.45 + fibre * 0.12, a: 0.9 + fibre * 0.1, r: 1.0 + fibre * 0.1 }
  },
}

// How strongly each surface's height field pushes the normal map, and how many
// times it repeats across a piece by default. Wood needs a low repeat or the
// grain looks like corduroy; fabric weave needs a high one or it looks knitted.
const TUNING = {
  wood: { normalScale: 0.55, repeat: 1.2 },
  plank: { normalScale: 0.4, repeat: 1 },
  fabric: { normalScale: 0.45, repeat: 3 },
  tile: { normalScale: 1.0, repeat: 1.6 },
  brushed: { normalScale: 0.25, repeat: 1 },
  porcelain: { normalScale: 0.18, repeat: 1 },
  stone: { normalScale: 0.3, repeat: 1.4 },
  plaster: { normalScale: 0.35, repeat: 3 },
  plastic: { normalScale: 0.2, repeat: 1 },
  leaf: { normalScale: 0.5, repeat: 1 },
  paper: { normalScale: 0.3, repeat: 2 },
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

function textureFrom(data, { srgb = false, repeat = 1 }) {
  // DataTexture wants a plain Uint8Array for UnsignedByteType; the clamped
  // array we filled shares the same buffer, so this is a view, not a copy.
  const tex = new THREE.DataTexture(new Uint8Array(data.buffer), SIZE, SIZE, THREE.RGBAFormat)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

/**
 * Walk the surface function once and emit all three maps together, deriving
 * the normal from the height field with a Sobel difference. Generating them in
 * one pass matters: the normal has to agree with the albedo it sits under, and
 * sampling the noise twice would drift.
 */
function generate(name, repeat) {
  const fn = SURFACES[name]
  const { normalScale } = TUNING[name]

  const n = SIZE * SIZE
  const height = new Float32Array(n)
  const albedo = new Uint8ClampedArray(n * 4)
  const rough = new Uint8ClampedArray(n * 4)

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x
      const { h, a, r } = fn(x / SIZE, y / SIZE)
      height[i] = h

      const av = a * 255
      albedo[i * 4] = av
      albedo[i * 4 + 1] = av
      albedo[i * 4 + 2] = av
      albedo[i * 4 + 3] = 255

      // Roughness lives in G by three's convention; the map multiplies the
      // material's own roughness, so values above 1 are clamped by the shader.
      const rv = Math.min(1, r) * 255
      rough[i * 4] = rv
      rough[i * 4 + 1] = rv
      rough[i * 4 + 2] = rv
      rough[i * 4 + 3] = 255
    }
  }

  const normal = new Uint8ClampedArray(n * 4)
  const at = (x, y) => height[(((y % SIZE) + SIZE) % SIZE) * SIZE + (((x % SIZE) + SIZE) % SIZE)]

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x
      const dx = (at(x - 1, y) - at(x + 1, y)) * normalScale * SIZE * 0.02
      const dy = (at(x, y - 1) - at(x, y + 1)) * normalScale * SIZE * 0.02
      const len = Math.hypot(dx, dy, 1)

      normal[i * 4] = ((dx / len) * 0.5 + 0.5) * 255
      normal[i * 4 + 1] = ((dy / len) * 0.5 + 0.5) * 255
      normal[i * 4 + 2] = (1 / len) * 0.5 * 255 + 127.5
      normal[i * 4 + 3] = 255
    }
  }

  return {
    map: textureFrom(albedo, { srgb: true, repeat }),
    normalMap: textureFrom(normal, { repeat }),
    roughnessMap: textureFrom(rough, { repeat }),
  }
}

// Texture sets are shared by every material using them, so generation happens
// once per surface-and-repeat rather than once per object.
const cache = new Map()

function surfaceMaps(name, repeatOverride) {
  const tuning = TUNING[name]
  if (!tuning) return null
  const repeat = repeatOverride ?? tuning.repeat
  const key = `${name}@${repeat}`
  if (!cache.has(key)) cache.set(key, generate(name, repeat))
  return cache.get(key)
}

/**
 * Attach a surface's maps to a material. `repeat` overrides the default for
 * large surfaces — a floor needs the grain repeating far more times than a
 * nightstand does, and repeat is a property of the texture, not the material,
 * so an override generates its own cached set.
 */
export function applySurface(material, name, repeat) {
  const maps = surfaceMaps(name, repeat)
  if (!maps) return material
  material.map = maps.map
  material.normalMap = maps.normalMap
  material.roughnessMap = maps.roughnessMap
  material.normalScale = new THREE.Vector2(1, 1)
  return material
}

export const SURFACE_NAMES = Object.keys(SURFACES)
