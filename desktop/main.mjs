import { app, BrowserWindow, dialog, ipcMain, protocol, net, shell, session } from 'electron'
import { basename, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdir, copyFile, readFile, stat, access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { atomicWrite, readProject, writeProject } from './files.mjs'
import { stringifyProject, projectIdentity } from '../shared/project.mjs'
import { ASSET_ID, MAX_ASSET_BYTES, inspectGlb } from '../shared/assets.mjs'
import { normalizeDraft } from '../shared/brief.mjs'
import { briefForAssistant, validateAssistantReply } from '../shared/briefAi.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const origin = 'nested://app'
protocol.registerSchemesAsPrivileged([{ scheme: 'nested', privileges: { standard: true, secure: true, supportFetchAPI: true } }])
if (process.env.NESTED_TEST_USER_DATA && !app.isPackaged) app.setPath('userData', process.env.NESTED_TEST_USER_DATA)
if (!app.requestSingleInstanceLock()) app.exit(0)
let win, currentPath = null, currentDoc = null, savedIdentity = null, exportedPath = null
let recovery, recoveryTimer, recoveryError = null, busy = false, closing = false, allowClose = false
let writeQueue = Promise.resolve()
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus() } })
const recoveryPath = () => join(app.getPath('userData'), 'recovery.nested')
// Private imported models, named by SHA-256 so identical files are stored once
// and a project can reference an asset without embedding it.
const assetDir = () => join(app.getPath('userData'), 'assets')
const assetPath = (id) => join(assetDir(), `${id}.glb`)
const dirty = () => currentDoc && projectIdentity(currentDoc) !== savedIdentity
const queueRecovery = (doc) => {
  writeQueue = writeQueue.catch(() => {}).then(() => writeProject(recoveryPath(), doc))
  writeQueue.then(() => { recoveryError = null }, err => { recoveryError = err.message })
  return writeQueue
}
async function flushRecovery() {
  clearTimeout(recoveryTimer)
  if (currentDoc) await queueRecovery(currentDoc)
  else await writeQueue
}
const filters = [{ name: 'Nested project', extensions: ['nested'] }]
async function save(doc, saveAs = false) {
  stringifyProject(doc)
  let path = currentPath
  if (saveAs || !path) {
    const result = await dialog.showSaveDialog(win, { title: 'Save Nested project', defaultPath: `${doc.name.replace(/[<>:"/\\|?*]/g, '-')}.nested`, filters })
    if (result.canceled) return null
    path = result.filePath.endsWith('.nested') ? result.filePath : `${result.filePath}.nested`
  }
  await writeProject(path, doc)
  currentPath = path
  savedIdentity = projectIdentity(doc)
  return { path }
}
async function confirmReplace() {
  await flushRecovery()
  if (!dirty()) return true
  const { response } = await dialog.showMessageBox(win, { type: 'question', message: 'Save changes to this project?', detail: 'Save a project file to keep these changes before continuing.', buttons: ['Save project', 'Discard changes', 'Cancel'], defaultId: 0, cancelId: 2 })
  if (response === 2) return false
  return response === 1 || Boolean(await save(currentDoc))
}
function handle(name, fn) {
  ipcMain.handle(name, async (event, ...args) => {
    if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== `${origin}/index.html`) throw new Error('Untrusted sender')
    try { return { ok: true, value: await fn(...args) } } catch (err) { return { ok: false, error: err.message } }
  })
}
async function exclusive(fn) {
  if (busy) throw new Error('Another file operation is in progress')
  busy = true
  try { return await fn() } finally { busy = false }
}

app.whenReady().then(async () => {
// Local-only app content. Server-side retailer/model APIs are not shipped.
protocol.handle('nested', async (request) => {
  const url = new URL(request.url)
  const asset = url.host === 'app' && /^\/user-assets\/([a-f0-9]{64})\.glb$/.exec(url.pathname)
  if (asset) {
    try {
      return new Response(await readFile(assetPath(asset[1])), { headers: { 'Content-Type': 'model/gltf-binary', 'Cache-Control': 'no-store' } })
    } catch { return new Response('Not found', { status: 404 }) }
  }
  const base = resolve(root, 'dist')
  const path = resolve(base, `.${decodeURIComponent(url.pathname)}`)
  if (url.host !== 'app' || !path.startsWith(base + sep)) return new Response('Not found', { status: 404 })
  const response = await net.fetch(pathToFileURL(path).href)
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-src 'none'")
  return response
})
session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
session.defaultSession.setPermissionCheckHandler(() => false)
try { recovery = await readProject(recoveryPath()) } catch (err) {
  if (err.code !== 'ENOENT') {
    recoveryError = `Recovery file could not be read: ${err.message}`
    await copyFile(recoveryPath(), join(app.getPath('userData'), `recovery-damaged-${Date.now()}.nested`)).catch(() => {})
    try { recovery = await readProject(`${recoveryPath()}.bak`) } catch { /* Preserve damaged file for inspection. */ }
  }
}
handle('project:initialize', () => ({ recoveryAvailable: Boolean(recovery), recoveryError }))
handle('project:status', () => ({ recoveryError }))
handle('project:stage', doc => {
  stringifyProject(doc)
  currentDoc = doc
  clearTimeout(recoveryTimer)
  recoveryTimer = setTimeout(() => queueRecovery(doc), 500)
  return { recoveryError }
})
handle('project:save', (doc, saveAs) => exclusive(() => save(doc, saveAs === true)))
handle('project:open', () => exclusive(async () => {
  const result = await dialog.showOpenDialog(win, { title: 'Open Nested project', filters, properties: ['openFile'] })
  if (result.canceled) return null
  const path = result.filePaths[0]
  const doc = await readProject(path) // Validate before touching the active project.
  if (!await confirmReplace()) return null
  currentPath = path; currentDoc = doc; savedIdentity = projectIdentity(doc)
  return { doc, path }
}))
handle('project:recover', () => exclusive(async () => {
  if (!recovery || !await confirmReplace()) return null
  currentDoc = recovery; currentPath = null; savedIdentity = null
  return { doc: recovery, path: null }
}))
handle('project:new', () => exclusive(async () => {
  if (!await confirmReplace()) return false
  currentPath = null; currentDoc = null; savedIdentity = null
  return true
}))
handle('image:export', dataUrl => exclusive(async () => {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,') || dataUrl.length > 48 * 1024 * 1024) throw new Error('Invalid PNG export')
  const result = await dialog.showSaveDialog(win, { title: 'Export room image', defaultPath: 'nested-room.png', filters: [{ name: 'PNG image', extensions: ['png'] }] })
  if (result.canceled) return null
  const path = result.filePath.endsWith('.png') ? result.filePath : `${result.filePath}.png`
  await atomicWrite(path, Buffer.from(dataUrl.split(',')[1], 'base64'))
  exportedPath = path
  return { path }
}))
// Brief assistant. The only network call in the app: it goes to Nested's own
// assistant service, only when the designer presses Ask, and carries the Brief's
// text (never attachments or the client's name). No provider key is in the app.
// The service address comes from NESTED_AI_URL or userData/ai.json {"url": ...};
// unset means the assistant is simply not connected.
async function assistantUrl() {
  let url = process.env.NESTED_AI_URL
  if (!url) { try { url = JSON.parse(await readFile(join(app.getPath('userData'), 'ai.json'), 'utf8')).url } catch { return null } }
  const parsed = new URL(url)
  const local = ['localhost', '127.0.0.1'].includes(parsed.hostname)
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && local)) throw new Error('The assistant service address must use https.')
  return parsed
}
handle('ai:status', async () => { const url = await assistantUrl(); return { configured: Boolean(url), host: url?.host ?? null } })
handle('ai:assist', async (message, draft) => {
  if (typeof message !== 'string' || !message.trim() || message.length > 2000) throw new Error('Write a question of up to 2,000 characters.')
  const url = await assistantUrl()
  if (!url) throw new Error('The Brief assistant is not connected.')
  const doc = normalizeDraft(JSON.stringify(draft))
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: message.trim(), brief: briefForAssistant(doc) }), signal: AbortSignal.timeout(45000), redirect: 'error' })
  if (!response.ok) throw new Error(`The assistant service answered ${response.status}.`)
  const text = await response.text()
  if (text.length > 200000) throw new Error('The assistant reply was too large.')
  return validateAssistantReply(JSON.parse(text), doc)
})
handle('image:show', () => { if (exportedPath) shell.showItemInFolder(exportedPath) })
handle('asset:import', () => exclusive(async () => {
  const result = await dialog.showOpenDialog(win, { title: 'Import GLB model', filters: [{ name: 'Binary glTF model', extensions: ['glb'] }], properties: ['openFile'] })
  if (result.canceled) return null
  const source = result.filePaths[0]
  if ((await stat(source)).size > MAX_ASSET_BYTES) throw new Error('Unsupported GLB: file exceeds 100 MB')
  const bytes = await readFile(source)
  const inspection = inspectGlb(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength))
  const id = createHash('sha256').update(bytes).digest('hex')
  // Content-addressed: an existing file with this name already holds these bytes.
  try { await access(assetPath(id)) } catch { await atomicWrite(assetPath(id), bytes, { backup: false }) }
  return { id, fileName: basename(source).slice(0, 260), bytes: bytes.length, inspection }
}))
handle('asset:status', async ids => {
  if (!Array.isArray(ids) || ids.length > 1000 || ids.some(id => typeof id !== 'string' || !ASSET_ID.test(id))) throw new Error('Invalid asset list')
  return Object.fromEntries(await Promise.all(ids.map(async id => [id, await access(assetPath(id)).then(() => true, () => false)])))
})
await mkdir(app.getPath('userData'), { recursive: true })
win = new BrowserWindow({ title: 'Nested', width: 1440, height: 960, minWidth: 1000, minHeight: 700,
  show: false, backgroundColor: '#f4f3f0',
  webPreferences: { preload: join(root, 'desktop/preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
})
win.removeMenu()
win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
win.webContents.on('will-navigate', event => event.preventDefault())
win.on('ready-to-show', () => win.show())
win.on('close', event => {
  if (allowClose) return
  event.preventDefault()
  if (closing || busy) return
  closing = true
  ;(async () => {
    try {
      await flushRecovery()
      if (dirty()) {
        const { response } = await dialog.showMessageBox(win, { type: 'question', message: 'Save this project before closing?', detail: 'A recovery copy has been saved on this computer.', buttons: ['Save project', 'Keep recovery and close', 'Cancel'], defaultId: 0, cancelId: 2 })
        if (response === 2 || (response === 0 && !await save(currentDoc))) return
      }
      allowClose = true; win.close()
    } catch (err) { dialog.showErrorBox('Could not preserve project', err.message) }
    finally { closing = false }
  })()
})
await win.loadURL(`${origin}/index.html`)
app.on('window-all-closed', () => app.quit())

}).catch(err => { console.error(err); app.exit(1) })
