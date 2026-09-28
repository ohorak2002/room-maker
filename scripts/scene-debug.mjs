// Development-only scene inspection in real Electron. Build first with
// `VITE_NESTED_DEBUG=1 npx vite build` so the engine hook is exposed, then:
//   node scripts/scene-debug.mjs <name> "<js run in the page before capture>"
// Writes artifacts/debug-<name>.png from the canvas.
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { createProject, ROOM_DEFAULTS } from '../shared/project.mjs'
import { writeProject } from '../desktop/files.mjs'

const [name = 'scene', script = ''] = process.argv.slice(2)
const root = resolve('.')
await mkdir(join(root, 'artifacts'), { recursive: true })
const userData = await mkdtemp(join(tmpdir(), 'nested-debug-'))
const state = structuredClone(ROOM_DEFAULTS)
Object.assign(state, { onboarded: true, floorplan: 'living', items: ['sofa', 'coffee-table', 'floor-lamp', 'rug'].map(id => ({ id, qty: 1 })), placements: { 'coffee-table#0': { x: 0, y: 0, z: 0.4, ry: 0, zone: 'center' } } })
await writeProject(join(userData, 'recovery.nested'), createProject(state, { name: 'Debug room' }))
const env = { ...process.env, NESTED_TEST_USER_DATA: userData }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: [root], env })
try {
  const page = await app.firstWindow()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Restore project', exact: true }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  await page.waitForTimeout(1500)
  if (script) console.log(JSON.stringify(await page.evaluate(`(async () => { const e = window.__nestedEngine; ${script} })()`)))
  await page.waitForTimeout(400)
  await page.locator('.canvas-mount canvas').screenshot({ path: join(root, 'artifacts', `debug-${name}.png`) })
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
