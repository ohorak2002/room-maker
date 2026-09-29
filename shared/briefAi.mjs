import { NOTE_FIELDS, KINDS, FLOORS, WALLS, FINISHES, LIGHTS } from './brief.mjs'

// What the Brief assistant may see and change. The model only ever *proposes*;
// the designer applies each change. It can write wording and choose supported
// finishes. It can never touch measurements, openings, verification flags, the
// client review, or project identity, and it never creates furniture.
export const MAX_AI_REPLY = 2000
export const MAX_PROPOSALS = 12
const hex = (v) => typeof v === 'string' && /^#[a-f\d]{6}$/i.test(v)
const oneOf = (list) => (v) => list.includes(v)
const text = (max) => (v) => typeof v === 'string' && v.length <= max
export const FIELD_RULES = {
  name: text(100),
  kind: oneOf(KINDS),
  lighting: oneOf(LIGHTS),
  'surfaces.floor': oneOf(FLOORS),
  'surfaces.wall': oneOf(WALLS),
  'surfaces.floorFinish': oneOf(FINISHES),
  'surfaces.wallFinish': oneOf(FINISHES),
  'surfaces.floorColor': hex,
  'surfaces.wallColor': hex,
  'surfaces.trimColor': hex,
  'surfaces.accentColor': hex,
  'surfaces.textureScale': (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0.1 && v <= 5,
  ...Object.fromEntries(NOTE_FIELDS.map((k) => [`notes.${k}`, text(3000)])),
}
export const ALLOWED_FIELDS = Object.keys(FIELD_RULES)

/** The Brief as the service may see it: no attachments, no identity beyond the project name. */
export function briefForAssistant(doc) {
  return {
    units: doc.units,
    projectName: doc.project?.name || '',
    rooms: doc.rooms.map((r) => ({
      id: r.id, name: r.name, kind: r.kind, floor: r.floor,
      size: { width: r.width, depth: r.depth, height: r.height },
      surfaces: r.surfaces, lighting: r.lighting, notes: r.notes,
    })),
  }
}

const get = (room, field) => field.split('.').reduce((o, k) => o?.[k], room)
/** Accept only well-formed proposals for rooms and fields that exist; count the rest. */
export function validateAssistantReply(raw, doc) {
  const reply = typeof raw?.reply === 'string' ? raw.reply.slice(0, MAX_AI_REPLY) : ''
  const proposals = []
  let dropped = 0
  for (const p of Array.isArray(raw?.proposals) ? raw.proposals : []) {
    const room = doc.rooms.find((r) => r.id === p?.roomId)
    const rule = typeof p?.field === 'string' && Object.hasOwn(FIELD_RULES, p.field) ? FIELD_RULES[p.field] : null
    if (!room || !rule || !rule(p.value) || proposals.length >= MAX_PROPOSALS) { dropped++; continue }
    proposals.push({ roomId: room.id, roomName: room.name, field: p.field, before: get(room, p.field), value: p.value, reason: typeof p.reason === 'string' ? p.reason.slice(0, 300) : '' })
  }
  return { reply, proposals, dropped }
}

/** Apply one accepted proposal to a (cloned) draft. Returns false if it is stale. */
export function applyProposal(draft, p) {
  const room = draft.rooms.find((r) => r.id === p.roomId)
  if (!room || JSON.stringify(get(room, p.field)) !== JSON.stringify(p.before)) return false
  const keys = p.field.split('.')
  const last = keys.pop()
  keys.reduce((o, k) => o[k], room)[last] = p.value
  return true
}
