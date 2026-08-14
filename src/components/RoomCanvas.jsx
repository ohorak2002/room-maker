import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { useRoomStore } from '../store/roomStore'
import { byId, starterForRoom, ROOM_PACKS, resolveItem, footprintArea } from '../data/catalog'
import { buildRoom } from '../three/buildRoom'
import { buildHome, buildHomeLights } from '../three/buildHome'
import { buildAtmosphere } from '../three/atmosphere'
import { autoArrange, instanceKey, zoneOf } from '../three/layout'
import { clampToShape } from '../three/shapeGeom'
import PieceMenu from './PieceMenu'
import './RoomCanvas.css'

export default function RoomCanvas() {
  const mountRef = useRef(null)
  const engineRef = useRef(null)
  const [selected, setSelected] = useState(null) // { key, name }
  const [dragging, setDragging] = useState(false)
  const [warnDismissed, setWarnDismissed] = useState(false)
  const [menu, setMenu] = useState(null) // { key, name, x, y }
  const [hoveredRoom, setHoveredRoom] = useState(null) // { name, sqft } in home overview

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
  const scope = useRoomStore((s) => s.scope)
  const home = useRoomStore((s) => s.home)
  const focusedRoom = useRoomStore((s) => s.focusedRoom)

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

    // Bloom on emissive geometry only (lamps, LED strips, screens, the window
    // pane). Threshold is high and strength is low on purpose — this is meant
    // to read as "that lamp is genuinely lit," not a hazy glow over everything.
    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))

    // Ground-truth ambient occlusion. Without it every piece reads as floating
    // slightly above the floor, because a shadow map alone can't darken the
    // narrow contact seam where a leg meets the boards.
    //
    // Radius is in metres. Furniture-contact scale (~0.25) looks correct on
    // paper but renders almost no occlusion here, because rooms are viewed from
    // several metres back and that radius covers only a few pixels on screen.
    // 1.0 is what actually reads at the distance this camera sits at.
    const gtao = new GTAOPass(scene, camera, 1, 1)
    gtao.blendIntensity = 0.85
    gtao.updateGtaoMaterial({ radius: 1.0, distanceExponent: 1, thickness: 1, scale: 1, samples: 16 })
    composer.addPass(gtao)

    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.4, 0.82)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())

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
      composer.setSize(w, h)
      composer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    }
    const ro = new ResizeObserver(resize)
    ro.observe(mount)
    resize()

    // --- ambient drift ----------------------------------------------------
    // A still render reads as a screenshot. After a few seconds of no input the
    // camera starts a very slow orbit, so the room breathes and you can see the
    // light move across surfaces. Any interaction cancels it instantly and the
    // idle timer restarts — it must never fight the user for control.
    const IDLE_MS = 4000
    const DRIFT_SPEED = 0.000045
    let lastInput = performance.now()
    let driftPhase = 0
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const noteInput = () => {
      lastInput = performance.now()
    }
    for (const evt of ['pointerdown', 'pointermove', 'wheel', 'keydown']) {
      renderer.domElement.addEventListener(evt, noteInput, { passive: true })
    }
    window.addEventListener('keydown', noteInput)

    let frame
    let prev = performance.now()
    const tick = (now) => {
      frame = requestAnimationFrame(tick)
      const dt = Math.min(now - prev, 64)
      prev = now

      const idle = now - lastInput > IDLE_MS
      // controls.enabled goes false while a piece is being dragged.
      if (idle && controls.enabled && !reduceMotion.matches) {
        // Ease the drift in rather than snapping to full speed at 4.000s.
        driftPhase = Math.min(driftPhase + dt / 2200, 1)
        const eased = driftPhase * driftPhase * (3 - 2 * driftPhase)
        const angle = DRIFT_SPEED * dt * eased
        const { x, z } = camera.position
        const target = controls.target
        const dx = x - target.x
        const dz = z - target.z
        camera.position.x = target.x + dx * Math.cos(angle) - dz * Math.sin(angle)
        camera.position.z = target.z + dx * Math.sin(angle) + dz * Math.cos(angle)
      } else {
        driftPhase = 0
      }

      controls.update()
      if (outline.visible) outline.update()
      composer.render()
    }
    frame = requestAnimationFrame(tick)

    engineRef.current = { scene, camera, renderer, composer, controls, outline, ghost, room: null, atmosphere: null, mount }

    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      for (const evt of ['pointerdown', 'pointermove', 'wheel', 'keydown']) {
        renderer.domElement.removeEventListener(evt, noteInput)
      }
      window.removeEventListener('keydown', noteInput)
      engineRef.current?.room?.dispose()
      engineRef.current?.atmosphere?.()
      controls.dispose()
      composer.dispose()
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
    const colors = store.colors()

    // --- whole-home overview: a different scene entirely -------------------
    if (store.scope === 'home' && store.home && !store.focusedRoom) {
      engine.homeLights?.()
      const span = Math.max(store.home.w, store.home.d)
      engine.atmosphere?.()
      engine.atmosphere = buildAtmosphere(scene, {
        lighting: 'overcast',
        roomSpan: span * 1.2,
        floorY: 0,
      })
      engine.homeLights = buildHomeLights(scene, { span })
      engine.room = buildHome(scene, { home: store.home, palette: colors })

      // Look down at the plan from a shallow angle — high enough to read the
      // layout, low enough that the low walls still give it depth.
      const dist = span * 1.25
      camera.position.set(dist * 0.32, span * 0.95, dist * 0.78)
      controls.target.set(0, 0, 0)
      controls.update()
      return
    }

    engine.homeLights?.()
    engine.homeLights = null

    const shape = store.shape()
    const room = store.dims()

    // One entry per physical copy, with a stable key.
    const entries = []
    for (const entry of store.activeItems()) {
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

    engine.atmosphere?.()
    engine.atmosphere = buildAtmosphere(scene, {
      lighting,
      roomSpan: Math.max(room.w, room.d),
      floorY: 0,
    })

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

    // 0.7 crops in for a tighter shot, which flatters a living room and ruins a
    // bathroom — at that distance the camera sits level with the side walls.
    // Ease back toward a full fit as the room gets smaller.
    const snug = THREE.MathUtils.clamp(Math.min(room.w, room.d) / 4.5, 0, 1)
    const crop = THREE.MathUtils.lerp(1.08, 0.7, snug)
    const fit = (radius / Math.sin(Math.min(vHalf, hHalf))) * crop
    // Stand off far enough to clear the footprint no matter how small the room.
    const dist = Math.max(fit, room.d / 2 + 1.7)

    // Only the near wall is left off, so the view has to enter through that
    // opening. A fixed swing to the side works until the room is narrower than
    // it is deep — then the sight line crosses a side wall instead, which is
    // exactly what a small bathroom or a galley kitchen is. Straighten up as
    // the room narrows.
    const xBias = 0.5 * Math.min(1, room.w / Math.max(room.d, 0.01))

    camera.position.set(dist * xBias, room.h * 0.78, dist * 0.86)
    controls.target.set(0, room.h * 0.4, -room.d * 0.1)
    controls.update()
  }, [palette, lighting, floorplan, customShape, customDims, windows, wallOverride, floorOverride, items, layoutRev, scope, home, focusedRoom])

  // ---- home overview: hover + click a room to focus it --------------------
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const inOverview = scope === 'home' && home && !focusedRoom
    if (!inOverview) {
      setHoveredRoom(null)
      return
    }

    const { renderer, camera } = engine
    const el = renderer.domElement
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let current = null

    const pickRoom = (e) => {
      const r = el.getBoundingClientRect()
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1
      ray.setFromCamera(ndc, camera)
      const hits = ray.intersectObjects(engine.room?.pickables || [], false)
      return hits[0]?.object || null
    }

    const setHighlight = (obj, on) => {
      const hl = obj?.userData?.highlight
      if (hl) hl.material.opacity = on ? 0.22 : 0
    }

    const onMove = (e) => {
      const obj = pickRoom(e)
      if (obj === current) return
      setHighlight(current, false)
      current = obj
      setHighlight(current, true)
      el.style.cursor = obj ? 'pointer' : 'default'
      setHoveredRoom(obj ? { name: obj.userData.roomName, sqft: obj.userData.sqft } : null)
    }

    const onClick = (e) => {
      const obj = pickRoom(e)
      if (obj) useRoomStore.getState().focusRoom(obj.userData.roomId)
    }

    const onLeave = () => {
      setHighlight(current, false)
      current = null
      setHoveredRoom(null)
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('click', onClick)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('click', onClick)
      el.removeEventListener('pointerleave', onLeave)
      setHighlight(current, false)
      el.style.cursor = 'default'
    }
  }, [scope, home, focusedRoom, layoutRev])

  // ---- pointer: select + drag --------------------------------------------
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    // Dragging furniture is meaningless in the plan overview.
    if (scope === 'home' && home && !focusedRoom) return
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

    // Shared between the keyboard, pointer and context-menu handlers.
    let outlineTarget = null

    // Keyboard: nudge and rotate whichever piece is currently selected.
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

    const onContext = (e) => {
      const hit = pick(e)
      if (!hit) return
      e.preventDefault()
      outline.setFromObject(hit.node)
      outline.visible = true
      outlineTarget = hit.node
      setSelected({ key: hit.node.userData.key, name: hit.node.userData.name })
      setMenu({
        key: hit.node.userData.key,
        name: hit.node.userData.name,
        x: e.clientX,
        y: e.clientY,
      })
    }

    el.addEventListener('contextmenu', onContext)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerdown', syncTarget)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      el.removeEventListener('contextmenu', onContext)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerdown', syncTarget)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [items, layoutRev, floorplan, customShape, customDims, scope, home, focusedRoom])

  const store = useRoomStore()
  const activeItems = store.activeItems()
  const activeRoom = store.activeRoom()
  const inOverview = scope === 'home' && home && !focusedRoom
  const count = activeItems.reduce((n, i) => n + i.qty, 0)

  const runMenuAction = (action, ctx) => {
    const engine = engineRef.current
    const node = engine?.room?.handles.find((h) => h.userData.key === ctx.key)
    if (!node) return

    if (action === 'remove') {
      store.removeInstance(ctx.key)
      engine.outline.visible = false
      setSelected(null)
      return
    }
    if (action === 'duplicate') {
      const [id] = ctx.key.split('#')
      const synth = store.synthetics[id]
      if (synth) store.addSynthetic(synth)
      else store.addItem(id)
      return
    }

    store.pushHistory()
    if (action === 'rotate') node.rotation.y += Math.PI / 4
    if (action === 'center') {
      node.position.x = 0
      node.position.z = 0
    }
    engine.outline.setFromObject(node)
    store.setPlacement(ctx.key, {
      x: node.position.x,
      y: node.position.y,
      z: node.position.z,
      ry: node.rotation.y,
      zone: node.userData.zone,
    })
  }
  const hasCustom = Object.keys(store.placements).length > 0
  const historyDepth = store._past.length

  // Crowding: summed footprint vs floor area. Past ~55% you can't walk through it.
  // Crowding is about floor you can still walk on, so only floor-standing
  // pieces count. Wall art, pendants, curtains and a towel bar take up none of
  // it, and counting them was making rooms read as packed when they weren't.
  const fill = store.crowding(
    activeItems.flatMap((entry) => {
      const item = resolveItem(entry.id, store.synthetics)
      if (!item) return []
      const zone = zoneOf(item.model)
      if (zone !== 'floor' && zone !== 'center') return []
      return Array(entry.qty).fill(footprintArea(item))
    })
  )
  const dims = store.dims()
  // A fixture room gets a pack matched to what it is; everything else falls
  // back to the mood-based pack. Its copy differs too — a bathroom isn't
  // furnished to a vibe, it's furnished to what has to be plumbed in.
  const pack = starterForRoom(activeRoom?.kind, store.mood)
  const packName = pack.name
  const isFixtureRoom = Boolean(activeRoom?.kind && ROOM_PACKS[activeRoom.kind])

  // --- whole-home overview: a different set of controls entirely -----------
  if (inOverview) {
    const furnished = home.rooms.filter((r) => (r.items || []).length > 0).length
    return (
      <div className="canvas-root">
        <div ref={mountRef} className="canvas-mount" />

        <div className="canvas-tools">
          <span className="tool-note">
            {home.beds} bed · {home.baths} bath · {home.sqft.toLocaleString()} sq ft
          </span>
        </div>

        <div className="canvas-hud">
          {hoveredRoom ? (
            <span className="hud-sel">
              <strong>{hoveredRoom.name}</strong> — {hoveredRoom.sqft} sq ft · click to design it
            </span>
          ) : (
            <span className="hud-hint">
              Click any room to design it{furnished > 0 ? ` · ${furnished} furnished so far` : ''}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="canvas-root">
      <div ref={mountRef} className="canvas-mount" />

      <PieceMenu menu={menu} onAction={runMenuAction} onClose={() => setMenu(null)} />

      {activeRoom && (
        <div className="focus-banner">
          <button className="btn-quiet" onClick={() => store.exitRoom()}>
            ← Whole place
          </button>
          <span className="focus-name">{activeRoom.name}</span>
        </div>
      )}

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
              {isFixtureRoom
                ? "Start with the fixtures this room needs, then swap out whatever you don't want."
                : `Start with a set picked for your ${store.mood} vibe, then swap out whatever you don't want.`}
            </p>
            <button
              className="btn-primary"
              onClick={() => store.addMany(pack.items)}
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
