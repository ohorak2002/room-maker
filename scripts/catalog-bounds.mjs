// QA24/R02: measured bounds of every built-in catalog piece against its declared height/footprint, floor contact and pivot.
// Needs the debug build (`VITE_NESTED_DEBUG=1 npx vite build`); rebuild normally afterwards.
//   node scripts/catalog-bounds.mjs <label>
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { createProject, ROOM_DEFAULTS } from '../shared/project.mjs'
import { writeProject } from '../desktop/files.mjs'
import { CATALOG } from '../src/data/catalog.js'

const root = resolve('.')
const out = join(root, 'artifacts', 'quality', `catalog-bounds-${process.argv[2] || 'run'}`)
await mkdir(out, { recursive: true })
const items = CATALOG
const placements = {}
items.forEach((it, i) => { placements[`${it.id}#0`] = { x: (i % 10) * 2.2 - 11, y: 0, z: Math.floor(i / 10) * 2.2 - 8, ry: 0} })
const state = { ...structuredClone(ROOM_DEFAULTS), onboarded: true, floorplan: 'living', items: items.map((it) => ({ id: it.id, qty: 1 })), placements }
const userData = await mkdtemp(join(tmpdir(), 'nested-bounds-'))
await writeProject(join(userData, 'recovery.nested'), createProject(state, { name: 'Bounds' }))
const env = { ...process.env, NESTED_TEST_USER_DATA: userData }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: [root], env })
try {
  const page = await app.firstWindow()
  await page.getByRole('button', { name: 'Restore project', exact: true }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  await page.waitForTimeout(4000)
  const measured = await page.evaluate(() => {
    const e = window.__nestedEngine, rows = []
    const THREE_Box = e.scene.constructor && null
    for (const h of e.room.handles) {
      h.updateWorldMatrix(true, true)
      let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity], meshes = 0, tris = 0
      h.traverse((o) => {
        if (!o.isMesh || !o.geometry) return
        meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3
        // Real vertices (not bounding-box corners, which inflate rotated parts).
        const pos = o.geometry.attributes.position
        const v = o.position.clone()
        for (let i = 0; i < pos.count; i++) {
          v.set(pos.getX(i), pos.getY(i), pos.getZ(i))
          o.localToWorld(v)
          if (v.x < min[0]) min[0] = v.x; if (v.y < min[1]) min[1] = v.y; if (v.z < min[2]) min[2] = v.z
          if (v.x > max[0]) max[0] = v.x; if (v.y > max[1]) max[1] = v.y; if (v.z > max[2]) max[2] = v.z
        }
      })
      const p = h.position
      rows.push({ id: h.userData.itemId, zone: h.userData.zone, meshes, tris, min: min.map((v, i) => v - [p.x, p.y, p.z][i]), max: max.map((v, i) => v - [p.x, p.y, p.z][i]) })
    }
    return rows
  })
  const byId = Object.fromEntries(items.map((i) => [i.id, i]))
  const report = measured.map((m) => {
    const it = byId[m.id]
    const w = m.max[0] - m.min[0], h = m.max[1] - m.min[1], d = m.max[2] - m.min[2]
    const flags = []
    const floorLike = m.zone === 'floor' || m.zone === 'center'
    if (floorLike && Math.abs(m.min[1]) > 0.02 && it.model !== 'rug') flags.push(`base at ${m.min[1].toFixed(3)} m, not the floor`)
    if (Math.abs(h - it.h) / it.h > 0.15 && floorLike) flags.push(`height ${h.toFixed(2)} vs declared ${it.h}`)
    const half = Math.max(w, d) / 2
    if (half > it.fp * 1.3) flags.push(`half-extent ${half.toFixed(2)} exceeds footprint radius ${it.fp} by >30%`)
    if (floorLike && half < it.fp * 0.45) flags.push(`half-extent ${half.toFixed(2)} far below footprint radius ${it.fp}`)
    const cx = (m.min[0] + m.max[0]) / 2, cz = (m.min[2] + m.max[2]) / 2
    if (floorLike && Math.hypot(cx, cz) > Math.max(w, d) * 0.15) flags.push(`pivot off-centre by (${cx.toFixed(2)}, ${cz.toFixed(2)})`)
    if (!m.meshes) flags.push('no geometry')
    return { id: m.id, model: it.model, zone: m.zone, w: +w.toFixed(3), d: +d.toFixed(3), h: +h.toFixed(3), declaredH: it.h, fp: it.fp, minY: +m.min[1].toFixed(3), meshes: m.meshes, tris: m.tris, flags }
  })
  const missing = items.filter((i) => !measured.some((m) => m.id === i.id)).map((i) => i.id)
  await writeFile(join(out, 'report.json'), JSON.stringify({ count: measured.length, catalog: items.length, missing, report }, null, 1))
  console.log(`measured ${measured.length}/${items.length}; not built: ${missing.join(', ') || 'none'}`)
  for (const r of report.filter((r) => r.flags.length)) console.log(`${r.id} (${r.model}, ${r.zone}): ${r.flags.join('; ')}`)
  console.log('flagged:', report.filter((r) => r.flags.length).length, ' max tris:', Math.max(...report.map((r) => r.tris)))
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
