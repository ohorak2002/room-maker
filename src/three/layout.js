// Layout solver.
//
// Two jobs:
//   zoneOf()      - which surface an object lives on (floor / wall / ceiling)
//   autoArrange() - a rule-based arrangement pass: anchor each piece to where a
//                   designer would put it, then relax overlaps apart.
//
// This is a deterministic solver, not a learned model. It encodes ordinary
// interior-design rules (bed against the long wall, nightstand beside the bed,
// monitor on the desk, plants in the corners) and then resolves collisions.

import { clampToShape } from './shapeGeom'

export const ZONES = {
  rug: 'center',
  table: 'center',
  painting: 'wall',
  wallpanel: 'wall',
  tv: 'wall',
  curtain: 'window',
  ledstrip: 'ceilingEdge',
  pendant: 'ceiling',
  hanging: 'ceiling',
  monitor: 'ondesk',
}

export const zoneOf = (model) => ZONES[model] || 'floor'

const isFloor = (model) => {
  const z = zoneOf(model)
  return z === 'floor' || z === 'center'
}

/** Stable per-instance key so a dragged object keeps its position across rebuilds. */
export const instanceKey = (itemId, n) => `${itemId}#${n}`

/**
 * @param entries [{ key, item }] in stable order
 * @param room    { w, d, h }
 * @returns       { [key]: { x, y, z, ry } }
 */
export function autoArrange(entries, room) {
  const { w, d, h, shape } = room
  const out = {}

  // In an L-shape or an alcove the geometric centre can sit outside the room,
  // so every anchor gets pulled back onto real floor at the end.
  const fix = shape ? (p) => clampToShape(shape, p.x, p.z) : (p) => p

  const backZ = -d / 2
  const frontZ = d / 2
  const leftX = -w / 2
  const rightX = w / 2

  const has = (model) => entries.some((e) => e.item.model === model)
  const bedFirst = has('bed')

  // Anchor pools consumed in order, so a second sofa doesn't land on the first.
  const corners = [
    { x: leftX + 0.7, z: backZ + 0.7 },
    { x: rightX - 0.7, z: backZ + 0.7 },
    { x: rightX - 0.7, z: frontZ - 0.7 },
    { x: leftX + 0.7, z: frontZ - 0.7 },
  ]
  let cornerAt = 0
  const nextCorner = () => corners[cornerAt++ % corners.length]

  let wallSlot = 0
  let ceilSlot = 0
  let deskAnchor = null
  let bedAnchor = null

  // --- pass 1: anchor everything -----------------------------------------
  const ordered = [...entries].sort((a, b) => rank(a.item.model) - rank(b.item.model))

  for (const { key, item } of ordered) {
    const zone = zoneOf(item.model)
    const r = item.fp || 0.35

    if (zone === 'wall') {
      const span = w - 1.6
      const x = span > 0 ? -span / 2 + ((wallSlot % 3) + 0.5) * (span / 3) : 0
      wallSlot++
      out[key] = { x, y: h * 0.55, z: backZ + 0.14, ry: 0, zone }
      continue
    }

    if (zone === 'window') {
      out[key] = { x: 0, y: 0, z: backZ + 0.22, ry: 0, zone }
      continue
    }

    if (zone === 'ceiling') {
      const side = ceilSlot % 2 ? 1 : -1
      out[key] = { x: side * w * 0.22, y: h - 0.25, z: side * d * 0.18, ry: 0, zone }
      ceilSlot++
      continue
    }

    if (zone === 'ceilingEdge') {
      out[key] = { x: 0, y: h - 0.08, z: backZ + 0.18, ry: 0, zone }
      continue
    }

    if (zone === 'ondesk') {
      out[key] = deskAnchor
        ? { x: deskAnchor.x, y: deskAnchor.y, z: deskAnchor.z, ry: deskAnchor.ry, zone: 'ondesk' }
        : { x: 0, y: 0, z: backZ + 0.6, ry: 0, zone: 'floor' }
      continue
    }

    // --- floor pieces, by role -------------------------------------------
    let p
    switch (item.model) {
      case 'rug':
        p = { x: 0, z: d * 0.08, ry: 0 }
        break
      case 'bed':
        p = { x: 0, z: backZ + 1.25, ry: 0 }
        bedAnchor = p
        break
      case 'sofa':
        p = bedFirst ? { x: 0, z: frontZ - 1.0, ry: Math.PI } : { x: 0, z: backZ + 0.9, ry: 0 }
        break
      case 'desk':
        p = { x: leftX + 0.55, z: -d * 0.1, ry: Math.PI / 2 }
        deskAnchor = { x: p.x, y: item.h + 0.03, z: p.z, ry: p.ry }
        break
      case 'shelf':
        p = { x: rightX - 0.35, z: backZ + 1.1, ry: -Math.PI / 2 }
        break
      case 'nightstand':
        p = bedAnchor
          ? { x: bedAnchor.x - 1.05, z: bedAnchor.z - 0.7, ry: 0 }
          : { x: leftX + 0.5, z: backZ + 0.6, ry: 0 }
        break
      case 'chair':
        p = deskAnchor
          ? { x: deskAnchor.x + 0.75, z: deskAnchor.z, ry: -Math.PI / 2 }
          : { x: 0, z: 0, ry: 0 }
        break
      case 'armchair':
      case 'beanbag':
      case 'pouf': {
        const c = nextCorner()
        p = { x: c.x, z: c.z, ry: Math.atan2(-c.x, -c.z) }
        break
      }
      case 'floorlamp': {
        const near = bedAnchor || { x: 0, z: 0 }
        p = { x: clamp(near.x + 1.15, leftX + 0.5, rightX - 0.5), z: near.z - 0.2, ry: 0 }
        break
      }
      case 'desklamp':
        p = deskAnchor
          ? { x: deskAnchor.x, y: deskAnchor.y, z: deskAnchor.z + 0.5, ry: deskAnchor.ry }
          : { x: 0, z: 0, ry: 0 }
        break
      case 'tree':
      case 'palm': {
        const c = nextCorner()
        p = { x: c.x, z: c.z, ry: 0 }
        break
      }
      case 'plant':
      case 'smallplant':
      case 'vase': {
        const c = nextCorner()
        p = { x: c.x * 0.85, z: c.z * 0.85, ry: 0 }
        break
      }
      case 'mirror':
        p = { x: rightX - 0.3, z: d * 0.15, ry: -Math.PI / 2 }
        break
      case 'tower':
        p = deskAnchor ? { x: deskAnchor.x + 0.1, z: deskAnchor.z - 0.8, ry: 0 } : { x: leftX + 0.5, z: 0, ry: 0 }
        break
      case 'speaker': {
        const c = nextCorner()
        p = { x: c.x, z: c.z, ry: 0 }
        break
      }
      default: {
        const c = nextCorner()
        p = { x: c.x, z: c.z, ry: 0 }
      }
    }

    const snapped = fix({
      x: clamp(p.x, leftX + r, rightX - r),
      z: clamp(p.z, backZ + r, frontZ - r),
    })

    out[key] = {
      x: snapped.x,
      y: p.y ?? 0,
      z: snapped.z,
      ry: p.ry ?? 0,
      zone: zone === 'center' ? 'floor' : zone,
    }
  }

  // --- pass 2: push overlapping floor pieces apart ------------------------
  const movable = ordered
    .filter(({ item }) => isFloor(item.model) && item.model !== 'rug')
    .map(({ key, item }) => ({ key, r: item.fp || 0.35, pinned: PINNED.has(item.model) }))

  for (let iter = 0; iter < 24; iter++) {
    let moved = false
    for (let i = 0; i < movable.length; i++) {
      for (let j = i + 1; j < movable.length; j++) {
        const a = movable[i]
        const b = movable[j]
        const pa = out[a.key]
        const pb = out[b.key]
        const dx = pb.x - pa.x
        const dz = pb.z - pa.z
        const dist = Math.hypot(dx, dz) || 0.001
        const min = (a.r + b.r) * 0.92
        if (dist >= min) continue

        const push = (min - dist) / 2
        const nx = dx / dist
        const nz = dz / dist
        // Pinned pieces (bed, desk) hold their spot; the other one yields.
        const aw = a.pinned ? 0 : b.pinned ? 1 : 0.5
        const bw = 1 - aw
        pa.x -= nx * push * 2 * aw
        pa.z -= nz * push * 2 * aw
        pb.x += nx * push * 2 * bw
        pb.z += nz * push * 2 * bw
        moved = true
      }
    }
    for (const m of movable) {
      const p = out[m.key]
      p.x = clamp(p.x, leftX + m.r, rightX - m.r)
      p.z = clamp(p.z, backZ + m.r, frontZ - m.r)
      // Relaxation can shove a piece into the cut-out part of an odd shape.
      const back = fix(p)
      p.x = back.x
      p.z = back.z
    }
    if (!moved) break
  }

  return out
}

const PINNED = new Set(['bed', 'desk', 'sofa', 'shelf'])

// Larger, more anchored pieces claim their spot first.
const ORDER = ['rug', 'bed', 'sofa', 'desk', 'shelf', 'nightstand', 'chair', 'monitor', 'tower', 'desklamp']
const rank = (model) => {
  const i = ORDER.indexOf(model)
  return i === -1 ? ORDER.length : i
}

const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)))
