import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createProject, parseProject, stringifyProject, ROOM_DEFAULTS } from '../shared/project.mjs'
import { readProject, writeProject } from '../desktop/files.mjs'

const state = structuredClone(ROOM_DEFAULTS)
state.onboarded = true
state.items = [{ id: 'chair', qty: 2 }]
state.customShape = { cols: 3, rows: 2, cells: ['0,0', '1,0', '2,0', '0,1'], h: 2.6 }
state.placements = { 'chair#0': { x: 1.3, y: 0, z: -0.25, ry: 1.2 } }
state.synthetics = { chair: { id: 'chair', name: 'Private chair', model: 'chair', sourceUrl: 'https://example.com/chair', wM: 0.62 } }
state.photo = { dataUrl: 'data:image/png;base64,abc', palette: ['#abcdef'] }
state._past = ['never saved']
state.reset = () => { throw new Error('must not serialize functions') }
const doc = createProject(state, { name: 'Living room — option A', client: 'Client' })
assert.deepEqual(parseProject(stringifyProject(doc)), doc)
assert.equal(doc.state._past, undefined)
assert.equal(doc.state.reset, undefined)
assert.equal(doc.state.placements['chair#0'].x, 1.3)
assert.equal(doc.state.synthetics.chair.wM, .62)
const wholeHome = structuredClone(doc)
wholeHome.state.scope = 'home'
wholeHome.state.home = { w: 6, d: 4, h: 2.6, rooms: [{ id: 'living', name: 'Living room', kind: 'living', ox: 0, oz: 0, floor: 0, ...state.customShape, items: state.items }] }
assert.deepEqual(parseProject(stringifyProject(wholeHome)).state.home, wholeHome.state.home)
for (const mutate of [d => d.version = 99, d => d.state.items[0].qty = -1, d => d.state.placements['chair#0'].x = 'bad', d => d.state.customShape.cells = ['999,0'], d => d.state.home = {}, d => d.state.reset = 'bad']) {
  const bad = structuredClone(doc); mutate(bad)
  assert.throws(() => stringifyProject(bad))
}
assert.throws(() => parseProject('{'))
assert.throws(() => parseProject(JSON.stringify(doc).replace('"state":{', '"state":{"__proto__":{},')))
const directory = await mkdtemp(join(tmpdir(), 'nested-project-test-'))
try {
  const path = join(directory, 'room.nested')
  await writeProject(path, doc)
  assert.deepEqual(await readProject(path), doc)
  const next = structuredClone(doc); next.state.placements['chair#0'].x = 2.4
  await writeProject(path, next)
  assert.deepEqual(await readProject(path), next)
  assert.deepEqual(await readProject(`${path}.bak`), doc)
  const invalid = structuredClone(doc); invalid.version = 900
  await assert.rejects(() => writeProject(path, invalid))
  assert.deepEqual(await readProject(path), next)
  assert.equal((await readdir(directory)).some(p => p.endsWith('.tmp')), false)
  assert.ok((await readFile(path, 'utf8')).includes('Living room'))
} finally { await rm(directory, { recursive: true, force: true }) }
// Room studio state: lighting controls and saved camera views round-trip,
// version 2 files (no studio state) migrate, and malformed values are refused.
const studioState = structuredClone(ROOM_DEFAULTS)
studioState.studio = { brightness: 120, sun: 42, accent: false }
studioState.views = [{ id: 'v1', name: 'By the window', roomKey: 'room', mode: 'eye', position: [1, 1.6, 2], target: [1, 1.6, 1.95], fov: 44, thumb: 'data:image/jpeg;base64,/9j/AA==' }, { id: 'v2', name: 'From above', roomKey: 'room', mode: 'overview', position: [3, 4, 5], target: [0, 0, 0], fov: 52, thumb: null }]
const studioDoc = createProject(studioState, { name: 'Studio' })
assert.deepEqual(parseProject(stringifyProject(studioDoc)).state.views, studioState.views)
assert.deepEqual(parseProject(stringifyProject(studioDoc)).state.studio, studioState.studio)
const v2file = structuredClone(studioDoc); v2file.version = 2; delete v2file.state.studio; delete v2file.state.views
const migratedStudio = parseProject(JSON.stringify(v2file))
assert.equal(migratedStudio.version, 4)
assert.equal(migratedStudio.state.brief, null)
assert.deepEqual(migratedStudio.state.studio, ROOM_DEFAULTS.studio)
assert.deepEqual(migratedStudio.state.views, [])
for (const mutate of [d => d.state.studio.brightness = 500, d => d.state.studio.sun = 120, d => d.state.studio.accent = 'yes', d => d.state.views[0].fov = 500, d => d.state.views[0].position = [1, 2], d => d.state.views[0].mode = 'orbit', d => d.state.views[1].id = 'v1', d => d.state.views[0].thumb = 'http://example.com/x.jpg', d => d.state.views[0].name = '']) {
  const bad = structuredClone(studioDoc); mutate(bad)
  assert.throws(() => stringifyProject(bad))
}
console.log('Project round trip, validation, backup and failed-write preservation passed')
