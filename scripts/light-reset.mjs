// QA16: lighting reset in an ordinary room and in a Brief room that records its own lighting (real Electron).
//   node scripts/light-reset.mjs <label>
import { _electron as electron } from 'playwright'
import { readFileSync } from 'node:fs'
import { mkdtemp, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import { parseBrief, compileBrief, briefFingerprint } from '../shared/brief.mjs'
import { createProject, ROOM_DEFAULTS } from '../shared/project.mjs'
import { writeProject } from '../desktop/files.mjs'

const root = resolve('.')
const out = join(root, 'artifacts', 'quality', `light-reset-${process.argv[2] || 'run'}`)
await mkdir(out, { recursive: true })
const steps = []
async function run(name, prepare, expectInitial, roomName) {
  const userData = await mkdtemp(join(tmpdir(), 'nested-lr-'))
  const env = { ...process.env, NESTED_TEST_USER_DATA: userData }; delete env.ELECTRON_RUN_AS_NODE
  if (prepare) await prepare(userData)
  const app = await electron.launch({ args: [root], env })
  try {
    const page = await app.firstWindow()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    if (prepare) { await page.getByRole('button', { name: 'Restore project', exact: true }).click(); await page.locator('.canvas-mount canvas').waitFor({ state: 'attached' }); await page.getByRole('button', { name: new RegExp(roomName) }).first().click(); await page.waitForTimeout(2500) }
    else { await page.getByRole('button', { name: /Skip the Brief/ }).click(); await page.locator('.canvas-mount canvas').waitFor() }
    await page.getByRole('button', { name: 'Light', exact: true }).first().click()
    const reset = page.getByRole('button', { name: 'Reset lighting' })
    const pressed = () => page.locator('.preset[aria-pressed=true] strong, .chip.active').first().innerText()
    const initial = await pressed()
    if (expectInitial) assert.equal(initial, expectInitial, `${name}: the room's recorded lighting is applied when it opens`)
    assert.equal(await reset.isDisabled(), true, `${name}: reset disabled at defaults`)
    await page.getByRole('button', { name: /Evening/ }).click()
    await page.getByLabel(/^Brightness/).fill('130')
    await page.getByLabel(/^Sun height/).fill('55')
    await page.getByLabel('Accent lighting', { exact: false }).uncheck()
    assert.equal(await reset.isEnabled(), true)
    await page.screenshot({ path: join(out, `${name}-changed.png`) })
    await reset.click()
    assert.equal(await pressed(), initial, `${name}: preset back to ${initial}`)
    assert.equal(await page.getByLabel(/^Brightness/).inputValue(), '100')
    assert.match(await page.locator('label[for=light-sun] output').innerText(), /room default/)
    assert.equal(await page.getByLabel('Accent lighting', { exact: false }).isChecked(), true)
    assert.equal(await reset.isDisabled(), true)
    steps.push(`${name}: reset restores "${initial}", 100%, room-default sun, accent on`)
    await page.screenshot({ path: join(out, `${name}-reset.png`) })
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
}
await run('ordinary room', null)
const ROOMNAME = parseBrief(readFileSync(join(root, 'examples', 'sample-home.nested-brief.json'), 'utf8')).doc.rooms[0].name
await run('brief room (evening-recorded)', async (userData) => {
  const sample = parseBrief(readFileSync(join(root, 'examples', 'sample-home.nested-brief.json'), 'utf8'))
  const doc = sample.doc; doc.rooms[0].lighting = 'golden'
  const state = { ...structuredClone(ROOM_DEFAULTS), home: compileBrief(doc), scope: 'home', onboarded: true, brief: { fingerprint: await briefFingerprint(doc), source: doc } }
  await writeProject(join(userData, 'recovery.nested'), createProject(state, { name: 'Brief lighting' }))
}, 'Golden hour', ROOMNAME)
console.log(JSON.stringify(steps, null, 1))
