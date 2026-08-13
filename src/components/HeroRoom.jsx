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
          { shape: 'living', h: 2.9, palette, lighting: 'golden',
            picks: ['sofa', 'coffee-table', 'rug', 'fiddle-fig', 'floor-lamp', 'bookshelf', 'canvas-art', 'monstera'] },
          { shape: 'bedroom', h: 2.7, palette: 'dusk', lighting: 'warm',
            picks: ['bed', 'nightstand', 'rug', 'floor-lamp', 'gallery-set', 'snake-plant', 'curtains'] },
          { shape: 'lshape', h: 2.8, palette: 'sage', lighting: 'natural',
            picks: ['sofa', 'desk', 'desk-chair', 'monitor', 'palm', 'bookshelf', 'rug', 'pouf'] },
          { shape: 'loft', h: 3.6, palette: 'copper', lighting: 'moody',
            picks: ['sofa', 'coffee-table', 'tv', 'led-strip', 'floor-lamp', 'olive-tree', 'rug', 'speaker'] },
          { shape: 'alcove', h: 2.8, palette: 'terra', lighting: 'overcast',
            picks: ['bed', 'desk', 'desk-chair', 'bookshelf', 'hanging-pothos', 'floor-mirror', 'rug'] },
          { shape: 'studio', h: 2.6, palette: 'mint', lighting: 'cool',
            picks: ['bed-budget', 'desk-budget', 'chair-budget', 'succulent-trio', 'gallery-set', 'rug-budget'] },
        ]

        let sceneIndex = 0
        let built = null
        let disposeAtmosphere = null
        let room = null

        const buildScene = (i) => {
          const cfg = SCENES[i % SCENES.length]
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
        const HOLD_MS = 7000
        const FADE_MS = 900
        let phaseStart = performance.now()
        let fading = false
        let swapped = false

        let frame
        const tick = (now) => {
          frame = requestAnimationFrame(tick)
          const elapsed = now - phaseStart

          if (!fading && elapsed > HOLD_MS) {
            fading = true
            swapped = false
            phaseStart = now
          }

          let exposure = 1.15
          if (fading) {
            const k = Math.min((now - phaseStart) / FADE_MS, 1)
            // Down to black at the midpoint, back up after the swap.
            const dip = 1 - Math.sin(Math.min(k, 1) * Math.PI)
            exposure = 1.15 * Math.max(dip, 0.02)

            if (k >= 0.5 && !swapped) {
              teardownScene()
              sceneIndex++
              buildScene(sceneIndex)
              reframe()
              swapped = true
            }
            if (k >= 1) {
              fading = false
              phaseStart = now
              exposure = 1.15
            }
          }
          renderer.toneMappingExposure = exposure

          const t = now * 0.00004
          camera.position.set(Math.sin(t) * dist * 0.62, eye, Math.cos(t * 0.7) * dist * 0.5 + dist * 0.55)
          camera.lookAt(0, room.h * 0.36, -room.d * 0.08)
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
    <div
      ref={mountRef}
      className="hero-room"
      style={{ opacity: ready ? 0.92 : 0, transform: ready ? 'none' : 'translateY(10px)' }}
      aria-hidden="true"
    />
  )
}
