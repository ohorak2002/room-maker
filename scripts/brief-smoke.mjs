// Real Electron check of the Upload Brief flow: gate, review, exact room, no
// auto-furnishing, official export/upload round trip, project save and recovery.
// Native dialog selections are stubbed; filesystem and IPC are real.
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import { readProject } from '../desktop/files.mjs'
import { parseBrief, briefFingerprint } from '../shared/brief.mjs'

const root = resolve('.')
const output = join(root, 'artifacts', 'brief-flow')
await mkdir(output, { recursive: true })
const userData = await mkdtemp(join(tmpdir(), 'nested-brief-test-'))
const samplePath = join(root, 'examples', 'sample-home.nested-brief.json')
const badNamePath = join(userData, 'notes.json')
await writeFile(badNamePath, '{}')
const notOfficial = join(userData, 'other.nested-brief.json')
await writeFile(notOfficial, JSON.stringify({ format: 'generic', producer: 'someone' }))
const exportedPath = join(userData, 'exported.nested-brief.json')
const draftPath = join(userData, 'saved.nested-brief-draft.json')
const projectPath = join(userData, 'brief-room.nested')
const sample = parseBrief(await readFile(samplePath, 'utf8'))
const fingerprint = await briefFingerprint(sample.doc)
const env = { ...process.env, NESTED_TEST_USER_DATA: userData }
delete env.ELECTRON_RUN_AS_NODE
const errors = []
const external = []
let application
const launch = async () => {
  application = await electron.launch({ args: [root], env, timeout: 60000 })
  const page = await application.firstWindow()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('request', (req) => { if (!/^(nested|data|blob):/.test(req.url())) external.push(req.url()) })
  await application.evaluate(({ dialog }, paths) => {
    globalThis.__next = {}
    dialog.showOpenDialog = async (_w, o) => ({ canceled: false, filePaths: [globalThis.__next[o.title] ?? paths.project] })
    dialog.showSaveDialog = async (_w, o) => ({ canceled: false, filePath: globalThis.__next[o.title] ?? paths.project })
    dialog.showMessageBox = async () => ({ response: 1 })
  }, { project: projectPath })
  return page
}
const choose = (title, path) => application.evaluate((_e, [t, p]) => { globalThis.__next[t] = p }, [title, path])
let page
try {
  page = await launch()
  // 1. The gate replaces the old questionnaire: no bypass, no quiz.
  await page.getByRole('heading', { name: 'Upload your Brief.' }).waitFor()
  assert.equal(await page.getByText(/style quiz|Retake/i).count(), 0)
  assert.equal(await page.locator('.canvas-mount').count(), 0)
  await page.screenshot({ path: join(output, '1-gate.png') })

  // 2. Wrong files are refused with a plain reason and change nothing.
  await choose('Upload Nested Brief', badNamePath)
  await page.getByRole('button', { name: 'Upload Brief…' }).click()
  await page.getByRole('alert').filter({ hasText: 'official .nested-brief.json' }).waitFor()
  await choose('Upload Nested Brief', notOfficial)
  await page.getByRole('button', { name: 'Upload Brief…' }).click()
  await page.getByText('A few details need attention.').waitFor()
  await page.getByText(/Upload an official \.nested-brief\.json exported from the Nested Brief editor/).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Create the empty home' }).count(), 0)

  // 3. The official sample: review first, create only after confirmation.
  await choose('Upload Nested Brief', samplePath)
  await page.getByRole('button', { name: 'Upload Brief…' }).click()
  await page.getByText('Your measured space is ready.').waitFor()
  await page.getByText('5.137 × 4.219 × 2.743 m').first().waitFor()
  assert.equal(await page.getByRole('button', { name: 'Create the empty home' }).isDisabled(), true)
  await page.screenshot({ path: join(output, '2-review.png'), fullPage: true })

  // 4. Official export/upload round trip through the editor.
  await page.getByRole('button', { name: 'Create or complete the official Brief' }).click()
  await page.getByText('OFFICIAL DESIGN BRIEF · V1').waitFor()
  await choose('Save official Brief', exportedPath)
  await choose('Save Brief draft', draftPath)
  await page.getByRole('button', { name: 'Save official Brief…' }).click()
  await page.getByText(/Official Brief saved to/).waitFor()
  await page.getByRole('button', { name: 'Save draft…' }).click()
  await page.getByText(/Draft saved to/).waitFor()
  assert.deepEqual(parseBrief(await readFile(exportedPath, 'utf8')).errors, [])
  assert.equal(JSON.parse(await readFile(draftPath, 'utf8')).format, 'nested-official-design-brief')
  // An incomplete brief cannot be exported: clearing the reviewer is refused.
  await page.getByRole('button', { name: 'Practical details' }).click()
  await page.getByLabel('Reviewed by').fill('')
  await page.getByRole('button', { name: 'Save official Brief…' }).click()
  await page.getByRole('alert').filter({ hasText: 'client review' }).waitFor()
  await choose('Open Brief draft', draftPath)
  await page.getByRole('button', { name: 'Open draft…' }).click()
  await page.getByText(/saved\.nested-brief-draft\.json opened/).waitFor()
  await page.getByRole('button', { name: 'Back to Upload Brief' }).click()
  await choose('Upload Nested Brief', exportedPath)
  await page.getByRole('button', { name: 'Upload Brief…' }).click()
  await page.getByText('Your measured space is ready.').waitFor()
  await page.getByLabel('I checked the layout, measurements and supported details above.').check()
  await page.getByRole('button', { name: 'Create the empty home' }).click()

  // 5. Several rooms open on the exact measured plan; a room opens as real 3D.
  await page.getByText('Measured floorplan').waitFor()
  await page.screenshot({ path: join(output, '3a-home-plan.png') })
  await page.getByRole('button', { name: /^Living room · / }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  await page.getByText('Your room is empty').waitFor()
  await page.getByText(/Nothing is placed for you/).waitFor()
  assert.equal(await page.getByRole('button', { name: /Add the .* set/i }).count(), 0)
  await page.getByRole('button', { name: 'Room', exact: true }).click()
  await page.getByText('5.137 m').waitFor()
  await page.getByRole('button', { name: 'Brief', exact: true }).click()
  await page.getByText('Official Brief v1 · measured room foundation').waitFor()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: join(output, '3-room-eye-level.png') })
  await page.getByRole('button', { name: 'Overview', exact: true }).click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: join(output, '4-room-overview.png') })
  await page.getByRole('button', { name: 'Corner' }).click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: join(output, '5-room-corner.png') })

  // 6. The designer furnishes it; save; the project reopens with its Brief.
  await page.getByRole('button', { name: 'Pieces', exact: true }).click()
  await page.getByRole('button', { name: /Add to room/ }).first().click()
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('status').filter({ hasText: /^Saved/ }).waitFor()
  const saved = await readProject(projectPath)
  assert.equal(saved.version, 4)
  assert.equal(saved.state.brief.fingerprint, fingerprint)
  assert.equal(saved.state.home.rooms[0].exactW, 5.137)
  assert.equal(saved.state.home.rooms[0].items.length, 1)
  assert.equal(saved.state.home.rooms[0].openings.length, 2) // only what the Brief recorded

  // 7. Crash and restart: the recovery copy restores the Brief project.
  await application.close()
  page = await launch()
  await page.getByRole('button', { name: 'Restore project', exact: true }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  await page.getByRole('button', { name: 'Brief', exact: true }).click()
  await page.getByText('Official Brief v1 · measured room foundation').waitFor()

  // 8. Start another project: back to Upload Brief; the saved file is untouched.
  await page.getByRole('button', { name: 'More project actions' }).click()
  await page.getByRole('menuitem', { name: 'New project' }).click()
  await page.getByRole('heading', { name: 'Upload your Brief.' }).waitFor()
  assert.deepEqual(external, [])
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ ok: true, screenshots: output, errors, external }, null, 2))
} finally {
  await application?.close().catch(() => {})
}
