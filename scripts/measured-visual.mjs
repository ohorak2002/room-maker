// QA23 (visual part): measured L-shaped room and a diagonal-wall room in real Electron, overview / eye level / corner.
//   node scripts/measured-visual.mjs <label>
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { newBrief, compileBrief, briefFingerprint } from '../shared/brief.mjs'
import { createProject, ROOM_DEFAULTS } from '../shared/project.mjs'
import { writeProject } from '../desktop/files.mjs'

const root = resolve('.')
const out = join(root, 'artifacts', 'quality', `measured-${process.argv[2] || 'run'}`)
await mkdir(out, { recursive: true })
const specs = {
  L: { name: 'L room', w: 6, d: 5, outline: [[0, 0], [6, 0], [6, 2], [3.5, 2], [3.5, 5], [0, 5]],
    openings: [{ id: 'w1', edge: 3, type: 'window', offset: 0.5, width: 1.2, height: 1.2, sill: 0.9 }, { id: 'd1', edge: 0, type: 'door', offset: 1, width: 0.9, height: 2.1, sill: 0 }, { id: 'w2', edge: 5, type: 'window', offset: 1, width: 1.5, height: 1.3, sill: 0.8 }] },
  Diagonal: { name: 'Diagonal room', w: 5, d: 4.5, outline: [[0, 0], [5, 0], [5, 3], [2, 4.5], [0, 4.5]],
    openings: [{ id: 'd2', edge: 2, type: 'door', offset: 1, width: 0.9, height: 2.1, sill: 0 }, { id: 'w3', edge: 0, type: 'window', offset: 1, width: 2, height: 1.3, sill: 0.9 }] },
  NoWindow: { name: 'Windowless', w: 4, d: 3.5, outline: [], openings: [{ id: 'd3', edge: 0, type: 'door', offset: 1, width: 0.9, height: 2.1, sill: 0 }] },
}
for (const [key, spec] of Object.entries(specs)) {
  const d = newBrief()
  d.project = { name: key, client: 'Test', studio: 'Test', designer: 'Test' }
  d.plan.layoutVerified = true; d.review = { approved: true, reviewedBy: 'Test', date: '2026-09-30' }
  Object.assign(d.rooms[0], { name: spec.name, kind: 'living', width: spec.w, depth: spec.d, height: 2.7, measurementSource: 'Designer measured', geometryVerified: true, openingsVerified: true, outline: spec.outline.map(([x, z]) => ({ x, z })), openings: spec.openings })
  const state = { ...structuredClone(ROOM_DEFAULTS), home: compileBrief(d), scope: 'home', onboarded: true, brief: { fingerprint: await briefFingerprint(d), source: d } }
  const userData = await mkdtemp(join(tmpdir(), 'nested-measured-'))
  await writeProject(join(userData, 'recovery.nested'), createProject(state, { name: key }))
  const env = { ...process.env, NESTED_TEST_USER_DATA: userData }
  delete env.ELECTRON_RUN_AS_NODE
  const app = await electron.launch({ args: [root], env })
  try {
    const page = await app.firstWindow()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByRole('button', { name: 'Restore project', exact: true }).click()
    await page.locator('.canvas-mount canvas').waitFor({ state: 'attached' })
    await page.waitForTimeout(1800)
    await page.screenshot({ path: join(out, `${key}-open.png`) })
    await page.getByRole('button', { name: '3D', exact: true }).click(); await page.waitForTimeout(1500)
    await page.screenshot({ path: join(out, `${key}-3d.png`) })
    await page.locator('.canvas-mount canvas').click({ position: { x: 650, y: 430 } }); await page.waitForTimeout(2500)
    await page.screenshot({ path: join(out, `${key}-inside.png`) })
    for (const view of ['Overview', 'Eye level', 'Corner']) {
      const b = page.getByRole('button', { name: view, exact: true }).first()
      if (await b.count()) { await b.click(); await page.waitForTimeout(1200); await page.screenshot({ path: join(out, `${key}-${view.replace(' ', '-')}.png`) }) }
    }
    console.log(key, 'captured')
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
}
