// Captures the Shop's Greenery cards (real Electron) for before/after comparison of plant models.
//   node scripts/shop-greenery.mjs <label>
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
const root = resolve('.')
const out = join(root, 'artifacts', 'quality', `greenery-${process.argv[2] || 'run'}`)
await mkdir(out, { recursive: true })
const env = { ...process.env, NESTED_TEST_USER_DATA: await mkdtemp(join(tmpdir(), 'nested-green-')) }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: [root], env })
try {
  const page = await app.firstWindow()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: /Skip the Brief/ }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  await page.getByRole('button', { name: 'Greenery', exact: true }).click()
  await page.waitForTimeout(2500)
  const cards = page.locator('.card')
  const n = await cards.count()
  for (let i = 0; i < n; i++) {
    const name = (await cards.nth(i).locator('.card-name').innerText()).replace(/\W+/g, '-').slice(0, 30)
    await cards.nth(i).locator('.card-photo').screenshot({ path: join(out, `${String(i).padStart(2, '0')}-${name}.png`) })
  }
  console.log(n, 'cards')
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
