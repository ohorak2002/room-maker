// R09/QA33-34: export sizes, window independence, cancel, duplicate click, restoration (real Electron; stubbed dialog).
//   node scripts/export-checks.mjs <label>
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

const root = resolve('.')
const out = join(root, 'artifacts', 'quality', `export-${process.argv[2] || 'run'}`)
await mkdir(out, { recursive: true })
const userData = await mkdtemp(join(tmpdir(), 'nested-export-'))
const env = { ...process.env, NESTED_TEST_USER_DATA: userData }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: [root], env })
const steps = []
try {
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: /Skip the Brief/ }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  await page.waitForTimeout(1500)
  const target = join(out, 'export.png')
  const stubSave = (canceled) => app.evaluate(({ dialog }, a) => { globalThis.saveCalls = 0; dialog.showSaveDialog = async () => { globalThis.saveCalls++; await new Promise((r) => setTimeout(r, a.delay)); return a.canceled ? { canceled: true } : { canceled: false, filePath: a.target } } }, { canceled, target, delay: 600 })
  const canvasSize = () => page.evaluate(() => { const c = document.querySelector('.canvas-mount canvas'); return [c.width, c.height] })
  const dims = async () => { const b = await readFile(target); return [b.readUInt32BE(16), b.readUInt32BE(20)] }
  const exportNow = async () => { await rm(target, { force: true }); await page.getByRole('button', { name: 'Export image', exact: true }).click(); await page.getByText('Room image saved', { exact: true }).waitFor(); }

  // Exact sizes.
  await stubSave(false)
  const before = await canvasSize()
  for (const size of ['1920x1080', '2560x1440', '3840x2160']) {
    await page.getByLabel('Export size').selectOption(size)
    await exportNow()
    assert.deepEqual(await dims(), size.split('x').map(Number), `export ${size}`)
    await page.waitForTimeout(250)
    assert.deepEqual(await canvasSize(), before, `canvas restored after ${size}`)
    steps.push(`exact ${size}`)
  }
  // Window independence: same exact size from a different window size.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1100, 760))
  await page.waitForTimeout(800)
  const small = await canvasSize()
  assert.notDeepEqual(small, before, 'window actually changed size')
  await page.getByLabel('Export size').selectOption('1920x1080')
  await exportNow()
  assert.deepEqual(await dims(), [1920, 1080])
  steps.push('same exact size from a smaller window')
  await page.getByLabel('Export size').selectOption('view')
  await exportNow()
  const d = await dims()
  assert.equal(Math.max(...d), 2560)
  assert.ok(Math.abs(d[0] / d[1] - small[0] / small[1]) < 0.01)
  steps.push('match-view keeps the view aspect in a smaller window')
  await page.waitForTimeout(250)
  assert.deepEqual(await canvasSize(), small)

  // Cancelled dialog: no success, no file, view restored.
  await stubSave(true)
  await rm(target, { force: true })
  await page.getByRole('button', { name: 'Export image', exact: true }).click()
  await page.waitForTimeout(1500)
  assert.equal(existsSync(target), false)
  assert.equal(await page.getByText('Room image saved', { exact: true }).count(), 0, 'cancel must not keep reporting success')
  assert.deepEqual(await canvasSize(), small)
  steps.push('cancelled dialog: no file, no success message, view restored')

  // Write failure (the folder would have to be a file): clear error, no success, view restored, retry works.
  await rm(target, { recursive: true, force: true }); await writeFile(target, 'not a folder')
  await app.evaluate(({ dialog }, p) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: p }) }, join(target, 'x.png'))
  await page.getByRole('button', { name: 'Export image', exact: true }).click()
  await page.getByText(/^Image export failed/).waitFor()
  assert.equal(await page.getByText('Room image saved', { exact: true }).count(), 0)
  assert.deepEqual(await canvasSize(), small)
  assert.equal(await page.getByRole('button', { name: 'Export image', exact: true }).isEnabled(), true, 'export usable again after a failure')
  steps.push('write failure: error shown, no success message, view restored, button usable')
  await stubSave(false)
  await exportNow()
  assert.equal((await dims()).length, 2)
  steps.push('retry after the failure succeeds')

  // Duplicate click while busy: one dialog only.
  await stubSave(false)
  const btn = page.getByRole('button', { name: 'Export image', exact: true })
  await btn.click(); await btn.click({ force: true, timeout: 500 }).catch(() => {})
  await page.getByText('Room image saved', { exact: true }).waitFor()
  assert.equal(await app.evaluate(() => globalThis.saveCalls), 1, 'double click opened one save dialog')
  steps.push('double click exports once')
  await page.screenshot({ path: join(out, 'toolbar.png') })
  assert.deepEqual(errors, [])
  console.log(JSON.stringify(steps, null, 1))
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
