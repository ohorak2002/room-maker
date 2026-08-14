import { useEffect, useRef, useState } from 'react'
import './HeroRoom.css'

/**
 * A slowly turning furnished room behind the welcome copy.
 *
 * This is the app's own photography: the render is the product, so it can never
 * misrepresent what you get, and it costs no licence and no stock-photo budget.
 *
 * It is deliberately progressive. The SVG house drawing paints instantly on
 * first byte; Three.js is fetched afterwards and the render crossfades in when
 * ready. Someone on a slow connection reads the headline immediately and the
 * room arrives late rather than blocking them.
 */
export default function HeroRoom({ palette = 'clay' }) {
  const mountRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [shot, setShot] = useState(null)
  // Set by a dot click, read by the render loop on its next frame. A ref
  // rather than state because the loop lives outside React's render cycle
  // and re-rendering on every click would tear down the scene.
  const jumpRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let disposed = false
    let cleanup = () => {}

    // Idle-time import so it never competes with first paint.
    const start = () =>
      Promise.all([
        import('three'),
        import('three/examples/jsm/environments/RoomEnvironment.js'),
        import('three/examples/jsm/postprocessing/EffectComposer.js'),
        import('three/examples/jsm/postprocessing/RenderPass.js'),
        import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
        import('three/examples/jsm/postprocessing/OutputPass.js'),
        import('../three/buildRoom'),
        import('../three/atmosphere'),
        import('../three/layout'),
        import('../data/presets'),
        import('../data/catalog'),
      ]).then(
        ([
          THREE,
          { RoomEnvironment },
          { EffectComposer },
          { RenderPass },
          { UnrealBloomPass },
          { OutputPass },
          { buildRoom },
          { buildAtmosphere },
          { autoArrange, instanceKey },
          presets,
          catalog,
        ]) => {
        if (disposed || !mountRef.current) return

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100)
        // No alpha here: a transparent renderer with a gradient sky would just
        // punch a rectangle of sky color over the page. The atmosphere module
        // paints the sky itself, so the canvas can be opaque; the CSS mask on
        // .hero-room is what feathers it into the surrounding page.
        const renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.15
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.VSMShadowMap
        mount.appendChild(renderer.domElement)

        const pmrem = new THREE.PMREMGenerator(renderer)
        const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)
        scene.environment = envRT.texture

        const composer = new EffectComposer(renderer)
        composer.addPass(new RenderPass(scene, camera))
        composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.4, 0.82))
        composer.addPass(new OutputPass())

        // A rotating showcase rather than one static room: each scene is a
        // different shape, palette, light and furniture set, so the page shows
        // the range of what the app makes instead of a single example.
        const SCENES = [
          { name: 'Living room', mood: 'Golden hour', move: 'dolly', shape: 'living', h: 2.9, palette, lighting: 'golden',
            picks: ['sofa', 'coffee-table', 'rug', 'fiddle-fig', 'floor-lamp', 'bookshelf', 'canvas-art', 'monstera'] },
          { name: 'Bedroom', mood: 'Dusk blue', move: 'rise', shape: 'bedroom', h: 2.7, palette: 'dusk', lighting: 'warm',
            picks: ['bed', 'nightstand', 'rug', 'floor-lamp', 'gallery-set', 'snake-plant', 'curtains'] },
          { name: 'Studio with a wing', mood: 'Sage & oat', move: 'pan', shape: 'lshape', h: 2.8, palette: 'sage', lighting: 'natural',
            picks: ['sofa', 'desk', 'desk-chair', 'monitor', 'palm', 'bookshelf', 'rug', 'pouf'] },
          { name: 'Loft', mood: 'Charcoal & copper', move: 'crane', shape: 'loft', h: 3.6, palette: 'copper', lighting: 'moody',
            picks: ['sofa', 'coffee-table', 'tv', 'led-strip', 'floor-lamp', 'olive-tree', 'rug', 'speaker'] },
          { name: 'Room with an alcove', mood: 'Terracotta', move: 'orbit', shape: 'alcove', h: 2.8, palette: 'terra', lighting: 'overcast',
            picks: ['bed', 'desk', 'desk-chair', 'bookshelf', 'hanging-pothos', 'floor-mirror', 'rug'] },
          { name: 'Studio', mood: 'Mint & birch', move: 'pull', shape: 'studio', h: 2.6, palette: 'mint', lighting: 'cool',
            picks: ['bed-budget', 'desk-budget', 'chair-budget', 'succulent-trio', 'gallery-set', 'rug-budget'] },
        ]

        let sceneIndex = 0
        let move = 'dolly'
        let built = null
        let disposeAtmosphere = null
        let room = null

        const buildScene = (i) => {
          const cfg = SCENES[i % SCENES.length]
          setShot({ name: cfg.name, mood: cfg.mood, index: i % SCENES.length, total: SCENES.length })
          move = cfg.move || 'dolly'
          const shape = { ...presets.getShape(cfg.shape), h: cfg.h }
          const p = presets.getPalette(cfg.palette)
          room = presets.shapeBounds(shape)

          disposeAtmosphere = buildAtmosphere(scene, {
            lighting: cfg.lighting,
            roomSpan: Math.max(room.w, room.d),
            floorY: 0,
          })

          const entries = cfg.picks
            .map((id) => ({ key: instanceKey(id, 0), item: catalog.byId(id) }))
            .filter((e) => e.item)

          const placements = autoArrange(entries, { ...room, shape })
          built = buildRoom(scene, {
            shape,
            ...room,
            colors: { wall: p.wall, floor: p.floor, trim: p.trim, accent: p.accent },
            lighting: cfg.lighting,
            windows: true,
            entries,
            placements,
          })
          return room
        }

        const teardownScene = () => {
          built?.dispose()
          disposeAtmosphere?.()
          built = null
          disposeAtmosphere = null
        }

        buildScene(sceneIndex)

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

        // Framing is recomputed per scene, since a 3.6m loft and a 2.6m studio
        // need very different camera distances.
        let dist = 0
        let eye = 0
        const reframe = () => {
          const radius = Math.hypot(room.w / 2, room.d / 2, room.h / 2)
          dist = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 0.66
          eye = room.h * 0.62
        }
        reframe()

        // Each scene holds for HOLD_MS, then crossfades to the next through
        // black. Swapping geometry mid-fade means the change is never visible
        // as a pop — the only frame where both could be seen is fully dark.
        const HOLD_MS = 6400
        const FADE_MS = 760
        let phaseStart = performance.now()
        let fading = false
        let swapped = false
        let entered = performance.now()

        // Cubic ease, used for both the dip and the push-in. Linear motion is
        // the single clearest sign that something was animated by a computer.
        const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

        let frame
        const tick = (now) => {
          frame = requestAnimationFrame(tick)
          const elapsed = now - phaseStart

          // A click jumps immediately rather than waiting out the hold; making
          // someone watch the rest of a scene they've chosen to leave is the
          // opposite of what the control is for.
          if (!fading && (elapsed > HOLD_MS || jumpRef.current !== null)) {
            fading = true
            swapped = false
            phaseStart = now
          }

          let exposure = 1.15
          if (fading) {
            const k = Math.min((now - phaseStart) / FADE_MS, 1)
            // Dips deep enough to hide the geometry swap and no deeper. The old
            // version went to near-black, which read as the power cutting out
            // rather than as a transition.
            const dip = 1 - Math.sin(ease(k) * Math.PI) * 0.94
            exposure = 1.15 * dip

            if (k >= 0.5 && !swapped) {
              teardownScene()
              if (jumpRef.current !== null) {
                sceneIndex = jumpRef.current
                jumpRef.current = null
              } else {
                sceneIndex++
              }
              buildScene(sceneIndex)
              reframe()
              swapped = true
              entered = now
            }
            if (k >= 1) {
              fading = false
              phaseStart = now
              exposure = 1.15
            }
          }
          renderer.toneMappingExposure = exposure

          // Every scene gets its own camera move rather than all six sharing one
          // slow drift. A single repeated motion is what made the loop read as a
          // screensaver: the second time you saw it you knew the third. Six
          // distinct moves means each room arrives as a shot of its own.
          //
          // All of them run over the whole hold, eased, so the camera is always
          // decelerating — real camera moves settle, they don't stop dead.
          const span = Math.min((now - entered) / (HOLD_MS + FADE_MS), 1)
          const e = ease(span)
          const drift = now * 0.00004

          let ox = Math.sin(drift) * dist * 0.62
          let oy = eye
          let oz = Math.cos(drift * 0.7) * dist * 0.5 + dist * 0.55
          let look = room.h * 0.36

          if (move === 'dolly') {
            // Straight push toward the room.
            const k = 1.09 - 0.11 * e
            ox *= k
            oz *= k
          } else if (move === 'pan') {
            // Slides across the front, holding its distance.
            ox = (-0.5 + e) * dist * 0.62
            oz = dist * 0.92
          } else if (move === 'rise') {
            // Starts low and lifts, which suits a bedroom — you come up over
            // the bed rather than looking down at it from the start.
            oy = eye * (0.62 + 0.5 * e)
            const k = 1.04 - 0.06 * e
            ox *= k
            oz *= k
            look = room.h * (0.3 + 0.1 * e)
          } else if (move === 'crane') {
            // Drops from high, for the loft, where the height is the point.
            oy = eye * (1.7 - 0.72 * e)
            const k = 1.14 - 0.16 * e
            ox *= k
            oz *= k
            look = room.h * (0.5 - 0.14 * e)
          } else if (move === 'orbit') {
            // Arcs around a corner, which is how you'd read an odd-shaped room.
            const a = -0.62 + e * 1.05
            ox = Math.sin(a) * dist * 0.86
            oz = Math.cos(a) * dist * 0.86
          } else if (move === 'pull') {
            // Backs off to reveal the whole space — the right last beat before
            // the loop starts over.
            const k = 0.86 + 0.24 * e
            ox *= k
            oz *= k
          }

          camera.position.set(ox, oy, oz)
          camera.lookAt(0, look, -room.d * 0.08)
          composer.render()
        }
        frame = requestAnimationFrame(tick)

        setReady(true)

        cleanup = () => {
          cancelAnimationFrame(frame)
          ro.disconnect()
          teardownScene()
          composer.dispose()
          envRT.dispose()
          pmrem.dispose()
          renderer.dispose()
          if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
        }
      }
      )

    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(start, { timeout: 1200 })
      : setTimeout(start, 400)

    return () => {
      disposed = true
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle)
      else clearTimeout(idle)
      cleanup()
    }
  }, [palette])

  // Opacity is set inline rather than via a class: the element competes with
  // several stacking and media rules on this screen, and an inline value is the
  // one thing that can't lose a specificity argument.
  return (
    <div className="hero-stage">
      <div
        ref={mountRef}
        className="hero-room"
        style={{ opacity: ready ? 0.92 : 0, transform: ready ? 'none' : 'translateY(10px)' }}
      />

      {ready && shot && (
        <div className="hero-caption">
          <span key={shot.name} className="hero-cap-text">
            <strong>{shot.name}</strong>
            <span className="hero-cap-mood">{shot.mood}</span>
          </span>
          <span className="hero-dots">
            {Array.from({ length: shot.total }, (_, i) => (
              <button
                key={i}
                type="button"
                className={`hero-dot ${i === shot.index ? 'on' : ''}`}
                onClick={() => {
                  if (i !== shot.index) jumpRef.current = i
                }}
                aria-label={`Show room ${i + 1} of ${shot.total}`}
              />
            ))}
          </span>
        </div>
      )}
    </div>
  )
}
