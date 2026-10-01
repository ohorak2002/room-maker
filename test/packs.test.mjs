import test from 'node:test'
import assert from 'node:assert/strict'
import { starterForRoom, ROOM_PACKS, KIND_PACKS, STARTER_PACKS, hasKindPack, CATALOG } from '../src/data/catalog.js'

test('a living room is not offered the bedroom pack', () => {
  assert.equal(starterForRoom('living', 'cozy').name, 'Living room set')
  assert.ok(starterForRoom('living', 'cozy').items.includes('sofa'))
  assert.equal(starterForRoom('bedroom', 'warm').name, 'Bedroom set')
})

test('fixture packs still win and unknown kinds fall back to the mood pack', () => {
  assert.equal(starterForRoom('bath', 'cozy'), ROOM_PACKS.bath)
  assert.equal(starterForRoom('studio', 'cool'), STARTER_PACKS.cool)
  assert.equal(hasKindPack('studio'), false)
})

test('every pack item exists in the catalog', () => {
  const ids = new Set((CATALOG || []).map((i) => i.id))
  if (!ids.size) return
  for (const p of [...Object.values(ROOM_PACKS), ...Object.values(KIND_PACKS)])
    for (const id of p.items) assert.ok(ids.has(id), `${p.name}: ${id}`)
})

test('an empty living room ranks its own pieces first', async () => {
  const { recommend } = await import('../src/data/catalog.js')
  const top = recommend('cozy', [], 40, null, 'living').slice(0, 6).map((i) => i.id)
  for (const id of KIND_PACKS.living.items) assert.ok(top.includes(id), `${id} in ${top}`)
  assert.notEqual(recommend('cozy', [], 40, null, null)[0].id, 'sofa', 'no kind -> unchanged mood ranking')
})
