import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseBrief, compileBrief, briefFingerprint } from '../shared/brief.mjs'
import { createProject, parseProject, stringifyProject, ROOM_DEFAULTS, PROJECT_VERSION } from '../shared/project.mjs'

// The Upload Brief flow inside a desktop project: import, save, reopen, refuse tampering.
const sample = parseBrief(readFileSync(new URL('../examples/sample-home.nested-brief.json', import.meta.url), 'utf8'))
assert.deepEqual(sample.errors, [])
const fingerprint = await briefFingerprint(sample.doc)
assert.equal(PROJECT_VERSION, 4)

// What importOfficialBrief() stores (the store itself is not importable in plain
// Node; scripts/desktop-smoke.mjs drives it in the real app).
const measured = (source) => ({ ...structuredClone(ROOM_DEFAULTS), home: compileBrief(source), scope: 'home', onboarded: true, brief: { fingerprint, source } })
let state = measured(sample.doc)
assert.deepEqual(state.items, []); assert.deepEqual(state.home.rooms[0].items, []) // nothing is furnished for the designer
state.home.rooms[0].items = [{ id: 'sofa', qty: 1 }]
state.placements = { 'room-1:sofa#0': { x: 1, y: 0, z: 2, ry: 0 } }
state.focusedRoom = 'room-1'
// Saved and reopened: identical geometry, furniture and Brief.
const doc = createProject(state, { name: 'Sample', client: 'Client' })
const reopened = parseProject(stringifyProject(doc))
assert.equal(reopened.state.brief.fingerprint, fingerprint)
assert.equal(reopened.state.home.rooms[0].items[0].id, 'sofa')

// Migration: a v3 file has no Brief and stays a normal project.
const v3 = createProject(structuredClone(ROOM_DEFAULTS), { name: 'Old' }); v3.version = 3; delete v3.state.brief
assert.equal(parseProject(JSON.stringify(v3)).state.brief, null)

// Refusals: a project cannot carry measured rooms that differ from its Brief.
const refuse = (mutate, label) => { const bad = structuredClone(doc); mutate(bad); assert.throws(() => stringifyProject(bad), undefined, label) }
refuse(d => d.state.home.rooms[0].exactW = 9, 'changed width')
refuse(d => d.state.home.rooms[0].openings.push({ id: 'x', type: 'door', edge: 0, offset: 0.1, width: 0.5, height: 2, sill: 0 }), 'invented opening')
refuse(d => d.state.home.rooms[0].surfaces.wallColor = '#000000', 'changed finish')
refuse(d => d.state.brief = null, 'measured rooms without a Brief')
refuse(d => d.state.brief.source.rooms[0].width = 6, 'edited Brief no longer matches its rooms')
refuse(d => d.state.brief.source.review.approved = false, 'unapproved Brief')
refuse(d => d.state.brief.fingerprint = 'abc', 'bad fingerprint')
refuse(d => d.state.brief.extra = 1, 'unknown field')
{ const noHome = structuredClone(doc); noHome.state.home = null; noHome.state.scope = 'room'; assert.throws(() => stringifyProject(noHome)) }

console.log('Brief projects: import shape, no auto-furnishing, save/reopen, migration and tamper refusal passed')
