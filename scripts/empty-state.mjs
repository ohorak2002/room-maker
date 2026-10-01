// Checks the empty-room offer in real Electron: a living room offers the living-room set, not the bedroom pack.
//   node scripts/empty-state.mjs <label>   (normal build)
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import { createProject, ROOM_DEFAULTS } from '../shared/project.mjs'
import { writeProject } from '../desktop/files.mjs'

const label = process.argv[2] || 'run'
const root = resolve('.')
const out = join(root, 'artifacts', 'quality', label)
await mkdir(out, { recursive: true })
const results = {}
for (const [floorplan, expected] of [['living', /living room set/i], ['bedroom', /bedroom set/i]]) {
  const userData = await mkdtemp(join(tmpdir(), 'nested-empty-'))
  const state = structuredClone(ROOM_DEFAULTS)
  Object.assign(state, { onboarded: true, floorplan, items: [], placements: {} })
  await writeProject(join(userData, 'recovery.nested'), createProject(state, { name: 'Empty room' }))
  const env = { ...process.env, NESTED_TEST_USER_DATA: userData }
  delete env.ELECTRON_RUN_AS_NODE
  const app = await electron.launch({ args: [root], env })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'Restore project', exact: true }).click()
    await page.locator('.canvas-mount canvas').waitFor()
    await page.waitForTimeout(1500)
    const offer = await page.getByRole('button', { name: /^Add the / }).first().innerText()
    results[floorplan] = offer
    assert.match(offer, expected)
    assert.doesNotMatch(offer, /cozy/i)
    await page.screenshot({ path: join(out, `empty-${floorplan}.png`) })
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
}
console.log(JSON.stringify(results))
