// QA10/QA15: Shop zero-result states and scope, duplicate, auto-arrange and undo/redo of each (real Electron; stubbed dialogs).
//   node scripts/shop-edit-checks.mjs <label>
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir, readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

const root = resolve('.')
const out = join(root, 'artifacts', 'quality', `shop-edit-${process.argv[2] || 'run'}`)
await mkdir(out, { recursive: true })
const userData = await mkdtemp(join(tmpdir(), 'nested-shop-'))
const path = join(userData, 'shop.nested')
const env = { ...process.env, NESTED_TEST_USER_DATA: userData }; delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: [root], env })
const steps = []
try {
  const page = await app.firstWindow()
  const errors = []; page.on('pageerror', (e) => errors.push(e.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await app.evaluate(({ dialog }, p) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: p }); dialog.showMessageBox = async () => ({ response: 1 }) }, path)
  await page.getByRole('button', { name: /Skip the Brief/ }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  const search = page.getByLabel('Search the catalog')
  const cards = () => page.locator('.card').count()

  // Zero matches inside "For your style".
  await search.fill('zzzqq')
  await page.getByText(/Nothing matches “zzzqq” in your recommended pieces/).waitFor()
  assert.equal(await page.getByRole('button', { name: /Search all categories/ }).count(), 0, 'no wider search offered when nothing matches anywhere')
  await page.getByRole('button', { name: 'Clear search' }).click()
  assert.ok(await cards() > 3); assert.equal(await search.inputValue(), '')
  steps.push('zero matches anywhere: truthful message, Clear search restores the list')
  // A search that only matches outside the chosen category.
  await page.getByRole('button', { name: 'Seating', exact: true }).click()
  await search.fill('lamp')
  await page.getByText(/Nothing matches “lamp” in Seating/).waitFor()
  const wider = page.getByRole('button', { name: /Search all categories \(\d+ match/ })
  await wider.waitFor()
  await wider.click()
  assert.ok(await cards() > 0, 'cards appear after searching all categories')
  assert.equal(await page.getByRole('button', { name: 'All', exact: true }).getAttribute('aria-pressed'), 'true')
  steps.push('category-scoped miss offers "Search all categories" and it finds the pieces')
  await page.getByRole('button', { name: 'Clear search' }).count()
  await search.fill('')
  await page.screenshot({ path: join(out, 'shop.png') })

  // Duplicate and auto-arrange with undo/redo.
  const placementsOf = async () => { await page.getByRole('button', { name: 'Save', exact: true }).first().click(); await page.waitForFunction(() => document.querySelector('.appbar-status').textContent.includes('Saved')); const d = JSON.parse(await readFile(path, 'utf8')); return { items: d.state.items, placements: d.state.placements } }
  const count = async () => Number((await page.locator('.appbar').innerText()).match(/(\d+) pieces?/)?.[1])
  await page.getByRole('button', { name: /^Add to room/ }).first().click()
  await page.getByRole('button', { name: /^Add to room/ }).nth(1).click()
  await page.waitForFunction(() => /2 pieces/.test(document.querySelector('.appbar').innerText))
  await page.evaluate(() => document.activeElement?.blur())
  await page.keyboard.press(']')
  await page.getByRole('button', { name: 'Duplicate' }).click()
  await page.waitForFunction(() => /3 pieces/.test(document.querySelector('.appbar').innerText))
  const afterDup = await placementsOf()
  assert.equal(afterDup.items.reduce((n, i) => n + i.qty, 0), 3)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  assert.equal(await count(), 2)
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  assert.equal(await count(), 3)
  steps.push('duplicate: 2 -> 3 pieces, undo -> 2, redo -> 3')
  // Put a piece somewhere custom so auto-arrange has something to change.
  await page.evaluate(() => document.activeElement?.blur())
  await page.keyboard.press(']')
  for (let i = 0; i < 6; i++) await page.keyboard.press('Shift+ArrowRight')
  const before = await placementsOf()
  await page.getByRole('button', { name: 'Auto-arrange' }).click()
  await page.waitForTimeout(800)
  const arranged = await placementsOf()
  const moved = JSON.stringify(arranged.placements) !== JSON.stringify(before.placements)
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await page.waitForTimeout(500)
  const undone = await placementsOf()
  assert.deepEqual(undone.placements, before.placements, 'undo restores the placements from before auto-arrange')
  assert.equal(moved, true, 'auto-arrange moved the custom piece')
  steps.push('auto-arrange moved the nudged piece; undo restores every placement exactly')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify(steps, null, 1))
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
