// Launch a packaged build (default: release/win-arm64-unpacked/Nested.exe) with
// a temporary profile and report what it loaded. Run after `npm run desktop:dist`.
//   node scripts/packaged-check.mjs [path\to\Nested.exe]
import { _electron as electron } from 'playwright'
import { mkdtemp } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

const exe = resolve(process.argv[2] || 'release/win-arm64-unpacked/Nested.exe')
const userData = await mkdtemp(join(tmpdir(), 'nested-packaged-'))
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ executablePath: exe, args: [`--user-data-dir=${userData}`], env })
try {
  const page = await app.firstWindow()
  await page.getByRole('button', { name: 'Save', exact: true }).waitFor({ timeout: 30000 })
  const report = await app.evaluate(({ app }) => ({ packaged: app.isPackaged, version: app.getVersion() }))
  report.exe = exe
  report.url = page.url()
  report.bridge = await page.evaluate(() => Object.keys(window.nestedDesktop).sort())
  report.nodeInRenderer = await page.evaluate(() => typeof window.require)
  assert.equal(report.packaged, true)
  assert.equal(report.url, 'nested://app/index.html')
  assert.equal(report.nodeInRenderer, 'undefined')
  console.log(JSON.stringify(report, null, 2))
} finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}) }
