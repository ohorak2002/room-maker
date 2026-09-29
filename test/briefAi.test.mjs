import assert from 'node:assert/strict'
import { newBrief } from '../shared/brief.mjs'
import { briefForAssistant, validateAssistantReply, applyProposal } from '../shared/briefAi.mjs'

const doc = newBrief()
doc.rooms[0].attachments = undefined
doc.attachments = [{ id: 'a', name: 'plan.png', mime: 'image/png', dataUrl: 'data:image/png;base64,SECRET' }]
doc.project = { name: 'Home', client: 'Private Client', studio: 'S', designer: 'D' }
const sent = JSON.stringify(briefForAssistant(doc))
assert.ok(!sent.includes('SECRET') && !sent.includes('Private Client') && !sent.includes('plan.png'), 'attachments and client identity are never sent')
const id = doc.rooms[0].id
const raw = { reply: 'Try warmer walls.', proposals: [
  { roomId: id, field: 'surfaces.wallColor', value: '#F0E8DC', reason: 'warm' },
  { roomId: id, field: 'notes.feeling', value: 'Calm and warm.' },
  { roomId: id, field: 'width', value: 9 },                 // measurements are refused
  { roomId: id, field: 'geometryVerified', value: true },   // verification is refused
  { roomId: id, field: 'openings', value: [] },
  { roomId: id, field: 'surfaces.wallColor', value: 'red' }, // malformed
  { roomId: 'nope', field: 'lighting', value: 'warm' },
  { roomId: id, field: '__proto__.x', value: 1 },
  { roomId: id, field: 'lighting', value: 'sunny' } ] }
const result = validateAssistantReply(raw, doc)
assert.deepEqual(result.proposals.map((p) => p.field), ['surfaces.wallColor', 'notes.feeling'])
assert.equal(result.dropped, 7)
assert.equal(validateAssistantReply(null, doc).proposals.length, 0)
const draft = structuredClone(doc)
assert.equal(applyProposal(draft, result.proposals[0]), true)
assert.equal(draft.rooms[0].surfaces.wallColor, '#F0E8DC')
assert.equal(applyProposal(draft, result.proposals[0]), false) // stale: the value changed since
assert.equal(draft.rooms[0].width, null)
console.log('Brief assistant: sanitised payload, allowlisted proposals, stale-proposal refusal passed')
import { validateChat } from '../shared/briefAi.mjs'
assert.deepEqual(validateChat([{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello', proposals: [1] }, { role: 'user', content: 'more' }]).map((m) => Object.keys(m).length), [2, 2, 2])
for (const bad of [[], [{ role: 'assistant', content: 'x' }], [{ role: 'system', content: 'x' }], [{ role: 'user', content: '' }], [{ role: 'user', content: 'x'.repeat(4001) }], 'x', Array(25).fill({ role: 'user', content: 'x' })]) assert.throws(() => validateChat(bad))
console.log('Brief chat: conversation bounds passed')
