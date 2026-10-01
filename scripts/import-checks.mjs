// QA12/QA13: GLB import failures, cancel, duplicates, shared placements and model removal (real Electron; stubbed dialog; synthetic files).
//   node scripts/import-checks.mjs <label>
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

const root = resolve('.')
const out = join(root, 'artifacts', 'quality', `import-${process.argv[2] || 'run'}`)
await mkdir(out, { recursive: true })
const userData = await mkdtemp(join(tmpdir(), 'nested-import-'))
const files = await mkdtemp(join(tmpdir(), 'nested-glb-'))
const good = await readFile(join(root, 'test', 'fixtures', 'nested-side-table.glb'))
const truncated = join(files, 'truncated.glb'); await writeFile(truncated, good.subarray(0, 200))
const goodPath = join(files, 'good.glb'); await writeFile(goodPath, good)
// Self-consistent GLB whose JSON refers to an external file.
const json = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'outside.bin', byteLength: 4 }], scenes: [{ nodes: [] }] }))
const pad = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)])
const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + pad.length, 8); header.writeUInt32LE(pad.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
const external = join(files, 'external.glb'); await writeFile(external, Buffer.concat([header, pad]))
const huge = join(files, 'huge.glb'); await writeFile(huge, Buffer.alloc(101 * 1024 * 1024))

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
  await page.getByRole('tab', { name: 'Models' }).click()
  const pick = (path) => app.evaluate(({ dialog }, p) => { dialog.showOpenDialog = async () => (p ? { canceled: false, filePaths: [p] } : { canceled: true }) }, path)
  const importBtn = page.getByRole('button', { name: 'Import GLB model…' })
  const msg = page.locator('.models-message')
  const cards = () => page.locator('.asset-card').count()
  const library = async () => (await readdir(join(userData, 'assets')).catch(() => [])).filter((f) => f.endsWith('.glb'))

  await pick(null); await importBtn.click(); await page.waitForTimeout(400)
  assert.equal(await cards(), 0); assert.equal(await msg.count(), 0); assert.equal(await importBtn.isEnabled(), true)
  steps.push('cancel: nothing added, button usable')
  for (const [name, path, re] of [['truncated', truncated, /./], ['external reference', external, /./], ['over 100 MB', huge, /100 MB/]]) {
    await pick(path); await importBtn.click()
    await msg.waitFor(); const text = await msg.innerText()
    assert.match(text, re)
    assert.equal(await cards(), 0, `${name}: no card`); assert.deepEqual(await library(), [], `${name}: nothing written to the library`)
    assert.equal(await importBtn.isEnabled(), true, `${name}: not stuck busy`)
    steps.push(`${name}: "${text.slice(0, 80)}"`)
  }
  await page.screenshot({ path: join(out, 'failed-import.png') })

  await pick(goodPath); await importBtn.click()
  await page.getByText('Placed size: W 60.0 × D 60.0 × H 50.0 cm').waitFor()
  assert.equal((await library()).length, 1)
  await pick(goodPath); await importBtn.click()
  await page.getByText(/is already in this project/).waitFor()
  assert.equal(await cards(), 1); assert.equal((await library()).length, 1)
  steps.push('duplicate content: one card, one library file, clear message')

  const place = page.getByRole('button', { name: /^Place in room/ })
  await place.click(); await place.click()
  await page.getByRole('button', { name: 'Place in room (2 placed)' }).waitFor()
  const remove = page.getByRole('button', { name: 'Remove from project' })
  assert.equal(await remove.isDisabled(), true)
  await page.getByText(/2 placed\. Remove them from the rooms first/).waitFor()
  steps.push('two placements of one model; Remove from project disabled while placed')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.getByRole('button', { name: 'Place in room (1 placed)' }).waitFor()
  assert.equal(await remove.isDisabled(), true)
  assert.equal((await library()).length, 1, 'library file kept while a copy remains')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.getByRole('button', { name: 'Place in room', exact: true }).waitFor()
  assert.equal(await remove.isEnabled(), true)
  await remove.click()
  await page.waitForFunction(() => document.querySelectorAll('.asset-card').length === 0)
  assert.equal((await library()).length, 1, 'removing from the project keeps the private library file')
  steps.push('removing the model from the project keeps the library file')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.asset-card').length === 1)
  steps.push('undo restores the model record')
  await page.screenshot({ path: join(out, 'models.png') })
  assert.deepEqual(errors, [])
  console.log(JSON.stringify(steps, null, 1))
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
