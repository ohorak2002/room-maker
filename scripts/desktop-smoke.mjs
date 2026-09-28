import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
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
  page.on('pageerror', err => errors.push(err.message))
  await page.getByRole('button', { name: 'Restore project', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Restore project', exact: true }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  return page
}
try {
  let page = await launch()
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined')
  const preferences = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences())
  assert.equal(preferences.sandbox, true); assert.equal(preferences.contextIsolation, true); assert.equal(preferences.nodeIntegration, false)
  await application.evaluate(({ dialog }, { projectPath, imagePath }) => {
    dialog.showSaveDialog = async (_win, opts) => ({ canceled: false, filePath: opts.title.includes('image') ? imagePath : projectPath })
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [projectPath] })
    dialog.showMessageBox = async () => ({ response: 1 })
  }, { projectPath, imagePath })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Saved ' }).waitFor()
  assert.deepEqual((await readProject(projectPath)).state.placements, state.placements)
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
  assert.equal(errors.length, 0, errors.join('\n'))
  const report = { runtime: 'actual Electron on Windows', architecture: process.arch, rendererViewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight, devicePixelRatio })), frameSampleCount: 120,
    medianFrameIntervalMs: sorted[60], p95FrameIntervalMs: sorted[114], note: 'Single baseline room; requestAnimationFrame intervals, not GPU timings or a general performance guarantee. Native dialog selections are stubbed; filesystem and IPC are real.', errors, userData }
  await writeFile(join(output, 'desktop-validation.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally { if (application) await application.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
