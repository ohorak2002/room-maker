// QA17/QA22: presentation mode, motion preference and saved-view restore after save/reopen (needs the debug build; rebuild normally afterwards).
//   VITE_NESTED_DEBUG=1 npx vite build && node scripts/presentation-motion.mjs <label>
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

const root = resolve('.')
const out = join(root, 'artifacts', 'quality', `presentation-${process.argv[2] || 'run'}`)
await mkdir(out, { recursive: true })
const userData = await mkdtemp(join(tmpdir(), 'nested-pres-'))
const path = join(userData, 'pres.nested')
const env = { ...process.env, NESTED_TEST_USER_DATA: userData }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: [root], env })
const steps = []
try {
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await app.evaluate(({ dialog }, p) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: p })
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] })
    dialog.showMessageBox = async () => ({ response: 1 })
  }, path)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: /Skip the Brief/ }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  await page.getByRole('button', { name: /Add the .* set/ }).click()
  await page.waitForTimeout(1500)
  const cam = () => page.evaluate(() => window.__nestedEngine.camera.position.toArray().map((n) => +n.toFixed(4)))
  const openPanel = async (name) => { const b = page.getByRole('button', { name, exact: true }).first(); if (await b.getAttribute('aria-pressed') !== 'true') await b.click() }
  const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]))

  // Eye level: no drift even when idle with motion allowed.
  const e0 = await cam(); await page.waitForTimeout(6500); const e1 = await cam()
  assert.ok(dist(e0, e1) < 1e-4, `eye level drifted ${dist(e0, e1)}`)
  steps.push('normal motion, eye level: no idle drift')
  // Overview: drifts when idle, stops on input, and never when reduced motion is requested.
  await openPanel('Views')
  await page.getByRole('button', { name: 'Overview', exact: true }).first().click()
  await page.waitForTimeout(800)
  const o0 = await cam(); await page.waitForTimeout(7000); const o1 = await cam()
  assert.ok(dist(o0, o1) > 0.02, `overview did not drift (${dist(o0, o1)})`)
  await page.mouse.move(400, 400); await page.mouse.move(420, 410)
  await page.waitForTimeout(300); const s0 = await cam(); await page.waitForTimeout(1500); const s1 = await cam()
  assert.ok(dist(s0, s1) < 1e-3, `drift did not stop on input (${dist(s0, s1)})`)
  steps.push(`normal motion, overview: drifts when idle (${dist(o0, o1).toFixed(3)} m in 7 s) and stops on input`)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(6500)
  const r0 = await cam(); await page.waitForTimeout(6000); const r1 = await cam()
  assert.ok(dist(r0, r1) < 1e-4, `reduced motion drifted (${dist(r0, r1)})`)
  steps.push('reduced motion: no drift')
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  // Presentation mode.
  await page.getByRole('button', { name: 'Eye level', exact: true }).first().click()
  const visibleCount = (sel) => page.locator(sel).evaluateAll((els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' }).length)
  assert.ok(await visibleCount('.rail') > 0 && await visibleCount('.inspector') > 0)
  await page.evaluate(() => document.activeElement?.blur())
  await page.keyboard.press('p')
  await page.waitForTimeout(500)
  const hidden = { rail: await visibleCount('.rail'), inspector: await visibleCount('.inspector'), filmstrip: await visibleCount('.filmstrip'), appbar: await visibleCount('.appbar') }
  await page.screenshot({ path: join(out, 'presenting.png') })
  steps.push(`present (P): visible rail=${hidden.rail} inspector=${hidden.inspector} filmstrip=${hidden.filmstrip} appbar=${hidden.appbar}`)
  assert.equal(hidden.rail + hidden.inspector + hidden.filmstrip, 0, 'chrome hidden while presenting')
  await page.keyboard.press('Escape'); await page.waitForTimeout(400)
  assert.ok(await visibleCount('.rail') > 0 && await visibleCount('.inspector') > 0, 'chrome returns after Escape')
  steps.push('Escape restores the rail, inspector and strip')
  await page.getByRole('button', { name: 'Present', exact: true }).first().click(); await page.waitForTimeout(400)
  assert.equal(await visibleCount('.rail'), 0)
  await page.keyboard.press('Escape'); await page.waitForTimeout(400)
  assert.ok(await visibleCount('.rail') > 0)
  steps.push('Present button and Escape round trip')

  // Saved view survives save, reopen and a window resize.
  await openPanel('Views')
  await page.getByRole('button', { name: 'Corner', exact: true }).first().click(); await page.waitForTimeout(1200)
  const corner = await cam()
  await page.getByLabel('Save this view').fill('Corner for client'); await page.getByRole('button', { name: 'Save', exact: true }).last().click()
  await page.getByText(/Saved “Corner for client”/).waitFor()
  await page.getByRole('button', { name: 'Save', exact: true }).first().click()
  await page.waitForFunction(() => document.querySelector('.appbar-status').textContent.includes('Saved'))
  await page.getByRole('button', { name: 'Open…', exact: true }).click()
  await page.getByRole('button', { name: 'Views', exact: true }).first().waitFor()
  await page.waitForTimeout(1500)
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1100, 760)); await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'Eye level', exact: true }).first().click(); await page.waitForTimeout(600)
  await openPanel('Views') // project replacement returns the inspector to Pieces
  await page.getByRole('button', { name: 'Go to Corner for client' }).click(); await page.waitForTimeout(1000)
  const back = await cam()
  assert.ok(dist(corner, back) < 0.05, `restored camera differs by ${dist(corner, back)} m`)
  steps.push(`saved view restored after save/open/resize within ${dist(corner, back).toFixed(4)} m`)
  assert.deepEqual(errors, [])
  console.log(JSON.stringify(steps, null, 1))
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
