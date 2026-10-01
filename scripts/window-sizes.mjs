// QA21: layout at minimum, 1440x900 and 1920x1080 (real Electron). Measures horizontal overflow, clipped/overlapping controls; saves captures.
//   node scripts/window-sizes.mjs <label>
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'

const root = resolve('.')
const out = join(root, 'artifacts', 'quality', `sizes-${process.argv[2] || 'run'}`)
await mkdir(out, { recursive: true })
const env = { ...process.env, NESTED_TEST_USER_DATA: await mkdtemp(join(tmpdir(), 'nested-sizes-')) }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: [root], env })
const report = []
const check = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
  const issues = []
  const doc = document.documentElement
  if (doc.scrollWidth > innerWidth + 1) issues.push(`page scrolls horizontally (${doc.scrollWidth} > ${innerWidth})`)
  const controls = [...document.querySelectorAll('button, input, select, textarea, [role=tab]')].filter(vis)
  const name = (e) => (e.getAttribute('aria-label') || e.innerText || e.placeholder || e.tagName).trim().slice(0, 30)
  for (const el of controls) {
    const r = el.getBoundingClientRect()
    if (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1) {
      // Inside a scroll container is fine.
      let p = el.parentElement, scrolled = false
      while (p) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowX + s.overflowY) && p.scrollHeight + p.scrollWidth > 0) { const pr = p.getBoundingClientRect(); if (r.right <= pr.right + 1 || /(auto|scroll)/.test(s.overflowX)) { scrolled = true; break } } p = p.parentElement }
      if (!scrolled) issues.push(`control off-window: ${name(el)} (${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)})`)
    }
    if (el.scrollWidth > el.clientWidth + 2 && el.tagName === 'BUTTON' && getComputedStyle(el).overflow !== 'visible') issues.push(`button text clipped: ${name(el)}`)
  }
  // Toolbar / rail overlaps: any two visible controls in the room overlay that intersect.
  const overlay = [...document.querySelectorAll('.canvas-toolbar button, .canvas-toolbar select, .room-chip, .canvas-root .tool-btn, .canvas-root .tool-icon, .export-size')].filter(vis)
  for (let i = 0; i < overlay.length; i++) for (let j = i + 1; j < overlay.length; j++) {
    const a = overlay[i].getBoundingClientRect(), b = overlay[j].getBoundingClientRect()
    if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1 && !overlay[i].contains(overlay[j]) && !overlay[j].contains(overlay[i])) issues.push(`overlap: ${name(overlay[i])} / ${name(overlay[j])}`)
  }
  return { issues, inner: [innerWidth, innerHeight, devicePixelRatio] }
}
try {
  const page = await app.firstWindow()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const resize = async (w, h) => { await app.evaluate(({ BrowserWindow }, s) => { const win = BrowserWindow.getAllWindows()[0]; win.setContentSize(s[0], s[1]) }, [w, h]); await page.waitForTimeout(700) }
  const sizes = [[1000, 700], [1440, 900], [1920, 1080]]
  for (const [w, h] of sizes) { await resize(w, h); const r = await page.evaluate(check); report.push({ screen: 'start', w, h, ...r }); await page.screenshot({ path: join(out, `start-${w}.png`) }) }
  await page.getByRole('button', { name: /Skip the Brief/ }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  await page.getByRole('button', { name: /Add the .* set/ }).click()
  await page.waitForTimeout(1500)
  for (const [w, h] of sizes) {
    await resize(w, h)
    for (const p of ['Pieces', 'Room', 'Finishes', 'Light', 'Views']) {
      const b = page.getByRole('button', { name: p, exact: true }).first()
      if (await b.getAttribute('aria-pressed') !== 'true') await b.click()
      await page.waitForTimeout(350)
      const r = await page.evaluate(check)
      report.push({ screen: p, w, h, ...r })
      await page.screenshot({ path: join(out, `${p.toLowerCase()}-${w}.png`) })
    }
  }
  // Long and Unicode project text at the minimum size.
  await resize(1000, 700)
  const long = 'Résidence Hörák — 東京のアパート ' + 'très long nom de projet '.repeat(8)
  await page.getByLabel('Project name', { exact: true }).fill(long)
  await page.getByLabel('Client name', { exact: true }).fill('שלום עולם ' + 'Client with an extremely long family name '.repeat(6))
  await page.waitForTimeout(500)
  const r = await page.evaluate(check)
  const bar = await page.evaluate(() => { const b = document.querySelector('.appbar'); const save = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Save'); const sr = save.getBoundingClientRect(); return { barScrolls: b ? b.scrollWidth > b.clientWidth + 1 : null, saveVisible: sr.right <= innerWidth && sr.left >= 0 } })
  report.push({ screen: 'long-text', w: 1000, h: 700, inner: r.inner, issues: [...r.issues, ...(bar.saveVisible ? [] : ['Save button pushed off-window']), ...(bar.barScrolls ? ['project bar overflows'] : [])] })
  await page.screenshot({ path: join(out, 'long-text-1000.png') })
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 1))
  for (const r of report) console.log(`${r.screen} ${r.w}x${r.h} (inner ${r.inner.join('x')}): ${r.issues.length ? r.issues.join(' | ') : 'ok'}`)
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
