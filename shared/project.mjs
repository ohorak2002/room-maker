import { validateAssetRecord } from './assets.mjs'

// v2 added `assets`: private imported models referenced by checksum.
export const PROJECT_VERSION = 2
export const MAX_PROJECT_BYTES = 32 * 1024 * 1024
export const ROOM_DEFAULTS = {
  onboarded: false, scope: 'room', home: null, focusedRoom: null, activeFloor: 0,
  residence: '', prefurnished: [], palette: 'clay', mood: 'cozy', lighting: 'natural',
  wallMaterial: 'plaster', floorplan: 'bedroom', customShape: null, customDims: null,
  planImage: null, windows: true, wallOverride: null, floorOverride: null,
  items: [], synthetics: {}, placements: {}, layoutRev: 0, photo: null,
  assets: {},
}
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
  if (object(doc) && doc.format === 'nested-project' && doc.version === 1 && object(doc.state) && !('assets' in doc.state)) {
    return { ...doc, version: PROJECT_VERSION, state: { ...doc.state, assets: {} } }
  }
  return doc
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
