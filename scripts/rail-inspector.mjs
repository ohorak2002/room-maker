// U04: the tool rail and the inspector must always agree (real Electron; synthetic Brief project).
//   node scripts/rail-inspector.mjs <label>
import { _electron as electron } from 'playwright'
import { readFileSync } from 'node:fs'
import { mkdtemp, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import { createProject, ROOM_DEFAULTS } from '../shared/project.mjs'
import { parseBrief, compileBrief, briefFingerprint } from '../shared/brief.mjs'
import { writeProject } from '../desktop/files.mjs'

const root = resolve('.')
const out = join(root, 'artifacts', 'quality', `rail-inspector-${process.argv[2] || 'run'}`)
await mkdir(out, { recursive: true })
const sample = parseBrief(readFileSync(join(root, 'examples', 'sample-home.nested-brief.json'), 'utf8'))
const fingerprint = await briefFingerprint(sample.doc)
const state = { ...structuredClone(ROOM_DEFAULTS), home: compileBrief(sample.doc), scope: 'home', onboarded: true, brief: { fingerprint, source: sample.doc } }
const userData = await mkdtemp(join(tmpdir(), 'nested-rail-'))
await writeProject(join(userData, 'recovery.nested'), createProject(state, { name: 'Rail fixture' }))
const env = { ...process.env, NESTED_TEST_USER_DATA: userData }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: [root], env })
const log = []
try {
  const page = await app.firstWindow()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 1 }) })
  await page.getByRole('button', { name: 'Restore project', exact: true }).click()
  await page.locator('.canvas-mount canvas').waitFor({ state: 'attached' })
  const agree = async (label) => {
    const pressed = await page.locator('.rail-btn[aria-pressed=true]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
    const open = await page.locator('.inspector').count()
    const heading = open ? await page.locator('.inspector-head h2').innerText() : null
    log.push({ label, pressed, heading })
    if (open) assert.equal(pressed.length, 1, `${label}: exactly one rail button pressed while the inspector is open (${pressed}) for "${heading}"`)
    else assert.equal(pressed.length, 0, `${label}: no rail button pressed when the inspector is closed`)
    await page.screenshot({ path: join(out, `${label.replace(/\W+/g, '-')}.png`) })
  }
  await agree('start')
  for (const name of ['Brief', 'Room', 'Finishes', 'Light', 'Views', 'Pieces']) {
    await page.getByRole('button', { name, exact: true }).first().click()
    await agree(`after ${name}`)
  }
  await page.getByRole('button', { name: 'Pieces', exact: true }).first().click() // collapse
  await agree('collapsed')
  await page.getByRole('button', { name: 'Brief', exact: true }).first().click()
  await agree('brief again')
  // Replace the project with one that has no Brief while the Brief tab is active.
  await page.getByRole('button', { name: 'More project actions' }).click()
  await page.getByRole('menuitem', { name: 'New project', exact: true }).click()
  await page.getByRole('button', { name: /Skip the Brief/ }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  await agree('new project without a Brief')
  console.log(JSON.stringify(log, null, 1))
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
