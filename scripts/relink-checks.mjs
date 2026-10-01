// QA13/QA04: a missing library file is flagged and relinked by re-importing the same file (placement kept); second save keeps a .bak (real Electron; stubbed dialogs).
//   node scripts/relink-checks.mjs <label>
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir, readFile, rm, access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

const root = resolve('.')
const out = join(root, 'artifacts', 'quality', `relink-${process.argv[2] || 'run'}`)
await mkdir(out, { recursive: true })
const userData = await mkdtemp(join(tmpdir(), 'nested-relink-'))
const path = join(userData, 'relink.nested')
const fixture = resolve('test', 'fixtures', 'nested-side-table.glb')
const id = createHash('sha256').update(await readFile(fixture)).digest('hex')
const lib = join(userData, 'assets', `${id}.glb`)
const env = { ...process.env, NESTED_TEST_USER_DATA: userData }; delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: [root], env })
const steps = []
try {
  const page = await app.firstWindow()
  const errors = []; page.on('pageerror', (e) => errors.push(e.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await app.evaluate(({ dialog }, a) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: a.p })
    dialog.showOpenDialog = async (_w, o) => ({ canceled: false, filePaths: [/GLB/.test(o.title) ? a.f : a.p] })
    dialog.showMessageBox = async () => ({ response: 1 })
  }, { p: path, f: fixture })
  await page.getByRole('button', { name: /Skip the Brief/ }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  await page.getByRole('tab', { name: 'Models' }).click()
  await page.getByRole('button', { name: 'Import GLB model…' }).click()
  await page.getByText('Placed size: W 60.0 × D 60.0 × H 50.0 cm').waitFor()
  await page.getByRole('button', { name: 'Place in room' }).click()
  await page.locator('[data-asset-loaded]').waitFor({ timeout: 30000 })
  const save = async () => { await page.getByRole('button', { name: 'Save', exact: true }).first().click(); await page.waitForFunction(() => document.querySelector('.appbar-status').textContent.includes('Saved')) }
  await save()
  const first = await readFile(path, 'utf8')
  const placementsBefore = JSON.parse(first).state.placements
  // A second save keeps the previous file as .bak.
  await page.getByLabel('Client name', { exact: true }).fill('Second save'); await save()
  assert.equal(await readFile(`${path}.bak`, 'utf8'), first, '.bak holds the previous save')
  steps.push('second save leaves the previous save as .bak')
  // Lose the library file, reopen the project: flagged missing, nothing crashes.
  await rm(lib)
  await page.getByRole('button', { name: 'Open…', exact: true }).click()
  await page.waitForTimeout(2500)
  await page.getByRole('tab', { name: 'Models' }).click()
  await page.getByRole('alert').filter({ hasText: /Model file is missing/ }).waitFor()
  await page.screenshot({ path: join(out, 'missing.png') })
  steps.push('missing library file: clear warning with the file name, no crash')
  // Relink by importing the same file again.
  await page.getByRole('button', { name: 'Import GLB model…' }).click()
  await page.locator('[data-asset-loaded]').waitFor({ timeout: 30000 })
  await access(lib)
  assert.equal(await page.getByRole('alert').filter({ hasText: /Model file is missing/ }).count(), 0)
  await save()
  const after = JSON.parse(await readFile(path, 'utf8')).state
  assert.deepEqual(after.placements, placementsBefore, 'placement unchanged after relinking')
  assert.equal(Object.keys(after.assets).length, 1)
  steps.push('re-importing the same file restores the model, the placement is untouched')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify(steps, null, 1))
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
