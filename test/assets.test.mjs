import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { inspectGlb, glbBounds, placedDimensions, compareDimensions, unitHint, createAssetRecord, validateAssetRecord } from '../shared/assets.mjs'
import { createProject, parseProject, stringifyProject, ROOM_DEFAULTS, PROJECT_VERSION } from '../shared/project.mjs'

const fixture = new Uint8Array(await readFile(new URL('./fixtures/nested-side-table.glb', import.meta.url)))
const info = inspectGlb(fixture)
assert.equal(info.materials, 3)
assert.deepEqual(info.materialNames, ['Oak veneer (fixture)', 'Blackened steel (fixture)', 'Clear glass (fixture)'])
assert.equal(info.textures, 2)
assert.equal(info.meshes, 3)
assert.equal(info.texCoords, true)
assert.deepEqual(info.extensionsUsed, ['KHR_materials_transmission'])
// Authored root offset (0.2, 0, -0.1) is reflected in bounds, size is not.
assert.deepEqual(info.bounds.size, [0.6, 0.5, 0.6])
assert.deepEqual(info.bounds.min, [-0.1, 0, -0.4])

// --- rejection cases: a readable error, never a partial import -------------
const glbWith = (json) => {
  const body = Buffer.from(JSON.stringify(json).padEnd(Math.ceil(JSON.stringify(json).length / 4) * 4, ' '))
  const out = Buffer.alloc(20 + body.length)
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8)
  out.writeUInt32LE(body.length, 12); out.writeUInt32LE(0x4e4f534a, 16); body.copy(out, 20)
  return new Uint8Array(out)
}
const mesh = { meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], accessors: [{ count: 3, min: [0, 0, 0], max: [1, 1, 1] }] }
assert.ok(inspectGlb(glbWith({ asset: { version: '2.0' }, ...mesh })))
assert.throws(() => inspectGlb(new Uint8Array(40)), /not a binary glTF/)
assert.throws(() => inspectGlb(fixture.subarray(0, fixture.length - 4)), /length does not match/)
assert.throws(() => inspectGlb(glbWith({ asset: { version: '2.0' }, ...mesh, images: [{ uri: 'wood.png' }] })), /external files/)
assert.throws(() => inspectGlb(glbWith({ asset: { version: '2.0' }, ...mesh, extensionsRequired: ['KHR_draco_mesh_compression'] })), /KHR_draco_mesh_compression/)
assert.throws(() => inspectGlb(glbWith({ asset: { version: '1.0' }, ...mesh })), /2\.0/)
assert.throws(() => inspectGlb(glbWith({ asset: { version: '2.0' } })), /no meshes/)

// Node transforms: a 90° turn about Y swaps X and Z extents.
const turned = glbBounds({ scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2] }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], accessors: [{ min: [-1, 0, -0.25], max: [1, 0.5, 0.25] }] })
assert.deepEqual(turned.size, [0.5, 0.5, 2])

// --- units, orientation and dimension checks ------------------------------
assert.deepEqual(placedDimensions([60, 50, 40], 'cm', 0), { w: 0.6, d: 0.4, h: 0.5 })
assert.deepEqual(placedDimensions([0.6, 0.5, 0.4], 'm', 90), { w: 0.4, d: 0.6, h: 0.5 })
assert.throws(() => placedDimensions([1, 1, 1], 'furlongs', 0))
assert.throws(() => placedDimensions([1, 1, 1], 'm', 45))
assert.equal(compareDimensions({ w: 0.6, d: 0.6, h: 0.5 }, null), null)
const check = compareDimensions({ w: 0.6, d: 0.6, h: 0.5 }, { w: 0.605, d: null, h: 0.52 })
assert.equal(check.axes.w.within, true)
assert.equal(check.axes.d, null) // unknown stays unknown
assert.equal(check.axes.h.within, false)
assert.equal(check.within, false)
assert.match(unitHint([180, 85, 90]), /centimetres/)
assert.equal(unitHint([1.8, 0.85, 0.9]), null)

// --- project records ------------------------------------------------------
const id = 'a'.repeat(64)
const record = createAssetRecord({ id, fileName: 'nested-side-table.glb', bytes: fixture.length, inspection: info }, new Date('2026-09-28T12:00:00Z'))
assert.equal(record.units, 'm')
assert.equal(record.scope, 'private')
assert.deepEqual(record.provenance, { source: '', rights: '' })
assert.equal(record.spec, null)
for (const mutate of [r => r.id = 'nope', r => r.units = 'ft', r => r.rotateY = 45, r => r.size = [1, 0, 1], r => r.scope = 'catalog', r => r.extra = 1, r => r.spec = { w: -1, d: null, h: null }]) {
  const bad = structuredClone(record); mutate(bad)
  assert.throws(() => validateAssetRecord(bad))
}

const state = structuredClone(ROOM_DEFAULTS)
state.assets = { [id]: record }
state.synthetics = { 'asset-aaaaaaaaaaaaaaaa': { id: 'asset-aaaaaaaaaaaaaaaa', assetId: id, name: 'Side table', model: 'asset', h: 0.5, fp: 0.3, price: null } }
state.items = [{ id: 'asset-aaaaaaaaaaaaaaaa', qty: 2 }]
const doc = createProject(state, { name: 'Imported model room' })
assert.equal(doc.version, PROJECT_VERSION)
assert.deepEqual(parseProject(stringifyProject(doc)), doc)
const orphan = structuredClone(doc); orphan.state.assets = {}
assert.throws(() => stringifyProject(orphan), /missing asset record/)
const rekeyed = structuredClone(doc); rekeyed.state.assets = { ['b'.repeat(64)]: record }
assert.throws(() => stringifyProject(rekeyed), /checksum/)

// A version 1 file (before imports existed) opens with an empty asset list.
const v1 = structuredClone(createProject(structuredClone(ROOM_DEFAULTS), { name: 'Old file' }))
v1.version = 1
delete v1.state.assets
const migrated = parseProject(JSON.stringify(v1))
assert.equal(migrated.version, PROJECT_VERSION)
assert.deepEqual(migrated.state.assets, {})
// Future versions are still refused rather than guessed at.
assert.throws(() => parseProject(JSON.stringify({ ...v1, version: 3 })))
console.log('GLB inspection, unit/orientation handling, asset records and v1 migration passed')
