// QA14: dragging a piece, cancelled drag, release outside the canvas (debug build; real Electron mouse input).
//   VITE_NESTED_DEBUG=1 npx vite build && node scripts/drag-checks.mjs <label>   (rebuild normally afterwards)
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

const root = resolve('.')
const out = join(root, 'artifacts', 'quality', `drag-${process.argv[2] || 'run'}`)
await mkdir(out, { recursive: true })
const env = { ...process.env, NESTED_TEST_USER_DATA: await mkdtemp(join(tmpdir(), 'nested-drag-')) }; delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: [root], env })
const steps = []
try {
  const page = await app.firstWindow()
  const errors = []; page.on('pageerror', (e) => errors.push(e.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: /Skip the Brief/ }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  await page.getByRole('button', { name: /Add the .* set/ }).click()
  await page.waitForTimeout(2500)
  // Close the inspector so the canvas is large and nothing overlays the room.
  await page.getByRole('button', { name: 'Close inspector' }).click(); await page.waitForTimeout(600)
  const info = (id) => page.evaluate((id) => {
    const e = window.__nestedEngine
    const h = e.room.handles.find((n) => n.userData.itemId === id)
    const r = e.renderer.domElement.getBoundingClientRect()
    const v = h.position.clone(); v.y += 0.35; v.project(e.camera)
    return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height, pos: h.position.toArray(), controls: e.controls.enabled, W: window.innerWidth, H: window.innerHeight }
  }, id)
  const a = await info('coffee-table')
  assert.ok(a.x > 0 && a.x < a.W && a.y > 0 && a.y < a.H, `coffee table on screen at ${a.x},${a.y}`)
  // Normal drag moves the piece.
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(a.x + 60, a.y + 30, { steps: 6 }); await page.mouse.up()
  await page.waitForTimeout(400)
  const b = await info('coffee-table')
  assert.ok(Math.hypot(b.pos[0] - a.pos[0], b.pos[2] - a.pos[2]) > 0.05, 'drag moved the piece')
  assert.equal(b.controls, true, 'orbit controls re-enabled after the drag')
  steps.push(`drag moved the table ${Math.hypot(b.pos[0] - a.pos[0], b.pos[2] - a.pos[2]).toFixed(2)} m; controls re-enabled`)
  // Cancelled drag: pointercancel mid-drag; later movement must not drag the piece.
  await page.mouse.move(b.x, b.y); await page.mouse.down(); await page.mouse.move(b.x + 40, b.y + 20, { steps: 4 })
  await page.evaluate(() => document.querySelector('.canvas-mount canvas').dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 })))
  const c0 = await info('coffee-table')
  await page.mouse.move(b.x + 160, b.y + 90, { steps: 6 })
  const c1 = await info('coffee-table')
  assert.ok(Math.hypot(c1.pos[0] - c0.pos[0], c1.pos[2] - c0.pos[2]) < 0.02, 'piece does not follow the pointer after a cancelled drag')
  assert.equal(c1.controls, true)
  await page.mouse.up()
  steps.push('pointercancel mid-drag: piece stops, controls enabled')
  // Release outside the window: no stuck drag.
  const d = await info('coffee-table')
  await page.mouse.move(d.x, d.y); await page.mouse.down(); await page.mouse.move(d.x + 30, d.y + 10, { steps: 3 }); await page.mouse.move(a.W + 80, d.y, { steps: 4 }); await page.mouse.up()
  await page.waitForTimeout(300)
  const e1 = await info('coffee-table')
  await page.mouse.move(100, 300, { steps: 4 })
  const e2 = await info('coffee-table')
  assert.ok(Math.hypot(e2.pos[0] - e1.pos[0], e2.pos[2] - e1.pos[2]) < 0.02, 'after releasing outside the window the piece does not keep following')
  assert.equal(e2.controls, true)
  steps.push('release outside the window: piece stays, controls enabled')
  // Piece stays inside the room bounds.
  const room = await page.evaluate(() => window.__nestedEngine.room.bounds)
  assert.ok(Math.abs(e2.pos[0]) <= room.w / 2 + 0.01 && Math.abs(e2.pos[2]) <= room.d / 2 + 0.01, `piece inside the room (${e2.pos}) vs ${JSON.stringify(room)}`)
  steps.push('piece remains within the room bounds')
  await page.screenshot({ path: join(out, 'after-drags.png') })
  assert.deepEqual(errors, [])
  console.log(JSON.stringify(steps, null, 1))
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
