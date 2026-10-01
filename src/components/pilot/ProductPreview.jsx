import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { builders } from '../../three/buildRoom'
import { renderThumbnail } from '../../three/thumbnail'
import { preloadMaterials } from '../../three/photoMaterials'
import { PILOT_MATERIALS } from '../../data/materialSources'

export function ProductImage({ item, angle = 'perspective', className = '', width = 480, height = 330 }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let live = true
    setUrl(null)
    preloadMaterials(Object.values(PILOT_MATERIALS)).then(() => {
      if (live) setUrl(renderThumbnail(item, { angle, width, height }))
    })
    return () => { live = false }
  }, [item, angle, width, height])
  return <div className={`pilot-product-image ${className}`}>
    {url ? <img src={url} alt={`${item.name}, ${angle} view`} /> : <span className="pilot-image-loading">Preparing view…</span>}
  </div>
}

export default function ProductPreview({ item }) {
  const ref = useRef(null)
  useEffect(() => {
    const mount = ref.current
    let renderer
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }) } catch { return }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = .8
    mount.appendChild(renderer.domElement)
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, 1, .01, 30)
    const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment()
    const environment = pmrem.fromScene(room, .04); room.dispose()
    scene.environment = environment.texture
    const light = new THREE.DirectionalLight('#fff4e3', 2); light.position.set(3, 4, 4); scene.add(light)
    scene.add(new THREE.HemisphereLight('#ffffff', '#b1a28c', .8))
    const node = builders[item.model](item); scene.add(node)
    const box = new THREE.Box3().setFromObject(node), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3())
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.copy(center); controls.enablePan = false; controls.enableDamping = true
    controls.minDistance = Math.max(size.x, size.y, size.z) * .7
    controls.maxDistance = Math.max(size.x, size.y, size.z) * 4
    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight
      if (!w || !h) return
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false)
      const distance = Math.max(size.x / camera.aspect, size.y, size.z) * 2
      camera.position.copy(center).add(new THREE.Vector3(distance * .45, distance * .3, distance))
      controls.update()
    }
    const ro = new ResizeObserver(resize); ro.observe(mount); resize()
    let frame
    const tick = () => { frame = requestAnimationFrame(tick); controls.update(); renderer.render(scene, camera) }; tick()
    return () => {
      cancelAnimationFrame(frame); ro.disconnect(); controls.dispose()
      node.traverse(o => { o.geometry?.dispose(); if (o.material) [].concat(o.material).forEach(m => m.dispose()) })
      environment.dispose(); pmrem.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove()
    }
  }, [item])
  return <div ref={ref} className="pilot-interactive-preview" aria-label={`Interactive 3D view of ${item.name}`} />
}
