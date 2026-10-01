// QA19 (measured parts only): unnamed controls, small targets, text contrast per panel (real Electron).
//   node scripts/a11y-audit.mjs <label>
// Does NOT test screen-reader behaviour.
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'

const root = resolve('.')
const out = join(root, 'artifacts', 'quality', `a11y-${process.argv[2] || 'run'}`)
await mkdir(out, { recursive: true })
const env = { ...process.env, NESTED_TEST_USER_DATA: await mkdtemp(join(tmpdir(), 'nested-a11y-')) }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: [root], env })
const report = {}
const audit = () => {
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
  const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { c: p.slice(0, 3), a: p[3] ?? 1 } }
  const bgOf = (el) => { let e = el; let acc = [255, 255, 255]; const stack = []; while (e) { const b = parse(getComputedStyle(e).backgroundColor); if (b && b.a > 0) { stack.push(b); if (b.a >= 1) break } e = e.parentElement } for (const b of stack.reverse()) acc = acc.map((v, i) => v * (1 - b.a) + b.c[i] * b.a); return acc }
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
  const name = (el) => (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.innerText || el.labels?.[0]?.innerText || el.innerText || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim()
  const unnamed = [], small = [], lowContrast = []
  const controls = [...document.querySelectorAll('button, a[href], input, select, textarea, [role=button], [role=tab], [role=menuitem]')].filter(visible)
  for (const el of controls) {
    const r = el.getBoundingClientRect()
    const tag = `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}`
    if (!name(el)) unnamed.push(tag)
    if ((r.width < 24 || r.height < 24) && el.type !== 'range' && el.type !== 'hidden') small.push(`${tag} "${name(el).slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`)
  }
  const seen = new Set()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const t = walker.currentNode; const el = t.parentElement
    if (!el || !t.textContent.trim() || !visible(el) || el.closest('canvas,script,style') || seen.has(el)) continue
    seen.add(el)
    const s = getComputedStyle(el); const fg = parse(s.color); if (!fg) continue
    const bg = bgOf(el); const fgc = fg.c.map((v, i) => v * fg.a + bg[i] * (1 - fg.a))
    const L1 = lum(fgc), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    const px = parseFloat(s.fontSize), bold = parseInt(s.fontWeight) >= 700
    const large = px >= 24 || (px >= 18.66 && bold)
    const need = large ? 3 : 4.5
    if (ratio < need && !el.disabled && !el.closest('[disabled]') && !el.closest('[aria-disabled=true]')) lowContrast.push(`${ratio.toFixed(2)} < ${need} "${t.textContent.trim().slice(0, 40)}" (${px}px)`)
  }
  return { controls: controls.length, unnamed, small, lowContrast }
}
try {
  const page = await app.firstWindow()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: /Skip the Brief/ }).waitFor(); report.start = await page.evaluate(audit)
  await page.getByRole('button', { name: /Skip the Brief/ }).click()
  await page.locator('.canvas-mount canvas').waitFor()
  await page.waitForTimeout(1200)
  report.size = await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio])
  for (const p of ['Room', 'Pieces', 'Finishes', 'Light', 'Views']) {
    const b = page.getByRole('button', { name: p, exact: true }).first()
    if (await b.getAttribute('aria-pressed') !== 'true') await b.click()
    await page.waitForTimeout(400)
    report[p] = await page.evaluate(audit)
  }
  await page.getByRole('button', { name: 'Pieces', exact: true }).first().click()
  await page.getByRole('button', { name: /Add the .* set/ }).click()
  await page.waitForTimeout(1500)
  report.furnished = await page.evaluate(audit)
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 1))
  for (const [k, v] of Object.entries(report)) if (v.controls !== undefined) console.log(k, `controls=${v.controls} unnamed=${v.unnamed.length} small=${v.small.length} lowContrast=${v.lowContrast.length}`)
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
