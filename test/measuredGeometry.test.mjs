import assert from 'node:assert/strict'
import * as THREE from 'three'
import { newBrief, compileBrief } from '../shared/brief.mjs'
import { buildMeasuredShell } from '../src/three/measuredShell.js'

// Independent expectations for a measured L-shaped room and a room with a diagonal wall:
// footprint area by the shoelace formula, true cut-outs at computed world positions, feet == metres.
const shoelace = (p) => Math.abs(p.reduce((a, v, i) => { const q = p[(i + 1) % p.length]; return a + v.x * q.z - q.x * v.z }, 0)) / 2
const base = (units) => {
  const d = newBrief(); d.units = units
  d.project = { name: 'Geometry', client: 'Test', studio: 'Test', designer: 'Test' }
  d.plan.layoutVerified = true; d.review = { approved: true, reviewedBy: 'Test', date: '2026-09-30' }
  return d
}
const FT = 1 / 0.3048
const scale = (v, units) => (units === 'ft' ? v * FT : v)
const room = (d, units, spec) => Object.assign(d.rooms[0], {
  name: spec.name, kind: 'living', x: 0, z: 0, width: scale(spec.w, units), depth: scale(spec.d, units), height: scale(2.7, units),
  measurementSource: 'Designer measured', geometryVerified: true, openingsVerified: true,
  outline: spec.outline.map(([x, z]) => ({ x: scale(x, units), z: scale(z, units) })),
  openings: spec.openings.map((o) => ({ ...o, offset: scale(o.offset, units), width: scale(o.width, units), height: scale(o.height, units), sill: scale(o.sill, units) })),
})
const L = { name: 'L room', w: 6, d: 5, outline: [[0, 0], [6, 0], [6, 2], [3.5, 2], [3.5, 5], [0, 5]],
  openings: [{ id: 'w1', edge: 3, type: 'window', offset: 0.5, width: 1.2, height: 1.2, sill: 0.9 }, { id: 'd1', edge: 0, type: 'door', offset: 1, width: 0.9, height: 2.1, sill: 0 }] }
const DIAG = { name: 'Diagonal room', w: 5, d: 4.5, outline: [[0, 0], [5, 0], [5, 3], [2, 4.5], [0, 4.5]],
  openings: [{ id: 'd2', edge: 2, type: 'door', offset: 1, width: 0.9, height: 2.1, sill: 0 }] }

const compile = (spec, units) => { const d = base(units); room(d, units, spec); return compileBrief(d).rooms[0] }

// 1. L-shape footprint: area is the polygon's, not the bounding rectangle's; feet and metres agree.
for (const units of ['m', 'ft']) {
  const shape = compile(L, units)
  assert.ok(Math.abs(shoelace(shape.footprint) - 22.5) < 1e-6, `${units}: footprint area ${shoelace(shape.footprint)}`)
  assert.ok(Math.abs(shape.exactW - 6) < 1e-6 && Math.abs(shape.exactD - 5) < 1e-6, `${units}: bounds ${shape.exactW} x ${shape.exactD}`)
  assert.ok(Math.abs(shape.h - 2.7) < 1e-6)
  const edges = shape.footprint.map((p, i) => { const q = shape.footprint[(i + 1) % shape.footprint.length]; return Math.hypot(q.x - p.x, q.z - p.z) })
  const expected = [6, 2, 2.5, 3, 3.5, 5]
  expected.forEach((e, i) => assert.ok(Math.abs(edges[i] - e) < 1e-6, `${units}: edge ${i} is ${edges[i]}`))
}

// 2. The floor mesh covers exactly the L.
const shapeL = compile(L, 'm')
const shell = buildMeasuredShell({ shape: shapeL, cutaway: false })
const floor = shell.children.find((x) => x.userData.measuredFloor)
const pos = floor.geometry.attributes.position, idx = floor.geometry.index
let area = 0
const v = (i) => new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i))
const tri = idx ? Array.from({ length: idx.count / 3 }, (_, k) => [idx.getX(3 * k), idx.getX(3 * k + 1), idx.getX(3 * k + 2)]) : Array.from({ length: pos.count / 3 }, (_, k) => [3 * k, 3 * k + 1, 3 * k + 2])
for (const [a, b, c] of tri) area += new THREE.Triangle(v(a), v(b), v(c)).getArea()
assert.ok(Math.abs(area - 22.5) < 1e-6, `floor mesh area ${area}`)

// 3. Openings are really empty at their computed world position and solid just outside their span.
shell.updateMatrixWorld(true)
const solidAt = (group, point) => {
  let hit = false
  group.traverse((m) => {
    if (!m.isMesh || m.material?.transparent) return
    m.geometry.computeBoundingBox()
    if (m.geometry.boundingBox.containsPoint(m.worldToLocal(point.clone()))) hit = true
  })
  return hit
}
const wallOf = (g, edge) => g.children.find((x) => x.userData.measuredEdge === edge)
const worldSpan = (shape, edge, offset, width) => {
  const a = shape.footprint[edge], b = shape.footprint[(edge + 1) % shape.footprint.length], len = Math.hypot(b.x - a.x, b.z - a.z)
  const d = { x: (b.x - a.x) / len, z: (b.z - a.z) / len }
  return { at: (t) => ({ x: a.x + d.x * t, z: a.z + d.z * t }), n: { x: -d.z, z: d.x }, offset, width }
}
const across = [-0.04, -0.02, 0, 0.02, 0.04]
function checkOpening(shell, shape, edge, o, yMid, yBelowSill) {
  const s = worldSpan(shape, edge, o.offset, o.width), wall = wallOf(shell, edge)
  for (const k of across) for (const t of [o.offset + o.width * 0.25, o.offset + o.width * 0.5, o.offset + o.width * 0.75]) {
    const p = s.at(t)
    assert.equal(solidAt(wall, new THREE.Vector3(p.x + s.n.x * k, yMid, p.z + s.n.z * k)), false, `edge ${edge}: opening must be empty at t=${t.toFixed(2)} across ${k}`)
  }
  for (const t of [o.offset - 0.15, o.offset + o.width + 0.15]) {
    const p = s.at(t)
    assert.equal(solidAt(wall, new THREE.Vector3(p.x + s.n.x * 0.05, yMid, p.z + s.n.z * 0.05)) || solidAt(wall, new THREE.Vector3(p.x - s.n.x * 0.05, yMid, p.z - s.n.z * 0.05)), true, `edge ${edge}: wall beside the opening at t=${t.toFixed(2)} must be solid`)
  }
  if (yBelowSill !== null) {
    const p = s.at(o.offset + o.width / 2)
    assert.equal(solidAt(wall, new THREE.Vector3(p.x + s.n.x * 0.05, yBelowSill, p.z + s.n.z * 0.05)) || solidAt(wall, new THREE.Vector3(p.x - s.n.x * 0.05, yBelowSill, p.z - s.n.z * 0.05)), true, `edge ${edge}: wall below a window sill must be solid`)
  }
}
checkOpening(shell, shapeL, 3, L.openings[0], 0.9 + 0.6, 0.45)
checkOpening(shell, shapeL, 0, L.openings[1], 1.0, null)

const shapeD = compile(DIAG, 'm')
assert.ok(Math.abs(shoelace(shapeD.footprint) - (5 * 3 + (3 + 4.5) / 2 * 0 + 0)) > 0) // sanity: not a rectangle
const expectedArea = shoelace([[0, 0], [5, 0], [5, 3], [2, 4.5], [0, 4.5]].map(([x, z]) => ({ x, z })))
assert.ok(Math.abs(shoelace(shapeD.footprint) - expectedArea) < 1e-6)
const shellD = buildMeasuredShell({ shape: shapeD, cutaway: false }); shellD.updateMatrixWorld(true)
checkOpening(shellD, shapeD, 2, DIAG.openings[0], 1.0, null)
assert.ok(Math.abs(Math.hypot(shapeD.footprint[3].x - shapeD.footprint[2].x, shapeD.footprint[3].z - shapeD.footprint[2].z) - Math.hypot(3, 1.5)) < 1e-6)
console.log('Measured L-shape and diagonal-wall geometry: areas, edge lengths, feet/metres equality and world-position cut-outs passed.')
