// U01: replacing or closing a project with unsaved changes (real Electron; stubbed dialogs, synthetic files only).
//   node scripts/replace-close.mjs <label>
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir, readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import { createProject, ROOM_DEFAULTS } from '../shared/project.mjs'
import { writeProject } from '../desktop/files.mjs'

const root = resolve('.')
const label = process.argv[2] || 'run'
const out = join(root, 'artifacts', 'quality', `replace-close-${label}`)
await mkdir(out, { recursive: true })
const userData = await mkdtemp(join(tmpdir(), 'nested-replace-'))
const pathA = join(userData, 'a.nested')
const pathB = join(userData, 'b.nested')
await writeProject(pathB, createProject({ ...structuredClone(ROOM_DEFAULTS), onboarded: true, floorplan: 'living' }, { name: 'Other project' }))
const env = { ...process.env, NESTED_TEST_USER_DATA: userData }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: [root], env, timeout: 60000 })
const errors = []
const steps = []
const ok = (name) => { steps.push(name); console.log('ok:', name) }
try {
  const page = await app.firstWindow()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => { console.log('page dialog:', d.type(), d.message()); d.accept().catch(() => {}) })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByLabel('Project name', { exact: true }).fill('Replace fixture')
  await page.getByRole('button', { name: /Skip the Brief/ }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  const status = page.locator('.appbar-status')
  const stub = (box, save, open) => app.evaluate(({ dialog }, a) => {
    globalThis.boxCalls = 0
    dialog.showMessageBox = async () => { globalThis.boxCalls++; return { response: a.box } }
    dialog.showSaveDialog = async () => (a.save ? { canceled: false, filePath: a.save } : { canceled: true })
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [a.open] })
  }, { box, save, open })
  const boxCalls = () => app.evaluate(() => globalThis.boxCalls)
  const menu = async (name) => { await page.getByRole('button', { name: 'More project actions' }).click(); await page.getByRole('menuitem', { name, exact: true }).click() }
  const dirtyEdit = async (text) => {
    await page.getByLabel('Client name', { exact: true }).fill(text)
    await page.waitForFunction(() => !/^Saved/.test(document.querySelector('.appbar-status').textContent))
  }

  await stub(2, pathA, pathB)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.appbar-status').textContent.includes('Saved'))
  await dirtyEdit('Dirty edit')

  // A: New project, Cancel keeps everything.
  await menu('New project')
  await page.waitForTimeout(600)
  assert.equal(await boxCalls(), 1)
  assert.equal(await page.getByLabel('Client name').inputValue(), 'Dirty edit')
  assert.match(await status.textContent(), /Unsaved changes.*a\.nested/)
  ok('New project + Cancel keeps the dirty project')

  // B: Open another file, Cancel keeps everything (and the other file is untouched).
  await page.getByRole('button', { name: 'Open…', exact: true }).click()
  await page.waitForTimeout(600)
  assert.equal(await page.getByLabel('Project name').inputValue(), 'Replace fixture')
  assert.equal(await page.getByLabel('Client name').inputValue(), 'Dirty edit')
  ok('Open + Cancel keeps the dirty project')

  // C: "Save project" on a project that has a file saves it, then New replaces it.
  await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 0 }) })
  await menu('New project')
  await page.getByRole('button', { name: /Skip the Brief/ }).waitFor()
  assert.equal(JSON.parse(await readFile(pathA, 'utf8')).client, 'Dirty edit', 'Save-then-New wrote the edit to the file')
  ok('Save then New writes the file and starts a new project')
  await page.getByRole('button', { name: /Skip the Brief/ }).click()
  await page.locator('.canvas-mount canvas').waitFor()

  // G: a project with no file: Save, but the Save dialog is cancelled -> replacement cancelled, edit kept.
  await dirtyEdit('Unpathed edit')
  await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 0 }); dialog.showSaveDialog = async () => ({ canceled: true }) })
  await menu('New project')
  await page.waitForTimeout(700)
  assert.equal(await page.getByLabel('Client name').inputValue(), 'Unpathed edit')
  assert.match(await status.textContent(), /Unsaved|Not saved/)
  ok('Save then cancelled Save dialog cancels the replacement')

  // D: Save to a real path, then Open replaces.
  const pathC = join(userData, 'c.nested')
  await app.evaluate(({ dialog }, a) => { dialog.showMessageBox = async () => ({ response: 0 }); dialog.showSaveDialog = async () => ({ canceled: false, filePath: a.c }); dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [a.b] }) }, { b: pathB, c: pathC })
  await page.getByRole('button', { name: 'Open…', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('[aria-label="Project name"]')?.value === 'Other project')
  assert.equal(JSON.parse(await readFile(pathC, 'utf8')).client, 'Unpathed edit')
  assert.match(await status.textContent(), /^Saved.*b\.nested/)
  ok('Save (new file) then Open writes the old project and opens the other')

  // E: Discard then reopen A: the discarded edit is gone.
  await dirtyEdit('Discard me')
  await app.evaluate(({ dialog }, p) => { dialog.showMessageBox = async () => ({ response: 1 }); dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] }) }, pathA)
  await page.getByRole('button', { name: 'Open…', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('[aria-label="Project name"]')?.value === 'Replace fixture')
  assert.equal(JSON.parse(await readFile(pathB, 'utf8')).client === 'Discard me', false, 'Discard did not write the file')
  assert.equal(await page.getByLabel('Client name').inputValue(), 'Dirty edit')
  ok('Discard then Open drops the edit without writing it')

  // F: close while dirty: Cancel keeps the window; "Keep recovery and close" exits with a recovery copy.
  await dirtyEdit('Close edit')
  await app.evaluate(({ dialog, BrowserWindow }) => { dialog.showMessageBox = async () => ({ response: 2 }); BrowserWindow.getAllWindows()[0].close() })
  await page.waitForTimeout(800)
  assert.equal(page.isClosed(), false)
  assert.equal(await page.getByLabel('Client name').inputValue(), 'Close edit')
  ok('Close + Cancel keeps the window and edit')
  await page.screenshot({ path: join(out, 'after-cancelled-close.png') })
  const closed = new Promise((r) => app.once('close', r))
  await app.evaluate(({ dialog, BrowserWindow }) => { dialog.showMessageBox = async () => ({ response: 1 }); BrowserWindow.getAllWindows()[0].close() })
  await closed
  const recovery = JSON.parse(await readFile(join(userData, 'recovery.nested'), 'utf8'))
  assert.equal(recovery.client, 'Close edit')
  assert.equal(JSON.parse(await readFile(pathA, 'utf8')).client, 'Dirty edit', 'file not overwritten by close-without-save')
  ok('Keep recovery and close leaves a recovery copy and the saved file untouched')
} finally { await app.close().catch(() => {}) }
assert.deepEqual(errors, [])
console.log(JSON.stringify({ steps, errors }, null, 2))
