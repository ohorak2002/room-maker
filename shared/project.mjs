import { validateAssetRecord } from './assets.mjs'
import { validateBrief, compileBrief, normalizeDraft, MAX_BRIEF_BYTES } from './brief.mjs'

// v2 added `assets`: private imported models referenced by checksum.
// v3 added `studio` (brightness, sun height, accent lights) and `views` (saved cameras).
// v4 added `brief`: the official Brief the project's measured rooms came from.
// v5 added `briefDraft`: a Brief being written in the app, not yet turned into rooms.
export const PROJECT_VERSION = 5
export const MAX_PROJECT_BYTES = 32 * 1024 * 1024
export const ROOM_DEFAULTS = {
  onboarded: false, scope: 'room', home: null, focusedRoom: null, activeFloor: 0,
  residence: '', prefurnished: [], palette: 'clay', mood: 'cozy', lighting: 'natural',
  wallMaterial: 'plaster', floorplan: 'bedroom', customShape: null, customDims: null,
  planImage: null, windows: true, wallOverride: null, floorOverride: null,
  items: [], synthetics: {}, placements: {}, layoutRev: 0, photo: null,
  assets: {},
  // sun: null = the room's own default sun height; otherwise degrees above the horizon.
  studio: { brightness: 100, sun: null, accent: true },
  views: [],
  // null = a project without an official Brief (rooms from earlier versions).
  // Otherwise { fingerprint, source }: `source` is the verified brief document.
  brief: null,
  // The unfinished Brief (incomplete by design; validated only when the room is created).
  briefDraft: null,
}
export const MAX_VIEWS = 40
export const VIEW_MODES = ['overview', 'eye', 'corner']
const fail = (message) => { throw new Error(`Invalid Nested project: ${message}`) }
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const finite = (v) => typeof v === 'number' && Number.isFinite(v)
function safeTree(value, depth = 0) {
  if (depth > 40) fail('data is nested too deeply')
  if (typeof value === 'number' && !Number.isFinite(value)) fail('non-finite number')
  if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(k)) fail('unsafe property')
    safeTree(v, depth + 1)
  }
}
function items(value) {
  if (!Array.isArray(value) || value.length > 1000 || value.some(i => !object(i) || typeof i.id !== 'string' || !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 100)) fail('invalid furniture list')
  if (value.reduce((n, i) => n + i.qty, 0) > 1000) fail('too many furniture instances')
}
function shape(value) {
  if (!object(value) || !Number.isInteger(value.cols) || !Number.isInteger(value.rows) || value.cols < 1 || value.rows < 1 || value.cols > 400 || value.rows > 400 || !Array.isArray(value.cells) || !value.cells.length || value.cells.length > 160000) fail('invalid room shape')
  if (value.h !== undefined && (!finite(value.h) || value.h <= 0 || value.h > 100)) fail('invalid ceiling')
  if (value.cells.some(c => typeof c !== 'string' || !/^\d+,\d+$/.test(c) || Number(c.split(',')[0]) >= value.cols || Number(c.split(',')[1]) >= value.rows)) fail('invalid room cell')
}
const vec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(finite)
function studio(value) {
  if (!object(value) || !finite(value.brightness) || value.brightness < 50 || value.brightness > 160) fail('invalid lighting brightness')
  if (value.sun !== null && (!finite(value.sun) || value.sun < 0 || value.sun > 90)) fail('invalid sun height')
  if (typeof value.accent !== 'boolean') fail('invalid accent lighting')
}
function views(value) {
  if (!Array.isArray(value) || value.length > MAX_VIEWS) fail('invalid saved views')
  const ids = new Set()
  for (const v of value) {
    if (!object(v) || typeof v.id !== 'string' || !v.id || v.id.length > 64 || ids.has(v.id)) fail('invalid saved view')
    ids.add(v.id)
    if (typeof v.name !== 'string' || !v.name.trim() || v.name.length > 80) fail('invalid saved view name')
    if (typeof v.roomKey !== 'string' || v.roomKey.length > 200) fail('invalid saved view room')
    if (!VIEW_MODES.includes(v.mode)) fail('invalid saved view mode')
    if (!vec3(v.position) || !vec3(v.target)) fail('invalid saved view camera')
    if (!finite(v.fov) || v.fov < 20 || v.fov > 90) fail('invalid saved view field of view')
    // A small JPEG preview, kept so the strip does not need a re-render on open.
    if (v.thumb !== null && (typeof v.thumb !== 'string' || !v.thumb.startsWith('data:image/jpeg;base64,') || v.thumb.length > 120000)) fail('invalid saved view preview')
  }
}
// A measured home must be exactly what its verified Brief compiles to; only the
// furniture lists (`items`) may differ. Nothing else about the shell is trusted.
const withoutItems = (rooms) => JSON.stringify(rooms.map(({ items, ...geometry }) => geometry))
function briefRecord(s) {
  const b = s.brief
  if (b === null) {
    if (s.home?.measured) fail('measured rooms need their official Brief')
    return
  }
  if (!object(b) || Object.keys(b).some(k => !['fingerprint', 'source'].includes(k)) || typeof b.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(b.fingerprint)) fail('invalid Brief record')
  if (new TextEncoder().encode(JSON.stringify(b.source)).length > MAX_BRIEF_BYTES) fail('Brief exceeds 8 MB')
  const { errors } = validateBrief(b.source)
  if (errors.length) fail(`the stored Brief is not valid (${errors[0]})`)
  if (!s.home?.measured || s.scope !== 'home') fail('a Brief project needs its measured home')
  const compiled = compileBrief(b.source)
  if (['w', 'd', 'h', 'storeys', 'beds', 'baths', 'sqft'].some(k => s.home[k] !== compiled[k]) || withoutItems(s.home.rooms) !== withoutItems(compiled.rooms)) fail('measured rooms do not match the stored Brief')
}
export function validateProject(doc) {
  if (!object(doc) || doc.format !== 'nested-project' || doc.version !== PROJECT_VERSION) fail('unsupported format or version')
  safeTree(doc)
  if (typeof doc.name !== 'string' || doc.name.length > 200 || typeof doc.client !== 'string' || doc.client.length > 200) fail('invalid project details')
  if (!object(doc.state)) fail('missing room state')
  const s = doc.state
  for (const k of Object.keys(s)) if (!Object.hasOwn(ROOM_DEFAULTS, k)) fail(`unknown room field ${k}`)
  for (const [k, fallback] of Object.entries(ROOM_DEFAULTS)) {
    if (!(k in s)) fail(`missing room field ${k}`)
    if (fallback !== null && (Array.isArray(fallback) ? !Array.isArray(s[k]) : typeof s[k] !== typeof fallback || (typeof fallback === 'object' && !object(s[k])))) fail(`invalid ${k}`)
  }
  items(s.items)
  studio(s.studio)
  views(s.views)
  briefRecord(s)
  if (s.briefDraft !== null) {
    try { normalizeDraft(JSON.stringify(s.briefDraft)) } catch (err) { fail(`invalid Brief draft (${err.message})`) }
  }
  if (!['room', 'home'].includes(s.scope)) fail('invalid scope')
  if (s.customShape) shape(s.customShape)
  if (s.customDims !== null && (!object(s.customDims) || !finite(s.customDims.h) || s.customDims.h <= 0)) fail('invalid dimensions')
  for (const k of ['focusedRoom', 'planImage', 'wallOverride', 'floorOverride']) if (s[k] !== null && typeof s[k] !== 'string') fail(`invalid ${k}`)
  if (!Number.isInteger(s.activeFloor) || s.activeFloor < 0 || !Number.isInteger(s.layoutRev)) fail('invalid layout state')
  if (s.prefurnished.some(v => typeof v !== 'string')) fail('invalid existing furniture')
  if (s.photo !== null && (!object(s.photo) || typeof s.photo.dataUrl !== 'string' || !Array.isArray(s.photo.palette) || s.photo.palette.some(v => typeof v !== 'string'))) fail('invalid room photo')
  for (const p of Object.values(s.placements)) {
    if (!object(p) || ['x', 'y', 'z', 'ry'].some(k => p[k] !== undefined && !finite(p[k]))) fail('invalid placement')
  }
  for (const i of Object.values(s.synthetics)) if (!object(i) || typeof i.id !== 'string' || typeof i.name !== 'string' || typeof i.model !== 'string') fail('invalid custom furniture')
  for (const [id, record] of Object.entries(s.assets)) if (validateAssetRecord(record).id !== id) fail('asset key does not match its checksum')
  // An imported piece is only meaningful with its asset record: that record
  // carries the authored units and orientation it must be placed with.
  for (const i of Object.values(s.synthetics)) if (i.model === 'asset' && !Object.hasOwn(s.assets, i.assetId)) fail('imported furniture references a missing asset record')
  if (s.home !== null) {
    if (!object(s.home) || !Array.isArray(s.home.rooms) || s.home.rooms.length > 200 || ['w', 'd', 'h'].some(k => !finite(s.home[k]) || s.home[k] <= 0)) fail('invalid home')
    for (const r of s.home.rooms) { shape(r); items(r.items || []); if (typeof r.id !== 'string' || typeof r.name !== 'string' || !finite(r.ox) || !finite(r.oz)) fail('invalid home room') }
  }
  if (s.scope === 'home' && !s.home) fail('home scope requires a floorplan')
  return doc
}
export function createProject(state, details = {}) {
  return validateProject({ format: 'nested-project', version: PROJECT_VERSION,
    name: details.name || 'Untitled project', client: details.client || '',
    savedAt: new Date().toISOString(),
    state: structuredClone(Object.fromEntries(Object.keys(ROOM_DEFAULTS).map(k => [k, state[k] ?? ROOM_DEFAULTS[k]]))),
  })
}
/** Bring an older saved file up to the current version, without guessing data. */
export function migrateProject(doc) {
  if (!object(doc) || doc.format !== 'nested-project' || !object(doc.state)) return doc
  let next = doc
  // Each step only fills in what its version introduced; nothing is guessed.
  if (next.version === 1) next = { ...next, version: 2, state: { ...next.state, assets: next.state.assets ?? {} } }
  if (next.version === 2) next = { ...next, version: 3, state: { ...next.state, studio: next.state.studio ?? structuredClone(ROOM_DEFAULTS.studio), views: next.state.views ?? [] } }
  if (next.version === 3) next = { ...next, version: 4, state: { ...next.state, brief: next.state.brief ?? null } }
  if (next.version === 4) next = { ...next, version: 5, state: { ...next.state, briefDraft: next.state.briefDraft ?? null } }
  return next
}
export function parseProject(text) {
  if (new TextEncoder().encode(text).length > MAX_PROJECT_BYTES) fail('file exceeds 32 MB')
  return validateProject(migrateProject(JSON.parse(text)))
}
export function stringifyProject(doc) {
  const text = JSON.stringify(validateProject(doc), null, 2)
  parseProject(text)
  return text
}
export const projectIdentity = (doc) => JSON.stringify([doc.name, doc.client, doc.state])
