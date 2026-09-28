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
const launch = async () => {
  application = await electron.launch({ args: [root], env, timeout: 60000 })
  const page = await application.firstWindow()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  page.on('pageerror', err => errors.push(err.message))
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
  await page.getByRole('status').filter({ hasText: 'Saved ' }).waitFor()
  const savedDoc = await readProject(projectPath)
  assert.deepEqual(savedDoc.state.placements, state.placements)
  assert.equal(savedDoc.state.assets[fixtureId].fileName, 'nested-side-table.glb')
  assert.deepEqual(savedDoc.state.assets[fixtureId].spec, { w: 0.6, d: null, h: 0.52 })
  assert.equal(savedDoc.state.items.find(i => i.id.startsWith('asset-')).qty, 1)
  await page.getByLabel('Project name', { exact: true }).fill('Edited alternative')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Saved ' }).waitFor()
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
  await page.getByRole('status').filter({ hasText: 'Saved ' }).waitFor()
  await page.getByRole('button', { name: 'Export image', exact: true }).click()
  await page.getByText('Room image saved', { exact: true }).waitFor()
  assert.equal((await readFile(imagePath)).subarray(1, 4).toString(), 'PNG')
  await page.screenshot({ path: join(output, 'desktop-workspace.png') })
  const frameTimes = await page.evaluate(() => new Promise(resolve => {
    const times = []; let previous
    function frame(t) { if (previous !== undefined) times.push(t - previous); previous = t; if (times.length < 120) requestAnimationFrame(frame); else resolve(times) }
    requestAnimationFrame(frame)
  }))
  const sorted = frameTimes.toSorted((a, b) => a - b)
  await page.getByLabel('Project name', { exact: true }).fill('Recovered after restart')
  await page.waitForTimeout(1200)
  // Abrupt process exit exercises recovery from disk, bypassing graceful close.
  await application.evaluate(({ app }) => app.exit(0))
  page = await launch()
  assert.equal(await page.getByLabel('Project name', { exact: true }).inputValue(), 'Recovered after restart')
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
