// Real Electron check of the in-app Brief flow: start a Brief, draft persistence,
// the AI assistant (against a stand-in service), review, the exact measured room,
// no auto-furnishing, save, crash recovery. Native dialog selections are stubbed;
// filesystem and IPC are real.
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import { readProject } from '../desktop/files.mjs'

const root = resolve('.')
const output = join(root, 'artifacts', 'brief-flow')
await mkdir(output, { recursive: true })
const userData = await mkdtemp(join(tmpdir(), 'nested-brief-test-'))
const projectPath = join(userData, 'brief-room.nested')

// A stand-in for Nested's assistant service, to check what the app sends and how
// it treats the reply. The real service holds the provider key.
const requests = []
const service = createServer(async (req, res) => {
  let body = ''
  for await (const chunk of req) body += chunk
  requests.push(JSON.parse(body))
  const roomId = requests.at(-1).brief.rooms[0].id
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ reply: 'A calm, warm feeling suits a reading room.', proposals: [
    { roomId, field: 'notes.feeling', value: 'Calm, warm and quiet.', reason: 'From your description.' },
    { roomId, field: 'width', value: 9 },
    { roomId, field: 'geometryVerified', value: true },
  ] }))
}).listen(0, '127.0.0.1')
await new Promise((ok) => service.once('listening', ok))

const env = { ...process.env, NESTED_TEST_USER_DATA: userData, NESTED_AI_URL: `http://127.0.0.1:${service.address().port}/brief-assist` }
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
  page.on('dialog', (d) => d.accept())
  await application.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path })
    dialog.showMessageBox = async () => ({ response: 1 })
  }, projectPath)
  return page
}
const fill = (page, label, value) => page.locator('.brief-editor-main').getByLabel(label, { exact: true }).fill(String(value))
let page
try {
  page = await launch()
  // 1. No upload, no quiz: the app starts a Brief itself.
  await page.getByRole('heading', { name: 'Start with a Brief.' }).waitFor()
  assert.equal(await page.getByText(/Upload|style quiz|Retake/i).count(), 0)
  assert.equal(await page.locator('.canvas-mount').count(), 0)
  await page.screenshot({ path: join(output, '1-start.png') })
  await page.getByRole('button', { name: 'Start a new brief' }).click()
  await page.getByText('OFFICIAL DESIGN BRIEF · V1').waitFor()
  await fill(page, 'Project name', 'Sample measured home')
  await fill(page, 'Client name', 'Sample client')
  await fill(page, 'Studio / company', 'Sample studio')
  await fill(page, 'Designer', 'Sample designer')

  // 2. The draft is part of the project: it survives a crash and restart.
  await page.waitForTimeout(900)
  await application.close()
  page = await launch()
  await page.getByRole('button', { name: 'Restore project', exact: true }).click()
  await page.getByText('OFFICIAL DESIGN BRIEF · V1').waitFor()
  assert.equal(await page.locator('.brief-editor-main').getByLabel('Project name', { exact: true }).inputValue(), 'Sample measured home')

  // 3. Incomplete Briefs cannot create a room.
  await page.getByRole('button', { name: 'Review and create the room' }).click()
  await page.getByRole('alert').filter({ hasText: 'client review' }).waitFor()

  // 4. The assistant proposes; only allowed changes reach the designer.
  await page.getByRole('button', { name: 'Room & floorplan' }).click()
  await fill(page, 'Room name', 'Living room')
  await page.getByLabel('Message the Brief chat').fill('It is a quiet reading room for two.')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await page.getByText('A calm, warm feeling suits a reading room.').waitFor()
  await page.getByText('2 suggestions were ignored').waitFor()
  assert.equal(requests.length, 1)
  assert.deepEqual(requests[0].messages, [{ role: 'user', content: 'It is a quiet reading room for two.' }])
  assert.ok(requests[0].issues.length > 0, 'the chat is told what the Brief still fails')
  const sent = JSON.stringify(requests[0])
  assert.ok(!sent.includes('Sample client') && !sent.includes('dataUrl'), 'client name and attachments are not sent')
  await page.screenshot({ path: join(output, '1b-assistant.png'), fullPage: true })
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  // A follow-up carries the whole conversation; Enter sends.
  await page.getByLabel('Message the Brief chat').fill('Make it richer.')
  await page.getByLabel('Message the Brief chat').press('Enter')
  await page.locator('.brief-msg-assistant').nth(1).waitFor()
  assert.deepEqual(requests[1].messages.map((m) => m.role), ['user', 'assistant', 'user'])
  await page.getByRole('button', { name: 'Colors & atmosphere' }).click()
  assert.equal(await page.getByLabel('How should the room feel?').inputValue(), 'Calm, warm and quiet.')
  await page.getByRole('button', { name: 'Room & floorplan' }).click()
  assert.equal(await page.getByLabel('WIDTH (m)').inputValue(), '') // measurements were not touched

  // 5. The designer enters verified measurements and reviews.
  await fill(page, 'WIDTH (m)', 5.137)
  await fill(page, 'DEPTH (m)', 4.219)
  await fill(page, 'Ceiling height (m)', 2.743)
  await fill(page, 'Plan reference / known scale', 'Measured on site with a laser.')
  await page.getByLabel('Measurement source').selectOption('Designer measured')
  await page.getByLabel('I verified the room dimensions, outline and ceiling height.').check()
  await page.getByRole('button', { name: 'Add opening' }).click()
  await page.getByLabel('Type', { exact: true }).selectOption('window')
  await fill(page, 'Wall edge number', 0)
  await fill(page, 'offset (m)', 1.117)
  await fill(page, 'width (m)', 1.413)
  await fill(page, 'height (m)', 1.257)
  await fill(page, 'sill (m)', 0.811)
  await page.getByLabel('I recorded and verified all openings, including none where appropriate.').check()
  await page.getByLabel('I verified the complete plan, room positions and scale.').check()
  await page.getByRole('button', { name: 'Practical details' }).click()
  await fill(page, 'Reviewed by', 'Sample designer')
  await fill(page, 'Review date', '2026-09-29')
  await page.getByLabel('The designer and client reviewed this brief.').check()
  await page.getByRole('button', { name: 'Review and create the room' }).click()
  await page.getByText('Your measured space is ready.').waitFor()
  await page.screenshot({ path: join(output, '2-review.png'), fullPage: true })
  assert.equal(await page.getByRole('button', { name: 'Create the empty home' }).isDisabled(), true)
  await page.getByLabel('I checked the layout, measurements and supported details above.').check()
  await page.getByRole('button', { name: 'Create the empty home' }).click()

  // 6. One room opens directly as real 3D, exact size shown, nothing furnished.
  await page.locator('.canvas-mount canvas').waitFor()
  await page.getByText('Your room is empty').waitFor()
  await page.getByText(/Nothing is placed for you/).waitFor()
  assert.equal(await page.getByRole('button', { name: /Add the .* set/i }).count(), 0)
  await page.getByRole('button', { name: 'Room', exact: true }).click()
  await page.getByText('5.137 m').waitFor()
  await page.getByRole('button', { name: 'Brief', exact: true }).click()
  await page.getByText('Calm, warm and quiet.').waitFor()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: join(output, '3-room-eye-level.png') })
  await page.getByRole('button', { name: 'Corner' }).click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: join(output, '4-room-corner.png') })

  // 7. The designer furnishes it; save; the file holds the Brief and no draft.
  await page.getByRole('button', { name: 'Pieces', exact: true }).click()
  await page.getByRole('button', { name: /Add to room/ }).first().click()
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('status').filter({ hasText: /^Saved/ }).waitFor()
  const saved = await readProject(projectPath)
  assert.equal(saved.version, 5)
  assert.equal(saved.state.brief.source.project.name, 'Sample measured home')
  assert.equal(saved.state.briefDraft, null)
  assert.equal(saved.state.home.rooms[0].exactW, 5.137)
  assert.equal(saved.state.home.rooms[0].items.length, 1)
  assert.equal(saved.state.home.rooms[0].openings.length, 1) // only what the Brief recorded

  // 8. Crash and restart: the recovery copy restores the Brief project.
  await application.close()
  page = await launch()
  await page.getByRole('button', { name: 'Restore project', exact: true }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  await page.getByRole('button', { name: 'Brief', exact: true }).click()
  await page.getByText('Official Brief v1 · measured room foundation').waitFor()

  // 9. Start another project: back to the start; the saved file is untouched.
  await page.getByRole('button', { name: 'More project actions' }).click()
  await page.getByRole('menuitem', { name: 'New project' }).click()
  await page.getByRole('heading', { name: 'Start with a Brief.' }).waitFor()
  assert.deepEqual(external, [])
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ ok: true, screenshots: output, errors, external, chatRequests: requests.length }, null, 2))
} finally {
  await application?.close().catch(() => {})
  service.close()
}
