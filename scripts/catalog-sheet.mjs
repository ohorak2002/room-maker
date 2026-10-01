// QA24 (visual): every catalog piece in rows from a fixed camera. Debug build required.
//   node scripts/catalog-sheet.mjs <label>
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { createProject, ROOM_DEFAULTS } from '../shared/project.mjs'
import { writeProject } from '../desktop/files.mjs'
import { CATALOG as ALL } from '../src/data/catalog.js'
const PICK = process.env.NESTED_PICK ? process.env.NESTED_PICK.split(',') : null
const CATALOG = PICK ? PICK.map((id) => ALL.find((c) => c.id === id)) : ALL

const root = resolve('.')
const out = join(root, 'artifacts', 'quality', `catalog-sheet-${process.argv[2] || 'run'}`)
await mkdir(out, { recursive: true })
const PER = 8, GAP = 2.0
const placements = {}
CATALOG.forEach((it, i) => { placements[`${it.id}#0`] = { x: (i % PER) * GAP - (PER - 1) * GAP / 2, y: 0, z: Math.floor(i / PER) * 2.4 - 32, ry: 0 } })
const state = { ...structuredClone(ROOM_DEFAULTS), onboarded: true, floorplan: 'living', lighting: process.env.NESTED_LIGHT || 'natural', items: CATALOG.map((it) => ({ id: it.id, qty: 1 })), placements }
const userData = await mkdtemp(join(tmpdir(), 'nested-sheet-'))
await writeProject(join(userData, 'recovery.nested'), createProject(state, { name: 'Sheet' }))
const env = { ...process.env, NESTED_TEST_USER_DATA: userData }; delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: [root], env })
try {
  const page = await app.firstWindow()
  await page.getByRole('button', { name: 'Restore project', exact: true }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  await page.waitForTimeout(4000)
  const rows = Math.ceil(CATALOG.length / PER)
  for (let r = 0; r < rows; r++) {
    const data = await page.evaluate((r) => {
      const e = window.__nestedEngine
      const { camera, controls, renderer, composer } = e
      controls.minDistance = 0.01; controls.maxDistance = 100; controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI
      const W = 1800, H = 520
      renderer.setPixelRatio(1); composer.setPixelRatio(1); renderer.setSize(W, H, false); composer.setSize(W, H); e.setAoDivisor(2)
      camera.aspect = W / H; camera.fov = 38; camera.updateProjectionMatrix()
      const z = r * 2.4 - 32
      camera.position.set(0, 2.2, z + 6.2); controls.target.set(0, 0.8, z); controls.update()
      e.outline.visible = false; e.ghost.visible = false
      // Show the whole row regardless of room walls: hide cutaway-layer walls/ceiling from this camera.
      for (const h of e.room.handles) h.visible = Math.abs(h.position.z - z) < 0.1
      e.renderer.shadowMap.needsUpdate = true
      composer.render()
      return renderer.domElement.toDataURL('image/png')
    }, r)
    await writeFile(join(out, `row-${r}.png`), Buffer.from(data.split(',')[1], 'base64'))
  }
  await writeFile(join(out, 'order.json'), JSON.stringify(CATALOG.map((c, i) => `${Math.floor(i / PER)}:${i % PER} ${c.id}`), null, 1))
  console.log(rows, 'rows')
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
