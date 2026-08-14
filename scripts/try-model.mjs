/**
 * Run one product through the whole pipeline and watch each stage.
 *
 *   MESHY_API_KEY=... node scripts/try-model.mjs <product url>
 *
 * This is the thing to run before trusting the endpoint, because it spends real
 * credits and takes real minutes, and when it goes wrong you want to know which
 * stage did it. Everything it calls is the code the deployed function calls —
 * no shortcuts, no stubs — so a clean run here means a clean run in the app.
 *
 * The mesh is written to scripts/out/ so it can be inspected, and a matching
 * .html viewer is written next to it so it can be looked at instead.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cacheKeyFor, canonicalProductUrl } from '../src/data/productId.js'
import { isUpgradable } from '../src/data/upgradable.js'
import { pickProductPhoto, isAllowedProductHost } from '../api/_lib/photo.js'
import { createFromImage, poll, hasCredentials } from '../api/_lib/meshy.js'
import { glbToSpec } from '../api/_lib/glb.js'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out')
const budget = Number(process.env.MODEL_TRIANGLE_BUDGET || 3000)

const step = (n, label) => console.log(`\n${n}. ${label}`)
const ok = (msg) => console.log(`   ✓ ${msg}`)
const die = (msg) => {
  console.error(`   ✗ ${msg}`)
  process.exit(1)
}

const raw = process.argv[2]
const model = process.argv[3] || 'sofa'
if (!raw) die('usage: node scripts/try-model.mjs <product url> [model key]')
if (!hasCredentials()) die('MESHY_API_KEY is not set')

step(1, 'Read the link')
const url = canonicalProductUrl(raw)
if (!url) die('that is not a URL')
const key = cacheKeyFor({ url, model })
ok(`tracking stripped → ${url}`)
ok(`cache key         → ${key}`)
if (!isUpgradable(model)) die(`"${model}" is not on the generate list — the built-in builder handles it`)
if (!isAllowedProductHost(url)) die('that retailer is not on the fetch allowlist')

step(2, 'Find a plain product shot')
const photo = await pickProductPhoto(url)
if (!photo.url) die(`no usable photo (${photo.candidates} images scored, all styled scenes or diagrams)`)
ok(`${photo.candidates} images scored, picked the ${photo.kind}`)
ok(photo.url)

step(3, 'Generate (this is the slow part — one to three minutes)')
const job = await createFromImage(photo.url, { polycount: budget })
ok(`job ${job}`)

const started = Date.now()
let result
for (;;) {
  await new Promise((r) => setTimeout(r, 10_000))
  result = await poll(job)
  const mins = ((Date.now() - started) / 60_000).toFixed(1)
  if (result.state === 'pending') {
    process.stdout.write(`   … ${result.progress ?? 0}% after ${mins}m\r`)
    if (Date.now() - started > 8 * 60_000) die('gave up after eight minutes')
    continue
  }
  if (result.state === 'failed') die(result.reason)
  console.log(`   ✓ done in ${mins}m`)
  break
}

step(4, 'Convert to geometry')
const res = await fetch(result.glbUrl)
const glb = await res.arrayBuffer()
ok(`downloaded ${(glb.byteLength / 1024).toFixed(0)}KB of GLB`)

const spec = glbToSpec(glb, { triangleBudget: budget })
ok(`${spec.triangles} triangles, ${(JSON.stringify(spec).length / 1024).toFixed(0)}KB of JSON`)
ok(`proportions at 1m tall: ${spec.widthM}w × ${spec.depthM}d`)
ok(`material ${JSON.stringify(spec.materials[0].rgb)}, tintable: ${spec.materials[0].tint}`)

const floor = Math.min(...spec.positions.filter((_, i) => i % 3 === 1))
if (floor !== 0) console.log(`   ! floor is at y=${floor}, expected 0`)

mkdirSync(OUT, { recursive: true })
const meshPath = join(OUT, `${key}.json`)
writeFileSync(meshPath, JSON.stringify(spec))
ok(`written to scripts/out/${key}.json`)

// A viewer, so the result can be judged at close range rather than guessed at
// from a triangle count. Three is loaded from the project's own node_modules.
const viewer = `<!doctype html><meta charset=utf8><title>${key}</title>
<style>html,body{margin:0;height:100%;background:#e8e6e1;font:13px system-ui}
#hud{position:fixed;left:12px;top:12px;padding:8px 10px;background:#fff;border-radius:6px}</style>
<div id=hud>${key} · ${spec.triangles} tris · drag to orbit</div>
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
const spec = ${JSON.stringify(spec)}
const scene = new THREE.Scene(); scene.background = new THREE.Color('#e8e6e1')
const cam = new THREE.PerspectiveCamera(45, innerWidth/innerHeight, 0.01, 100)
cam.position.set(1.6, 1.1, 1.9)
const r = new THREE.WebGLRenderer({antialias:true}); r.setSize(innerWidth, innerHeight)
r.setPixelRatio(devicePixelRatio); document.body.appendChild(r.domElement)
const g = new THREE.BufferGeometry()
g.setAttribute('position', new THREE.Float32BufferAttribute(spec.positions, 3))
if (spec.indices) g.setIndex(spec.indices)
g.computeVertexNormals()
// The catalog colour, to prove the mesh still takes a tint.
const m = new THREE.MeshStandardMaterial({ color: new THREE.Color('#6E7A72'), roughness: 0.95 })
scene.add(new THREE.Mesh(g, m))
scene.add(new THREE.GridHelper(4, 16, '#bbb', '#ccc'))
scene.add(new THREE.HemisphereLight('#fff', '#8a8377', 2.2))
const key1 = new THREE.DirectionalLight('#fff', 2.2); key1.position.set(2,3,2); scene.add(key1)
const c = new OrbitControls(cam, r.domElement); c.target.set(0,0.4,0); c.update()
addEventListener('resize', () => { cam.aspect = innerWidth/innerHeight; cam.updateProjectionMatrix(); r.setSize(innerWidth, innerHeight) })
;(function loop(){ requestAnimationFrame(loop); c.update(); r.render(scene, cam) })()
</script>`
const viewerPath = join(OUT, `${key}.html`)
writeFileSync(viewerPath, viewer)

console.log(`\nLook at it:  npm run dev  →  http://localhost:5173/scripts/out/${key}.html`)
