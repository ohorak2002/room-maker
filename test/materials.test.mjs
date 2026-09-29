// The bundled photographic material sets: files present, unmodified, sized as
// recorded, and every catalog reference resolves. Offline; reads the repository.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { MATERIAL_SETS, PILOT_MATERIALS } from '../src/data/materialSources.js'

const root = new URL('../public/materials/polyhaven/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

/** Width and height from a JPEG's start-of-frame marker. */
function jpegSize(bytes) {
  assert.equal(bytes[0], 0xff); assert.equal(bytes[1], 0xd8, 'not a JPEG')
  let i = 2
  while (i < bytes.length) {
    assert.equal(bytes[i], 0xff)
    const marker = bytes[i + 1]
    const len = bytes.readUInt16BE(i + 2)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [bytes.readUInt16BE(i + 7), bytes.readUInt16BE(i + 5)]
    i += 2 + len
  }
  throw new Error('no frame header')
}

for (const [id, set] of Object.entries(MATERIAL_SETS)) {
  assert.match(set.license, /^CC0/, `${id} must be CC0`)
  assert.ok(set.sourceUrl.startsWith('https://polyhaven.com/a/'))
  assert.ok(set.tile.every((v) => v > 0.05 && v < 5), `${id} tile size is metres`)
  assert.deepEqual(Object.keys(set.maps).sort(), ['map', 'normalMap', 'roughnessMap'])
  assert.ok(set.maps.normalMap.includes('nor_gl'), `${id} must use the OpenGL normal map`)
  for (const file of Object.values(set.maps)) {
    const bytes = await readFile(join(root, set.dir, file))
    assert.equal(createHash('md5').update(bytes).digest('hex'), set.md5[file], `${file} differs from the published checksum`)
    const [w, h] = jpegSize(bytes)
    assert.equal(w, 2048, `${file} width`)
    // Non-square sources (the herringbone is 2048 x 2091) must keep the aspect
    // that the published tile size implies, or the weave would be stretched.
    assert.ok(Math.abs(w / h - set.tile[0] / set.tile[1]) < 0.01, `${file} aspect differs from its published tile`)
  }
}
for (const id of Object.values(PILOT_MATERIALS)) assert.ok(MATERIAL_SETS[id], `pilot references unknown set ${id}`)
console.log('Bundled material sets: license, checksums, dimensions and references verified')
