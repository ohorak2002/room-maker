import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { builders } from './buildRoom'

/**
 * Renders a catalog item to a small PNG using the exact same geometry the room
 * uses. That's the point: the thumbnail is not an approximation of the product,
 * it *is* the object you're about to place, so what you preview is what you get.
 *
 * One shared offscreen renderer handles every item and results are cached by id,
 * so browsing the catalog costs one draw per item for the life of the page.
 */

let ctx = null
const cache = new Map()

function getContext() {
  if (ctx) return ctx

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(256, 256)
  renderer.setPixelRatio(1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

  const key = new THREE.DirectionalLight(0xfff4e2, 2.2)
  key.position.set(2, 3, 2.5)
  scene.add(key)

  const rim = new THREE.DirectionalLight(0xd8e8ff, 0.8)
  rim.position.set(-2, 1.5, -2)
  scene.add(rim)

  scene.add(new THREE.AmbientLight(0xffffff, 0.35))

  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100)

  ctx = { renderer, scene, camera, pmrem }
  return ctx
}

/** @returns {string|null} a data: URL, or null if the item has no builder */
export function renderThumbnail(item) {
  if (cache.has(item.id)) return cache.get(item.id)

  const build = builders[item.model]
  if (!build) return null

  let url = null
  try {
    const { renderer, scene, camera } = getContext()
    const node = build(item)
    scene.add(node)

    // Frame whatever we just built, whatever its proportions.
    const bounds = new THREE.Box3().setFromObject(node)
    const size = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())
    const reach = Math.max(size.x, size.y, size.z) || 1
    const dist = (reach / (2 * Math.tan((camera.fov * Math.PI) / 360))) * 1.3

    camera.position.set(center.x + dist * 0.62, center.y + dist * 0.45, center.z + dist * 0.72)
    camera.lookAt(center)
    camera.updateProjectionMatrix()

    renderer.render(scene, camera)
    url = renderer.domElement.toDataURL('image/png')

    scene.remove(node)
    node.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose()
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
        else o.material?.dispose()
      }
    })
  } catch (err) {
    console.warn('thumbnail failed for', item.id, err)
  }

  cache.set(item.id, url)
  return url
}

/** Free the offscreen context — WebGL contexts are a limited resource. */
export function disposeThumbnails() {
  if (!ctx) return
  ctx.pmrem.dispose()
  ctx.renderer.dispose()
  ctx = null
  cache.clear()
}
