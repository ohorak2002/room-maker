// Full-window captures of the room studio shell in real Electron, for review:
// every inspector panel at a few window sizes, presentation mode, and a saved
// view. Writes artifacts/studio/<width>x<height>-<name>.png.
//   node scripts/studio-captures.mjs [widthxheight ...]     (default: three sizes)
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { createProject, ROOM_DEFAULTS } from '../shared/project.mjs'
import { writeProject } from '../desktop/files.mjs'

const sizes = (process.argv.slice(2).length ? process.argv.slice(2) : ['1000x700', '1440x900', '1920x1080']).map((s) => s.split('x').map(Number))
const root = resolve('.')
const out = join(root, 'artifacts', 'studio')
await mkdir(out, { recursive: true })
const userData = await mkdtemp(join(tmpdir(), 'nested-studio-'))
const state = structuredClone(ROOM_DEFAULTS)
Object.assign(state, {
  onboarded: true, floorplan: 'living', items: ['sofa', 'coffee-table', 'floor-lamp', 'rug'].map((id) => ({ id, qty: 1 })),
  placements: {
    'rug#0': { x: 0, y: 0, z: -0.3, ry: 0, zone: 'center' }, 'sofa#0': { x: 0, y: 0, z: -2.15, ry: 0, zone: 'floor' },
    'coffee-table#0': { x: 0, y: 0, z: -0.8, ry: 0, zone: 'center' }, 'floor-lamp#0': { x: -1.7, y: 0, z: -2.3, ry: 0, zone: 'floor' },
  },
})
await writeProject(join(userData, 'recovery.nested'), createProject(state, { name: 'The Willow House', client: 'Demo client' }))
const env = { ...process.env, NESTED_TEST_USER_DATA: userData }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: [root], env })
const errors = []
try {
  const page = await app.firstWindow()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Restore project', exact: true }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  for (const [w, h] of sizes) {
    await app.evaluate(({ BrowserWindow }, [w, h]) => {
      const win = BrowserWindow.getAllWindows()[0]
      win.setMinimumSize(600, 500)
      win.setContentSize(w, h)
    }, [w, h])
    await page.waitForTimeout(1800)
    const tag = `${w}x${h}`
    for (const [rail, name] of [['Room', 'room'], ['Pieces', 'pieces'], ['Finishes', 'finishes'], ['Light', 'light'], ['Views', 'views']]) {
      const button = page.getByRole('button', { name: rail, exact: true })
      if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: join(out, `${tag}-${name}.png`) })
    }
    if (w === 1440) {
      // Shop cards for the two pilot pieces (thumbnails come from the same builders).
      await page.getByRole('button', { name: 'Pieces', exact: true }).click().catch(() => {})
      await page.getByRole('tab', { name: 'Shop' }).click()
      for (const [term, name] of [['sofa', 'shop-sofa'], ['coffee', 'shop-table']]) {
        await page.getByPlaceholder(/Search/).first().fill(term)
        await page.waitForTimeout(1500)
        await page.screenshot({ path: join(out, `${tag}-${name}.png`) })
      }
      await page.getByPlaceholder(/Search/).first().fill('')
    }
    // Inspector collapsed, then presentation.
    await page.getByRole('button', { name: 'Close inspector' }).click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: join(out, `${tag}-collapsed.png`) })
    await page.getByRole('button', { name: 'Present', exact: true }).click()
    await page.waitForTimeout(700)
    await page.screenshot({ path: join(out, `${tag}-present.png`) })
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Pieces', exact: true }).click()
  }
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
console.log(errors.length ? `page errors: ${errors.join('; ')}` : 'no page errors')
