import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir, readFile, writeFile, rename, access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import { createProject, ROOM_DEFAULTS } from '../shared/project.mjs'
import { writeProject, readProject } from '../desktop/files.mjs'

const root = resolve('.')
const output = join(root, 'artifacts')
await mkdir(output, { recursive: true })
const userData = await mkdtemp(join(tmpdir(), 'nested-electron-test-'))
const projectPath = join(userData, 'test-room.nested')
const imagePath = join(output, 'desktop-room.png')
const fixturePath = join(root, 'test', 'fixtures', 'nested-side-table.glb')
const fixtureId = createHash('sha256').update(await readFile(fixturePath)).digest('hex')
const libraryPath = join(userData, 'assets', `${fixtureId}.glb`)
const state = structuredClone(ROOM_DEFAULTS)
Object.assign(state, { onboarded: true, floorplan: 'living', items: ['sofa', 'coffee-table', 'floor-lamp', 'rug'].map(id => ({ id, qty: 1 })), placements: { 'coffee-table#0': { x: 0, y: 0, z: 0.4, ry: 0, zone: 'center' } } })
const doc = createProject(state, { name: 'Desktop validation room', client: 'Demo client' })
await writeProject(join(userData, 'recovery.nested'), doc)
const env = { ...process.env, NESTED_TEST_USER_DATA: userData }
delete env.ELECTRON_RUN_AS_NODE
let application
const errors = []
const external = []
const materialResponses = []
// Range inputs are driven the way React hears them: native setter + input event.
const setRange = (locator, value) => locator.evaluate((el, v) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v))
  el.dispatchEvent(new Event('input', { bubbles: true }))
}, value)
const launch = async () => {
  application = await electron.launch({ args: [root], env, timeout: 60000 })
  const page = await application.firstWindow()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  page.on('pageerror', err => errors.push(err.message))
  page.on('request', req => { if (!/^(nested|data|blob):/.test(req.url())) external.push(req.url()) })
  page.on('response', res => { if (res.url().includes('/materials/polyhaven/')) materialResponses.push([res.url().split('/').pop(), res.status()]) })
  await page.getByRole('button', { name: 'Restore project', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Restore project', exact: true }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  return page
}
let page
try {
  page = await launch()
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined')
  const preferences = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences())
  assert.equal(preferences.sandbox, true); assert.equal(preferences.contextIsolation, true); assert.equal(preferences.nodeIntegration, false)
  await application.evaluate(({ dialog }, { projectPath, imagePath, fixturePath }) => {
    dialog.showSaveDialog = async (_win, opts) => ({ canceled: false, filePath: opts.title.includes('image') ? imagePath : projectPath })
    dialog.showOpenDialog = async (_win, opts) => ({ canceled: false, filePaths: [opts.title.includes('GLB') ? fixturePath : projectPath] })
    dialog.showMessageBox = async () => ({ response: 1 })
  }, { projectPath, imagePath, fixturePath })
  console.log('step: import')
  // Import the fixture: validated and copied into the private library, then
  // placed and loaded through the standard GLTFLoader.
  await page.getByRole('tab', { name: 'Models' }).click()
  await page.getByRole('button', { name: 'Import GLB model…' }).click()
  await page.getByText('Placed size: W 60.0 × D 60.0 × H 50.0 cm').waitFor()
  await access(libraryPath)
  await page.getByRole('button', { name: 'Place in room' }).click()
  const loaded = page.locator(`[data-asset-loaded="${fixtureId}"]`)
  await loaded.waitFor({ timeout: 30000 })
  // Runtime truth from the loaded three.js objects: materials not merged,
  // textures and transmission kept.
  assert.match(await loaded.textContent(), /Loaded: 3 materials · 2 textures · 1 transmissive · 6 parts/)
  // Designer-confirmed units: a centimetre correction shrinks the placed size.
  await page.getByLabel('Authored units').selectOption('cm')
  await page.getByText('Placed size: W 0.6 × D 0.6 × H 0.5 cm').waitFor()
  await page.getByLabel('Authored units').selectOption('m')
  await page.getByLabel('Product width in centimetres').fill('60')
  await page.getByLabel('Product height in centimetres').fill('52')
  await page.getByLabel('Source').click()
  await page.getByText('Differs from the entered dimensions: H -2.0 cm').waitFor()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('status').filter({ hasText: /^Saved/ }).waitFor()
  const savedDoc = await readProject(projectPath)
  assert.deepEqual(savedDoc.state.placements, state.placements)
  assert.equal(savedDoc.state.assets[fixtureId].fileName, 'nested-side-table.glb')
  assert.deepEqual(savedDoc.state.assets[fixtureId].spec, { w: 0.6, d: null, h: 0.52 })
  assert.equal(savedDoc.state.items.find(i => i.id.startsWith('asset-')).qty, 1)
  await page.getByLabel('Project name', { exact: true }).fill('Edited alternative')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('status').filter({ hasText: /^Saved/ }).waitFor()
  assert.equal((await readProject(`${projectPath}.bak`)).name, doc.name)
  assert.equal((await readProject(projectPath)).name, 'Edited alternative')
  // Open cancellation leaves the current project intact.
  await application.evaluate(({ dialog }) => { dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] }) })
  await page.getByRole('button', { name: 'Open…', exact: true }).click()
  assert.equal(await page.getByLabel('Project name', { exact: true }).inputValue(), 'Edited alternative')
  await application.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }) }, projectPath)
  await page.getByLabel('Project name', { exact: true }).fill('Unsaved temporary name')
  await page.getByRole('button', { name: 'Open…', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('[aria-label="Project name"]').value === 'Edited alternative')
  // Malformed files are rejected before replacing the active design.
  const invalidPath = join(userData, 'invalid.nested')
  await writeFile(invalidPath, '{broken')
  await application.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }) }, invalidPath)
  await page.getByRole('button', { name: 'Open…', exact: true }).click()
  await page.getByRole('alert').waitFor()
  assert.equal(await page.getByLabel('Project name', { exact: true }).inputValue(), 'Edited alternative')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('status').filter({ hasText: /^Saved/ }).waitFor()
  await page.getByRole('button', { name: 'Export image', exact: true }).click()
  await page.getByText('Room image saved', { exact: true }).waitFor()
  assert.equal((await readFile(imagePath)).subarray(1, 4).toString(), 'PNG')
  {
    const png = await readFile(imagePath)
    assert.ok(png.readUInt32BE(16) >= 600 && png.readUInt32BE(20) >= 400, 'exported image is a real render, not a stub')
  }
  // Production builds carry no development hooks.
  assert.equal(await page.evaluate(() => [typeof window.__nestedEngine, typeof window.__nestedMaterials, typeof window.__nestedLegacyPieces].join()), 'undefined,undefined,undefined')
  console.log('step: studio')
  // --- Room studio: lighting, field of view, saved views, presentation ---------
  // Built-in views and their previews are in the strip.
  await page.getByRole('button', { name: 'Eye level', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await page.getByRole('button', { name: /Golden hour/ }).click()
  assert.equal(await page.getByRole('button', { name: /Golden hour/ }).getAttribute('aria-pressed'), 'true')
  await setRange(page.getByLabel(/^Brightness/), 120)
  await page.getByText('120%', { exact: true }).waitFor()
  await setRange(page.getByLabel(/^Sun height/), 40)
  await page.getByText('40°', { exact: true }).waitFor()
  await page.getByLabel('Accent lighting', { exact: false }).uncheck()
  // Camera views: change field of view, then save the current camera.
  await page.getByRole('button', { name: 'Views', exact: true }).click()
  await setRange(page.getByLabel(/^Field of view/), 44)
  await page.getByText('44°', { exact: true }).waitFor()
  await page.getByLabel('Save this view').fill('By the window')
  await page.locator('.studio-btn').click()
  await page.getByText('Saved “By the window”', { exact: false }).first().waitFor()
  await page.getByRole('button', { name: 'By the window', exact: true }).waitFor()
  // A second view from another preset, then go back to the first.
  await page.getByRole('button', { name: 'Corner', exact: true }).first().click()
  await page.getByRole('button', { name: 'By the window', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: 'By the window', exact: true }).getAttribute('aria-pressed'), 'true')
  assert.equal(await page.getByLabel(/^Field of view/).inputValue(), '44')
  // Presentation mode hides the chrome and Escape brings it back.
  await page.getByRole('button', { name: 'Present', exact: true }).click()
  await page.locator('.appbar').waitFor({ state: 'hidden' })
  assert.equal(await page.locator('.rail').isVisible(), false)
  await page.getByRole('button', { name: 'Exit presentation' }).waitFor()
  await page.keyboard.press('Escape')
  await page.locator('.appbar').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Room', exact: true }).click()
  await page.getByText('Floor area').waitFor()
  await page.getByRole('button', { name: 'Pieces', exact: true }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('status').filter({ hasText: /^Saved/ }).waitFor()
  {
    const studioDoc = await readProject(projectPath)
    assert.equal(studioDoc.version, 3)
    assert.equal(studioDoc.state.lighting, 'golden')
    assert.deepEqual(studioDoc.state.studio, { brightness: 120, sun: 40, accent: false })
    assert.equal(studioDoc.state.views.length, 1)
    assert.equal(studioDoc.state.views[0].name, 'By the window')
    assert.equal(studioDoc.state.views[0].fov, 44)
    assert.equal(studioDoc.state.views[0].mode, 'eye')
    assert.match(studioDoc.state.views[0].thumb, /^data:image\/jpeg;base64,/)
    assert.deepEqual(studioDoc.state.placements, state.placements)
  }
  // Material pilot: the bundled maps loaded from the app itself, nothing external.
  assert.equal(materialResponses.length >= 6 && materialResponses.every(([, status]) => status === 200), true, JSON.stringify(materialResponses))
  assert.deepEqual(external, [])
  console.log('step: workspace screenshot')
  await page.screenshot({ path: join(output, 'desktop-workspace.png') })
  const frameTimes = await page.evaluate(() => new Promise(resolve => {
    const times = []; let previous
    function frame(t) { if (previous !== undefined) times.push(t - previous); previous = t; if (times.length < 120) requestAnimationFrame(frame); else resolve(times) }
    requestAnimationFrame(frame)
  }))
  const sorted = frameTimes.toSorted((a, b) => a - b)
  await page.getByLabel('Project name', { exact: true }).fill('Recovered after restart')
  await page.waitForTimeout(1200)
  console.log('step: crash restart')
  // Abrupt process exit exercises recovery from disk, bypassing graceful close.
  await application.evaluate(({ app }) => app.exit(0))
  page = await launch()
  assert.equal(await page.getByLabel('Project name', { exact: true }).inputValue(), 'Recovered after restart')
  // Lighting and saved views survive a crash restart.
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: /Golden hour/ }).getAttribute('aria-pressed'), 'true')
  assert.equal(await page.getByLabel(/^Brightness/).inputValue(), '120')
  await page.getByRole('button', { name: 'By the window', exact: true }).waitFor()
  // The reopened project rebuilt the pilot pieces: their maps were requested again in the new process.
  await page.waitForTimeout(500)
  assert.ok(materialResponses.length >= 12 && materialResponses.every(([, status]) => status === 200), JSON.stringify(materialResponses))
  assert.deepEqual(external, [])
  await page.getByRole('button', { name: 'Pieces', exact: true }).click()
  console.log('step: reload imported model')
  // A fresh process reloads the imported model from the private library.
  await page.getByRole('tab', { name: 'Models' }).click()
  await page.locator(`[data-asset-loaded="${fixtureId}"]`).waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: 'Overview', exact: true }).click()
  await page.waitForTimeout(400)
  await page.locator('.canvas-mount canvas').screenshot({ path: join(output, 'desktop-asset-room.png') })
  // A missing model file is reported, keeps a placeholder, and breaks nothing.
  await page.getByLabel('Project name', { exact: true }).fill('Missing model check')
  await page.waitForTimeout(1200)
  await application.evaluate(({ app }) => app.exit(0))
  await rename(libraryPath, `${libraryPath}.moved`)
  try {
    page = await launch()
    await page.getByRole('tab', { name: 'Models' }).click()
    await page.getByText('Model file is missing on this computer.', { exact: false }).waitFor({ timeout: 30000 })
  } finally { await rename(`${libraryPath}.moved`, libraryPath) }
  assert.equal(errors.length, 0, errors.join('\n'))
  const report = { runtime: 'actual Electron on Windows', architecture: process.arch, rendererViewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight, devicePixelRatio })), frameSampleCount: 120,
    medianFrameIntervalMs: sorted[60], p95FrameIntervalMs: sorted[114], note: 'Single baseline room; requestAnimationFrame intervals, not GPU timings or a general performance guarantee. Native dialog selections are stubbed; filesystem and IPC are real.', errors, userData }
  await writeFile(join(output, 'desktop-validation.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} catch (err) {
  await page?.screenshot({ path: join(output, 'desktop-smoke-failure.png') }).catch(() => {})
  throw err
} finally { if (application) await application.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
