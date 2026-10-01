import assert from 'node:assert/strict'
import { PILOT_PRODUCTS, pilotState } from '../src/data/referencePilot.js'
import { ROOM_DEFAULTS, createProject, stringifyProject, parseProject } from '../shared/project.mjs'

const initial = { ...structuredClone(ROOM_DEFAULTS), ...pilotState() }
const document = createProject(initial, { name: 'Reference pilot' })
const reopened = parseProject(stringifyProject(document))
assert.equal(reopened.state.customShape.exactW, 4.5)
assert.equal(reopened.state.customShape.exactD, 3.8)
assert.equal(reopened.state.items.length, 5)
assert.deepEqual(reopened.state.placements, initial.placements)
for (const item of PILOT_PRODUCTS) {
  assert.equal(item.price, null, 'demo products must not invent retail prices')
  assert.equal(item.pilot, true)
  assert.ok(item.provenance.includes('Not a verified retail product'))
  assert.ok([item.w, item.d, item.h].every(n => Number.isFinite(n) && n > 0))
  assert.ok(reopened.state.synthetics[item.id], 'every placed pilot product must reopen')
}
// Changing a conceptual upholstery finish must survive save/open without
// changing product size or any placement.
initial.synthetics['pilot-sofa'] = { ...initial.synthetics['pilot-sofa'], finish: 'sage', color: '#8f9b82' }
const changed = parseProject(stringifyProject(createProject(initial)))
assert.equal(changed.state.synthetics['pilot-sofa'].finish, 'sage')
assert.equal(changed.state.synthetics['pilot-sofa'].w, 2.2)
assert.deepEqual(changed.state.placements, reopened.state.placements)
// A regular project remains a regular project after the same save/open path.
assert.equal(parseProject(stringifyProject(createProject(ROOM_DEFAULTS))).state.customShape, null)
console.log('Reference pilot persistence and honest demo data passed')
