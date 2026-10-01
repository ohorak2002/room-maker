// R10: texture/geometry counts while moving between a room and the whole-home overview repeatedly (debug build).
import { _electron as electron } from 'playwright'
import { mkdtemp } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { parseBrief, compileBrief, briefFingerprint } from '../shared/brief.mjs'
import { createProject, ROOM_DEFAULTS } from '../shared/project.mjs'
import { writeProject } from '../desktop/files.mjs'
const root = resolve('.')
const sample = parseBrief(readFileSync(join(root, 'examples', 'sample-home.nested-brief.json'), 'utf8'))
const state = { ...structuredClone(ROOM_DEFAULTS), home: compileBrief(sample.doc), scope: 'home', onboarded: true, brief: { fingerprint: await briefFingerprint(sample.doc), source: sample.doc } }
const userData = await mkdtemp(join(tmpdir(), 'nested-reshome-'))
await writeProject(join(userData, 'recovery.nested'), createProject(state, { name: 'Home' }))
const env = { ...process.env, NESTED_TEST_USER_DATA: userData }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: ['--js-flags=--expose-gc', root], env })
try {
  const page = await app.firstWindow()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Restore project', exact: true }).click()
  await page.locator('.canvas-mount canvas').waitFor({ state: 'attached' })
  await page.getByRole('button', { name: '3D', exact: true }).click(); await page.waitForTimeout(1500)
  const sample1 = () => page.evaluate(async () => { await new Promise((r) => setTimeout(r, 300)); window.gc?.(); const i = window.__nestedEngine.renderer.info; return { geometries: i.memory.geometries, textures: i.memory.textures } })
  const rows = [{ step: 'overview', ...await sample1() }]
  for (let n = 1; n <= 12; n++) {
    await page.locator('.canvas-mount canvas').click({ position: { x: 650, y: 430 } }); await page.waitForTimeout(1200)
    if (!(await page.getByText(/Nothing in here yet|Done ·|pieces? in/).count() + await page.locator('button[aria-label="Back to all rooms"], .room-chip button').count())) throw new Error('trip ' + n + ': did not enter a room')
    await page.getByRole('button', { name: 'Back to all rooms' }).or(page.locator('button[aria-label*="back" i]')).first().click({ timeout: 5000 }).catch(async () => { await page.locator('.room-chip button').first().click() })
    await page.waitForTimeout(900)
    if (n % 4 === 0) rows.push({ step: `after ${n} room<->overview trips`, ...await sample1() })
  }
  for (const r of rows) console.log(JSON.stringify(r))
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
