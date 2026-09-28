/**
 * Run every test file and report once.
 *
 * Plain Node, no framework, and entirely offline. `--offline` is still accepted
 * by `npm run test:offline` for older instructions and changes nothing. Real
 * Electron checks live in scripts/desktop-smoke.mjs (`npm run test:desktop`).
 */
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))

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
  const { code, out } = await run(file)
  const ok = code === 0 && !/FAIL|problems/.test(out)
  if (!ok) failed++
  console.log(`${ok ? '\x1b[32mok\x1b[0m' : '\x1b[31mFAIL\x1b[0m'} ${file}`)
  if (!ok) console.log(out.split('\n').map((l) => '     ' + l).join('\n'))
}

console.log(failed ? `\n\x1b[31m${failed} file(s) failed\x1b[0m` : '\n\x1b[32mall tests passed\x1b[0m')
process.exit(failed ? 1 : 0)
