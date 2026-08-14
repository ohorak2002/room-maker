/**
 * Will this piece actually go in this room?
 *
 * Only answerable once a piece has been measured — see productFacts.js. The
 * catalog's `fp` is an estimate, and warning someone their sofa will not fit
 * on the strength of a guess is worse than saying nothing: they would go and
 * measure it themselves, find it fine, and stop believing the app.
 *
 * So every check here is gated on `measured`, and every verdict says which
 * number it is talking about. A warning a user cannot check is just anxiety.
 */

/** Longest straight run of floor along each axis, in metres. */
function longestRuns(shape) {
  const cells = shape?.cells
  if (!cells?.length) return null

  const CELL = 0.5 // shape cells are half-metre squares
  const has = new Set(cells.map(([x, z]) => `${x},${z}`))

  let bestX = 0
  let bestZ = 0
  for (const [x, z] of cells) {
    let run = 0
    for (let i = x; has.has(`${i},${z}`); i++) run++
    if (run > bestX) bestX = run
    run = 0
    for (let j = z; has.has(`${x},${j}`); j++) run++
    if (run > bestZ) bestZ = run
  }
  return { x: bestX * CELL, z: bestZ * CELL }
}

/**
 * @param {object} item      a measured item (wM / dM / h)
 * @param {object} shape     the active room shape
 * @param {number} ceilingM
 * @returns {{level:'blocked'|'tight'|null, message:string}|null}
 */
export function checkFit(item, shape, ceilingM) {
  if (!item?.measured) return null

  const width = item.wM
  const depth = item.dM
  const height = item.h
  const runs = longestRuns(shape)
  if (!runs) return null

  const cm = (m) => `${Math.round(m * 100)}cm`

  // Ceiling first — a tall bookcase that does not stand up is the one failure
  // no amount of rearranging solves.
  if (height && ceilingM && height > ceilingM) {
    return {
      level: 'blocked',
      message: `${cm(height)} tall — your ceiling is ${cm(ceilingM)}. It won't stand up.`,
    }
  }

  if (!width) return null

  // A piece has to fit along one axis or the other, since it can be rotated.
  const longest = Math.max(runs.x, runs.z)
  if (width > longest) {
    return {
      level: 'blocked',
      message: `${cm(width)} wide — your longest clear wall is ${cm(longest)}.`,
    }
  }

  // Fits, but with nothing to spare. Worth saying, because "fits" and "fits
  // with 4cm at each end" are different things to live with.
  const spare = longest - width
  if (spare < 0.2) {
    return {
      level: 'tight',
      message: `${cm(width)} wide against a ${cm(longest)} wall — ${cm(spare)} to spare.`,
    }
  }

  // Depth is the quieter failure: it fits the wall but eats the walkway.
  if (depth && depth > Math.min(runs.x, runs.z) * 0.5) {
    return {
      level: 'tight',
      message: `${cm(depth)} deep — that's over half the shorter side of the room.`,
    }
  }

  return null
}
