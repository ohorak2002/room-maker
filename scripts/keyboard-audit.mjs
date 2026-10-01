// QA18 (measured parts): tab order, focus visibility, menu/Escape, rail and range keys (real Electron).
//   node scripts/keyboard-audit.mjs <label>
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

const root = resolve('.')
const out = join(root, 'artifacts', 'quality', `keyboard-${process.argv[2] || 'run'}`)
await mkdir(out, { recursive: true })
const env = { ...process.env, NESTED_TEST_USER_DATA: await mkdtemp(join(tmpdir(), 'nested-kb-')) }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: [root], env })
const result = {}
try {
  const page = await app.firstWindow()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: /Skip the Brief/ }).focus()
  await page.keyboard.press('Enter')
  await page.locator('.canvas-mount canvas').waitFor()
  await page.waitForTimeout(1200)
  const describe = () => page.evaluate(() => {
    const e = document.activeElement; if (!e || e === document.body) return null
    const s = getComputedStyle(e)
    const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none')
    const r = e.getBoundingClientRect()
    const name = (e.getAttribute('aria-label') || e.innerText || e.getAttribute('title') || e.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 40)
    return { tag: e.tagName.toLowerCase(), name, ring: Boolean(ring), inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth }
  })
  await page.evaluate(() => document.body.focus())
  const order = []
  for (let i = 0; i < 45; i++) { await page.keyboard.press('Tab'); const d = await describe(); if (d) order.push(d) }
  result.tabOrder = order.map((d) => `${d.tag}:${d.name}${d.ring ? '' : ' [NO RING]'}${d.inView ? '' : ' [OFFSCREEN]'}`)
  result.noRing = order.filter((d) => !d.ring).length
  result.offscreen = order.filter((d) => !d.inView).length
  // Rail: Enter/Space on a rail button switches the inspector.
  await page.getByRole('button', { name: 'Light', exact: true }).first().focus()
  await page.keyboard.press('Enter')
  assert.equal(await page.locator('.inspector-head h2').innerText(), 'Light & atmosphere')
  await page.getByRole('button', { name: 'Views', exact: true }).first().focus()
  await page.keyboard.press('Space')
  assert.equal(await page.locator('.inspector-head h2').innerText(), 'Camera & views')
  result.rail = 'Enter and Space switch panels'
  // Range: arrow keys change the value.
  await page.getByRole('button', { name: 'Light', exact: true }).first().click()
  const slider = page.getByLabel(/^Brightness/)
  await slider.focus()
  const before = await slider.inputValue(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight')
  const after = await slider.inputValue()
  assert.notEqual(after, before); result.range = `${before} -> ${after} with ArrowRight`
  // Menu: opens by keyboard, arrows move, Escape closes and returns focus to the trigger.
  const trigger = page.getByRole('button', { name: 'More project actions' })
  await trigger.focus(); await page.keyboard.press('Enter')
  await page.getByRole('menuitem').first().waitFor()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  result.menuClosed = (await page.getByRole('menuitem').count()) === 0
  result.menuFocusReturned = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'More project actions')
  // Non-drag placement route: add a piece by keyboard from the Shop, then it appears in the room count.
  await page.getByRole('button', { name: 'Pieces', exact: true }).first().click()
  const add = page.getByRole('button', { name: /^Add to room/ }).first()
  await add.focus(); await page.keyboard.press('Enter')
  await page.waitForFunction(() => /1 piece/.test(document.querySelector('.appbar')?.innerText || document.body.innerText))
  result.addByKeyboard = 'Enter on Add to room adds a piece'
  // Select the placed piece from the keyboard, nudge it, rotate it, then delete it.
  await page.evaluate(() => document.activeElement?.blur())
  assert.equal(await page.locator('.hud-hint').innerText().then((t) => /switch piece/.test(t)), false, 'nothing selected yet')
  await page.keyboard.press(']')
  await page.waitForFunction(() => /switch piece/.test(document.querySelector('.hud-hint')?.innerText || ''))
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('r')
  await page.keyboard.press('Delete')
  await page.waitForFunction(() => /0 pieces/.test(document.body.innerText))
  result.selectByKeyboard = '] selects a placed piece; arrows, R and Delete then act on it'
  await writeFile(join(out, 'report.json'), JSON.stringify(result, null, 1))
  console.log(JSON.stringify(result, null, 1))
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
