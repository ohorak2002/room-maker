import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { photoMaterial, boxUV, axialUV } from './photoMaterials'
import { MATERIAL_SETS, PILOT_MATERIALS } from '../data/materialSources'

/**
 * The material pilot: one sofa and one round coffee table, built with separate
 * material groups (upholstery, piping, wooden legs/top, brass hardware) and
 * photographic Poly Haven maps at their published physical scale. These are
 * concept pieces: the maps stand for "a grey wool-blend upholstery" and "oak",
 * not for any retailer's cloth or timber. Only catalog entries that name
 * `materialSet: 'pilot'` come here; every other piece keeps its old builder.
 */

const FABRIC_TILE = MATERIAL_SETS[PILOT_MATERIALS.upholstery].tile
const WOOD_TILE = MATERIAL_SETS[PILOT_MATERIALS.wood].tile

const mesh = (geo, mat, name) => {
  const m = new THREE.Mesh(geo, mat)
  m.name = name
  return m
}

const upholstery = () => photoMaterial(PILOT_MATERIALS.upholstery, { sheen: 0.35, sheenColor: 0xcfcac2, normalScale: 0.9, env: 0.25 })
// Piping is bias-cut cloth: same set, a touch darker, its own material.
const piping = () => photoMaterial(PILOT_MATERIALS.upholstery, { color: 0xc9c5bd, normalScale: 0.9, env: 0.25 })
// Stained oak: the veneer's own grain and roughness, tinted darker for the sofa legs.
const stainedOak = () => photoMaterial(PILOT_MATERIALS.wood, { color: 0x9c7a5a, env: 0.3, specular: 0.6 })
const brass = () =>
  new THREE.MeshStandardMaterial({ color: 0xd4b06a, metalness: 1, roughness: 0.38, envMapIntensity: 1.8 })

/**
 * A padded block: a densely subdivided box, rounded, then domed and creased.
 * RoundedBoxGeometry only subdivides its corners, so its flat faces have no
 * vertices for a bulge to act on and read as hard-edged panels. Here every
 * face has vertices, positions are merged so normals are smooth across the
 * round-over, and `bulge` swells each face between its seams.
 */
function softBox(w, h, d, r, { bulge = 0, crease = 0, seed = 0, step = 0.03 } = {}) {
  const rr = Math.min(r, w / 2.05, h / 2.05, d / 2.05)
  const seg = (len) => Math.max(4, Math.round(len / step))
  let geo = new THREE.BoxGeometry(w, h, d, seg(w), seg(h), seg(d))
  const pos = geo.attributes.position
  const hx = w / 2, hy = h / 2, hz = d / 2
  const clampTo = (v, lim) => Math.max(-lim, Math.min(lim, v))
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const ix = clampTo(x, hx - rr), iy = clampTo(y, hy - rr), iz = clampTo(z, hz - rr)
    const dx = x - ix, dy = y - iy, dz = z - iz
    const len = Math.hypot(dx, dy, dz)
    if (len > 1e-6) { x = ix + (dx / len) * rr; y = iy + (dy / len) * rr; z = iz + (dz / len) * rr }
    if (bulge || crease) {
      const fx = 1 - Math.min(1, Math.abs(x) / hx) ** 2
      const fy = 1 - Math.min(1, Math.abs(y) / hy) ** 2
      const fz = 1 - Math.min(1, Math.abs(z) / hz) ** 2
      const nx = x + Math.sign(x) * bulge * fy * fz
      const ny = y + Math.sign(y) * (bulge * fx * fz + crease * Math.sin(x * 21 + seed) * Math.sin(z * 15 + seed * 1.7) * fx * fz)
      const nz = z + Math.sign(z) * (bulge * fx * fy + crease * 0.6 * Math.sin(y * 19 + seed * 2.3) * Math.sin(x * 13 + seed) * fx * fy)
      x = nx; y = ny; z = nz
    }
    pos.setXYZ(i, x, y, z)
  }
  geo.deleteAttribute('normal')
  geo.deleteAttribute('uv')
  geo = mergeVertices(geo, 1e-5)
  geo.computeVertexNormals()
  return geo
}

/** Points of a rounded rectangle, counter-clockwise, in a 2D plane. */
function roundedRect(hw, hh, cr, perCorner = 8) {
  const pts = []
  const corners = [[hw - cr, hh - cr, 0], [-hw + cr, hh - cr, 0.5], [-hw + cr, -hh + cr, 1], [hw - cr, -hh + cr, 1.5]]
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= perCorner; i++) {
      const a = (start + (i / perCorner) * 0.5) * Math.PI
      pts.push([cx + Math.cos(a) * cr, cy + Math.sin(a) * cr])
    }
  }
  return pts
}

/** A thin piping cord along a closed or open path, with UVs in real tile units. */
function cord(points3, radius, closed, tile) {
  const curve = new THREE.CatmullRomCurve3(points3, closed, 'centripetal')
  const geo = new THREE.TubeGeometry(curve, Math.max(32, points3.length * 3), radius, 6, closed)
  const len = curve.getLength()
  const uv = geo.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * len) / tile[0], (uv.getY(i) * Math.PI * 2 * radius) / tile[1])
  return geo
}

// ---------------------------------------------------------------------------
// Sofa
// ---------------------------------------------------------------------------

export function pilotSofa(options = {}) {
  const g = new THREE.Group()
  g.userData.materialSet = 'pilot'
  const U = upholstery()
  const P = piping()
  const legMat = stainedOak()
  const H = brass()
  g.userData.materials = { upholstery: U, piping: P, legs: legMat, hardware: H }

  const W = 2.1, D = 0.92, legH = options.lowFeet ? 0.055 : 0.13
  const fabricUV = (geo, offset = [0, 0]) => boxUV(geo, FABRIC_TILE, { top: 'z', sides: 'y', offset })

  // Frame the cushions sit in.
  // The frame runs between the arms (which are full-height blocks), so no
  // rounded frame corner is left showing where an arm meets it.
  const armW = 0.17
  const baseTop = legH + 0.2
  const base = mesh(fabricUV(softBox(W - 2 * armW + 0.03, 0.2, D, 0.04, { bulge: 0.006 })), U, 'base')
  base.position.y = legH + 0.1
  g.add(base)

  // Back rail behind the back cushions.
  const rail = mesh(fabricUV(softBox(W - 0.3, 0.46, 0.13, 0.05), [0.3, 0.1]), U, 'back-rail')
  rail.position.set(0, baseTop + 0.23, -D / 2 + 0.065)
  g.add(rail)

  // Three seat cushions with a real gap between them.
  const seatW = (W - 2 * armW) / 3
  const seatD = D - 0.2
  const seatH = 0.17
  const seatY = baseTop + seatH / 2 - 0.012
  for (let i = 0; i < 3; i++) {
    const w = seatW - 0.014
    const geo = fabricUV(softBox(w, seatH, seatD, 0.065, { bulge: 0.03, crease: 0.006, seed: i * 2.1 }), [i * 0.21, i * 0.13])
    const c = mesh(geo, U, `seat-${i}`)
    c.position.set((i - 1) * seatW, seatY, 0.05)
    g.add(c)

    // Piping cord round the top edge of the cushion, sitting in its round-over.
    const path = roundedRect(w / 2 - 0.012, seatD / 2 - 0.012, 0.05).map(([a, b]) => new THREE.Vector3(a, seatH / 2 - 0.02, b))
    const p = mesh(cord(path, 0.0065, true, FABRIC_TILE), P, `seat-piping-${i}`)
    p.position.set((i - 1) * seatW, seatY, 0.05)
    g.add(p)
  }

  // Back cushions, leaning back and proud of the rail.
  const backH = 0.4
  const backD = 0.19
  const backTilt = -0.13
  for (let i = 0; i < 3; i++) {
    const w = seatW - 0.02
    const geo = fabricUV(softBox(w, backH, backD, 0.07, { bulge: 0.036, crease: 0.006, seed: 7 + i * 1.9 }), [i * 0.19, 0.4 + i * 0.17])
    const b = mesh(geo, U, `back-${i}`)
    b.position.set((i - 1) * seatW, baseTop + seatH - 0.02 + backH / 2, -D / 2 + backD / 2 + 0.085)
    b.rotation.x = backTilt
    g.add(b)

    const path = roundedRect(w / 2 - 0.012, backH / 2 - 0.012, 0.05).map(([a, b2]) => new THREE.Vector3(a, b2, backD / 2 - 0.02))
    const p = mesh(cord(path, 0.0065, true, FABRIC_TILE), P, `back-piping-${i}`)
    p.position.copy(b.position)
    p.rotation.x = backTilt
    g.add(p)
  }

  // Rolled arms: deeply rounded blocks, with piping along the front face.
  for (const s of [-1, 1]) {
    const armH = 0.52
    const arm = mesh(fabricUV(softBox(armW, armH, D, 0.075, { bulge: 0.012, crease: 0.003, seed: s }), [s * 0.3, 0.55]), U, `arm-${s > 0 ? 'right' : 'left'}`)
    const ax = s * (W / 2 - armW / 2)
    arm.position.set(ax, legH + 0.02 + armH / 2, 0)
    g.add(arm)
  }

  // Front-top edge of the frame: a straight piping run.
  const run = cord([new THREE.Vector3(-W / 2 + 0.2, baseTop - 0.02, D / 2 - 0.006), new THREE.Vector3(0, baseTop - 0.02, D / 2 - 0.006), new THREE.Vector3(W / 2 - 0.2, baseTop - 0.02, D / 2 - 0.006)], 0.0065, false, FABRIC_TILE)
  g.add(mesh(run, P, 'frame-piping'))

  // Legs: stained oak, splayed slightly, with a brass mounting plate and foot cap.
  let k = 0
  for (const [x, z] of [[-0.92, -0.34], [0.92, -0.34], [-0.92, 0.34], [0.92, 0.34]]) {
    const sx = Math.sign(x), sz = Math.sign(z)
    const topR = 0.029, botR = 0.019
    const geo = new THREE.CylinderGeometry(topR, botR, legH, 20)
    axialUV(geo, WOOD_TILE, (topR + botR) / 2, [k * 0.37, k * 0.23])
    const splay = 0.09
    const leg = mesh(geo, legMat, `leg-${k}`)
    leg.position.set(x + sx * 0.012, legH / 2, z + sz * 0.012)
    // Bottom of the leg swings outward from the frame.
    leg.rotation.z = sx * splay
    leg.rotation.x = -sz * splay
    g.add(leg)

    const plate = mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.005, 24), H, `leg-plate-${k}`)
    plate.position.set(x, legH + 0.0025, z)
    g.add(plate)
    const foot = (legH / 2) * Math.sin(splay)
    const cap = mesh(new THREE.CylinderGeometry(0.0205, 0.0205, 0.012, 16), H, `leg-cap-${k}`)
    cap.position.set(x + sx * (0.012 + foot), 0.006, z + sz * (0.012 + foot))
    g.add(cap)
    k++
  }
  return g
}

// ---------------------------------------------------------------------------
// Round coffee table
// ---------------------------------------------------------------------------

export function pilotTable(it) {
  const g = new THREE.Group()
  g.userData.materialSet = 'pilot'
  const h = it.h || 0.42
  const R = 0.5
  const thick = 0.04

  // Face grain everywhere, with vertex colour darkening the rim where the cut
  // runs across the grain (end grain absorbs more finish and reads darker).
  const top = photoMaterial(PILOT_MATERIALS.wood, { color: 0xe3cba8, env: 0.3, normalScale: 0.4, specular: 0.22 })
  top.vertexColors = true
  const rim = top
  const wood = photoMaterial(PILOT_MATERIALS.wood, { color: 0xd9c19c, env: 0.3, normalScale: 0.4, specular: 0.22 })
  const endGrain = photoMaterial(PILOT_MATERIALS.wood, { color: 0x8a6d4e, env: 0.2, normalScale: 0.5, specular: 0.4 })
  const H = brass()
  g.userData.materials = { top, apron: wood, legs: wood, endGrain, hardware: H }

  // Top: a chamfered-then-rounded profile, so edge highlights read as an edge.
  const profile = []
  const bev = 0.009
  // Rings across the flat faces keep the face normal straight up/down until the
  // last few millimetres; a bare centre-to-rim fan blends toward the bevel and
  // makes the whole top read as a shallow dish.
  profile.push([0, h])
  for (const f of [0.25, 0.5, 0.75, 0.9]) profile.push([R * f, h])
  profile.push([R - bev - 0.004, h])
  for (let i = 0; i <= 5; i++) {
    const a = (i / 5) * (Math.PI / 2)
    profile.push([R - bev + Math.sin(a) * bev, h - bev + Math.cos(a) * bev])
  }
  for (let i = 0; i <= 5; i++) {
    const a = (i / 5) * (Math.PI / 2)
    profile.push([R - bev + Math.cos(a) * bev, h - thick + bev - Math.sin(a) * bev])
  }
  profile.push([R - bev - 0.004, h - thick])
  for (const f of [0.9, 0.75, 0.5, 0.25]) profile.push([R * f, h - thick])
  profile.push([0, h - thick])
  // Lathe faces are outward only when the profile runs bottom to top (verified: reversed order gave top normals of -Y).
  const lathe = new THREE.LatheGeometry(profile.slice().reverse().map(([x, y]) => new THREE.Vector2(Math.max(x, 1e-4), y)), 128)
  lathe.computeVertexNormals()
  // Board grain runs along Z on top; long-grain edges follow it, end grain is darkened.
  boxUV(lathe, WOOD_TILE, { top: 'z', sides: 'h', offset: [0.21, 0.37] })
  const nrm = lathe.attributes.normal
  const col = new Float32Array(nrm.count * 3)
  for (let i = 0; i < nrm.count; i++) {
    const across = Math.max(0, Math.min(1, (Math.abs(nrm.getZ(i)) - 0.5) / 0.45)) * (1 - Math.abs(nrm.getY(i)))
    const f = 1 - 0.3 * across * across * (3 - 2 * across)
    col.set([f, f, f], i * 3)
  }
  lathe.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.add(mesh(lathe, rim, 'top'))

  // Apron ring under the top, grain following the ring.
  const apronR = 0.42
  const apronGeo = new THREE.CylinderGeometry(apronR, apronR, 0.055, 96, 1, true)
  axialUV(apronGeo, WOOD_TILE, apronR, [0.6, 0.1], true)
  const apron = mesh(apronGeo, wood, 'apron')
  apron.material.side = THREE.DoubleSide
  apron.position.y = h - thick - 0.0275
  g.add(apron)

  // Four splayed legs, each with its own patch of grain, a brass bracket where
  // it meets the apron, and a brass foot cap.
  const topY = h - thick - 0.03
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2
    const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a))
    const topP = dir.clone().multiplyScalar(0.355).setY(topY)
    const botP = dir.clone().multiplyScalar(0.405).setY(0.012)
    const axis = topP.clone().sub(botP)
    const len = axis.length()
    const geo = new THREE.CylinderGeometry(0.03, 0.019, len, 20)
    axialUV(geo, WOOD_TILE, 0.024, [0.13 + k * 0.29, 0.05 + k * 0.41])
    const leg = new THREE.Mesh(geo, [wood, endGrain, endGrain])
    leg.name = `leg-${k}`
    leg.userData.materialGroups = ['side', 'end grain', 'end grain']
    leg.position.copy(topP).add(botP).multiplyScalar(0.5)
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize())
    g.add(leg)

    const bracket = mesh(new RoundedBoxGeometry(0.058, 0.05, 0.007, 3, 0.002), H, `bracket-${k}`)
    bracket.position.copy(dir).multiplyScalar(apronR + 0.0035).setY(h - thick - 0.03)
    bracket.rotation.y = a
    g.add(bracket)
    for (const dy of [-0.014, 0.014]) {
      const screw = mesh(new THREE.CylinderGeometry(0.0038, 0.0038, 0.004, 10), H, `screw-${k}`)
      screw.position.copy(bracket.position).setY(bracket.position.y + dy).addScaledVector(dir, 0.005)
      screw.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
      g.add(screw)
    }
    const cap = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 16), H, `foot-${k}`)
    cap.position.copy(botP).setY(0.006)
    g.add(cap)
  }
  return g
}
