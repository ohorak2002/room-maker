import { CELL, hasCell, shapeBounds } from '../data/presets'

/**
 * Turn a cell mask into the runs of floor and wall a room needs.
 *
 * Real apartments are L-shaped, have alcoves, and have cut corners where the
 * building turns. Modelling the room as a grid of occupied cells handles all of
 * that: a wall belongs anywhere an occupied cell touches an empty one.
 *
 * Everything is merged into runs first, so an 18×14 loft is a handful of boxes
 * rather than 252 of them.
 */

/** Merge a sorted list of integers into [start, end] runs of consecutive values. */
function runs(sorted) {
  const out = []
  for (const v of sorted) {
    const last = out[out.length - 1]
    if (last && v === last[1] + 1) last[1] = v
    else out.push([v, v])
  }
  return out
}

/** Horizontal strips of floor, merged along each row. */
export function floorRuns(shape) {
  const { w, d } = shapeBounds(shape)
  const out = []
  for (let r = 0; r < shape.rows; r++) {
    const cols = []
    for (let c = 0; c < shape.cols; c++) if (hasCell(shape, c, r)) cols.push(c)
    for (const [a, b] of runs(cols)) {
      const len = (b - a + 1) * CELL
      out.push({
        x: -w / 2 + (a * CELL) + len / 2,
        z: -d / 2 + r * CELL + CELL / 2,
        w: len,
        d: CELL,
      })
    }
  }
  return out
}

/**
 * Wall segments on every inside/outside boundary.
 * `axis` is the direction the wall runs; `facing` points into the room.
 */
export function wallRuns(shape) {
  const { w, d } = shapeBounds(shape)
  const out = []

  // Walls running along X — the north and south edges of each row.
  for (let r = 0; r < shape.rows; r++) {
    for (const [dir, dz] of [['n', -1], ['s', 1]]) {
      const cols = []
      for (let c = 0; c < shape.cols; c++) {
        if (hasCell(shape, c, r) && !hasCell(shape, c, r + dz)) cols.push(c)
      }
      for (const [a, b] of runs(cols)) {
        const len = (b - a + 1) * CELL
        out.push({
          axis: 'x',
          len,
          x: -w / 2 + a * CELL + len / 2,
          z: -d / 2 + r * CELL + (dir === 'n' ? 0 : CELL),
          facing: dir === 'n' ? 1 : -1,
        })
      }
    }
  }

  // Walls running along Z — the west and east edges of each column.
  for (let c = 0; c < shape.cols; c++) {
    for (const [dir, dc] of [['w', -1], ['e', 1]]) {
      const rowsList = []
      for (let r = 0; r < shape.rows; r++) {
        if (hasCell(shape, c, r) && !hasCell(shape, c + dc, r)) rowsList.push(r)
      }
      for (const [a, b] of runs(rowsList)) {
        const len = (b - a + 1) * CELL
        out.push({
          axis: 'z',
          len,
          x: -w / 2 + c * CELL + (dir === 'w' ? 0 : CELL),
          z: -d / 2 + a * CELL + len / 2,
          facing: dir === 'w' ? 1 : -1,
        })
      }
    }
  }

  return out
}

/**
 * The wall a window belongs on: the longest run on the far (-z) side, since
 * that's the one the default camera looks at. Returns null if there isn't one
 * wide enough to be worth cutting.
 */
export function windowWall(shape) {
  const candidates = wallRuns(shape)
    .filter((s) => s.axis === 'x' && s.facing === 1 && s.len >= 1.5)
    .sort((a, b) => b.len - a.len || a.z - b.z)
  return candidates[0] || null
}

/** Cell centres, used to seed automatic placement inside odd shapes. */
export function insideCells(shape) {
  const { w, d } = shapeBounds(shape)
  const out = []
  for (let r = 0; r < shape.rows; r++) {
    for (let c = 0; c < shape.cols; c++) {
      if (!hasCell(shape, c, r)) continue
      out.push({
        c, r,
        x: -w / 2 + (c + 0.5) * CELL,
        z: -d / 2 + (r + 0.5) * CELL,
        // How buried the cell is — 0 means it touches a wall.
        edge: [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => !hasCell(shape, c + dc, r + dr)),
      })
    }
  }
  return out
}

/**
 * Nudge a point back inside the footprint. Used to clamp dragging, which is the
 * one place a user can try to put a sofa through an exterior wall.
 */
export function clampToShape(shape, x, z, radius = 0) {
  const cells = insideCells(shape)
  if (!cells.length) return { x, z }

  // Already inside with clearance? Leave it alone.
  const inside = (px, pz) => {
    const { w, d } = shapeBounds(shape)
    const c = Math.floor((px + w / 2) / CELL)
    const r = Math.floor((pz + d / 2) / CELL)
    return hasCell(shape, c, r)
  }
  if (inside(x, z)) return { x, z }

  // Otherwise snap to the nearest cell centre.
  let best = cells[0]
  let bestD = Infinity
  for (const cell of cells) {
    const dist = (cell.x - x) ** 2 + (cell.z - z) ** 2
    if (dist < bestD) {
      bestD = dist
      best = cell
    }
  }
  return { x: best.x, z: best.z }
}

/** Total floor area in m², for the crowding check. */
export const shapeArea = (shape) => shape.cells.length * CELL * CELL
