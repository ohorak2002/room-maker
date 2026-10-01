import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir, cpus } from 'node:os'
import assert from 'node:assert/strict'
import { readProject } from '../desktop/files.mjs'

const root = resolve('.'), output = join(root, 'artifacts', 'reference-pilot')
await mkdir(output, { recursive: true })
const userData = await mkdtemp(join(tmpdir(), 'nested-pilot-'))
const projectPath = join(userData, 'pilot.nested'), imagePath = join(output, 'room-export.png')
const env = { ...process.env, NESTED_TEST_USER_DATA: userData }
delete env.ELECTRON_RUN_AS_NODE
const errors = [], external = []
const app = await electron.launch({ args: [root], env, timeout: 60000 })
try {
  const page = await app.firstWindow()
  page.setDefaultTimeout(20000)
  page.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); console.error('Renderer:', m.text()) } })
  await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.unmaximize(); w.setContentSize(1586, 992) })
  await page.setViewportSize({ width: 1586, height: 992 })
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
  page.on('pageerror', e => errors.push(e.message))
  page.on('request', r => { if (!/^(nested|data|blob):/.test(r.url())) external.push(r.url()) })
  await page.getByRole('button', { name: 'Explore the living-room pilot' }).click()
  console.log('Pilot opened')
  await page.locator('.canvas-mount canvas').waitFor({ timeout: 60000 })
  await page.locator('.pilot-card img').last().waitFor()
  await page.waitForTimeout(1800)
  await page.screenshot({ path: join(output, '01-pilot-desktop.png'), scale: 'css' })
  assert.deepEqual(errors, [], 'pilot must render without JavaScript or shader errors')
  if (process.env.NESTED_CAPTURE_ONLY === '1') { console.log('Captured pilot desktop'); }
  else {
    const timing = await page.evaluate(() => new Promise(resolve => {
      const samples = []; let last
      const tick = t => { if (last != null) samples.push(t-last); last=t; if (samples.length < 120) requestAnimationFrame(tick); else { samples.sort((a,b) => a-b); const c=document.querySelector('.canvas-mount canvas'); resolve({ medianMs:samples[60], p95Ms:samples[114], sampleCount:120, canvas:[c.width,c.height], viewport:[innerWidth,innerHeight], devicePixelRatio }) } }
      requestAnimationFrame(tick)
    }))
    console.log('Checking search and category filters')
    assert.equal(await page.locator('.pilot-card').count(), 5)
    await page.getByLabel('Search the catalog', { exact: true }).fill('oak')
    assert.equal(await page.locator('.pilot-card').count(), 2)
    await page.getByLabel('Search the catalog', { exact: true }).fill('')
    await page.getByRole('tab', { name: 'Tables', exact: true }).click()
    assert.equal(await page.locator('.pilot-card').count(), 1)
    await page.getByRole('tab', { name: 'All', exact: true }).click()
    await page.getByRole('button', { name: 'Sage upholstery', exact: true }).click()
    console.log('Changed finish')
    await page.waitForTimeout(500)
    assert.equal(await page.getByRole('button', { name: 'Sage upholstery' }).getAttribute('aria-pressed'), 'true')
    await app.evaluate(({ dialog }, { projectPath, imagePath }) => {
      dialog.showSaveDialog = async (_win, opts) => ({ canceled: false, filePath: opts.title.includes('image') ? imagePath : projectPath })
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [projectPath] })
      dialog.showMessageBox = async () => ({ response: 1 })
    }, { projectPath, imagePath })
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    console.log('Saving pilot')
    await page.getByRole('status').filter({ hasText: /^Saved/ }).waitFor()
    let saved = await readProject(projectPath)
    assert.equal(saved.state.synthetics['pilot-sofa'].finish, 'sage')
    assert.equal(saved.state.customShape.exactD, 3.8)
    await page.getByRole('button', { name: 'Undo', exact: true }).filter({ visible: true }).click()
    assert.equal(await page.getByRole('button', { name: 'Oatmeal upholstery' }).getAttribute('aria-pressed'), 'true')
    await page.getByRole('button', { name: 'Redo', exact: true }).filter({ visible: true }).click()
    assert.equal(await page.getByRole('button', { name: 'Sage upholstery' }).getAttribute('aria-pressed'), 'true')
    await page.getByRole('button', { name: 'Oatmeal upholstery' }).click()
    await page.getByRole('tab', { name: '3D view', exact: true }).click()
    await page.locator('.pilot-interactive-preview canvas').waitFor()
    await page.screenshot({ path: join(output, '02-product-3d.png'), scale: 'css' })
    await page.getByRole('tab', { name: 'Product views' }).click()
    await page.getByRole('button', { name: 'Floor plan', exact: true }).click()
    await page.screenshot({ path: join(output, '03-floor-plan.png'), scale: 'css' })
    await page.getByRole('button', { name: 'Room view', exact: true }).click()
    await page.getByLabel('Room lighting', { exact: true }).selectOption('warm')
    await page.waitForTimeout(800)
    await page.screenshot({ path: join(output, '04-evening.png'), scale: 'css' })
    await page.getByLabel('Room lighting', { exact: true }).selectOption('natural')
    await page.getByRole('button', { name: 'Rotate', exact: true }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByRole('status').filter({ hasText: /^Saved/ }).waitFor()
    saved = await readProject(projectPath)
    assert.ok(saved.state.placements['pilot-sofa#0'].ry > .7)
    await page.getByRole('button', { name: 'Undo', exact: true }).filter({ visible: true }).click()
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click()
    await page.getByText('In your room · 2 copies', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    await page.getByText('In your room', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Inspect Oak lounge chair' }).click()
    await page.getByRole('button', { name: 'Replace item', exact: true }).click()
    await page.getByRole('button', { name: 'Replace with Oatmeal sofa', exact: true }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByRole('status').filter({ hasText: /^Saved/ }).waitFor()
    const replaced = await readProject(projectPath)
    assert.equal(replaced.state.items.find(i => i.id === 'pilot-sofa').qty, 2)
    assert.equal(replaced.state.placements['pilot-sofa#1'].x, 1.24)
    assert.equal(replaced.state.items.some(i => i.id === 'pilot-chair'), false)
    await page.getByRole('button', { name: 'Undo', exact: true }).filter({ visible: true }).click()
    await page.getByRole('tab', { name: 'All', exact: true }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByRole('status').filter({ hasText: /^Saved/ }).waitFor()
    await page.getByRole('button', { name: 'Open…', exact: true }).click()
    await page.locator('.pilot-workspace').waitFor()
    await page.getByRole('button', { name: 'Create realistic image', exact: true }).click()
    await page.getByText('Room image saved', { exact: true }).waitFor({ timeout: 30000 })
    const png = await readFile(imagePath)
    assert.equal(Math.max(png.readUInt32BE(16), png.readUInt32BE(20)), 2560)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1000, 700))
    await page.setViewportSize({ width: 1000, height: 700 })
    console.log('Compact viewport:', await page.evaluate(() => [innerWidth, innerHeight]))
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(output, '05-compact.png'), scale: 'css' })
    await page.getByRole('button', { name: 'Browse furniture', exact: true }).click()
    await page.getByRole('button', { name: 'Inspect Oak lounge chair' }).click()
    await page.getByRole('heading', { name: 'Oak lounge chair', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Browse furniture', exact: true }).click()
    await page.getByRole('button', { name: 'Open full room editor', exact: true }).click()
    await page.getByRole('navigation', { name: 'Room tools' }).waitFor()
    await page.getByRole('button', { name: 'Back to pilot', exact: true }).click()
    await page.locator('.pilot-workspace').waitFor()
    assert.deepEqual(errors, [])
    assert.deepEqual(external, [])
    const report = { passed: true, userData, projectPath, errors, external, machine: { platform: process.platform, architecture: process.arch, cpu: cpus()[0]?.model }, timing, timingNote: '120 requestAnimationFrame intervals in the actual Electron pilot; not GPU timings or a guarantee across devices. Native file dialog choices stubbed; IPC and filesystem real.', checks: ['catalog', 'search', 'categories', 'finishes', 'undo/redo', 'product 3D', 'floor plan', 'lighting', 'rotation', 'duplicate/remove', 'replace preserving placement', 'save/open', '2560px export', 'compact layout', 'full editor roundtrip'] }
    await writeFile(join(output, 'validation.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
  }
} catch (err) {
  console.error(err, { rendererErrors: errors })
  const page = app.windows()[0]
  if(page) { await page.screenshot({path:join(output,'failure.png')}).catch(()=>{}); console.error((await page.locator('body').innerText().catch(()=>'' )).slice(0,1800)) }
  throw err
}
finally {
  // This process owns an isolated temporary profile. Exit directly so a dirty
  // pilot cannot leave an invisible native save-on-close prompt in capture runs.
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
}
