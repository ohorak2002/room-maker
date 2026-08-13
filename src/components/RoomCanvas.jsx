import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { useRoomStore } from '../store/roomStore'
import { byId, starterFor, resolveItem } from '../data/catalog'
import { buildRoom, BACKDROPS } from '../three/buildRoom'
import { autoArrange, instanceKey } from '../three/layout'
import { clampToShape } from '../three/shapeGeom'
import './RoomCanvas.css'

export default function RoomCanvas() {
  const mountRef = useRef(null)
  const engineRef = useRef(null)
  const [selected, setSelected] = useState(null) // { key, name }
  const [dragging, setDragging] = useState(false)
  const [warnDismissed, setWarnDismissed] = useState(false)

  const palette = useRoomStore((s) => s.palette)
  const lighting = useRoomStore((s) => s.lighting)
  const floorplan = useRoomStore((s) => s.floorplan)
  const customShape = useRoomStore((s) => s.customShape)
  const customDims = useRoomStore((s) => s.customDims)
  const windows = useRoomStore((s) => s.windows)
  const wallOverride = useRoomStore((s) => s.wallOverride)
  const floorOverride = useRoomStore((s) => s.floorOverride)
  const items = useRoomStore((s) => s.items)
  const layoutRev = useRoomStore((s) => s.layoutRev)

  // ---- engine (once) -----------------------------------------------------
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 200)
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    // VSM gives genuinely soft shadow edges rather than PCF's speckled fringe.
    renderer.shadowMap.type = THREE.VSMShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    mount.appendChild(renderer.domElement)

    // A generated interior environment: every PBR surface now has something real
    // to reflect. Without this, metal reads as flat grey and gloss does nothing.
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = envRT.texture

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.maxPolarAngle = Math.PI / 2.05
    controls.minDistance = 2
    controls.maxDistance = 30

    const outline = new THREE.BoxHelper(new THREE.Object3D(), 0x4fa089)
    outline.visible = false
    outline.material.depthTest = false
    outline.material.linewidth = 2
    scene.add(outline)

    const ghost = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.36, 32),
      new THREE.MeshBasicMaterial({ color: 0x4fa089, transparent: true, opacity: 0.85, depthTest: false })
    )
    ghost.rotation.x = -Math.PI / 2
    ghost.visible = false
    scene.add(ghost)

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
      if (outline.visible) outline.update()
      renderer.render(scene, camera)
    }
    tick()

    engineRef.current = { scene, camera, renderer, controls, outline, ghost, room: null, mount }

    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      engineRef.current?.room?.dispose()
      controls.dispose()
      envRT.dispose()
      pmrem.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
      engineRef.current = null
    }
  }, [])

  // ---- rebuild on structural change --------------------------------------
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const { scene, camera, controls, outline, ghost } = engine

    engine.room?.dispose()
    outline.visible = false
    ghost.visible = false
    setSelected(null)

    const store = useRoomStore.getState()
    const shape = store.shape()
    const room = store.dims()
    const colors = store.colors()

    // One entry per physical copy, with a stable key.
    const entries = []
    for (const entry of store.items) {
      const item = resolveItem(entry.id, store.synthetics)
      if (!item) continue
      for (let n = 0; n < entry.qty; n++) entries.push({ key: instanceKey(entry.id, n), item })
    }

    // Solver first, then any position the user dragged wins.
    const auto = autoArrange(entries, { ...room, shape })
    const placements = {}
    for (const { key } of entries) {
      placements[key] = { ...auto[key], ...(store.placements[key] || {}) }
    }

    scene.background = new THREE.Color(BACKDROPS[lighting] ?? BACKDROPS.natural)

    engine.room = buildRoom(scene, {
      shape,
      ...room,
      colors,
      lighting,
      windows,
      entries,
      placements,
    })

    // Fit the room's bounding sphere against whichever field of view is tighter.
    // Fitting width and height separately broke on short-wide canvases (panel
    // open on a laptop): the horizontal fit went small and the camera ended up
    // inside the furniture.
    const vHalf = (camera.fov * Math.PI) / 360
    const hHalf = Math.atan(Math.tan(vHalf) * Math.max(camera.aspect, 0.35))
    const radius = Math.hypot(room.w / 2, room.d / 2, room.h / 2)
    const dist = (radius / Math.sin(Math.min(vHalf, hHalf))) * 0.7

    camera.position.set(dist * 0.5, room.h * 0.78, dist * 0.86)
    controls.target.set(0, room.h * 0.4, -room.d * 0.1)
    controls.update()
  }, [palette, lighting, floorplan, customShape, customDims, windows, wallOverride, floorOverride, items, layoutRev])

  // ---- pointer: select + drag --------------------------------------------
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const { renderer, camera, controls, outline, ghost, mount } = engine
    const el = renderer.domElement

    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const plane = new THREE.Plane()
    const hitPoint = new THREE.Vector3()
    const grabOffset = new THREE.Vector3()

    let active = null // { node, zone, radius }
    let downAt = null
    let didMove = false

    const toNdc = (e) => {
      const r = el.getBoundingClientRect()
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1
    }

    /** Walk up to the tagged group — meshes are children of the draggable node. */
    const draggableOf = (obj) => {
      let o = obj
      while (o) {
        if (o.userData?.draggable) return o
        o = o.parent
      }
      return null
    }

    const pick = (e) => {
      toNdc(e)
      ray.setFromCamera(ndc, camera)
      const hits = ray.intersectObjects(engine.room?.handles || [], true)
      for (const h of hits) {
        const node = draggableOf(h.object)
        if (node) return { node, point: h.point }
      }
      return null
    }

    // The plane a piece slides on: floor pieces move in XZ, wall pieces in XY,
    // ceiling pieces in XZ at ceiling height.
    const planeFor = (node) => {
      const z = node.userData.zone
      if (z === 'wall' || z === 'window') {
        plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), node.position)
      } else {
        plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), node.position)
      }
    }

    const onDown = (e) => {
      if (e.button !== 0) return
      const hit = pick(e)
      downAt = { x: e.clientX, y: e.clientY }
      didMove = false
      // One history entry per drag gesture, taken before anything moves.
      if (hit) useRoomStore.getState().pushHistory()

      if (!hit) {
        outline.visible = false
        ghost.visible = false
        setSelected(null)
        return
      }

      active = { node: hit.node, zone: hit.node.userData.zone, radius: hit.node.userData.radius }
      planeFor(hit.node)
      ray.setFromCamera(ndc, camera)
      if (ray.ray.intersectPlane(plane, hitPoint)) {
        grabOffset.copy(hit.node.position).sub(hitPoint)
      } else {
        grabOffset.set(0, 0, 0)
      }

      outline.setFromObject(hit.node)
      outline.visible = true
      setSelected({ key: hit.node.userData.key, name: hit.node.userData.name })

      controls.enabled = false
      el.setPointerCapture?.(e.pointerId)
    }

    const onMove = (e) => {
      if (!active) {
        // Hover affordance only; cheap enough at pointer rate.
        el.style.cursor = pick(e) ? 'grab' : 'default'
        return
      }
      if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 3) didMove = true
      if (!didMove) return

      toNdc(e)
      ray.setFromCamera(ndc, camera)
      if (!ray.ray.intersectPlane(plane, hitPoint)) return

      const room = useRoomStore.getState().dims()
      const r = active.radius
      const next = hitPoint.clone().add(grabOffset)

      if (active.zone === 'wall' || active.zone === 'window') {
        active.node.position.x = clamp(next.x, -room.w / 2 + 0.6, room.w / 2 - 0.6)
        active.node.position.y = clamp(next.y, 0.4, room.h - 0.3)
      } else {
        // Bounding-box clamp first, then pull back onto the actual footprint —
        // an L-shaped room has space inside its bounds that isn't floor.
        const shape = useRoomStore.getState().shape()
        const snapped = clampToShape(
          shape,
          clamp(next.x, -room.w / 2 + r, room.w / 2 - r),
          clamp(next.z, -room.d / 2 + r, room.d / 2 - r)
        )
        active.node.position.x = snapped.x
        active.node.position.z = snapped.z
      }

      ghost.position.set(active.node.position.x, 0.02, active.node.position.z)
      ghost.scale.setScalar(Math.max(r / 0.33, 0.6))
      ghost.visible = active.zone !== 'wall' && active.zone !== 'window'
      outline.setFromObject(active.node)
      el.style.cursor = 'grabbing'
      setDragging(true)
    }

    const onUp = (e) => {
      el.releasePointerCapture?.(e.pointerId)
      controls.enabled = true
      ghost.visible = false
      setDragging(false)
      el.style.cursor = 'default'

      if (active && didMove) {
        const p = active.node.position
        useRoomStore.getState().setPlacement(active.node.userData.key, {
          x: p.x,
          y: p.y,
          z: p.z,
          ry: active.node.rotation.y,
          zone: active.zone,
        })
      }
      active = null
      downAt = null
    }

    // Keyboard: nudge and rotate whichever piece is currently selected.
    let outlineTarget = null
    const onKeyDown = (e) => {
      // Never steal keys while someone is typing in the panel.
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const store = useRoomStore.getState()

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        store.undo()
        return
      }

      if (!outlineTarget) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        store.removeInstance(outlineTarget.userData.key)
        outlineTarget = null
        outline.visible = false
        setSelected(null)
        return
      }

      const step = e.shiftKey ? 0.4 : 0.1
      const p = outlineTarget.position
      const room = store.dims()
      const r = outlineTarget.userData.radius
      let handled = true
      switch (e.key) {
        case 'ArrowLeft': p.x = clamp(p.x - step, -room.w / 2 + r, room.w / 2 - r); break
        case 'ArrowRight': p.x = clamp(p.x + step, -room.w / 2 + r, room.w / 2 - r); break
        case 'ArrowUp': p.z = clamp(p.z - step, -room.d / 2 + r, room.d / 2 - r); break
        case 'ArrowDown': p.z = clamp(p.z + step, -room.d / 2 + r, room.d / 2 - r); break
        case 'r': case 'R': outlineTarget.rotation.y += Math.PI / 8; break
        default: handled = false
      }
      if (!handled) return
      e.preventDefault()
      const snap = clampToShape(store.shape(), p.x, p.z)
      p.x = snap.x
      p.z = snap.z
      outline.setFromObject(outlineTarget)
      useRoomStore.getState().setPlacement(outlineTarget.userData.key, {
        x: p.x, y: p.y, z: p.z,
        ry: outlineTarget.rotation.y,
        zone: outlineTarget.userData.zone,
      })
    }

    // Keep the keyboard target in sync with pointer selection.
    const syncTarget = (e) => {
      const hit = pick(e)
      outlineTarget = hit ? hit.node : null
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerdown', syncTarget)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerdown', syncTarget)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [items, layoutRev, floorplan, customShape, customDims])

  const store = useRoomStore()
  const count = items.reduce((n, i) => n + i.qty, 0)
  const hasCustom = Object.keys(store.placements).length > 0
  const historyDepth = store._past.length

  // Crowding: summed footprint vs floor area. Past ~55% you can't walk through it.
  const fill = store.crowding(
    items.flatMap((entry) => {
      const item = resolveItem(entry.id, store.synthetics)
      return item ? Array(entry.qty).fill(item.fp || 0.35) : []
    })
  )
  const dims = store.dims()
  const packName = starterFor(store.mood).name

  return (
    <div className="canvas-root">
      <div ref={mountRef} className="canvas-mount" />

      <div className="canvas-tools">
        <button
          className="tool-btn"
          onClick={() => store.undo()}
          disabled={historyDepth === 0}
          title="Undo the last change (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          className="tool-btn primary"
          onClick={() => store.clearPlacements()}
          title="Re-run the layout solver on every piece"
        >
          Auto-arrange
        </button>
        {hasCustom && <span className="tool-note">Custom layout</span>}
      </div>

      {fill > 0.55 && !warnDismissed && (
        <div className="crowd-warning" role="status">
          <button
            className="crowd-close"
            onClick={() => setWarnDismissed(true)}
            aria-label="Dismiss crowding warning"
          >
            ×
          </button>
          <strong>This room is packed.</strong> Your pieces cover about{' '}
          {Math.round(fill * 100)}% of the {(store.shape().cells.length * 0.25).toFixed(1)} m² of floor you
          actually have — there won't be much room to walk. Try a bigger floorplan or fewer large pieces.
        </div>
      )}

      {count === 0 && (
        <div className="empty-room">
          <div className="empty-card">
            <p className="empty-title">Your room is empty</p>
            <p className="empty-sub">
              Start with a set picked for your {store.mood} vibe, then swap out whatever you don't
              want.
            </p>
            <button
              className="btn-primary"
              onClick={() => store.addMany(starterFor(store.mood).items)}
            >
              Add the {packName.toLowerCase()}
            </button>
          </div>
        </div>
      )}

      <div className="canvas-hud">
        {selected ? (
          <span className="hud-sel">
            <strong>{selected.name}</strong> — drag to move · arrows nudge · R rotates · Delete
            removes
          </span>
        ) : (
          count > 0 && (
            <span className="hud-hint">Click a piece to move it · drag empty space to orbit</span>
          )
        )}
      </div>
    </div>
  )
}

const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)))
