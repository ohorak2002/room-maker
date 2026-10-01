// QA35/R10: renderer resource counts across repeated rebuilds (needs `VITE_NESTED_DEBUG=1 npx vite build`; rebuild normally afterwards).
//   node scripts/resource-growth.mjs <label>
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'

const root = resolve('.')
const out = join(root, 'artifacts', 'quality', `resources-${process.argv[2] || 'run'}`)
await mkdir(out, { recursive: true })
const env = { ...process.env, NESTED_TEST_USER_DATA: await mkdtemp(join(tmpdir(), 'nested-res-')) }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: ['--js-flags=--expose-gc', root], env })
try {
  const page = await app.firstWindow()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: /Skip the Brief/ }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  await page.getByRole('button', { name: /Add the .* set/ }).click()
  await page.waitForTimeout(2500)
  const sample = () => page.evaluate(async () => {
    const e = window.__nestedEngine
    await new Promise((r) => setTimeout(r, 300))
    window.gc?.()
    const i = e.renderer.info
    return { geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs?.length ?? null, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null }
  })
  const samples = [{ step: 'start', ...await sample() }]
  // Rebuild the room repeatedly: light preset + wall material changes rebuild the scene.
  const presets = [/Golden hour/, /Evening/, /Soft daylight/]
  for (let n = 1; n <= 30; n++) {
    const lightBtn = page.getByRole('button', { name: 'Light', exact: true }).first()
    if (await lightBtn.getAttribute('aria-pressed') !== 'true') await lightBtn.click()
    await page.getByRole('button', { name: presets[n % 3] }).click({ timeout: 5000 })
    await page.waitForTimeout(250)
    if (n % 5 === 0) samples.push({ step: `after ${n} lighting changes`, ...await sample() })
  }
  // Room size changes force geometry rebuilds.
  const roomBtn = page.getByRole('button', { name: 'Room', exact: true }).first()
  if (await roomBtn.getAttribute('aria-pressed') !== 'true') await roomBtn.click()
  for (let n = 1; n <= 10; n++) {
    for (const shape of ['Bedroom', 'Living Room']) { await page.getByRole('button', { name: shape, exact: true }).click({ timeout: 5000 }); await page.waitForTimeout(400) }
  }
  samples.push({ step: 'after 20 room-shape switches', ...await sample() })
  await writeFile(join(out, 'samples.json'), JSON.stringify(samples, null, 1))
  for (const s of samples) console.log(JSON.stringify(s))
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
