import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useRoomStore } from '../store/roomStore'
import { getFloorplan } from '../data/presets'
import { byId } from '../data/catalog'
import { buildRoom, BACKDROPS } from '../three/buildRoom'
import './RoomCanvas.css'

export default function RoomCanvas() {
  const mountRef = useRef(null)
  const engineRef = useRef(null)

  const palette = useRoomStore((s) => s.palette)
  const lighting = useRoomStore((s) => s.lighting)
  const floorplan = useRoomStore((s) => s.floorplan)
  const windows = useRoomStore((s) => s.windows)
  const wallOverride = useRoomStore((s) => s.wallOverride)
  const floorOverride = useRoomStore((s) => s.floorOverride)
  const items = useRoomStore((s) => s.items)
  const colorsFn = useRoomStore((s) => s.colors)

  // ---- one-time engine setup -------------------------------------------
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 200)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.maxPolarAngle = Math.PI / 2.05
    controls.minDistance = 2
    controls.maxDistance = 30
    controls.target.set(0, 1.1, 0)

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount
      if (!w || !h) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(mount)
    resize()

    let frame
    const tick = () => {
      frame = requestAnimationFrame(tick)
      controls.update()
      renderer.render(scene, camera)
    }
    tick()

    engineRef.current = { scene, camera, renderer, controls, disposeRoom: null }

    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      engineRef.current?.disposeRoom?.()
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
      engineRef.current = null
    }
  }, [])

  // ---- rebuild whenever the design changes ------------------------------
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const { scene, camera, controls } = engine

    engine.disposeRoom?.()

    const plan = getFloorplan(floorplan)
    const colors = colorsFn()

    const entries = []
    for (const entry of items) {
      const item = byId(entry.id)
      if (!item) continue
      for (let n = 0; n < entry.qty; n++) entries.push(item)
    }

    scene.background = new THREE.Color(BACKDROPS[lighting] ?? BACKDROPS.natural)

    engine.disposeRoom = buildRoom(scene, {
      w: plan.w,
      d: plan.d,
      h: plan.h,
      colors,
      lighting,
      windows,
      entries,
    })

    // Frame the room from a front corner: pick the distance that fits the room's
    // width and height in the current viewport, then sit back a little further.
    const vFov = (camera.fov * Math.PI) / 180
    const fitHeight = plan.h / (2 * Math.tan(vFov / 2))
    const fitWidth = plan.w / (2 * Math.tan(vFov / 2) * Math.max(camera.aspect, 0.5))
    const dist = Math.max(fitHeight, fitWidth, plan.d * 0.6) * 1.6

    camera.position.set(dist * 0.5, plan.h * 0.78, dist * 0.86)
    controls.target.set(0, plan.h * 0.4, -plan.d * 0.1)
    controls.update()
  }, [palette, lighting, floorplan, windows, wallOverride, floorOverride, items, colorsFn])

  const count = items.reduce((n, i) => n + i.qty, 0)

  return (
    <div className="canvas-root">
      <div ref={mountRef} className="canvas-mount" />
      <div className="canvas-hud">
        <span className="hud-hint">Drag to orbit · scroll to zoom</span>
        {count === 0 && <span className="hud-empty">Room is empty — add pieces from the Shop tab</span>}
      </div>
    </div>
  )
}
