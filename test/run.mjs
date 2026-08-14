/**
 * Run every test file and report once.
 *
 * Plain Node, no framework. These tests exist to catch the specific ways this
 * app has actually broken — a mis-parsed measurement, a GLB that will not seat
 * on the floor, a cache key that changes when a tracking parameter does — and
 * none of that needs a runner.
 *
 * Some tests reach the live internet on purpose (the dimension parser is only
 * meaningful against real retailer markup, and that markup changes without
 * warning). Those are marked, and `--offline` skips them so a flaky connection
 * or a redesigned shop cannot fail a build.
 */
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const NETWORKED = new Set(['dimensions.test.mjs'])
const offline = process.argv.includes('--offline')

const files = readdirSync(HERE)
  .filter((f) => f.endsWith('.test.mjs'))
  .sort()

const run = (file) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [join(HERE, file)], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('close', (code) => resolve({ file, code, out }))
  })

let failed = 0
for (const file of files) {
  if (offline && NETWORKED.has(file)) {
    console.log(`\x1b[2m—  ${file} (skipped, needs the network)\x1b[0m`)
    continue
  }
  const { code, out } = await run(file)
  const ok = code === 0 && !/FAIL|problems/.test(out)
  if (!ok) failed++
  console.log(`${ok ? '\x1b[32mok\x1b[0m' : '\x1b[31mFAIL\x1b[0m'} ${file}${NETWORKED.has(file) ? ' \x1b[2m(live)\x1b[0m' : ''}`)
  if (!ok) console.log(out.split('\n').map((l) => '     ' + l).join('\n'))
}

console.log(failed ? `\n\x1b[31m${failed} file(s) failed\x1b[0m` : '\n\x1b[32mall tests passed\x1b[0m')
process.exit(failed ? 1 : 0)
