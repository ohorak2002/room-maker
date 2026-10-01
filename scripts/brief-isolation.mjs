import { _electron as electron } from 'playwright'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import assert from 'node:assert/strict'

const root = resolve('.')
const out = join(root, 'artifacts', 'quality', `brief-isolation-${process.argv[2] || 'after'}`)
await mkdir(out, { recursive: true })
let respond
const service = createServer(async (req, res) => {
  let body = ''; for await (const chunk of req) body += chunk
  const request = JSON.parse(body)
  respond = () => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ reply: 'OLD PROJECT RESPONSE', proposals: [{ roomId: request.brief.rooms[0].id, field: 'notes.feeling', value: 'Old project suggestion' }] })) }
}).listen(0, '127.0.0.1')
await new Promise(resolve => service.once('listening', resolve))
const env = { ...process.env, NESTED_TEST_USER_DATA: await mkdtemp(join(tmpdir(), 'nested-isolation-')), NESTED_AI_URL: `http://127.0.0.1:${service.address().port}` }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ args: [root], env })
let page
try {
  page = await app.firstWindow()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 1 }) })
  await page.getByRole('button', { name: 'Start a new brief', exact: true }).click()
  await page.getByLabel('Message the Brief chat').fill('Please improve the first project')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await page.getByText('Thinking…', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'More project actions' }).click()
  await page.getByRole('menuitem', { name: 'New project', exact: true }).click()
  await page.getByRole('button', { name: 'Start a new brief', exact: true }).click()
  assert.ok(respond, 'local service received first project request')
  respond()
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(out, 'new-project-chat.png') })
  assert.equal(await page.getByText('OLD PROJECT RESPONSE', { exact: true }).count(), 0, 'abandoned response must not appear in a different project')
  assert.equal(await page.getByText('Please improve the first project', { exact: true }).count(), 0, 'conversation must be scoped to its project')
  await writeFile(join(out, 'result.json'), JSON.stringify({ passed: true, scenario: 'new project during delayed Brief reply', runtime: 'real Electron; local mock service' }, null, 2))
  console.log('Brief project isolation passed')
} catch (error) {
  await writeFile(join(out, 'failure.txt'), error.stack)
  throw error
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
  service.closeAllConnections(); service.close()
}
