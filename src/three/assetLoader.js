import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { UNIT_SCALES, placedDimensions } from '../../shared/assets.mjs'

/**
 * Faithful loading for private imported models.
 *
 * Unlike the legacy converter (api/_lib/glb.js), nothing here merges material
 * groups, drops textures or tints surfaces: the standard GLTFLoader output is
 * placed as authored. The only transforms applied are explicit and recorded on
 * the asset — re-seating on the model's own bounds, the designer-confirmed
 * authored units, and a quarter-turn to face the room.
 *
 * Parsed models are cached per checksum and cloned per placement. Clones share
 * geometry, materials and textures, so meshes are tagged `sharedAsset` and the
 * room's dispose() leaves them alone; they live for the session.
 */

const cache = new Map() // id -> Promise<{ root, box, stats }>
const status = new Map() // id -> { state: 'loading' | 'loaded' | 'missing' | 'error', ... }
const listeners = new Set()

export const assetUrl = (id) => `/user-assets/${id}.glb`

export function subscribeAssetStatus(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export const assetStatus = (id) => status.get(id) || null
const report = (id, value) => {
  status.set(id, value)
  for (const fn of listeners) fn(id, value)
}

/** Count what the loader actually produced, so the UI reports runtime truth. */
function describe(root) {
  const materials = new Set()
  const textures = new Set()
  let meshes = 0
  let triangles = 0
  root.traverse((o) => {
    if (!o.isMesh) return
    meshes++
    const g = o.geometry
    triangles += Math.floor((g.index ? g.index.count : g.attributes.position.count) / 3)
    for (const m of [].concat(o.material)) {
      materials.add(m)
      for (const v of Object.values(m)) if (v && v.isTexture) textures.add(v)
    }
  })
  const list = [...materials]
  return {
    meshes,
    triangles,
    materials: list.length,
    textures: textures.size,
    transmissive: list.filter((m) => m.transmission > 0).length,
    metallic: list.filter((m) => m.metalness > 0.5).length,
  }
}

export function loadAsset(id) {
  if (!cache.has(id)) {
    report(id, { state: 'loading' })
    const promise = new GLTFLoader().loadAsync(assetUrl(id)).then(
      (gltf) => {
        const root = gltf.scene
        root.updateMatrixWorld(true)
        root.traverse((o) => {
          if (!o.isMesh) return
          o.castShadow = true
          o.receiveShadow = true
          o.userData.sharedAsset = true
          o.userData.tintable = false
        })
        const box = new THREE.Box3().setFromObject(root)
        const stats = describe(root)
        report(id, { state: 'loaded', stats, size: box.getSize(new THREE.Vector3()).toArray() })
        return { root, box, stats }
      },
      (err) => {
        cache.delete(id) // Let a later rebuild retry, e.g. after re-importing the file.
        const missing = /404|not found/i.test(String(err?.message || err))
        report(id, missing ? { state: 'missing' } : { state: 'error', message: String(err?.message || err) })
        throw err
      }
    )
    cache.set(id, promise)
  }
  return cache.get(id)
}

/** A placed copy: authored hierarchy intact inside a pivot that carries our transforms. */
export function instantiate(loaded, record) {
  const inner = cloneSkinned(loaded.root)
  const center = loaded.box.getCenter(new THREE.Vector3())
  inner.position.sub(new THREE.Vector3(center.x, loaded.box.min.y, center.z))
  const pivot = new THREE.Group()
  pivot.add(inner)
  pivot.scale.setScalar(UNIT_SCALES[record.units])
  pivot.rotation.y = THREE.MathUtils.degToRad(record.rotateY)
  pivot.name = 'imported-asset'
  return pivot
}

/**
 * Stand-in shown until the model arrives, or instead of it when the file is
 * missing on this computer: the recorded footprint as a translucent box, so the
 * layout still shows how much room the piece takes.
 */
export function placeholder(record, missing = false) {
  const { w, d, h } = placedDimensions(record.size, record.units, record.rotateY)
  const g = new THREE.Group()
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: missing ? 0xb4553c : 0x9aa3a8, transparent: true, opacity: 0.35, depthWrite: false })
  )
  mesh.position.y = h / 2
  mesh.userData.noCast = true
  g.add(mesh)
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: missing ? 0xb4553c : 0x5b6469 }))
  edges.position.y = h / 2
  g.add(edges)
  g.name = 'asset-placeholder'
  return g
}
