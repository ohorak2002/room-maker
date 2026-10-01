// QA39: a real journey in a PACKAGED build (not installer): fonts, bundled materials, private GLB import, save, export, no network, no debug hooks.
//   node scripts/packaged-journey.mjs [path\to\Nested.exe] [label]
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

const exe = resolve(process.argv[2] || 'release/win-arm64-unpacked/Nested.exe')
const out = join(resolve('.'), 'artifacts', 'quality', `packaged-${process.argv[3] || 'run'}`)
await mkdir(out, { recursive: true })
const userData = await mkdtemp(join(tmpdir(), 'nested-pkg-'))
const projectPath = join(userData, 'packaged.nested'), imagePath = join(userData, 'packaged.png')
const fixture = resolve('test', 'fixtures', 'nested-side-table.glb')
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ executablePath: exe, args: [`--user-data-dir=${userData}`], env })
const steps = []
try {
  const page = await app.firstWindow()
  const errors = [], external = [], statuses = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('request', (r) => { if (!/^(nested:|data:|blob:)/.test(r.url())) external.push(r.url()) })
  page.on('response', (r) => { if (r.url().includes('/materials/')) statuses.push([r.url().split('/').pop(), r.status()]) })
  await app.evaluate(({ dialog }, a) => {
    dialog.showSaveDialog = async (_w, o) => ({ canceled: false, filePath: /image/i.test(o.title) ? a.img : a.proj })
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [a.fx] })
    dialog.showMessageBox = async () => ({ response: 1 })
  }, { img: imagePath, proj: projectPath, fx: fixture })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: /Skip the Brief/ }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  await page.getByRole('button', { name: /Add the .* set/ }).click()
  await page.waitForFunction(() => /6 pieces/.test(document.querySelector('.appbar').innerText))
  await page.waitForTimeout(3500)
  // Fonts and bundled maps.
  const fonts = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')) })
  assert.ok(fonts.some((f) => /Instrument Sans/.test(f)) && fonts.some((f) => /Instrument Serif/.test(f)), `fonts loaded: ${fonts}`)
  steps.push(`fonts loaded from the package: ${[...new Set(fonts)].join(', ')}`)
  assert.ok(statuses.length >= 6 && statuses.every(([, s]) => s === 200), JSON.stringify(statuses))
  steps.push(`${statuses.length} bundled material maps served with status 200`)
  // Debug hooks absent.
  assert.equal(await page.evaluate(() => [typeof window.__nestedEngine, typeof window.__nestedMaterials, typeof window.__nestedLegacyPieces].join()), 'undefined,undefined,undefined')
  steps.push('no debug hooks in the packaged renderer')
  // Private GLB import, placement, load.
  await page.getByRole('tab', { name: 'Models' }).click()
  await page.getByRole('button', { name: 'Import GLB model…' }).click()
  await page.getByText('Placed size: W 60.0 × D 60.0 × H 50.0 cm').waitFor()
  await page.getByRole('button', { name: 'Place in room' }).click()
  await page.locator('[data-asset-loaded]').waitFor({ timeout: 30000 })
  assert.match(await page.locator('[data-asset-loaded]').first().innerText(), /Loaded: 3 materials · 2 textures · 1 transmissive/)
  const lib = (await readdir(join(userData, 'assets'))).filter((f) => f.endsWith('.glb'))
  assert.equal(lib.length, 1)
  steps.push('GLB imported into the private library, placed and loaded with 3 materials, 2 textures, 1 transmissive')
  // Save, export.
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('status').filter({ hasText: /^Saved/ }).waitFor()
  const doc = JSON.parse(await readFile(projectPath, 'utf8'))
  assert.equal(doc.version, 5); assert.equal(Object.keys(doc.state.assets).length, 1)
  steps.push('project saved (format v5) with the asset record')
  await page.getByRole('button', { name: 'Export image', exact: true }).click()
  await page.getByText('Room image saved', { exact: true }).waitFor()
  const png = await readFile(imagePath)
  assert.equal(png.subarray(1, 4).toString(), 'PNG'); steps.push(`image exported ${png.readUInt32BE(16)} x ${png.readUInt32BE(20)}`)
  await page.screenshot({ path: join(out, 'packaged-room.png') })
  assert.deepEqual(external, [], `external requests: ${external}`)
  assert.deepEqual(errors, [])
  steps.push('no requests outside nested:, data:, blob:; no page errors')
  console.log(JSON.stringify({ exe, steps }, null, 1))
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
