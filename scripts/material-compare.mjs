// Repeatable before/after captures for the material pilot (sofa + coffee table).
// Build first with `VITE_NESTED_DEBUG=1 npx vite build`, then:
//   node scripts/material-compare.mjs <label>        e.g. before | after
// Writes artifacts/material/<label>/<light>-<view>.png at a fixed 1600 x 900,
// pixel ratio 1, from fixed cameras, with a pinned layout, for two lightings:
// daylight ('natural') and evening ('moody'). Also samples idle frame intervals
// in the real window before resizing for capture, and writes timing.json.
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { createProject, ROOM_DEFAULTS } from '../shared/project.mjs'
import { writeProject } from '../desktop/files.mjs'

const label = process.argv[2] || 'run'
const root = resolve('.')
const out = join(root, 'artifacts', 'material', label)
await mkdir(out, { recursive: true })

const LIGHTS = [['day', 'natural'], ['evening', 'moody']]
// Pinned layout in the 7 x 5.5 m living room (sofa faces +z).
const placements = {
  'rug#0': { x: 0, y: 0, z: -0.3, ry: 0, zone: 'center' },
  'sofa#0': { x: 0, y: 0, z: -2.15, ry: 0, zone: 'floor' },
  'coffee-table#0': { x: 0, y: 0, z: -0.8, ry: 0, zone: 'center' },
  'floor-lamp#0': { x: -1.7, y: 0, z: -2.3, ry: 0, zone: 'floor' },
}
// position, target, fov. Room coordinates in metres.
const VIEWS = {
  'room-eye': { p: [1.0, 1.6, 2.45], t: [-0.1, 0.8, -1.8], fov: 52 },
  'room-high': { p: [3.0, 2.2, 2.5], t: [0, 0.5, -1.2], fov: 52 },
  'wall-corner': { p: [0.5, 1.6, 2.3], t: [-2.6, 1.7, -2.7], fov: 60 },
  'room-wide': { p: [0, 1.7, 2.6], t: [0, 1.3, -2.7], fov: 75 },
  'window-frame': { p: [-0.6, 1.5, -0.8], t: [0.4, 1.5, -2.7], fov: 50 },
  'near-wall': { p: [0.4, 1.6, -2.4], t: [0.4, 1.5, -3.2], fov: 65 },
  'level-wide': { p: [0, 1.6, 2.5], t: [0, 1.6, -3], fov: 65 },
  'lamp-room': { p: [2.2, 1.5, 1.2], t: [-1.7, 1.2, -2.3], fov: 50 },
  'sofa-arm-seam': { p: [-0.2, 0.78, -0.85], t: [-0.8, 0.42, -1.75], fov: 45 },
  'sofa-fabric-leg': { p: [-0.6, 0.32, -0.95], t: [-0.9, 0.12, -1.81], fov: 45 },
  'table-top-edge': { p: [0.55, 0.78, -0.1], t: [0.15, 0.4, -0.75], fov: 45 },
  'table-legs': { p: [0.75, 0.4, -0.15], t: [0.05, 0.16, -0.8], fov: 45 },
}

const timing = {}
for (const [lightName, lighting] of LIGHTS) {
  const userData = await mkdtemp(join(tmpdir(), 'nested-material-'))
  const state = structuredClone(ROOM_DEFAULTS)
  Object.assign(state, {
    onboarded: true, floorplan: 'living', lighting,
    // NESTED_ITEMS=a,b,c replaces the pinned pilot set (placements then come from the app's own layout).
    items: (process.env.NESTED_ITEMS ? process.env.NESTED_ITEMS.split(',') : ['sofa', 'coffee-table', 'floor-lamp', 'rug']).map((id) => ({ id, qty: 1 })),
    placements: process.env.NESTED_ITEMS ? {} : placements,
  })
  await writeProject(join(userData, 'recovery.nested'), createProject(state, { name: 'Material pilot' }))
  const env = { ...process.env, NESTED_TEST_USER_DATA: userData }
  delete env.ELECTRON_RUN_AS_NODE
  const app = await electron.launch({ args: [root], env })
  try {
    const page = await app.firstWindow()
    // NESTED_LEGACY=1: render the old sofa and table under the current lighting.
    if (process.env.NESTED_LEGACY) await page.evaluate(() => { window.__nestedLegacyPieces = true }) // before Restore builds the room
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByRole('button', { name: 'Restore project', exact: true }).click()
    await page.locator('.canvas-mount canvas').waitFor()
    await page.waitForTimeout(2500)
    await page.evaluate(() => window.__nestedMaterials?.ready())
    await page.waitForTimeout(1500)

    // Optional experiment hook (NESTED_PRE_JS), run against the engine `e` before timing/capture.
    if (process.env.NESTED_PRE_JS) await page.evaluate(`(() => { const e = window.__nestedEngine; ${process.env.NESTED_PRE_JS} })()`)

    // Idle frame intervals at the real window size, eye-level camera.
    timing[lightName] = await page.evaluate(async (v) => {
      const e = window.__nestedEngine
      const { camera, controls } = e
      controls.minDistance = 0.01; controls.maxDistance = 100
      controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI
      camera.fov = v.fov; camera.updateProjectionMatrix()
      camera.position.set(...v.p); controls.target.set(...v.t); controls.update()
      await new Promise((r) => setTimeout(r, 800))
      const times = []
      let prev
      await new Promise((resolve) => {
        const f = (t) => { if (prev !== undefined) times.push(t - prev); prev = t; if (times.length < 240) requestAnimationFrame(f); else resolve() }
        requestAnimationFrame(f)
      })
      times.sort((a, b) => a - b)
      const c = e.renderer.domElement
      return { median: times[120], p95: times[228], canvas: [c.width, c.height], samples: times.length }
    }, VIEWS['room-eye'])

    const only = process.env.NESTED_ONLY ? process.env.NESTED_ONLY.split(',') : null
    for (const [name, v] of Object.entries(VIEWS)) {
      if (only && !only.includes(name)) continue
      const data = await page.evaluate((v) => {
        const e = window.__nestedEngine
        const { camera, controls, renderer, composer } = e
        const W = 1600, H = 900
        renderer.setPixelRatio(1); composer.setPixelRatio(1)
        renderer.setSize(W, H, false); composer.setSize(W, H)
        e.setAoDivisor(2)
        camera.aspect = W / H; camera.fov = v.fov; camera.updateProjectionMatrix()
        camera.position.set(...v.p); controls.target.set(...v.t); controls.update()
        renderer.shadowMap.needsUpdate = true
        e.outline.visible = false; e.ghost.visible = false
        composer.render()
        return renderer.domElement.toDataURL('image/png')
      }, v)
      await writeFile(join(out, `${lightName}-${name}.png`), Buffer.from(data.split(',')[1], 'base64'))
      if (process.env.NESTED_DIAGNOSTICS && name === 'table-top-edge') {
        const diagnostics = await page.evaluate(() => {
          const e = window.__nestedEngine
          const table = e.room.handles.find(n => n.userData.itemId === 'coffee-table')
          const top = table.getObjectByName('top')
          const material = top.material
          const p = top.geometry.attributes.position, n = top.geometry.attributes.normal
          let maxY = -Infinity
          for (let i = 0; i < p.count; i++) maxY = Math.max(maxY, p.getY(i))
          const normals = []
          for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i) - maxY) < 1e-5 && Math.hypot(p.getX(i), p.getZ(i)) < 0.45) normals.push(n.getY(i))
          const facts = { topY: maxY, flatTopNormalsY: [Math.min(...normals), Math.max(...normals)], frontSide: material.side, vertices: p.count, maps: window.__nestedMaterials.stats() }
          const images = {}
          const capture = name => { e.renderer.shadowMap.needsUpdate = true; e.composer.render(); images[name] = e.renderer.domElement.toDataURL('image/png') }
          for (const mode of ['normal-off', 'roughness-constant', 'neutral', 'shadows-off']) {
            const trial = material.clone()
            const lights = []
            top.material = trial
            try {
              if (mode === 'normal-off') trial.normalScale.set(0, 0)
              if (mode === 'roughness-constant') { trial.roughnessMap = null; trial.roughness = 0.55 }
              if (mode === 'neutral') { trial.map = null; trial.normalMap = null; trial.roughnessMap = null; trial.color.setHex(0x888888); trial.vertexColors = false; trial.roughness = 0.6 }
              if (mode === 'shadows-off') e.scene.traverse(o => { if (o.isLight && o.castShadow) { lights.push(o); o.castShadow = false } })
              trial.needsUpdate = true
              capture(mode)
            } finally { top.material = material; lights.forEach(l => { l.castShadow = true }); trial.dispose() }
          }
          capture('restored')
          return { facts, images }
        })
        await writeFile(join(out, `${lightName}-diagnostics.json`), JSON.stringify(diagnostics.facts, null, 2))
        for (const [mode, data] of Object.entries(diagnostics.images)) await writeFile(join(out, `${lightName}-table-${mode}.png`), Buffer.from(data.split(',')[1], 'base64'))
      }
    }
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
}
await writeFile(join(out, 'timing.json'), JSON.stringify({ label, note: 'rAF intervals, 240 frames, idle, reduced motion, real window, eye-level camera', timing }, null, 2))
console.log(JSON.stringify(timing, null, 2))
