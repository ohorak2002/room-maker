// Real Electron persistence regression; only synthetic files and stubbed dialogs.
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

const root = resolve('.')
const label = process.argv[2] || 'after'
const out = join(root, 'artifacts', 'quality', `persistence-${label}`)
await mkdir(out, { recursive: true })
const userData = await mkdtemp(join(tmpdir(), 'nested-persistence-'))
const path = join(userData, 'quality.nested')
const env = { ...process.env, NESTED_TEST_USER_DATA: userData }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: [root], env, timeout: 60000 })
let page
const errors = []
try {
  page = await app.firstWindow()
  page.on('pageerror', e => errors.push(e.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByLabel('Project name', { exact: true }).fill('Persistence fixture')
  await page.getByRole('button', { name: /Skip the Brief/ }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path })
    dialog.showMessageBox = async () => ({ response: 2 })
  }, path)
  const status = page.locator('.appbar-status')
  const save = async () => {
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.appbar-status').textContent.includes('Saved'))
  }
  await save()
  await page.getByLabel('Client name', { exact: true }).fill('Later client edit')
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await page.screenshot({ path: join(out, 'dirty-project.png') })
  assert.match(await status.textContent(), /Unsaved changes.*quality\.nested/, 'file identity must survive metadata edits')
  await save()
  assert.equal(JSON.parse(await readFile(path, 'utf8')).client, 'Later client edit')
  // Unrelated UI changes cannot dirty a saved project.
  await page.getByRole('button', { name: 'Hide side panel', exact: true }).click()
  await page.getByRole('button', { name: 'Show side panel', exact: true }).click()
  assert.match(await status.textContent(), /^Saved/)
  await page.getByRole('button', { name: /Golden hour/ }).click()
  await page.waitForFunction(() => document.querySelector('.appbar-status').textContent.includes('Unsaved changes'))
  await save()
  // Canceled Save As keeps the current file and state.
  await app.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true }) })
  await page.getByRole('button', { name: 'More project actions' }).click()
  await page.getByRole('menuitem', { name: 'Save as…', exact: true }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).waitFor({ state: 'visible' })
  assert.match(await status.textContent(), /^Saved.*quality\.nested/)
  // Force write failure against a synthetic directory, never a real client file.
  const badPath = join(userData, 'directory.nested')
  await mkdir(badPath)
  await page.getByLabel('Client name', { exact: true }).fill('Keep after failure')
  const prior = await readFile(path, 'utf8')
  await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }) }, badPath)
  await page.getByRole('button', { name: 'More project actions' }).click()
  await page.getByRole('menuitem', { name: 'Save as…', exact: true }).click()
  await page.locator('.appbar-status[role=alert]').waitFor()
  assert.equal(await readFile(path, 'utf8'), prior)
  assert.equal(await page.getByLabel('Client name').inputValue(), 'Keep after failure')
  await save() // Save retries the original file, not the failed Save As path.
  // An edit during a delayed Save As must remain dirty after the earlier snapshot saves.
  const copyPath = join(userData, 'snapshot.nested')
  await app.evaluate(({ dialog }, path) => {
    globalThis.finishSave = null
    dialog.showSaveDialog = () => new Promise(resolve => { globalThis.finishSave = () => resolve({ canceled: false, filePath: path }) })
  }, copyPath)
  await page.getByRole('button', { name: 'More project actions' }).click()
  await page.getByRole('menuitem', { name: 'Save as…', exact: true }).click()
  // Wait until the main process reached the dialog, then edit using live UI.
  for (let n = 0; n < 100 && !await app.evaluate(() => Boolean(globalThis.finishSave)); n++) await page.waitForTimeout(20)
  await page.getByRole('button', { name: /Evening/ }).click()
  await app.evaluate(() => globalThis.finishSave())
  await page.waitForFunction(() => !document.querySelector('.bar-btn.primary').disabled)
  assert.match(await status.textContent(), /Unsaved changes.*snapshot\.nested/)
  assert.equal(JSON.parse(await readFile(copyPath, 'utf8')).state.lighting, 'golden')
  await save()
  assert.equal(JSON.parse(await readFile(copyPath, 'utf8')).state.lighting, 'moody')
  // Open a known-good file, then verify its status survives effects/polling.
  await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }) }, path)
  await page.getByRole('button', { name: 'Open…', exact: true }).click()
  await page.waitForFunction(() => !document.querySelector('.bar-btn.primary').disabled)
  await page.waitForTimeout(2200)
  assert.match(await status.textContent(), /^(Saved|Opened).*quality\.nested/)
  await page.screenshot({ path: join(out, 'opened-project.png') })
  assert.deepEqual(errors, [])
  const report = { source: 'working tree', runtime: 'actual Electron', userData, errors, viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio })), checks: ['metadata dirty/file identity', 'save roundtrip', 'UI-only state', 'lighting dirty', 'cancel Save As', 'write failure preservation and retry', 'edit during delayed save', 'open stable status'] }
  await writeFile(join(out, 'result.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  await page?.screenshot({ path: join(out, 'failure.png') }).catch(() => {})
  await writeFile(join(out, 'failure.txt'), error.stack)
  throw error
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
