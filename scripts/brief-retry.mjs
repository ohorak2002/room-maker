// U02: Brief chat failure, retry, and a new project after an abandoned request (real Electron; local mock service).
//   node scripts/brief-retry.mjs <label>
import { _electron as electron } from 'playwright'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import assert from 'node:assert/strict'

const root = resolve('.')
const out = join(root, 'artifacts', 'quality', `brief-retry-${process.argv[2] || 'run'}`)
await mkdir(out, { recursive: true })
let failNext = true
let hold = null
const seen = []
const service = createServer(async (req, res) => {
  let body = ''; for await (const chunk of req) body += chunk
  const last = JSON.parse(body).messages.at(-1).content
  seen.push(last)
  const reply = (status, payload) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(payload)) }
  if (failNext) { failNext = false; return reply(500, { error: 'mock outage' }) }
  if (last === 'Slow one') { hold = () => reply(200, { reply: 'LATE REPLY', proposals: [] }); return }
  reply(200, { reply: `ANSWER to: ${last}`, proposals: [] })
}).listen(0, '127.0.0.1')
await new Promise((r) => service.once('listening', r))
const env = { ...process.env, NESTED_TEST_USER_DATA: await mkdtemp(join(tmpdir(), 'nested-retry-')), NESTED_AI_URL: `http://127.0.0.1:${service.address().port}` }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: [root], env })
const steps = []
try {
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 1 }) })
  await page.getByRole('button', { name: 'Start a new brief', exact: true }).click()
  const box = page.getByLabel('Message the Brief chat')
  await box.fill('First try')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: /kept below/ }).waitFor()
  assert.equal(await box.inputValue(), 'First try', 'failed message is back in the box')
  assert.equal(await page.getByRole('log').getByText('First try', { exact: true }).count(), 0, 'failed message is not left in the conversation')
  await page.screenshot({ path: join(out, 'failed.png') })
  steps.push('failure keeps the message for retry')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await page.getByText('ANSWER to: First try', { exact: true }).waitFor()
  assert.equal(await page.getByRole('log').getByText('First try', { exact: true }).count(), 1, 'retried message appears once')
  assert.equal(await page.getByRole('alert').count(), 0, 'error cleared after success')
  steps.push('retry succeeds once, error cleared')
  // Abandon a slow request, start a new project, and confirm the chat still works there.
  await box.fill('Slow one')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await page.getByText('Thinking…', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'More project actions' }).click()
  await page.getByRole('menuitem', { name: 'New project', exact: true }).click()
  await page.getByRole('button', { name: 'Start a new brief', exact: true }).click()
  for (let n = 0; n < 100 && !hold; n++) await page.waitForTimeout(20)
  hold()
  await page.waitForTimeout(400)
  assert.equal(await page.getByText('LATE REPLY', { exact: true }).count(), 0)
  await page.getByLabel('Message the Brief chat').fill('Second project')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await page.getByText('ANSWER to: Second project', { exact: true }).waitFor({ timeout: 10000 })
  await page.screenshot({ path: join(out, 'second-project.png') })
  steps.push('new project chat works after an abandoned request')
  assert.deepEqual(errors, [])
  await writeFile(join(out, 'result.json'), JSON.stringify({ steps, seen }, null, 2))
  console.log(JSON.stringify({ steps, seen }, null, 2))
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
  service.closeAllConnections(); service.close()
}
