import { open, rename, copyFile, readFile, stat, mkdir, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { MAX_PROJECT_BYTES, parseProject, stringifyProject } from '../shared/project.mjs'

// Write beside the target, flush, then replace. Never truncate the last good save.
export async function atomicWrite(path, contents, { backup = true } = {}) {
  await mkdir(dirname(path), { recursive: true })
  const temp = `${path}.${randomUUID()}.tmp`
  try {
    const file = await open(temp, 'wx')
    try { await file.writeFile(contents); await file.sync() } finally { await file.close() }
    if (backup) {
      try { await copyFile(path, `${path}.bak`) } catch (err) { if (err.code !== 'ENOENT') throw err }
    }
    await rename(temp, path)
  } finally { await unlink(temp).catch(() => {}) }
}
export const writeProject = async (path, doc) => atomicWrite(path, stringifyProject(doc))
export async function readProject(path) {
  if ((await stat(path)).size > MAX_PROJECT_BYTES) throw new Error('Project exceeds 32 MB')
  return parseProject(await readFile(path, 'utf8'))
}
