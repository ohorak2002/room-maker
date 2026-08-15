/**
 * Room detection, against a floorplan drawn to be awkward on purpose.
 *
 * The synthetic plan mirrors the shape that exposed the problem: an L-shaped
 * apartment, bedrooms in a row off a corridor, an open living/kitchen end. It
 * also carries the things that make naive detection fail — text labels inside
 * rooms, door swing arcs breaking the wall line, and furniture symbols — so a
 * pass here means the filters are doing real work rather than getting lucky on
 * a clean rectangle grid.
 */
import { detectRooms } from '../src/data/detectRooms.js'

const W = 1000
const H = 700

function blankPlan() {
  const data = new Uint8ClampedArray(W * H * 4).fill(255)
  return {
    data,
    width: W,
    height: H,
    set(x, y, v) {
      if (x < 0 || y < 0 || x >= W || y >= H) return
      const i = (y * W + x) * 4
      data[i] = data[i + 1] = data[i + 2] = v
      data[i + 3] = 255
    },
  }
}

const rect = (p, x, y, w, h, t = 6) => {
  for (let i = 0; i < t; i++) {
    for (let x2 = x; x2 < x + w; x2++) {
      p.set(x2, y + i, 0)
      p.set(x2, y + h - 1 - i, 0)
    }
    for (let y2 = y; y2 < y + h; y2++) {
      p.set(x + i, y2, 0)
      p.set(x + w - 1 - i, y2, 0)
    }
  }
}
const vline = (p, x, y1, y2, t = 6) => {
  for (let y = y1; y <= y2; y++) for (let i = 0; i < t; i++) p.set(x + i, y, 0)
}
const hline = (p, y, x1, x2, t = 6) => {
  for (let x = x1; x <= x2; x++) for (let i = 0; i < t; i++) p.set(x, y + i, 0)
}
/** A blob of ink, standing in for a text label or an appliance symbol. */
const blob = (p, x, y, w, h) => {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if ((xx + yy) % 3) p.set(xx, yy, 40)
}
/** A quarter-circle door swing, which breaks a wall the way a real plan does. */
const swing = (p, cx, cy, r) => {
  for (let a = 0; a < 90; a++) {
    const rad = (a * Math.PI) / 180
    p.set(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), 90)
  }
}

const plan = blankPlan()

// Outer shell: an L. The notch at bottom-right is the part a rectangle-only
// reading gets wrong, and the reason this test exists.
hline(plan, 40, 60, 940)
vline(plan, 60, 40, 660)
hline(plan, 660, 60, 620)
vline(plan, 620, 460, 660)
hline(plan, 460, 620, 940)
vline(plan, 934, 40, 460)

// Four bedrooms in a row across the top.
const beds = []
for (let i = 0; i < 4; i++) {
  const x = 80 + i * 210
  rect(plan, x, 60, 190, 180)
  beds.push({ x, y: 60, w: 190, h: 180 })
  blob(plan, x + 60, 130, 70, 14) // its name, printed inside
  swing(plan, x + 20, 240, 40) // its door
}

// Living room and kitchen along the bottom left.
rect(plan, 80, 300, 300, 330)
blob(plan, 160, 450, 120, 16)
rect(plan, 400, 300, 200, 330)
blob(plan, 450, 450, 90, 16)
blob(plan, 420, 580, 60, 40) // an appliance

// A room in the lower-right arm of the L.
rect(plan, 660, 300, 250, 140)

const { rooms, threshold, wallRatio } = detectRooms(plan)

const near = (a, b, tol) => Math.abs(a - b) <= tol
let fail = 0
const ok = (label, cond, extra = '') => {
  console.log(cond ? 'ok  ' : 'FAIL', label, extra)
  if (!cond) fail++
}

console.log(`threshold ${threshold}, wall ink ${(wallRatio * 100).toFixed(1)}%, found ${rooms.length} rooms\n`)
for (const r of rooms) console.log(`   ${String(r.w).padStart(4)}x${String(r.h).padStart(4)} at (${r.x},${r.y})  fill ${r.fill}`)
console.log()

ok('finds the seven drawn rooms', rooms.length === 7, `got ${rooms.length}`)

const found = (x, y, w, h) => rooms.some((r) => near(r.x, x, 14) && near(r.y, y, 14) && near(r.w, w, 20) && near(r.h, h, 20))
ok('  every bedroom', beds.every((b) => found(b.x, b.y, b.w, b.h)))
ok('  the living room', found(80, 300, 300, 330))
ok('  the kitchen', found(400, 300, 200, 330))
ok('  the room in the L arm', found(660, 300, 250, 140))

// The things that must NOT become rooms.
ok('text labels are not rooms', !rooms.some((r) => r.w < 90 && r.h < 30))
ok('the outdoors is not a room', !rooms.some((r) => r.w > 850 && r.h > 550))

// Rooms must not overlap: a leak through a wall merges two into one blob.
let overlaps = 0
for (let i = 0; i < rooms.length; i++)
  for (let j = i + 1; j < rooms.length; j++) {
    const a = rooms[i]
    const b = rooms[j]
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps++
  }
ok('no two rooms overlap', overlaps === 0, overlaps ? `${overlaps} overlapping pairs` : '')

// A transparent-background PNG must not read as one huge dark room.
const alpha = { data: new Uint8ClampedArray(200 * 200 * 4), width: 200, height: 200 }
ok('transparent background is treated as paper', detectRooms(alpha).rooms.length === 0)

console.log('\n' + (fail ? `${fail} problems` : 'all passed'))
process.exit(fail ? 1 : 0)
