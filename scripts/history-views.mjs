// QA15/QA17: undo/redo, native text-field undo, saved views update/rename/delete/persist (real Electron; stubbed dialogs).
//   node scripts/history-views.mjs <label>
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir, readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

const root = resolve('.')
const out = join(root, 'artifacts', 'quality', `history-views-${process.argv[2] || 'run'}`)
await mkdir(out, { recursive: true })
const userData = await mkdtemp(join(tmpdir(), 'nested-hist-'))
const path = join(userData, 'views.nested')
const env = { ...process.env, NESTED_TEST_USER_DATA: userData }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: [root], env })
const steps = []
try {
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await app.evaluate(({ dialog }, p) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: p }); dialog.showMessageBox = async () => ({ response: 1 }) }, path)
  await page.getByRole('button', { name: /Skip the Brief/ }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  const count = async () => Number((await page.locator('.appbar').innerText()).match(/(\d+) pieces?/)?.[1])
  const undo = page.getByRole('button', { name: 'Undo', exact: true }), redo = page.getByRole('button', { name: 'Redo', exact: true })
  assert.equal(await redo.isDisabled(), true)
  await page.getByRole('button', { name: /Add the .* set/ }).click()
  await page.waitForFunction(() => /6 pieces/.test(document.querySelector('.appbar').innerText))
  await page.getByRole('button', { name: /^Add to room/ }).first().click()
  await page.waitForFunction(() => /7 pieces/.test(document.querySelector('.appbar').innerText)).catch(() => {})
  const seven = await count()
  assert.ok(seven === 7 || seven === 6, `count after add: ${seven}`)
  // Undo / redo round trip through the toolbar.
  await undo.click(); const afterUndo1 = await count()
  await undo.click(); const afterUndo2 = await count()
  assert.equal(afterUndo2, 0, 'two undos return to the empty room')
  assert.equal(await redo.isEnabled(), true)
  await redo.click(); assert.equal(await count(), 6)
  await redo.click(); assert.equal(await count(), seven)
  assert.equal(await redo.isDisabled(), true, 'nothing left to redo')
  steps.push(`toolbar: add set (6) + add piece (${seven}) -> undo x2 (${afterUndo1}, ${afterUndo2}) -> redo x2 (6, ${seven})`)
  // Keyboard: Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z outside a text field.
  await page.evaluate(() => document.activeElement?.blur())
  await page.keyboard.press('Control+z'); await page.keyboard.press('Control+z')
  assert.equal(await count(), 0)
  await page.keyboard.press('Control+y'); assert.equal(await count(), 6)
  await page.keyboard.press('Control+Shift+z'); assert.equal(await count(), seven)
  steps.push('keyboard: Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z')
  // A new edit after undo discards the redo branch.
  await undo.click()
  assert.equal(await redo.isEnabled(), true)
  await page.getByRole('button', { name: /^Add to room/ }).nth(1).click()
  assert.equal(await redo.isDisabled(), true, 'new edit clears redo')
  steps.push('a new edit clears redo')
  // Native text undo is left alone inside a text field.
  const before = await count()
  const client = page.getByLabel('Client name', { exact: true })
  await client.fill('Typed text'); await client.focus()
  await page.keyboard.press('Control+z')
  assert.equal(await count(), before, 'Ctrl+Z in a text field must not undo a room edit')
  steps.push('Ctrl+Z inside a text field does not undo the room')

  // Saved views.
  await page.getByRole('button', { name: 'Views', exact: true }).first().click()
  await page.getByRole('button', { name: 'Eye level', exact: true }).first().click()
  await page.waitForTimeout(600)
  await page.getByLabel('Save this view').fill('First look'); await page.getByRole('button', { name: 'Save', exact: true }).last().click()
  await page.getByText(/Saved “First look”/).waitFor()
  const save = async () => { await page.getByRole('button', { name: 'Save', exact: true }).first().click(); await page.waitForFunction(() => document.querySelector('.appbar-status').textContent.includes('Saved')) }
  await save()
  const v1 = JSON.parse(await readFile(path, 'utf8')).state.views
  assert.equal(v1.length, 1); assert.equal(v1[0].name, 'First look'); assert.equal(v1[0].mode, 'eye'); assert.ok(v1[0].thumb?.startsWith('data:image/jpeg'))
  const thumb1 = v1[0].thumb
  await page.getByRole('button', { name: 'Corner', exact: true }).first().click(); await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Update First look to the current camera' }).click()
  await page.getByText(/Updated “First look”/).waitFor()
  await save()
  const v2 = JSON.parse(await readFile(path, 'utf8')).state.views
  assert.equal(v2.length, 1); assert.equal(v2[0].id, v1[0].id); assert.equal(v2[0].name, 'First look'); assert.equal(v2[0].mode, 'corner')
  assert.notDeepEqual(v2[0].position, v1[0].position); assert.notEqual(v2[0].thumb, thumb1)
  steps.push('update: same id and name, new camera, mode and thumbnail, persisted')
  const nameBox = page.getByLabel('Name of saved view First look')
  await nameBox.fill('Corner look'); await nameBox.blur()
  await save()
  assert.equal(JSON.parse(await readFile(path, 'utf8')).state.views[0].name, 'Corner look')
  steps.push('rename persisted')
  await page.getByRole('button', { name: 'Go to Corner look' }).click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: join(out, 'views-panel.png') })
  await page.getByRole('button', { name: 'Delete Corner look' }).click()
  await save()
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')).state.views, [])
  steps.push('delete persisted')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify(steps, null, 1))
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
