/**
 * Find the rooms in a floorplan image.
 *
 * Uploading a floorplan and getting back a generic grid of rectangles is the
 * app's most annoying lie: the picture of your actual apartment sits right
 * there on screen while the plan beside it belongs to nobody. `generateHome()`
 * only ever knew the bedroom count, and the uploaded image was decoration.
 *
 * This reads the pixels instead. The insight that makes it tractable is that an
 * architectural drawing is already almost a segmentation: walls are the darkest
 * thing on the page, and a room is any enclosed region of not-wall. So:
 *
 *   1. threshold to separate wall ink from everything else
 *   2. flood the outside in from the border, so "outdoors" is known
 *   3. label what is left — each enclosed pocket is a candidate room
 *   4. throw away the pockets that are too small, too thin, or too full of ink
 *      to be a room, which is how text labels, door swings, closets and
 *      appliance symbols get rejected
 *
 * It returns rectangles in image-pixel space, which is exactly what the manual
 * tracer already produces and `homeFromTrace()` already consumes — so this
 * feeds the existing pipeline rather than a parallel one, and anything it gets
 * wrong stays editable by hand.
 *
 * WHAT IT IS NOT. This is not architectural understanding. It does not know a
 * kitchen from a bedroom, it will merge two rooms joined by a wide opening, and
 * it will lose a room whose wall is drawn in the same weight as its furniture.
 * A clean vector-style plan reads well; a phone photo of a paper plan reads
 * badly. Treat the output as a first draft to correct, never as a survey.
 */

/** Pixels are sampled from this working width; bigger is slower, not better. */
const WORK_WIDTH = 900

/**
 * Otsu's method: pick the darkness threshold that best splits the histogram
 * into two groups. Chosen over a fixed cutoff because plans vary wildly in how
 * heavy their linework is, and a constant would need tuning per drawing.
 */
function otsuThreshold(gray) {
  const hist = new Array(256).fill(0)
  for (const v of gray) hist[v]++
  const total = gray.length

  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]

  let sumB = 0
  let wB = 0
  let best = 0
  let bestVar = -1
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (!wB) continue
    const wF = total - wB
    if (!wF) break
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) * (mB - mF)
    if (between > bestVar) {
      bestVar = between
      best = t
    }
  }
  return best
}

/**
 * @param {{data:Uint8ClampedArray,width:number,height:number}} image
 * @param {object} [opts]
 * @returns {{rooms:Array<{x,y,w,h,areaPx,fill}>, scale:number, wallRatio:number,
 *            width:number, height:number, threshold:number}}
 *          `rooms` are rects in ORIGINAL image pixels.
 */
export function detectRooms(image, opts = {}) {
  const {
    minAreaFrac = 0.004, // a room is at least 0.4% of the drawing
    maxAreaFrac = 0.6, // bigger than this is the outdoors, not a room
    minSide = 12, // in working pixels; rejects label boxes and thin slivers
    minFill = 0.55, // a real room is mostly empty inside its own bounding box
  } = opts

  const { data, width: srcW, height: srcH } = image
  const scale = srcW > WORK_WIDTH ? WORK_WIDTH / srcW : 1
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))

  // --- 1. greyscale, at working resolution -------------------------------
  const gray = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const sy = Math.min(srcH - 1, Math.round(y / scale))
    for (let x = 0; x < w; x++) {
      const sx = Math.min(srcW - 1, Math.round(x / scale))
      const i = (sy * srcW + sx) * 4
      const a = data[i + 3]
      // Treat transparent as paper, or a PNG with an alpha background reads as
      // one enormous black room.
      gray[y * w + x] = a < 128 ? 255 : (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0
    }
  }

  // --- 2. walls are the dark ink -----------------------------------------
  const threshold = otsuThreshold(gray)
  const isWall = new Uint8Array(w * h)
  let wallCount = 0
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] <= threshold) {
      isWall[i] = 1
      wallCount++
    }
  }

  // --- 3. flood the outside in from the border ---------------------------
  // Anything reachable from the edge without crossing ink is outdoors. What
  // survives is enclosed, which is the definition of a room worth having.
  const OUTSIDE = 1
  const label = new Int32Array(w * h) // 0 = unvisited, 1 = outside, 2+ = region
  const stack = []
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = y * w + x
    if (label[i] || isWall[i]) return
    label[i] = OUTSIDE
    stack.push(i)
  }
  for (let x = 0; x < w; x++) {
    push(x, 0)
    push(x, h - 1)
  }
  for (let y = 0; y < h; y++) {
    push(0, y)
    push(w - 1, y)
  }
  while (stack.length) {
    const i = stack.pop()
    const x = i % w
    const y = (i / w) | 0
    push(x + 1, y)
    push(x - 1, y)
    push(x, y + 1)
    push(x, y - 1)
  }

  // --- 4. label the enclosed pockets -------------------------------------
  const regions = []
  let next = 2
  for (let start = 0; start < label.length; start++) {
    if (label[start] || isWall[start]) continue
    const id = next++
    let minX = w
    let minY = h
    let maxX = 0
    let maxY = 0
    let area = 0
    label[start] = id
    const queue = [start]
    while (queue.length) {
      const i = queue.pop()
      const x = i % w
      const y = (i / w) | 0
      area++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const ni = ny * w + nx
        if (label[ni] || isWall[ni]) continue
        label[ni] = id
        queue.push(ni)
      }
    }
    regions.push({ minX, minY, maxX, maxY, area })
  }

  // --- 5. keep the ones shaped like rooms --------------------------------
  const totalPx = w * h
  const rooms = []
  for (const r of regions) {
    const bw = r.maxX - r.minX + 1
    const bh = r.maxY - r.minY + 1
    const frac = r.area / totalPx
    if (frac < minAreaFrac || frac > maxAreaFrac) continue
    if (bw < minSide || bh < minSide) continue
    // How much of its own bounding box the region fills. A room is close to
    // rectangular; a door swing, a corridor elbow or the gap around a symbol
    // is not, and this is what separates them.
    const fill = r.area / (bw * bh)
    if (fill < minFill) continue

    rooms.push({
      x: Math.round(r.minX / scale),
      y: Math.round(r.minY / scale),
      w: Math.round(bw / scale),
      h: Math.round(bh / scale),
      areaPx: Math.round(r.area / (scale * scale)),
      fill: Math.round(fill * 100) / 100,
    })
  }

  // Biggest first: the rooms someone cares about get the first labels, and a
  // stable order keeps repeat runs from shuffling the list.
  rooms.sort((a, b) => b.areaPx - a.areaPx)

  return { rooms, scale, threshold, wallRatio: wallCount / totalPx, width: srcW, height: srcH }
}
