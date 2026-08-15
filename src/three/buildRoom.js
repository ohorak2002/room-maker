import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { zoneOf } from './layout'
import { floorRuns, wallRuns, windowWall } from './shapeGeom'
import { shapeBounds } from '../data/presets'
import { applySurface } from './textures'
import { FIDDLE_FIG } from './meshes/fiddleFig'
import { requestUpgrade } from './modelUpgrade'
import { requestFacts, applyFacts } from '../data/productFacts'

/**
 * Build a mesh that arrived as raw geometry rather than as code.
 *
 * Two things come through here now: the SketchUp fig, and whatever /api/model
 * generates from a product photo. They share a format on purpose — metres,
 * Y-up, origin on the floor, centred on X and Z — so neither needs a special
 * case, and a third source later would not either.
 *
 * Vertex normals are computed here unless the spec ships its own. Un-indexed
 * data (the fig) comes out flat-shaded per face; indexed data (a generated
 * mesh) comes out smooth across shared vertices, which is the right answer for
 * the curved silhouettes that are the only shapes we generate — see
 * data/upgradable.js. A textured piece keeps the provider's normals instead,
 * because those were authored against the same UVs the photograph sits on.
 *
 * Materials marked `tint` are multiplied by the catalog colour, so the piece
 * still answers to the palette. The rest keep the colours they were authored
 * with — a terracotta pot shouldn't turn sage because the walls did. A piece
 * carrying a real product photograph is never tinted: the fabric in that photo
 * is the reason the user pasted the link.
 */

/**
 * One THREE.Texture per spec, not per piece. Eight dining chairs share one
 * upgraded spec, and decoding the same base64 image eight times would cost
 * eight uploads to the GPU for one picture.
 */
const specTextures = new WeakMap()

function textureFor(spec) {
  if (!spec.texture) return null
  const cached = specTextures.get(spec)
  if (cached) return cached

  const tex = new THREE.TextureLoader().load(spec.texture)
  // glTF UVs put the origin at the top left, which is the opposite of three's
  // default. GLTFLoader sets this for the same reason; we read the raw UVs, so
  // we have to set it ourselves or every product arrives upside down.
  tex.flipY = false
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  specTextures.set(spec, tex)
  return tex
}

function sketchupMesh(spec, it) {
  const g = new THREE.Group()
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(spec.positions, 3))
  if (spec.uvs) geo.setAttribute('uv', new THREE.Float32BufferAttribute(spec.uvs, 2))
  // Indexing has to be set before normals are computed, or the averaging has
  // no shared vertices to average across and every surface comes out faceted.
  if (spec.indices) geo.setIndex(spec.indices)
  if (spec.normals) geo.setAttribute('normal', new THREE.Float32BufferAttribute(spec.normals, 3))
  else geo.computeVertexNormals()

  for (const [start, count, matIndex] of spec.groups) {
    geo.addGroup(start, count, matIndex)
  }

  const map = textureFor(spec)
  const tinted = GENERATED_SURFACE[it.model] || FOLIAGE
  const mats = spec.materials.map((m) => {
    const [r, gg, b] = m.rgb
    const hex = `#${((1 << 24) + (r << 16) + (gg << 8) + b).toString(16).slice(1)}`
    if (map) {
      // The photograph already carries the product's own shading, so this stays
      // matte and barely reflective. Letting the environment map play across it
      // as well would light the same surface twice.
      return new THREE.MeshStandardMaterial({
        map,
        color: new THREE.Color(hex),
        roughness: 0.9,
        metalness: 0.0,
        envMapIntensity: 0.25,
      })
    }
    return m.tint ? tinted(it.color || hex) : mat(hex, 0.62, 0.0, 0.4, 'paper')
  })

  const mesh = new THREE.Mesh(geo, mats)
  // Height is baked in, so honour the catalog's size by scaling uniformly.
  let s = it.h ? it.h / spec.heightM : 1

  // A generated mesh reports its own proportions, and they are the product's,
  // not the catalog's. A three-seater standing in for a loveseat would keep its
  // real width once scaled to the right height and shoulder its way through the
  // neighbours, because the layout solver placed the piece using the catalog's
  // footprint. Give it a quarter more room than that and no more.
  if (spec.widthM && it.fp) {
    const half = (spec.widthM * s) / 2
    const allowed = it.fp * 1.25
    if (half > allowed) s *= allowed / half
  }

  mesh.scale.setScalar(s)
  g.add(mesh)
  return g
}

/**
 * The same node the room would show for an upgraded piece, built standalone.
 *
 * Exists so the shop's thumbnails can draw the mesh the room is drawing. A
 * thumbnail that still shows the generic sofa after the real one has landed
 * reads as a broken product, not as a pending one.
 */
export function upgradedNode(spec, item) {
  return shadowed(sketchupMesh(spec, item))
}

/**
 * Replace a placed piece's geometry in situ, once a better model turns up.
 *
 * The node itself survives: it is what the drag layer raycasts against and
 * what holds the key the store writes positions back under. Only its contents
 * change, so a piece being upgraded mid-drag keeps following the pointer.
 */
function swapGeometry(node, spec, item) {
  const replacement = shadowed(sketchupMesh(spec, item))

  for (const child of [...node.children]) {
    // Lamps carry a PointLight, and that light is the piece's actual job. The
    // generated mesh is geometry only, so throwing the whole subtree away would
    // swap a better-looking lamp in and switch the room's lighting off with it.
    if (child.isLight) continue

    node.remove(child)
    child.traverse?.((o) => {
      if (!o.isMesh) return
      o.geometry?.dispose()
      // Materials only, never `material.map`. A product texture belongs to its
      // spec and is shared by every copy of that product in the room — dispose
      // it here and the other seven dining chairs go black.
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
      else o.material?.dispose()
    })
  }

  for (const child of [...replacement.children]) node.add(child)
  node.userData.upgraded = true
}

// ---------------------------------------------------------------------------
// Materials
//
// Everything is PBR and reads the scene environment map, so surfaces pick up
// real reflections instead of looking like flat painted cardboard. The
// envMapIntensity is what separates a fabric sofa from a metal lamp base —
// fabric barely reflects, chrome reflects almost everything.
// ---------------------------------------------------------------------------

const mat = (color, roughness = 0.85, metalness = 0.0, envMapIntensity = 0.6, surface = null, repeat) => {
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness,
    metalness,
    envMapIntensity,
  })
  // `surface` attaches procedurally generated albedo/normal/roughness maps.
  // The albedo is greyscale near white, so `color` above still decides the hue
  // and every palette keeps working — see textures.js.
  return surface ? applySurface(m, surface, repeat) : m
}

const glow = (color, intensity = 1.2) =>
  new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    roughness: 0.4,
    envMapIntensity: 0.3,
  })

/**
 * Every rectangular part is a rounded box, not a hard-edged one. Real furniture
 * has a small radius on every edge, and that highlight along the bevel is most
 * of what makes a render stop looking procedural. The radius is clamped so thin
 * parts (a 2cm shelf board) don't collapse into a pill.
 */
const box = (w, h, d, material, radius = 0.018) => {
  const r = Math.min(radius, w / 2.2, h / 2.2, d / 2.2)
  if (r <= 0.002) return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), material)
}

/** Hard-edged box, for the room shell where bevels would read as sloppy. */
const hardBox = (w, h, d, material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)

/**
 * A cushion: a box with a large corner radius, squashed slightly and given a
 * gentle barrel to its faces.
 *
 * This is most of what separates upholstery from a crate. Real foam under
 * fabric never has a flat face or a sharp arris — it bulges between its seams,
 * and the highlight running along that bulge is what the eye reads as "soft".
 * A rounded box alone still looks machined; the barrel is the part that lands.
 */
const cushion = (w, h, d, material, radius = 0.07, bulge = 0.02) => {
  const r = Math.min(radius, w / 2.4, h / 2.4, d / 2.4)
  const geo = new RoundedBoxGeometry(w, h, d, 6, r)
  const pos = geo.attributes.position

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    // Push each vertex out by how far it is from the middle on the other two
    // axes, so faces swell and edges stay put.
    const fx = 1 - Math.min(1, Math.abs(x) / (w / 2)) ** 2
    const fy = 1 - Math.min(1, Math.abs(y) / (h / 2)) ** 2
    const fz = 1 - Math.min(1, Math.abs(z) / (d / 2)) ** 2
    pos.setX(i, x + Math.sign(x) * bulge * fy * fz)
    pos.setY(i, y + Math.sign(y) * bulge * fx * fz)
    pos.setZ(i, z + Math.sign(z) * bulge * fx * fy)
  }
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, material)
}

/**
 * A leg tapered toward the floor, tilted out from vertical.
 *
 * Furniture legs are almost never straight cylinders standing plumb. The taper
 * and the splay are small — a couple of centimetres and a few degrees — and
 * they're the difference between a piece that sits and a piece that hovers.
 */
const taperedLeg = (topR, botR, h, material, splay = 0) => {
  const leg = cyl(topR, botR, h, material, 10)
  leg.rotation.z = splay
  return leg
}

const cyl = (rt, rb, h, material, seg = 32) =>
  new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material)

/**
 * A surface of revolution from a 2D profile — `[[radius, height], ...]`.
 *
 * Pots, vases, bowls and lamp shades are all one curve spun around an axis,
 * which is exactly how they're really made on a wheel. Stacking cylinders to
 * fake the same shape gives you visible steps where there should be a curve.
 */
const lathe = (profile, material, seg = 28) =>
  new THREE.Mesh(
    new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(Math.max(0.0001, x), y)), seg),
    material
  )

/**
 * Re-map a mesh's UVs by projecting straight down from above.
 *
 * A lathe wraps its UVs around the axis, so any grain painted on one ends up
 * running in concentric circles — a round table top came out looking like a
 * sawn stump. Timber is cut from a board, so the grain runs straight across
 * regardless of how the edge was turned. Projecting from above gives that.
 */
const planarUV = (mesh, scale = 1) => {
  const geo = mesh.geometry
  const pos = geo.attributes.position
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) * scale + 0.5
    uv[i * 2 + 1] = pos.getZ(i) * scale + 0.5
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return mesh
}

// A leaf outline: base at the origin, tip at (0,1), swelling to either side.
const LEAF_SHAPE = (() => {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.42, 0.18, 0.34, 0.78, 0, 1)
  s.bezierCurveTo(-0.34, 0.78, -0.42, 0.18, 0, 0)
  return s
})()

const LEAF_GEO = new THREE.ExtrudeGeometry(LEAF_SHAPE, {
  depth: 0.012,
  bevelEnabled: true,
  bevelSize: 0.012,
  bevelThickness: 0.006,
  bevelSegments: 2,
  curveSegments: 10,
})

/**
 * One leaf, scaled and curled.
 *
 * Plants were the worst-looking things in the app because their leaves were
 * flat rectangles, and nothing in nature is a flat rectangle. A real leaf has
 * an outline that tapers to a point and a curl along its length — the curl is
 * what catches light unevenly and stops a plant reading as a paper cut-out.
 *
 * The geometry is cloned from one shared shape rather than rebuilt per leaf,
 * since a tree can carry thirty of them.
 */
const leaf = (len, wid, material, curl = 0.25) => {
  const geo = LEAF_GEO.clone()
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    // Curl along the length, and fold slightly about the midrib.
    pos.setZ(i, pos.getZ(i) - curl * y * y - Math.abs(x) * 0.22)
  }
  geo.computeVertexNormals()
  const m = new THREE.Mesh(geo, material)
  m.scale.set(wid, len, 1)
  return m
}
const sphere = (r, material, seg = 24) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), material)

const shadowed = (group) => {
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  return group
}

// ---------------------------------------------------------------------------
// Object builders. Each returns a Group whose origin sits on the floor.
// `zone` decides where the placer puts it.
// ---------------------------------------------------------------------------

const WOOD = '#8B6B4A'
const DARK = '#2B2D31'

// Physical surface presets. The numbers matter more than they look: fabric with
// a metal's reflectivity looks like a beanbag wrapped in foil, and wood with
// fabric roughness goes dead flat under the key light.
//                      roughness, metalness, envIntensity
/**
 * Cloth, and the one material here that is not a MeshStandardMaterial.
 *
 * Fabric is the surface people are most sensitive to getting wrong, because a
 * sofa is the thing in the room they have touched most often. What a standard
 * material cannot do is the pale rim that appears where upholstery turns away
 * from the light — that is thousands of fibre ends catching it side-on, and
 * without it velvet, linen and wool all resolve to the same soft rubber.
 *
 * `sheen` is three's model of exactly that, and it is why this one is Physical.
 * Kept modest and broad: a high sheen with a tight roughness reads as satin,
 * which is a different and much shinier material than most of the catalog.
 */
const FABRIC = (c) => {
  const color = new THREE.Color(c)
  const m = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.95,
    metalness: 0.0,
    envMapIntensity: 0.12,
    sheen: 0.6,
    sheenRoughness: 0.75,
    // Lifted toward white rather than a fixed highlight colour, so a charcoal
    // sofa gets a grey rim and a sage one a pale green — a white rim on a dark
    // fabric looks dusty.
    sheenColor: color.clone().lerp(new THREE.Color(0xffffff), 0.55),
  })
  return applySurface(m, 'fabric')
}
const WOODEN = (c) => mat(c, 0.55, 0.0, 0.45, 'wood')
const METAL = (c) => mat(c, 0.32, 0.88, 1.1, 'brushed')
const PLASTIC = (c) => mat(c, 0.42, 0.0, 0.7, 'plastic')
const CERAMIC = (c) => mat(c, 0.22, 0.0, 0.95, 'porcelain')
const FOLIAGE = (c) => mat(c, 0.72, 0.0, 0.2, 'leaf')
const PAPERY = (c) => mat(c, 0.88, 0.0, 0.2, 'paper')

/**
 * What a generated mesh should be made of.
 *
 * A model that arrives from /api/model is one undivided surface — the provider
 * is asked not to texture it, and without a texture there is nothing to tell
 * the arm of a chair from its legs. So the material comes from what the piece
 * is rather than from anything in the file.
 *
 * Getting this wrong is not subtle. The fig's tinted group is foliage and uses
 * the leaf surface; run a sofa through the same default and it renders
 * upholstered in leaves.
 */
const GENERATED_SURFACE = {
  sofa: FABRIC,
  armchair: FABRIC,
  chair: FABRIC,
  beanbag: FABRIC,
  pouf: FABRIC,
  diningchair: WOODEN,
  stool: WOODEN,
  // Not METAL: a lamp mesh is mostly shade, and chroming the whole thing to get
  // the base right costs more than it wins.
  floorlamp: PAPERY,
  desklamp: PAPERY,
  pendant: PAPERY,
  palm: FOLIAGE,
  plant: FOLIAGE,
  smallplant: FOLIAGE,
  hanging: FOLIAGE,
  vase: CERAMIC,
  bathtub: CERAMIC,
  toilet: CERAMIC,
}

// Shower screens and appliance doors. Transparency alone reads as a hole in the
// wall; it's the near-zero roughness plus a strong env response that makes it
// register as glass.
const GLASS = (c = '#DCE6EA') =>
  new THREE.MeshStandardMaterial({
    color: new THREE.Color(c),
    roughness: 0.06,
    metalness: 0.0,
    envMapIntensity: 1.4,
    transparent: true,
    opacity: 0.24,
  })
const STONE = (c = '#3C3F44') => mat(c, 0.28, 0.1, 0.8, 'stone')
const ENAMEL = (c) => mat(c, 0.15, 0.25, 1.1, 'porcelain')

/**
 * Washer and dryer are the same machine with a different door tint, so they
 * share a builder rather than duplicating twenty lines for a colour change.
 */
const frontLoader = (it, doorTint) => {
  const g = new THREE.Group()
  // Painted appliance steel — closest to porcelain's faint orange peel, not the
  // directional brushing of a stainless finish.
  const body = box(0.6, it.h, 0.6, mat('#E8EAEC', 0.35, 0.1, 0.7, 'porcelain'))
  body.position.y = it.h / 2
  g.add(body)

  const port = cyl(0.19, 0.19, 0.05, GLASS(doorTint), 24)
  port.rotation.x = Math.PI / 2
  port.position.set(0, it.h * 0.5, 0.3)
  g.add(port)

  const ring = cyl(0.22, 0.22, 0.035, METAL('#AEB3B8'), 24)
  ring.rotation.x = Math.PI / 2
  ring.position.set(0, it.h * 0.5, 0.285)
  g.add(ring)

  const panel = box(0.56, 0.1, 0.02, mat('#2A2D31', 0.3, 0.2, 0.8, 'plastic'))
  panel.position.set(0, it.h * 0.87, 0.31)
  g.add(panel)

  const dial = cyl(0.035, 0.035, 0.02, METAL('#C9CDD2'), 16)
  dial.rotation.x = Math.PI / 2
  dial.position.set(-0.19, it.h * 0.87, 0.32)
  g.add(dial)
  return g
}

export const builders = {
  /**
   * A snake plant: stiff blades rising from a pot, each one twisted and leaning
   * a different way. Real ones are never symmetrical, and the irregularity is
   * most of what stops a cluster reading as a fan.
   */
  plant: (it) => {
    const g = new THREE.Group()
    const soil = CERAMIC('#2E2A26')
    const pot = lathe([[0.11, 0], [0.135, 0.02], [0.15, 0.1], [0.165, 0.26], [0.155, 0.27], [0.14, 0.26]], CERAMIC('#B4785A'))
    g.add(pot)

    const dirt = cyl(0.142, 0.142, 0.02, soil, 20)
    dirt.position.y = 0.255
    g.add(dirt)

    const m = FOLIAGE(it.color)
    const blades = 7
    const H = Math.max(0.3, it.h - 0.28)
    for (let i = 0; i < blades; i++) {
      const a = (i / blades) * Math.PI * 2 + 0.4
      const len = H * (0.72 + ((i * 37) % 10) / 28)
      const b = leaf(len, 0.075, m, 0.1)
      b.position.set(Math.cos(a) * 0.05, 0.25, Math.sin(a) * 0.05)
      b.rotation.y = -a + Math.PI / 2
      b.rotation.x = -0.06
      b.rotation.z = Math.sin(i * 2.1) * 0.16
      g.add(b)
    }
    return g
  },

  /** A succulent: a rosette of short fat leaves, tightest at the centre. */
  smallplant: (it) => {
    const g = new THREE.Group()
    const pot = lathe([[0.075, 0], [0.09, 0.015], [0.1, 0.07], [0.11, 0.12], [0.1, 0.13]], CERAMIC('#D8CFC2'))
    g.add(pot)

    const dirt = cyl(0.093, 0.093, 0.015, CERAMIC('#332E29'), 18)
    dirt.position.y = 0.125
    g.add(dirt)

    const m = FOLIAGE(it.color)
    for (let ring = 0; ring < 3; ring++) {
      const n = 6 - ring
      const tilt = 1.15 - ring * 0.34
      const size = 0.1 - ring * 0.022
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 0.7
        const l = leaf(size, 0.052, m, 0.3)
        l.position.set(Math.cos(a) * 0.018 * (ring + 1), 0.13, Math.sin(a) * 0.018 * (ring + 1))
        l.rotation.y = -a
        l.rotation.x = -tilt
        g.add(l)
      }
    }
    return g
  },

  /**
   * A fiddle-leaf fig: a bare trunk with large leaves clustered up top.
   *
   * The old version was five squashed spheres, which reads as topiary. What
   * makes this species recognisable is big individual leaves on visible stems,
   * so the leaves are modelled and the canopy isn't.
   */
  /**
   * The fig is now the SketchUp model rather than the procedural one — the
   * first piece in the app whose geometry was authored in a real modeller and
   * imported as data. Everything else here is still built in code.
   */
  tree: (it) => sketchupMesh(FIDDLE_FIG, it),

  _treeProcedural: (it) => {
    const g = new THREE.Group()
    const pot = lathe([[0.16, 0], [0.19, 0.03], [0.21, 0.14], [0.23, 0.33], [0.215, 0.35], [0.19, 0.33]], CERAMIC('#A8705A'))
    g.add(pot)

    const dirt = cyl(0.2, 0.2, 0.02, CERAMIC('#2E2A26'), 22)
    dirt.position.y = 0.335
    g.add(dirt)

    const trunkH = it.h - 0.35
    const trunk = cyl(0.028, 0.045, trunkH, WOODEN('#6B5340'), 12)
    trunk.position.y = 0.35 + trunkH / 2
    trunk.rotation.z = 0.02
    g.add(trunk)

    const m = FOLIAGE(it.color)
    const leaves = 20
    for (let i = 0; i < leaves; i++) {
      const t = i / (leaves - 1)
      // Leaves belong in the top third. Spreading them evenly down the trunk
      // made it read as a cactus — a fig is bare stem with a crown on top.
      const y = 0.35 + trunkH * (0.58 + t * 0.44)
      const a = i * 2.399 // golden angle, so they never line up in columns
      const size = 0.42 - t * 0.13
      const reach = 0.1 + t * 0.14

      const stem = cyl(0.007, 0.009, 0.16, WOODEN('#7A6248'), 6)
      stem.position.set(Math.cos(a) * 0.07, y, Math.sin(a) * 0.07)
      stem.rotation.z = Math.cos(a) * 0.8
      stem.rotation.x = -Math.sin(a) * 0.8
      g.add(stem)

      const l = leaf(size, 0.27, m, 0.2)
      l.position.set(Math.cos(a) * reach, y + 0.04, Math.sin(a) * reach)
      l.rotation.y = -a + Math.PI / 2
      l.rotation.x = -0.75 - t * 0.35
      l.rotation.z = Math.sin(i * 1.7) * 0.35
      g.add(l)
    }
    return g
  },

  palm: (it) => {
    const g = new THREE.Group()
    const pot = cyl(0.2, 0.16, 0.3, CERAMIC('#9E8A72'))
    pot.position.y = 0.15
    g.add(pot)

    // Slim stems that fan out and arch over, rather than slabs standing on end.
    const crown = it.h * 0.62
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      const stem = cyl(0.012, 0.022, crown, WOODEN('#7C7A52'), 8)
      stem.position.set(Math.cos(a) * 0.05, 0.3 + crown / 2, Math.sin(a) * 0.05)
      stem.rotation.z = Math.cos(a) * 0.1
      g.add(stem)
    }

    const frondM = FOLIAGE(it.color)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3
      const droop = 0.55 + (i % 3) * 0.16
      const len = it.h * 0.38

      const arm = new THREE.Group()
      arm.position.set(0, 0.3 + crown, 0)
      arm.rotation.y = -a
      arm.rotation.z = droop

      // A frond is a tapered spine with leaflets, not a rectangle.
      const spine = cyl(0.006, 0.012, len, frondM, 6)
      spine.position.y = len / 2
      arm.add(spine)

      for (let k = 1; k <= 6; k++) {
        const t = k / 7
        for (const side of [-1, 1]) {
          const leaf = box(0.008, 0.13 - t * 0.05, 0.055, frondM)
          leaf.position.set(side * 0.055, len * t, 0)
          leaf.rotation.z = side * 0.75
          arm.add(leaf)
        }
      }
      g.add(arm)
    }
    return g
  },

  vase: (it) => {
    const g = new THREE.Group()
    // A real vase narrows at the neck and flares at the lip; a straight
    // cylinder is a tin can.
    const v = lathe([[0.05, 0], [0.075, 0.03], [0.085, 0.1], [0.06, 0.19], [0.055, 0.22], [0.065, 0.235], [0.061, 0.24]], CERAMIC('#DCD3C6'))
    g.add(v)

    const m = FOLIAGE(it.color)
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2
      const lean = 0.18 + (i % 3) * 0.09
      const len = 0.26 + (i % 4) * 0.05

      const stem = cyl(0.005, 0.007, len, m, 6)
      stem.position.set(Math.cos(a) * 0.03, 0.24 + len / 2, Math.sin(a) * 0.03)
      stem.rotation.z = Math.cos(a) * lean
      stem.rotation.x = -Math.sin(a) * lean
      g.add(stem)

      const l = leaf(0.12, 0.07, m, 0.3)
      l.position.set(Math.cos(a) * (0.03 + len * lean), 0.24 + len, Math.sin(a) * (0.03 + len * lean))
      l.rotation.y = -a
      l.rotation.z = Math.cos(a) * lean
      g.add(l)
    }
    return g
  },

  hanging: (it) => {
    const g = new THREE.Group()
    const pot = lathe([[0.1, 0], [0.12, 0.02], [0.13, 0.09], [0.125, 0.15], [0.11, 0.16]], FABRIC('#C4B49A'))
    g.add(pot)

    const m = FOLIAGE(it.color)
    // Trailing vines: a chain of leaves down a drooping stem, which is what a
    // pothos actually looks like. Rectangles hanging down looked like tinsel.
    for (let v = 0; v < 6; v++) {
      const a = (v / 6) * Math.PI * 2
      const drop = 0.35 + (v % 3) * 0.18
      const x = Math.cos(a) * 0.09
      const z = Math.sin(a) * 0.09

      const vine = cyl(0.004, 0.004, drop, m, 5)
      vine.position.set(x, -drop / 2, z)
      g.add(vine)

      const count = 3 + (v % 2)
      for (let i = 0; i < count; i++) {
        const t = (i + 1) / (count + 1)
        const l = leaf(0.085, 0.075, m, 0.35)
        l.position.set(x, -drop * t, z)
        l.rotation.y = -a + i * 1.2
        l.rotation.x = Math.PI * 0.62
        g.add(l)
      }
    }
    return g
  },

  chair: (it) => {
    const g = new THREE.Group()
    const m = FABRIC(it.color)
    const seatY = 0.46

    // Contoured seat and a back with a waist. An office chair is never two flat
    // slabs, and the taper is what reads as ergonomic.
    const seat = cushion(0.48, 0.075, 0.46, m, 0.05, 0.014)
    seat.position.y = seatY
    g.add(seat)

    const back = cushion(0.44, 0.5, 0.06, m, 0.05, 0.016)
    back.position.set(0, seatY + 0.32, -0.22)
    back.rotation.x = -0.14
    g.add(back)

    const lumbar = cyl(0.03, 0.03, 0.4, m, 12)
    lumbar.rotation.z = Math.PI / 2
    lumbar.position.set(0, seatY + 0.16, -0.2)
    g.add(lumbar)

    const post = cyl(0.032, 0.038, 0.26, METAL('#8E9297'), 12)
    post.position.y = seatY - 0.17
    g.add(post)

    // Five-star base with castors, which is the silhouette everyone recognises.
    const hub = cyl(0.05, 0.06, 0.05, METAL(DARK), 16)
    hub.position.y = 0.06
    g.add(hub)

    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      const arm = box(0.26, 0.022, 0.045, METAL(DARK), 0.01)
      arm.position.set(Math.cos(a) * 0.14, 0.055, Math.sin(a) * 0.14)
      arm.rotation.y = -a
      g.add(arm)

      const castor = cyl(0.026, 0.026, 0.02, PLASTIC('#1B1D21'), 12)
      castor.rotation.x = Math.PI / 2
      castor.position.set(Math.cos(a) * 0.26, 0.026, Math.sin(a) * 0.26)
      g.add(castor)
    }
    return g
  },

  armchair: (it) => {
    const g = new THREE.Group()
    const m = FABRIC(it.color)
    const legH = 0.12
    const W = 0.86
    const D = 0.86

    const base = box(W, 0.2, D, m, 0.05)
    base.position.y = legH + 0.1
    g.add(base)

    const seat = cushion(W - 0.24, 0.16, D - 0.22, m, 0.06, 0.022)
    seat.position.set(0, legH + 0.28, 0.03)
    g.add(seat)

    const back = cushion(W - 0.26, 0.42, 0.16, m, 0.07, 0.025)
    back.position.set(0, legH + 0.47, -D / 2 + 0.16)
    back.rotation.x = -0.14
    g.add(back)

    for (const s of [-1, 1]) {
      const arm = box(0.15, 0.32, D, m, 0.05)
      arm.position.set(s * (W / 2 - 0.075), legH + 0.32, 0)
      g.add(arm)

      const roll = cyl(0.075, 0.075, D, m, 16)
      roll.rotation.x = Math.PI / 2
      roll.position.set(s * (W / 2 - 0.075), legH + 0.48, 0)
      g.add(roll)
    }

    for (const [x, z] of [[-0.33, -0.31], [0.33, -0.31], [-0.33, 0.31], [0.33, 0.31]]) {
      const leg = taperedLeg(0.026, 0.018, legH, WOODEN('#5A4230'))
      leg.position.set(x, legH / 2, z)
      g.add(leg)
    }
    return g
  },

  /**
   * A sofa built the way one is actually made: a frame, then cushions sitting
   * in it with visible seams, then arms, then legs.
   *
   * The old version was four boxes and read as a crate. What changed isn't
   * detail for its own sake — it's that the seams between separate cushions,
   * the gap under the frame, and the slight sink of the seats into the base
   * are the specific cues the eye uses to identify a sofa. Miss them and no
   * amount of texture rescues it.
   */
  sofa: (it) => {
    const g = new THREE.Group()
    const m = FABRIC(it.color)
    const W = 2.1
    const D = 0.92
    const legH = 0.13

    // Plinth — the frame the cushions sit in, lifted off the floor.
    const base = box(W, 0.22, D, m, 0.04)
    base.position.y = legH + 0.11
    g.add(base)

    // Three seat cushions with real gaps. One long cushion is the single
    // biggest tell that something isn't a sofa.
    const seatW = (W - 0.34) / 3
    for (let i = 0; i < 3; i++) {
      const c = cushion(seatW - 0.02, 0.17, D - 0.24, m, 0.06, 0.022)
      c.position.set((i - 1) * seatW, legH + 0.3, 0.04)
      g.add(c)
    }

    // Back cushions, tilted back and sitting proud of the frame.
    for (let i = 0; i < 3; i++) {
      const b = cushion(seatW - 0.03, 0.42, 0.17, m, 0.07, 0.025)
      b.position.set((i - 1) * seatW, legH + 0.5, -D / 2 + 0.17)
      b.rotation.x = -0.12
      g.add(b)
    }

    // Rolled arms — a squashed cylinder capping a slab, which is the shape of
    // every upholstered arm and nothing like the flat board it replaced.
    for (const s of [-1, 1]) {
      const arm = box(0.17, 0.34, D, m, 0.05)
      arm.position.set(s * (W / 2 - 0.085), legH + 0.34, 0)
      g.add(arm)

      const roll = cyl(0.085, 0.085, D, m, 18)
      roll.rotation.x = Math.PI / 2
      roll.position.set(s * (W / 2 - 0.085), legH + 0.51, 0)
      g.add(roll)
    }

    for (const [x, z] of [[-0.9, -0.34], [0.9, -0.34], [-0.9, 0.34], [0.9, 0.34]]) {
      const leg = taperedLeg(0.028, 0.019, legH, WOODEN('#5A4230'), 0)
      leg.position.set(x, legH / 2, z)
      g.add(leg)
    }
    return g
  },

  beanbag: (it) => {
    const g = new THREE.Group()
    const b = sphere(0.45, FABRIC(it.color))
    b.scale.set(1, 0.65, 1)
    b.position.y = 0.3
    g.add(b)
    return g
  },

  pouf: (it) => {
    const g = new THREE.Group()
    const p = cyl(0.28, 0.3, 0.36, FABRIC(it.color), 20)
    p.position.y = 0.18
    g.add(p)
    return g
  },

  desk: (it) => {
    const g = new THREE.Group()
    const wood = WOODEN(it.color)
    const W = 1.5
    const D = 0.7

    // The top overhangs its frame, which is what gives a desk its shadow line.
    const top = box(W, 0.04, D, wood)
    top.position.y = it.h
    g.add(top)

    const apron = box(W - 0.14, 0.07, D - 0.12, wood)
    apron.position.y = it.h - 0.055
    g.add(apron)

    // A shallow drawer under one side, with a reveal around it.
    const drawer = box(0.44, 0.1, 0.02, wood)
    drawer.position.set(-0.32, it.h - 0.11, D / 2 - 0.07)
    g.add(drawer)
    const pull = box(0.16, 0.016, 0.016, METAL('#C9CDD2'))
    pull.position.set(-0.32, it.h - 0.11, D / 2 - 0.05)
    g.add(pull)

    for (const [x, z] of [[-0.68, -0.29], [0.68, -0.29], [-0.68, 0.29], [0.68, 0.29]]) {
      const leg = taperedLeg(0.026, 0.017, it.h - 0.06, METAL(DARK))
      leg.position.set(x, (it.h - 0.06) / 2, z)
      g.add(leg)
    }
    return g
  },

  table: (it) => {
    const g = new THREE.Group()
    // Round top with a chamfered edge, on a weighted pedestal. The profile is
    // what stops it reading as a disc balanced on a tube.
    const top = lathe(
      [[0, it.h + 0.03], [0.47, it.h + 0.03], [0.5, it.h + 0.015], [0.5, it.h - 0.015], [0.47, it.h - 0.03], [0, it.h - 0.03]],
      WOODEN(it.color),
      32
    )
    // Grain runs across the board, not around the turned edge.
    planarUV(top, 0.8)
    g.add(top)

    const stem = lathe(
      [[0.22, 0], [0.23, 0.015], [0.12, 0.06], [0.055, 0.2], [0.05, it.h - 0.05], [0.14, it.h - 0.035], [0, it.h - 0.035]],
      METAL(DARK),
      24
    )
    g.add(stem)
    return g
  },

  nightstand: (it) => {
    const g = new THREE.Group()
    const wood = WOODEN(it.color)
    const legH = 0.11
    const bodyH = it.h - legH

    const body = box(0.45, bodyH, 0.4, wood)
    body.position.y = legH + bodyH / 2
    g.add(body)

    // Two drawers standing proud, so the reveal between them catches shadow.
    for (let i = 0; i < 2; i++) {
      const y = legH + bodyH * (0.28 + i * 0.44)
      const face = box(0.4, bodyH * 0.38, 0.02, wood)
      face.position.set(0, y, 0.21)
      g.add(face)

      const pull = box(0.14, 0.018, 0.018, METAL('#C9CDD2'))
      pull.position.set(0, y, 0.235)
      g.add(pull)
    }

    for (const [x, z] of [[-0.17, -0.15], [0.17, -0.15], [-0.17, 0.15], [0.17, 0.15]]) {
      const leg = taperedLeg(0.022, 0.015, legH, WOODEN('#5A4230'))
      leg.position.set(x, legH / 2, z)
      g.add(leg)
    }
    return g
  },

  bed: (it) => {
    const g = new THREE.Group()
    const m = FABRIC(it.color)
    const legH = 0.11
    const W = 1.6
    const L = 2.0

    const frame = box(W, 0.26, L, m, 0.03)
    frame.position.y = legH + 0.13
    g.add(frame)

    // The mattress bulges — that soft edge rolling over the frame is the thing
    // a stacked pair of boxes never gets.
    const mattress = cushion(W - 0.07, 0.24, L - 0.07, FABRIC('#EFEAE2'), 0.09, 0.03)
    mattress.position.y = legH + 0.37
    g.add(mattress)

    // Duvet folded back, so the bed reads as made rather than as a slab.
    const duvet = cushion(W - 0.04, 0.1, L * 0.62, FABRIC('#F6F3EC'), 0.05, 0.02)
    duvet.position.set(0, legH + 0.5, L / 2 - (L * 0.62) / 2 - 0.04)
    g.add(duvet)

    const headboard = box(W, 0.78, 0.11, m, 0.04)
    headboard.position.set(0, legH + 0.52, -L / 2 + 0.05)
    g.add(headboard)

    for (const s of [-1, 1]) {
      const pillow = cushion(0.62, 0.15, 0.36, FABRIC('#FCFBF8'), 0.075, 0.035)
      pillow.position.set(s * 0.37, legH + 0.55, -L / 2 + 0.32)
      pillow.rotation.z = s * 0.03
      g.add(pillow)
    }

    for (const [x, z] of [[-0.72, -0.92], [0.72, -0.92], [-0.72, 0.92], [0.72, 0.92]]) {
      const leg = taperedLeg(0.03, 0.021, legH, WOODEN('#5A4230'))
      leg.position.set(x, legH / 2, z)
      g.add(leg)
    }
    return g
  },

  shelf: (it) => {
    const g = new THREE.Group()
    const wood = WOODEN(it.color)
    const W = 0.9
    const D = 0.32
    const shelves = 5

    for (const s of [-1, 1]) {
      const side = box(0.035, it.h, D, wood)
      side.position.set(s * (W / 2 - 0.017), it.h / 2, 0)
      g.add(side)
    }

    // A thin back panel. Without it you see straight through to the wall and
    // the unit reads as a ladder rather than a bookcase.
    const back = box(W - 0.05, it.h, 0.012, wood)
    back.position.set(0, it.h / 2, -D / 2 + 0.008)
    g.add(back)

    const spines = ['#7A3B34', '#3E5C74', '#6E7A52', '#8A6F4E', '#4A3A4F', '#B08968', '#2E4A44']
    for (let i = 0; i < shelves; i++) {
      const y = (i * (it.h - 0.03)) / (shelves - 1)
      const board = box(W - 0.06, 0.028, D - 0.02, wood)
      board.position.y = y
      g.add(board)

      // Books, leaning slightly and never filling the shelf. A full upright row
      // looks like a wall; the gap and the lean are what make it lived in.
      if (i < shelves - 1) {
        let x = -W / 2 + 0.06
        const limit = W / 2 - 0.16 - ((i * 53) % 17) / 100
        let n = 0
        while (x < limit && n < 9) {
          const bw = 0.022 + ((i * 7 + n * 13) % 5) * 0.007
          const bh = 0.16 + ((i * 3 + n * 11) % 6) * 0.016
          const bk = box(bw, bh, D - 0.09, PAPERY(spines[(i + n) % spines.length]), 0.004)
          bk.position.set(x + bw / 2, y + 0.014 + bh / 2, 0.005)
          bk.rotation.z = n % 4 === 3 ? 0.1 : 0
          g.add(bk)
          x += bw + 0.004
          n++
        }
      }
    }
    return g
  },

  rug: (it) => {
    const g = new THREE.Group()
    const r = box(2.6, 0.03, 1.9, FABRIC(it.color))
    r.position.y = 0.015
    g.add(r)
    return g
  },

  floorlamp: (it) => {
    const g = new THREE.Group()
    const base = cyl(0.18, 0.2, 0.04, METAL(DARK), 20)
    base.position.y = 0.02
    g.add(base)
    const pole = cyl(0.02, 0.02, it.h, METAL(DARK), 10)
    pole.position.y = it.h / 2
    g.add(pole)
    const shade = cyl(0.14, 0.2, 0.24, glow(it.color, 0.9), 20)
    shade.position.y = it.h
    g.add(shade)
    const light = new THREE.PointLight(new THREE.Color(it.color), 6, 6, 2)
    light.position.set(0, it.h - 0.1, 0)
    g.add(light)
    return g
  },

  desklamp: (it) => {
    const g = new THREE.Group()
    const base = cyl(0.1, 0.11, 0.03, PLASTIC(it.color), 16)
    g.add(base)
    const arm = cyl(0.015, 0.015, 0.42, PLASTIC(it.color), 8)
    arm.position.set(0, 0.21, 0)
    arm.rotation.z = 0.3
    g.add(arm)
    const head = cyl(0.05, 0.09, 0.12, glow('#FFE3A8', 1.4), 14)
    head.position.set(-0.13, 0.42, 0)
    head.rotation.z = 0.6
    g.add(head)
    const light = new THREE.PointLight(0xffe3a8, 3, 3, 2)
    light.position.set(-0.13, 0.4, 0)
    g.add(light)
    return g
  },

  pendant: (it) => {
    const g = new THREE.Group()
    const cord = cyl(0.008, 0.008, 0.7, METAL(DARK), 6)
    cord.position.y = 0.35
    g.add(cord)
    const shade = cyl(0.06, 0.26, 0.3, glow(it.color, 0.8), 20)
    shade.position.y = -0.05
    g.add(shade)
    const light = new THREE.PointLight(0xfff0d0, 8, 8, 2)
    light.position.y = -0.15
    g.add(light)
    return g
  },

  ledstrip: (it) => {
    const g = new THREE.Group()
    const strip = box(2.4, 0.04, 0.04, glow(it.color, 2.0))
    g.add(strip)
    const light = new THREE.PointLight(new THREE.Color(it.color), 5, 7, 2)
    g.add(light)
    return g
  },

  painting: (it) => {
    const g = new THREE.Group()
    const frame = box(1.1, it.h, 0.05, WOODEN('#2B2D31'))
    g.add(frame)
    const canvas = box(1.0, it.h - 0.1, 0.02, mat(it.color, 0.8))
    canvas.position.z = 0.03
    g.add(canvas)
    return g
  },

  wallpanel: (it) => {
    const g = new THREE.Group()
    const panel = box(1.0, it.h, 0.06, it.emissive ? glow(it.color, 1.6) : FABRIC(it.color))
    g.add(panel)
    if (it.emissive) {
      const light = new THREE.PointLight(new THREE.Color(it.color), 4, 5, 2)
      light.position.z = 0.4
      g.add(light)
    }
    return g
  },

  mirror: (it) => {
    const g = new THREE.Group()
    const frame = box(0.7, it.h, 0.06, WOODEN('#8B7355'))
    frame.position.y = it.h / 2
    g.add(frame)
    const glass = box(0.62, it.h - 0.08, 0.02, mat(it.color, 0.04, 0.95, 1.5))
    glass.position.set(0, it.h / 2, 0.04)
    g.add(glass)
    return g
  },

  curtain: (it) => {
    const g = new THREE.Group()
    for (const s of [-1, 1]) {
      const panel = box(0.42, it.h, 0.08, FABRIC(it.color))
      panel.position.set(s * 0.85, it.h / 2, 0)
      g.add(panel)
    }
    const rod = cyl(0.02, 0.02, 2.4, METAL(DARK), 8)
    rod.rotation.z = Math.PI / 2
    rod.position.y = it.h
    g.add(rod)
    return g
  },

  monitor: (it) => {
    const g = new THREE.Group()
    const screen = box(1.0, 0.42, 0.04, glow('#1B3A5C', 0.35))
    screen.position.y = 0.42
    g.add(screen)
    const neck = box(0.06, 0.18, 0.06, PLASTIC(it.color))
    neck.position.y = 0.14
    g.add(neck)
    const foot = box(0.32, 0.03, 0.18, PLASTIC(it.color))
    foot.position.y = 0.02
    g.add(foot)
    return g
  },

  tower: (it) => {
    const g = new THREE.Group()
    const body = box(0.22, it.h, 0.46, METAL(it.color))
    body.position.y = it.h / 2
    g.add(body)
    const led = box(0.01, it.h - 0.12, 0.02, glow('#5CC8FF', 2.0))
    led.position.set(0.115, it.h / 2, 0.2)
    g.add(led)
    return g
  },

  tv: (it) => {
    const g = new THREE.Group()
    const screen = box(1.45, it.h, 0.06, glow('#12202E', 0.3))
    g.add(screen)
    return g
  },

  speaker: (it) => {
    const g = new THREE.Group()
    const body = box(0.24, it.h, 0.26, WOODEN(it.color))
    body.position.y = it.h / 2
    g.add(body)
    for (const y of [0.28, 0.58, 0.82]) {
      const cone = cyl(0.07, 0.07, 0.02, PLASTIC('#15171A'), 20)
      cone.rotation.x = Math.PI / 2
      cone.position.set(0, y * it.h, 0.14)
      g.add(cone)
    }
    return g
  },

  // --- bathroom -----------------------------------------------------------
  // Porcelain is the whole material story here: low roughness, no metalness,
  // and a high env response, which is what separates a sanitary fixture from a
  // white-painted box.

  toilet: (it) => {
    const g = new THREE.Group()
    const porcelain = CERAMIC('#F6F6F4')

    const pedestal = box(0.3, 0.36, 0.42, porcelain, 0.07)
    pedestal.position.set(0, 0.18, 0.04)
    g.add(pedestal)

    const bowl = cyl(0.19, 0.15, 0.15, porcelain, 22)
    bowl.scale.z = 1.2
    bowl.position.set(0, 0.42, 0.09)
    g.add(bowl)

    const seat = cyl(0.2, 0.2, 0.03, PLASTIC('#FCFCFB'), 22)
    seat.scale.z = 1.2
    seat.position.set(0, 0.51, 0.09)
    g.add(seat)

    const tank = box(0.4, 0.36, 0.16, porcelain, 0.03)
    tank.position.set(0, 0.55, -0.18)
    g.add(tank)

    const lid = box(0.42, 0.03, 0.18, porcelain, 0.012)
    lid.position.set(0, 0.745, -0.18)
    g.add(lid)

    const flush = cyl(0.026, 0.026, 0.018, METAL('#C9CDD2'), 12)
    flush.position.set(0.12, 0.765, -0.18)
    g.add(flush)
    return g
  },

  vanity: (it) => {
    const g = new THREE.Group()
    const cab = box(0.9, it.h - 0.06, 0.48, WOODEN(it.color))
    cab.position.y = (it.h - 0.06) / 2
    g.add(cab)

    const top = box(0.96, 0.06, 0.52, STONE('#EDEAE4'))
    top.position.y = it.h - 0.03
    g.add(top)

    const basin = cyl(0.17, 0.13, 0.11, CERAMIC('#FFFFFF'), 24)
    basin.position.set(0, it.h + 0.045, 0.02)
    g.add(basin)

    // A faucet is a riser plus a spout reaching back over the basin.
    const riser = cyl(0.018, 0.018, 0.2, METAL('#C9CDD2'), 12)
    riser.position.set(0, it.h + 0.1, -0.17)
    g.add(riser)
    const spout = box(0.022, 0.022, 0.15, METAL('#C9CDD2'))
    spout.position.set(0, it.h + 0.19, -0.11)
    g.add(spout)

    for (const s of [-1, 1]) {
      const pull = box(0.16, 0.02, 0.02, METAL('#C9CDD2'))
      pull.position.set(s * 0.22, it.h * 0.52, 0.25)
      g.add(pull)
    }
    return g
  },

  bathtub: (it) => {
    const g = new THREE.Group()
    const porcelain = CERAMIC('#F7F7F5')

    const shell = box(1.65, it.h, 0.75, porcelain, 0.07)
    shell.position.y = it.h / 2
    g.add(shell)

    // Sinking a slightly darker, glossier well just under the rim reads as
    // depth far more cheaply than actually hollowing the geometry would.
    const well = box(1.48, 0.1, 0.58, ENAMEL('#E4EBEE'), 0.05)
    well.position.y = it.h - 0.04
    g.add(well)

    const spout = cyl(0.021, 0.021, 0.13, METAL('#C9CDD2'), 12)
    spout.rotation.z = Math.PI / 2
    spout.position.set(-0.72, it.h + 0.07, 0)
    g.add(spout)
    return g
  },

  shower: (it) => {
    const g = new THREE.Group()

    const tray = box(0.92, 0.09, 0.92, CERAMIC('#F4F4F2'), 0.03)
    tray.position.y = 0.045
    g.add(tray)

    // Two panels meeting at a corner — enough to read as an enclosure without
    // boxing the piece in from every side.
    const front = box(0.92, it.h - 0.12, 0.018, GLASS())
    front.position.set(0, (it.h - 0.12) / 2 + 0.09, 0.45)
    g.add(front)
    const side = box(0.92, it.h - 0.12, 0.018, GLASS())
    side.rotation.y = Math.PI / 2
    side.position.set(0.45, (it.h - 0.12) / 2 + 0.09, 0)
    g.add(side)

    const riser = cyl(0.016, 0.016, it.h * 0.45, METAL('#C9CDD2'), 10)
    riser.position.set(-0.36, it.h * 0.62, -0.36)
    g.add(riser)

    const head = cyl(0.095, 0.095, 0.025, METAL('#C9CDD2'), 18)
    head.position.set(-0.3, it.h * 0.86, -0.3)
    g.add(head)
    return g
  },

  towelrack: (it) => {
    const g = new THREE.Group()
    const chrome = METAL('#C9CDD2')

    const bar = cyl(0.014, 0.014, 0.62, chrome, 10)
    bar.rotation.z = Math.PI / 2
    g.add(bar)

    for (const s of [-1, 1]) {
      const arm = box(0.02, 0.02, 0.07, chrome)
      arm.position.set(s * 0.3, 0, -0.04)
      g.add(arm)

      const towel = box(0.24, 0.44, 0.045, FABRIC(it.color))
      towel.position.set(s * 0.15, -0.22, 0.03)
      g.add(towel)
    }
    return g
  },

  // --- kitchen ------------------------------------------------------------

  counter: (it) => {
    const g = new THREE.Group()
    const w = 1.8

    const carcass = box(w, it.h - 0.05, 0.62, WOODEN(it.color))
    carcass.position.y = (it.h - 0.05) / 2
    g.add(carcass)

    const top = box(w + 0.04, 0.05, 0.66, STONE())
    top.position.y = it.h - 0.025
    g.add(top)

    // Proud door fronts with a pull each. The gap between doors is what stops a
    // cabinet run from reading as one long slab.
    for (let i = 0; i < 3; i++) {
      const x = -w / 2 + (i + 0.5) * (w / 3)
      const door = box(w / 3 - 0.035, it.h - 0.2, 0.022, WOODEN(it.color))
      door.position.set(x, (it.h - 0.05) / 2, 0.32)
      g.add(door)

      const pull = box(w / 3 - 0.22, 0.018, 0.018, METAL('#C9CDD2'))
      pull.position.set(x, it.h - 0.19, 0.345)
      g.add(pull)
    }
    return g
  },

  kitchensink: (it) => {
    const g = new THREE.Group()
    const w = 1.2

    const carcass = box(w, it.h - 0.05, 0.62, WOODEN(it.color))
    carcass.position.y = (it.h - 0.05) / 2
    g.add(carcass)

    const top = box(w + 0.04, 0.05, 0.66, STONE())
    top.position.y = it.h - 0.025
    g.add(top)

    // An inset steel basin, dropped just below the counter line.
    const basin = box(0.62, 0.14, 0.42, METAL('#AEB3B8'), 0.02)
    basin.position.set(0, it.h - 0.075, 0.02)
    g.add(basin)

    const riser = cyl(0.02, 0.02, 0.26, METAL('#C9CDD2'), 12)
    riser.position.set(0, it.h + 0.13, -0.22)
    g.add(riser)
    const neck = box(0.026, 0.026, 0.2, METAL('#C9CDD2'))
    neck.position.set(0, it.h + 0.25, -0.13)
    g.add(neck)

    const door = box(w - 0.06, it.h - 0.34, 0.022, WOODEN(it.color))
    door.position.set(0, (it.h - 0.2) / 2, 0.32)
    g.add(door)
    return g
  },

  island: (it) => {
    const g = new THREE.Group()

    const carcass = box(1.5, it.h - 0.05, 0.9, WOODEN(it.color))
    carcass.position.y = (it.h - 0.05) / 2
    g.add(carcass)

    // The overhang on one side is what makes an island an island rather than a
    // free-standing cabinet — it's where stools go.
    const top = box(1.62, 0.06, 1.06, STONE())
    top.position.set(0, it.h - 0.03, 0.06)
    g.add(top)

    for (let i = 0; i < 2; i++) {
      const x = -0.36 + i * 0.72
      const door = box(0.66, it.h - 0.22, 0.022, WOODEN(it.color))
      door.position.set(x, (it.h - 0.05) / 2, -0.46)
      g.add(door)
    }
    return g
  },

  range: (it) => {
    const g = new THREE.Group()
    const steel = METAL('#B9BDC2')

    const body = box(0.76, it.h - 0.04, 0.62, steel)
    body.position.y = (it.h - 0.04) / 2
    g.add(body)

    const cooktop = box(0.78, 0.03, 0.64, ENAMEL('#17191C'))
    cooktop.position.y = it.h - 0.02
    g.add(cooktop)

    for (const [x, z] of [[-0.18, -0.14], [0.18, -0.14], [-0.18, 0.16], [0.18, 0.16]]) {
      const burner = cyl(0.082, 0.082, 0.01, mat('#0E1013', 0.35, 0.4, 0.9), 20)
      burner.position.set(x, it.h + 0.001, z)
      g.add(burner)
    }

    const oven = box(0.68, 0.42, 0.022, ENAMEL('#1B1D21'))
    oven.position.set(0, it.h * 0.4, 0.32)
    g.add(oven)

    const handle = cyl(0.018, 0.018, 0.66, steel, 10)
    handle.rotation.z = Math.PI / 2
    handle.position.set(0, it.h * 0.68, 0.35)
    g.add(handle)
    return g
  },

  fridge: (it) => {
    const g = new THREE.Group()
    const steel = METAL('#C2C6CB')

    const body = box(0.9, it.h, 0.72, steel)
    body.position.y = it.h / 2
    g.add(body)

    // Freezer-over-fridge. The door split and two offset handles carry the read;
    // without them it's a filing cabinet.
    const split = box(0.9, 0.014, 0.02, mat('#8E9297', 0.4, 0.6, 0.8))
    split.position.set(0, it.h * 0.68, 0.36)
    g.add(split)

    for (const [y, len] of [[it.h * 0.79, 0.2], [it.h * 0.45, 0.46]]) {
      const handle = cyl(0.016, 0.016, len, METAL('#8E9297'), 10)
      handle.position.set(0.31, y, 0.375)
      g.add(handle)
    }
    return g
  },

  dishwasher: (it) => {
    const g = new THREE.Group()
    const steel = METAL('#B9BDC2')

    const body = box(0.6, it.h, 0.6, steel)
    body.position.y = it.h / 2
    g.add(body)

    const panel = box(0.56, it.h * 0.78, 0.022, ENAMEL('#1B1D21'))
    panel.position.set(0, it.h * 0.44, 0.31)
    g.add(panel)

    const handle = cyl(0.015, 0.015, 0.5, steel, 10)
    handle.rotation.z = Math.PI / 2
    handle.position.set(0, it.h * 0.9, 0.33)
    g.add(handle)
    return g
  },

  // --- dining -------------------------------------------------------------

  diningtable: (it) => {
    const g = new THREE.Group()
    const wood = WOODEN(it.color)

    const top = box(1.85, 0.055, 0.95, wood)
    top.position.y = it.h
    g.add(top)

    // The apron under the top is what stops a dining table reading as a slab on
    // sticks — it's the band every real one has between the legs.
    const apron = box(1.62, 0.09, 0.74, wood)
    apron.position.y = it.h - 0.08
    g.add(apron)

    for (const [x, z] of [[-0.8, -0.36], [0.8, -0.36], [-0.8, 0.36], [0.8, 0.36]]) {
      const leg = box(0.075, it.h - 0.055, 0.075, wood)
      leg.position.set(x, (it.h - 0.055) / 2, z)
      g.add(leg)
    }
    return g
  },

  diningchair: (it) => {
    const g = new THREE.Group()
    const wood = WOODEN('#7A5C42')
    const seatY = it.h * 0.42

    const seat = box(0.44, 0.06, 0.44, FABRIC(it.color))
    seat.position.y = seatY
    g.add(seat)

    // Slatted back — a solid panel reads as a bench, and the gaps are most of
    // what makes a dining chair look like one from across a room.
    for (let i = 0; i < 3; i++) {
      const slat = box(0.4, 0.075, 0.035, wood)
      slat.position.set(0, seatY + 0.16 + i * 0.13, -0.2)
      g.add(slat)
    }
    for (const s of [-1, 1]) {
      const post = box(0.045, it.h - seatY, 0.045, wood)
      post.position.set(s * 0.2, seatY + (it.h - seatY) / 2, -0.2)
      g.add(post)
    }

    for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
      const leg = box(0.045, seatY, 0.045, wood)
      leg.position.set(x, seatY / 2, z)
      g.add(leg)
    }
    return g
  },

  sideboard: (it) => {
    const g = new THREE.Group()
    const wood = WOODEN(it.color)
    const legH = 0.14
    const bodyH = it.h - legH

    const body = box(1.5, bodyH, 0.45, wood)
    body.position.y = legH + bodyH / 2
    g.add(body)

    for (let i = 0; i < 3; i++) {
      const x = -0.5 + i * 0.5
      const door = box(0.46, bodyH - 0.1, 0.02, wood)
      door.position.set(x, legH + bodyH / 2, 0.235)
      g.add(door)

      const pull = box(0.15, 0.018, 0.018, METAL('#C9CDD2'))
      pull.position.set(x, legH + bodyH * 0.72, 0.255)
      g.add(pull)
    }

    for (const [x, z] of [[-0.68, -0.16], [0.68, -0.16], [-0.68, 0.16], [0.68, 0.16]]) {
      const leg = box(0.05, legH, 0.05, METAL(DARK))
      leg.position.set(x, legH / 2, z)
      g.add(leg)
    }
    return g
  },

  // --- storage and odds and ends -------------------------------------------
  // These exist so ordinary words resolve to something recognisable. A dresser
  // is not a nightstand and a wardrobe is not a bookshelf, and typing either
  // used to fall through to a plain crate.

  dresser: (it) => {
    const g = new THREE.Group()
    const wood = WOODEN(it.color)
    const legH = 0.13
    const bodyH = it.h - legH

    const body = box(1.15, bodyH, 0.5, wood)
    body.position.y = legH + bodyH / 2
    g.add(body)

    const rows = 3
    for (let r = 0; r < rows; r++) {
      const y = legH + (bodyH / rows) * (r + 0.5)
      for (const s of [-1, 1]) {
        const face = box(0.52, bodyH / rows - 0.035, 0.022, wood)
        face.position.set(s * 0.28, y, 0.26)
        g.add(face)

        const pull = box(0.17, 0.018, 0.018, METAL('#C9CDD2'))
        pull.position.set(s * 0.28, y, 0.285)
        g.add(pull)
      }
    }

    for (const [x, z] of [[-0.5, -0.19], [0.5, -0.19], [-0.5, 0.19], [0.5, 0.19]]) {
      const leg = taperedLeg(0.026, 0.018, legH, WOODEN('#5A4230'))
      leg.position.set(x, legH / 2, z)
      g.add(leg)
    }
    return g
  },

  wardrobe: (it) => {
    const g = new THREE.Group()
    const wood = WOODEN(it.color)
    const legH = 0.1
    const bodyH = it.h - legH

    const body = box(1.05, bodyH, 0.6, wood)
    body.position.y = legH + bodyH / 2
    g.add(body)

    // A cornice at the top and a plinth reveal at the bottom. Both are small,
    // and both are why a wardrobe looks like joinery instead of a fridge.
    const cornice = box(1.11, 0.05, 0.65, wood)
    cornice.position.y = legH + bodyH - 0.02
    g.add(cornice)

    for (const s of [-1, 1]) {
      const door = box(0.5, bodyH - 0.13, 0.024, wood)
      door.position.set(s * 0.26, legH + bodyH / 2 - 0.03, 0.31)
      g.add(door)

      const handle = cyl(0.013, 0.013, 0.24, METAL('#C9CDD2'), 10)
      handle.position.set(s * 0.06, legH + bodyH * 0.5, 0.335)
      g.add(handle)
    }

    for (const [x, z] of [[-0.45, -0.24], [0.45, -0.24], [-0.45, 0.24], [0.45, 0.24]]) {
      const leg = taperedLeg(0.024, 0.018, legH, WOODEN('#5A4230'))
      leg.position.set(x, legH / 2, z)
      g.add(leg)
    }
    return g
  },

  stool: (it) => {
    const g = new THREE.Group()
    const seat = cyl(0.18, 0.18, 0.06, FABRIC(it.color), 20)
    seat.position.y = it.h - 0.03
    g.add(seat)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      const leg = cyl(0.016, 0.02, it.h - 0.06, METAL(DARK), 8)
      leg.position.set(Math.cos(a) * 0.12, (it.h - 0.06) / 2, Math.sin(a) * 0.12)
      leg.rotation.z = Math.cos(a) * 0.08
      leg.rotation.x = -Math.sin(a) * 0.08
      g.add(leg)
    }
    return g
  },

  bench: (it) => {
    const g = new THREE.Group()
    const seat = box(1.3, 0.08, 0.38, WOODEN(it.color))
    seat.position.y = it.h
    g.add(seat)
    for (const s of [-1, 1]) {
      const leg = box(0.07, it.h, 0.34, WOODEN(it.color))
      leg.position.set(s * 0.55, it.h / 2, 0)
      g.add(leg)
    }
    return g
  },

  /** Countertop machines — toaster, microwave, coffee maker, air fryer. */
  smallappliance: (it) => {
    const g = new THREE.Group()
    const body = box(0.44, it.h, 0.36, mat('#D8DADD', 0.35, 0.35, 0.9), 0.03)
    body.position.y = it.h / 2
    g.add(body)

    const door = box(0.34, it.h * 0.6, 0.02, ENAMEL('#1B1D21'))
    door.position.set(-0.03, it.h * 0.5, 0.19)
    g.add(door)

    const panel = box(0.06, it.h * 0.6, 0.02, mat('#2A2D31', 0.4, 0.2, 0.7))
    panel.position.set(0.17, it.h * 0.5, 0.19)
    g.add(panel)
    return g
  },

  /** Bins, hampers, baskets — anything cylindrical you drop things into. */
  bin: (it) => {
    const g = new THREE.Group()
    const body = cyl(0.2, 0.16, it.h, FABRIC(it.color), 20)
    body.position.y = it.h / 2
    g.add(body)
    const rim = cyl(0.205, 0.205, 0.03, FABRIC(it.color), 20)
    rim.position.y = it.h
    g.add(rim)
    return g
  },

  // --- laundry ------------------------------------------------------------

  washer: (it) => frontLoader(it, '#9FB3BD'),
  dryer: (it) => frontLoader(it, '#C7BFB2'),

  /**
   * Stand-in for anything we don't have a model of yet.
   *
   * Deliberately plain — a crate with a lid, sized from the piece's own height
   * and footprint. It should read as "a box standing in for something", not as
   * a broken attempt at the real product. The card that adds it says the same.
   */
  generic: (it) => {
    const g = new THREE.Group()
    const w = Math.max(0.26, (it.fp || 0.3) * 1.6)
    const d = Math.max(0.22, (it.fp || 0.3) * 1.25)

    const body = box(w, it.h, d, PLASTIC(it.color), 0.035)
    body.position.y = it.h / 2
    g.add(body)

    const lid = box(w * 0.97, 0.022, d * 0.97, WOODEN(it.color))
    lid.position.y = it.h + 0.005
    g.add(lid)
    return g
  },
}

// ---------------------------------------------------------------------------
// Room shell
// ---------------------------------------------------------------------------

function buildShell({ shape, h, colors, windows, wallMaterial }) {
  // Architecture wants crisp corners — a bevelled wall reads as a mistake, and
  // rounding the shell would also leave visible seams where planes meet.
  const box = hardBox
  const g = new THREE.Group()
  // Architectural surfaces barely reflect. Left at the default envMapIntensity
  // the environment map floods them and every palette washes out to white.
  //
  // Box UVs run 0..1 per face, so `repeat` here is "tiles across this whole
  // surface" rather than tiles per metre. Walls and floors are the largest
  // things in the scene and need far more repeats than a nightstand does.
  // The wall's construction, chosen in the survey. Brick and concrete carry
  // their own colour rather than taking the palette's wall paint — an "exposed
  // brick" wall that turns mint green in a cool palette is not exposed brick.
  // Plaster and painted boarding do take the paint, because that is what they
  // are: a surface with a colour chosen for it.
  const wm = wallMaterial || { surface: 'plaster', repeat: 5 }
  const wallMat = mat(
    wm.tint || colors.wall,
    wm.roughness ?? 0.96,
    0.0,
    0.12,
    wm.surface || 'plaster',
    wm.repeat || 5
  )
  const floorMat = mat(colors.floor, 0.72, 0.0, 0.3, 'plank', 2)
  const trimMat = mat(colors.trim, 0.7, 0.0, 0.18, 'plaster', 2)
  const ceilMat = mat(colors.trim, 0.98, 0.0, 0.1, 'plaster', 5)
  const t = 0.12

  // --- floor and ceiling, from merged cell runs --------------------------
  for (const run of floorRuns(shape)) {
    const slab = box(run.w, t, run.d, floorMat)
    slab.position.set(run.x, -t / 2, run.z)
    slab.receiveShadow = true
    slab.castShadow = false
    g.add(slab)

    const cap = box(run.w, t, run.d, ceilMat)
    cap.position.set(run.x, h + t / 2, run.z)
    g.add(cap)
  }

  // --- walls on every inside/outside boundary -----------------------------
  // The near wall (facing the camera) is left off so the room reads as a
  // dollhouse cutaway rather than a sealed box.
  const win = windows ? windowWall(shape) : null
  const bounds = shapeBounds(shape)
  const nearZ = bounds.d / 2

  for (const seg of wallRuns(shape)) {
    // Skip walls on the near edge — those are the ones we'd be looking through.
    if (seg.axis === 'x' && seg.facing === -1 && Math.abs(seg.z - nearZ) < 0.01) continue

    const isWindowWall =
      win && seg.axis === 'x' && Math.abs(seg.z - win.z) < 0.01 && Math.abs(seg.x - win.x) < 0.01

    const along = seg.axis === 'x' ? [seg.len, h, t] : [t, h, seg.len]

    if (!isWindowWall) {
      const wall = box(...along, wallMat)
      wall.position.set(seg.x, h / 2, seg.z)
      g.add(wall)
    } else {
      addWindowedWall(g, seg, h, t, { wallMat, trimMat })
    }

    // Baseboard hugging the inside face of every wall.
    const bbLen = seg.len
    const bb =
      seg.axis === 'x' ? box(bbLen, 0.09, 0.035, trimMat) : box(0.035, 0.09, bbLen, trimMat)
    bb.position.set(
      seg.x + (seg.axis === 'z' ? seg.facing * (t / 2 + 0.018) : 0),
      0.045,
      seg.z + (seg.axis === 'x' ? seg.facing * (t / 2 + 0.018) : 0)
    )
    g.add(bb)
  }

  return g
}

/** A wall run with a window opening cut into it, plus frame, glass and sky. */
function addWindowedWall(g, seg, h, t, { wallMat, trimMat }) {
  const box = hardBox
  const ww = Math.min(2.4, seg.len * 0.62)
  const sill = 0.9
  const top = Math.min(h - 0.45, sill + 1.6)
  const side = (seg.len - ww) / 2

  const below = box(seg.len, sill, t, wallMat)
  below.position.set(seg.x, sill / 2, seg.z)
  g.add(below)

  const above = box(seg.len, h - top, t, wallMat)
  above.position.set(seg.x, top + (h - top) / 2, seg.z)
  g.add(above)

  for (const s of [-1, 1]) {
    if (side <= 0.01) continue
    const pier = box(side, top - sill, t, wallMat)
    pier.position.set(seg.x + s * (ww / 2 + side / 2), sill + (top - sill) / 2, seg.z)
    g.add(pier)
  }

  const midY = sill + (top - sill) / 2
  const frame = box(ww + 0.1, top - sill + 0.1, t * 0.6, trimMat)
  frame.position.set(seg.x, midY, seg.z + seg.facing * 0.02)
  g.add(frame)

  const pane = new THREE.Mesh(
    new THREE.BoxGeometry(ww - 0.06, top - sill - 0.06, 0.02),
    new THREE.MeshPhysicalMaterial({
      color: 0xdcecf7,
      transmission: 0.85,
      transparent: true,
      opacity: 0.32,
      roughness: 0.05,
      metalness: 0,
    })
  )
  pane.position.set(seg.x, midY, seg.z)
  g.add(pane)

  // Sky card behind the glass, sized to the opening so it never peeks past the
  // wall from an exterior camera angle.
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(ww - 0.02, top - sill - 0.02),
    new THREE.MeshBasicMaterial({ color: 0xbdd9ec })
  )
  sky.position.set(seg.x, midY, seg.z - seg.facing * 0.12)
  sky.rotation.y = seg.facing > 0 ? 0 : Math.PI
  g.add(sky)
}

// ---------------------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------------------

function buildLights(scene, { shape, h, lighting, windows }) {
  const { w, d } = shapeBounds(shape)
  const added = []
  const add = (l) => {
    scene.add(l)
    added.push(l)
    return l
  }

  // Balance is everything here, and it was wrong: ambient plus a ceiling fill
  // at `fill * 12` came to more light than the key, so nothing had a lit side
  // and a shaded side. Every room rendered as a milky white box — a clay floor
  // at #b08968 came out near-white — and no palette could show through it.
  //
  // The fix is not less light overall, it is a wider gap between key and fill.
  // A room reads as three-dimensional because one direction is brighter than
  // the others; flatten that and the nicest palette in the world goes grey.
  //
  // So: ambient down by about two thirds, key up, fill down to a hint. Overcast
  // deliberately keeps its high ambient and low key, because "flat, soft,
  // shadowless grey" is what that rig is *for* — it is the one place the old
  // balance was correct.
  const rigs = {
    natural: { amb: 0.1, ambColor: 0xf3f1ea, sun: 3.0, sunColor: 0xfff6e8, fill: 0.06 },
    warm: { amb: 0.09, ambColor: 0xffd9a8, sun: 1.9, sunColor: 0xffb865, fill: 0.11 },
    cool: { amb: 0.11, ambColor: 0xe4edf7, sun: 2.6, sunColor: 0xd2e4ff, fill: 0.05 },
    moody: { amb: 0.03, ambColor: 0x5b5266, sun: 1.0, sunColor: 0xffa055, fill: 0.14 },
    golden: { amb: 0.08, ambColor: 0xffd9a0, sun: 3.4, sunColor: 0xffb95e, fill: 0.07 },
    overcast: { amb: 0.34, ambColor: 0xe8ebee, sun: 1.2, sunColor: 0xdfe6ec, fill: 0.04 },
  }
  const rig = rigs[lighting] || rigs.natural

  add(new THREE.AmbientLight(rig.ambColor, rig.amb))
  add(new THREE.HemisphereLight(rig.ambColor, 0x4a4238, rig.amb * 0.4))

  // Key light: through the window when there is one, from above when there isn't.
  const sun = new THREE.DirectionalLight(rig.sunColor, rig.sun)
  sun.position.set(windows ? -w * 0.2 : w * 0.4, h * 1.4, windows ? -d * 1.4 : d * 0.5)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.radius = 6
  sun.shadow.blurSamples = 16
  sun.shadow.bias = -0.0006
  sun.shadow.normalBias = 0.02
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far = 40
  const span = Math.max(w, d)
  sun.shadow.camera.left = -span
  sun.shadow.camera.right = span
  sun.shadow.camera.top = span
  sun.shadow.camera.bottom = -span
  add(sun)

  const fill = new THREE.PointLight(rig.sunColor, rig.fill * 12, Math.max(w, d) * 2, 2)
  fill.position.set(0, h - 0.3, d * 0.2)
  add(fill)

  return () => added.forEach((l) => scene.remove(l))
}

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

/**
 * Instantiate every entry at the coordinates the caller resolved. Each node is
 * tagged with the data the drag layer needs to move it and write it back.
 *
 * `live` is how a scene that has been torn down refuses a late upgrade. Rooms
 * are rebuilt on every palette, light and layout change, and a mesh requested
 * by the room before last can still be in the air — adding it to a disposed
 * group would leak the geometry and show nothing.
 */
/**
 * Rebuild a piece at the size the retailer says it is.
 *
 * Rebuilt rather than scaled: scaling a bookcase to 80cm wide would stretch its
 * boards and its board *thickness* with it. The builders already take `h` and
 * `fp`, so handing them the measured values and swapping the result keeps every
 * proportion the builder knows about intact.
 *
 * The node itself is never replaced, only its contents — it carries the drag
 * state and the selection, and the user may already have moved it.
 */
function resize(node, item, facts) {
  const measured = applyFacts(item, facts)
  const build = builders[item.model]
  if (!build) return

  // Nothing worth a rebuild: no size, and a colour close enough to see no
  // difference. Recolouring in place is far cheaper than rebuilding.
  const sized = measured.h !== item.h || measured.fp !== item.fp
  if (!sized) {
    if (facts.colour) {
      node.traverse((child) => {
        if (child.isMesh && child.material?.color && child.userData.tintable !== false) {
          child.material.color.set(facts.colour)
        }
      })
    }
    return
  }

  let replacement
  try {
    replacement = shadowed(build(measured))
  } catch {
    return // A builder that cannot take these numbers keeps the estimate.
  }

  for (const child of [...node.children]) {
    // Lights belong to the piece, not the geometry — a lamp that gets resized
    // must not switch off. Same reasoning as swapGeometry.
    if (child.isLight) continue
    node.remove(child)
    child.traverse?.((n) => {
      n.geometry?.dispose?.()
      if (Array.isArray(n.material)) n.material.forEach((m) => m.dispose())
      else n.material?.dispose?.()
    })
  }
  for (const child of [...replacement.children]) node.add(child)

  node.userData.radius = measured.fp || node.userData.radius
  node.userData.measured = true
}

function placeItems(group, entries, placements, live) {
  const handles = []

  for (const { key, item } of entries) {
    const build = builders[item.model]
    if (!build) continue

    const p = placements[key]
    if (!p) continue

    const node = shadowed(build(item))
    node.position.set(p.x, p.y || 0, p.z)
    node.rotation.y = p.ry || 0
    node.userData = {
      key,
      itemId: item.id,
      name: item.name,
      model: item.model,
      zone: p.zone || zoneOf(item.model),
      radius: item.fp || 0.35,
      draggable: true,
    }

    // The procedural piece is on screen from this frame. If a generated model
    // of the actual product exists or can be made, it takes over later.
    requestUpgrade(item).then((spec) => {
      if (spec && live.ok) swapGeometry(node, spec, item)
    })

    // The retailer's own measurements, which land in about a second and matter
    // whether or not a better mesh ever arrives. A bookcase keeps its
    // procedural geometry and still becomes exactly 80cm wide.
    requestFacts(item).then((facts) => {
      if (facts && live.ok) resize(node, item, facts)
    })

    group.add(node)
    handles.push(node)
  }

  return handles
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildRoom(scene, config) {
  const group = new THREE.Group()
  const shell = buildShell(config)
  shadowed(shell)
  group.add(shell)

  // Flipped by dispose(), and read by any model still being generated.
  const live = { ok: true }

  const handles = placeItems(group, config.entries, config.placements, live)
  scene.add(group)

  const disposeLights = buildLights(scene, config)

  const dispose = () => {
    live.ok = false
    disposeLights()
    scene.remove(group)
    group.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose()
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
        else o.material?.dispose()
      }
    })
  }

  return { dispose, handles, group }
}

// Superseded by three/atmosphere.js, which paints a gradient sky plus fog and
// exterior ground instead of a flat fill.
