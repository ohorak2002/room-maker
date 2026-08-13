import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { zoneOf } from './layout'
import { floorRuns, wallRuns, windowWall } from './shapeGeom'
import { shapeBounds } from '../data/presets'

// ---------------------------------------------------------------------------
// Materials
//
// Everything is PBR and reads the scene environment map, so surfaces pick up
// real reflections instead of looking like flat painted cardboard. The
// envMapIntensity is what separates a fabric sofa from a metal lamp base —
// fabric barely reflects, chrome reflects almost everything.
// ---------------------------------------------------------------------------

const mat = (color, roughness = 0.85, metalness = 0.0, envMapIntensity = 0.6) =>
  new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness,
    metalness,
    envMapIntensity,
  })

const glow = (color, intensity = 1.2) =>
  new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    roughness: 0.4,
    envMapIntensity: 0.3,
  })

/**
 * Every rectangular part is a rounded box, not a hard-edged one. Real furniture
 * has a small radius on every edge, and that highlight along the bevel is most
 * of what makes a render stop looking procedural. The radius is clamped so thin
 * parts (a 2cm shelf board) don't collapse into a pill.
 */
const box = (w, h, d, material, radius = 0.018) => {
  const r = Math.min(radius, w / 2.2, h / 2.2, d / 2.2)
  if (r <= 0.002) return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), material)
}

/** Hard-edged box, for the room shell where bevels would read as sloppy. */
const hardBox = (w, h, d, material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)

const cyl = (rt, rb, h, material, seg = 32) =>
  new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material)
const sphere = (r, material, seg = 24) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), material)

const shadowed = (group) => {
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  return group
}

// ---------------------------------------------------------------------------
// Object builders. Each returns a Group whose origin sits on the floor.
// `zone` decides where the placer puts it.
// ---------------------------------------------------------------------------

const WOOD = '#8B6B4A'
const DARK = '#2B2D31'

// Physical surface presets. The numbers matter more than they look: fabric with
// a metal's reflectivity looks like a beanbag wrapped in foil, and wood with
// fabric roughness goes dead flat under the key light.
//                      roughness, metalness, envIntensity
const FABRIC = (c) => mat(c, 0.95, 0.0, 0.12)
const WOODEN = (c) => mat(c, 0.55, 0.0, 0.45)
const METAL = (c) => mat(c, 0.32, 0.88, 1.1)
const PLASTIC = (c) => mat(c, 0.42, 0.0, 0.7)
const CERAMIC = (c) => mat(c, 0.22, 0.0, 0.95)
const FOLIAGE = (c) => mat(c, 0.72, 0.0, 0.2)
const PAPERY = (c) => mat(c, 0.88, 0.0, 0.2)
// Shower screens and appliance doors. Transparency alone reads as a hole in the
// wall; it's the near-zero roughness plus a strong env response that makes it
// register as glass.
const GLASS = (c = '#DCE6EA') =>
  new THREE.MeshStandardMaterial({
    color: new THREE.Color(c),
    roughness: 0.06,
    metalness: 0.0,
    envMapIntensity: 1.4,
    transparent: true,
    opacity: 0.24,
  })
const STONE = (c = '#3C3F44') => mat(c, 0.28, 0.1, 0.8)
const ENAMEL = (c) => mat(c, 0.15, 0.25, 1.1)

/**
 * Washer and dryer are the same machine with a different door tint, so they
 * share a builder rather than duplicating twenty lines for a colour change.
 */
const frontLoader = (it, doorTint) => {
  const g = new THREE.Group()
  const body = box(0.6, it.h, 0.6, mat('#E8EAEC', 0.35, 0.1, 0.7))
  body.position.y = it.h / 2
  g.add(body)

  const port = cyl(0.19, 0.19, 0.05, GLASS(doorTint), 24)
  port.rotation.x = Math.PI / 2
  port.position.set(0, it.h * 0.5, 0.3)
  g.add(port)

  const ring = cyl(0.22, 0.22, 0.035, METAL('#AEB3B8'), 24)
  ring.rotation.x = Math.PI / 2
  ring.position.set(0, it.h * 0.5, 0.285)
  g.add(ring)

  const panel = box(0.56, 0.1, 0.02, mat('#2A2D31', 0.3, 0.2, 0.8))
  panel.position.set(0, it.h * 0.87, 0.31)
  g.add(panel)

  const dial = cyl(0.035, 0.035, 0.02, METAL('#C9CDD2'), 16)
  dial.rotation.x = Math.PI / 2
  dial.position.set(-0.19, it.h * 0.87, 0.32)
  g.add(dial)
  return g
}

export const builders = {
  plant: (it) => {
    const g = new THREE.Group()
    const pot = cyl(0.16, 0.12, 0.26, CERAMIC('#B4785A'))
    pot.position.y = 0.13
    g.add(pot)
    for (let i = 0; i < 6; i++) {
      const blade = box(0.06, it.h - 0.2, 0.02, FOLIAGE(it.color))
      blade.position.set(Math.sin(i) * 0.07, 0.26 + (it.h - 0.2) / 2, Math.cos(i) * 0.07)
      blade.rotation.z = (i - 3) * 0.09
      g.add(blade)
    }
    return g
  },

  smallplant: (it) => {
    const g = new THREE.Group()
    const pot = cyl(0.11, 0.09, 0.12, CERAMIC('#D8CFC2'))
    pot.position.y = 0.06
    g.add(pot)
    for (let i = 0; i < 3; i++) {
      const bud = sphere(0.07, FOLIAGE(it.color))
      bud.scale.y = 0.8
      bud.position.set((i - 1) * 0.09, 0.16, 0)
      g.add(bud)
    }
    return g
  },

  tree: (it) => {
    const g = new THREE.Group()
    const pot = cyl(0.22, 0.17, 0.34, CERAMIC('#A8705A'))
    pot.position.y = 0.17
    g.add(pot)
    const trunk = cyl(0.035, 0.05, it.h - 0.4, WOODEN('#6B5340'), 12)
    trunk.position.y = 0.34 + (it.h - 0.4) / 2
    g.add(trunk)
    const canopyY = it.h - 0.15
    for (let i = 0; i < 5; i++) {
      const leaf = sphere(0.24 - i * 0.02, FOLIAGE(it.color), 16)
      leaf.scale.set(1, 0.7, 1)
      leaf.position.set(Math.cos(i * 2.2) * 0.2, canopyY - i * 0.22, Math.sin(i * 2.2) * 0.2)
      g.add(leaf)
    }
    return g
  },

  palm: (it) => {
    const g = new THREE.Group()
    const pot = cyl(0.2, 0.16, 0.3, CERAMIC('#9E8A72'))
    pot.position.y = 0.15
    g.add(pot)

    // Slim stems that fan out and arch over, rather than slabs standing on end.
    const crown = it.h * 0.62
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      const stem = cyl(0.012, 0.022, crown, WOODEN('#7C7A52'), 8)
      stem.position.set(Math.cos(a) * 0.05, 0.3 + crown / 2, Math.sin(a) * 0.05)
      stem.rotation.z = Math.cos(a) * 0.1
      g.add(stem)
    }

    const frondM = FOLIAGE(it.color)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3
      const droop = 0.55 + (i % 3) * 0.16
      const len = it.h * 0.38

      const arm = new THREE.Group()
      arm.position.set(0, 0.3 + crown, 0)
      arm.rotation.y = -a
      arm.rotation.z = droop

      // A frond is a tapered spine with leaflets, not a rectangle.
      const spine = cyl(0.006, 0.012, len, frondM, 6)
      spine.position.y = len / 2
      arm.add(spine)

      for (let k = 1; k <= 6; k++) {
        const t = k / 7
        for (const side of [-1, 1]) {
          const leaf = box(0.008, 0.13 - t * 0.05, 0.055, frondM)
          leaf.position.set(side * 0.055, len * t, 0)
          leaf.rotation.z = side * 0.75
          arm.add(leaf)
        }
      }
      g.add(arm)
    }
    return g
  },

  vase: (it) => {
    const g = new THREE.Group()
    const v = cyl(0.07, 0.05, 0.22, CERAMIC('#DCD3C6'))
    v.position.y = 0.11
    g.add(v)
    for (let i = 0; i < 8; i++) {
      const stem = box(0.015, 0.3, 0.015, FOLIAGE(it.color))
      stem.position.set((Math.random() - 0.5) * 0.12, 0.34, (Math.random() - 0.5) * 0.12)
      stem.rotation.z = (Math.random() - 0.5) * 0.5
      g.add(stem)
    }
    return g
  },

  hanging: (it) => {
    const g = new THREE.Group()
    const pot = cyl(0.12, 0.14, 0.16, FABRIC('#C4B49A'))
    g.add(pot)
    for (let i = 0; i < 6; i++) {
      const vine = box(0.03, 0.4 + Math.random() * 0.3, 0.03, FOLIAGE(it.color))
      const a = (i / 6) * Math.PI * 2
      vine.position.set(Math.cos(a) * 0.1, -0.25, Math.sin(a) * 0.1)
      g.add(vine)
    }
    return g
  },

  chair: (it) => {
    const g = new THREE.Group()
    const seat = box(0.5, 0.08, 0.5, FABRIC(it.color))
    seat.position.y = 0.45
    g.add(seat)
    const back = box(0.5, 0.55, 0.07, FABRIC(it.color))
    back.position.set(0, 0.75, -0.22)
    g.add(back)
    const post = cyl(0.04, 0.04, 0.4, METAL(DARK), 10)
    post.position.y = 0.22
    g.add(post)
    const base = cyl(0.28, 0.28, 0.04, METAL(DARK), 16)
    base.position.y = 0.03
    g.add(base)
    return g
  },

  armchair: (it) => {
    const g = new THREE.Group()
    const m = FABRIC(it.color)
    const seat = box(0.85, 0.35, 0.85, m)
    seat.position.y = 0.3
    g.add(seat)
    const back = box(0.85, 0.6, 0.18, m)
    back.position.set(0, 0.6, -0.34)
    g.add(back)
    for (const s of [-1, 1]) {
      const arm = box(0.16, 0.28, 0.85, m)
      arm.position.set(s * 0.35, 0.6, 0)
      g.add(arm)
    }
    return g
  },

  sofa: (it) => {
    const g = new THREE.Group()
    const m = FABRIC(it.color)
    const seat = box(2.1, 0.4, 0.9, m)
    seat.position.y = 0.3
    g.add(seat)
    const back = box(2.1, 0.6, 0.2, m)
    back.position.set(0, 0.6, -0.35)
    g.add(back)
    for (const s of [-1, 1]) {
      const arm = box(0.18, 0.3, 0.9, m)
      arm.position.set(s * 0.96, 0.62, 0)
      g.add(arm)
    }
    return g
  },

  beanbag: (it) => {
    const g = new THREE.Group()
    const b = sphere(0.45, FABRIC(it.color))
    b.scale.set(1, 0.65, 1)
    b.position.y = 0.3
    g.add(b)
    return g
  },

  pouf: (it) => {
    const g = new THREE.Group()
    const p = cyl(0.28, 0.3, 0.36, FABRIC(it.color), 20)
    p.position.y = 0.18
    g.add(p)
    return g
  },

  desk: (it) => {
    const g = new THREE.Group()
    const top = box(1.5, 0.06, 0.7, WOODEN(it.color))
    top.position.y = it.h
    g.add(top)
    for (const [x, z] of [[-0.68, -0.3], [0.68, -0.3], [-0.68, 0.3], [0.68, 0.3]]) {
      const leg = box(0.06, it.h, 0.06, METAL(DARK))
      leg.position.set(x, it.h / 2, z)
      g.add(leg)
    }
    return g
  },

  table: (it) => {
    const g = new THREE.Group()
    const top = cyl(0.5, 0.5, 0.05, WOODEN(it.color), 24)
    top.position.y = it.h
    g.add(top)
    const stem = cyl(0.06, 0.1, it.h, METAL(DARK), 12)
    stem.position.y = it.h / 2
    g.add(stem)
    return g
  },

  nightstand: (it) => {
    const g = new THREE.Group()
    const body = box(0.45, it.h, 0.4, WOODEN(it.color))
    body.position.y = it.h / 2
    g.add(body)
    for (const y of [0.18, 0.4]) {
      const pull = box(0.16, 0.02, 0.02, METAL('#D8CFC2'))
      pull.position.set(0, y, 0.21)
      g.add(pull)
    }
    return g
  },

  bed: (it) => {
    const g = new THREE.Group()
    const base = box(1.6, 0.35, 2.0, FABRIC(it.color))
    base.position.y = 0.18
    g.add(base)
    const mattress = box(1.55, 0.22, 1.95, FABRIC('#EFEAE2'))
    mattress.position.y = 0.46
    g.add(mattress)
    const head = box(1.6, 0.7, 0.12, FABRIC(it.color))
    head.position.set(0, 0.6, -1.0)
    g.add(head)
    for (const s of [-1, 1]) {
      const pillow = box(0.6, 0.14, 0.35, FABRIC('#FFFFFF'))
      pillow.position.set(s * 0.38, 0.62, -0.72)
      g.add(pillow)
    }
    return g
  },

  shelf: (it) => {
    const g = new THREE.Group()
    const m = WOODEN(it.color)
    for (const s of [-1, 1]) {
      const side = box(0.05, it.h, 0.32, m)
      side.position.set(s * 0.42, it.h / 2, 0)
      g.add(side)
    }
    for (let i = 0; i <= 4; i++) {
      const shelfBoard = box(0.9, 0.04, 0.32, m)
      shelfBoard.position.y = (i * it.h) / 4
      g.add(shelfBoard)
    }
    return g
  },

  rug: (it) => {
    const g = new THREE.Group()
    const r = box(2.6, 0.03, 1.9, FABRIC(it.color))
    r.position.y = 0.015
    g.add(r)
    return g
  },

  floorlamp: (it) => {
    const g = new THREE.Group()
    const base = cyl(0.18, 0.2, 0.04, METAL(DARK), 20)
    base.position.y = 0.02
    g.add(base)
    const pole = cyl(0.02, 0.02, it.h, METAL(DARK), 10)
    pole.position.y = it.h / 2
    g.add(pole)
    const shade = cyl(0.14, 0.2, 0.24, glow(it.color, 0.9), 20)
    shade.position.y = it.h
    g.add(shade)
    const light = new THREE.PointLight(new THREE.Color(it.color), 6, 6, 2)
    light.position.set(0, it.h - 0.1, 0)
    g.add(light)
    return g
  },

  desklamp: (it) => {
    const g = new THREE.Group()
    const base = cyl(0.1, 0.11, 0.03, PLASTIC(it.color), 16)
    g.add(base)
    const arm = cyl(0.015, 0.015, 0.42, PLASTIC(it.color), 8)
    arm.position.set(0, 0.21, 0)
    arm.rotation.z = 0.3
    g.add(arm)
    const head = cyl(0.05, 0.09, 0.12, glow('#FFE3A8', 1.4), 14)
    head.position.set(-0.13, 0.42, 0)
    head.rotation.z = 0.6
    g.add(head)
    const light = new THREE.PointLight(0xffe3a8, 3, 3, 2)
    light.position.set(-0.13, 0.4, 0)
    g.add(light)
    return g
  },

  pendant: (it) => {
    const g = new THREE.Group()
    const cord = cyl(0.008, 0.008, 0.7, METAL(DARK), 6)
    cord.position.y = 0.35
    g.add(cord)
    const shade = cyl(0.06, 0.26, 0.3, glow(it.color, 0.8), 20)
    shade.position.y = -0.05
    g.add(shade)
    const light = new THREE.PointLight(0xfff0d0, 8, 8, 2)
    light.position.y = -0.15
    g.add(light)
    return g
  },

  ledstrip: (it) => {
    const g = new THREE.Group()
    const strip = box(2.4, 0.04, 0.04, glow(it.color, 2.0))
    g.add(strip)
    const light = new THREE.PointLight(new THREE.Color(it.color), 5, 7, 2)
    g.add(light)
    return g
  },

  painting: (it) => {
    const g = new THREE.Group()
    const frame = box(1.1, it.h, 0.05, WOODEN('#2B2D31'))
    g.add(frame)
    const canvas = box(1.0, it.h - 0.1, 0.02, mat(it.color, 0.8))
    canvas.position.z = 0.03
    g.add(canvas)
    return g
  },

  wallpanel: (it) => {
    const g = new THREE.Group()
    const panel = box(1.0, it.h, 0.06, it.emissive ? glow(it.color, 1.6) : FABRIC(it.color))
    g.add(panel)
    if (it.emissive) {
      const light = new THREE.PointLight(new THREE.Color(it.color), 4, 5, 2)
      light.position.z = 0.4
      g.add(light)
    }
    return g
  },

  mirror: (it) => {
    const g = new THREE.Group()
    const frame = box(0.7, it.h, 0.06, WOODEN('#8B7355'))
    frame.position.y = it.h / 2
    g.add(frame)
    const glass = box(0.62, it.h - 0.08, 0.02, mat(it.color, 0.04, 0.95, 1.5))
    glass.position.set(0, it.h / 2, 0.04)
    g.add(glass)
    return g
  },

  curtain: (it) => {
    const g = new THREE.Group()
    for (const s of [-1, 1]) {
      const panel = box(0.42, it.h, 0.08, FABRIC(it.color))
      panel.position.set(s * 0.85, it.h / 2, 0)
      g.add(panel)
    }
    const rod = cyl(0.02, 0.02, 2.4, METAL(DARK), 8)
    rod.rotation.z = Math.PI / 2
    rod.position.y = it.h
    g.add(rod)
    return g
  },

  monitor: (it) => {
    const g = new THREE.Group()
    const screen = box(1.0, 0.42, 0.04, glow('#1B3A5C', 0.35))
    screen.position.y = 0.42
    g.add(screen)
    const neck = box(0.06, 0.18, 0.06, PLASTIC(it.color))
    neck.position.y = 0.14
    g.add(neck)
    const foot = box(0.32, 0.03, 0.18, PLASTIC(it.color))
    foot.position.y = 0.02
    g.add(foot)
    return g
  },

  tower: (it) => {
    const g = new THREE.Group()
    const body = box(0.22, it.h, 0.46, METAL(it.color))
    body.position.y = it.h / 2
    g.add(body)
    const led = box(0.01, it.h - 0.12, 0.02, glow('#5CC8FF', 2.0))
    led.position.set(0.115, it.h / 2, 0.2)
    g.add(led)
    return g
  },

  tv: (it) => {
    const g = new THREE.Group()
    const screen = box(1.45, it.h, 0.06, glow('#12202E', 0.3))
    g.add(screen)
    return g
  },

  speaker: (it) => {
    const g = new THREE.Group()
    const body = box(0.24, it.h, 0.26, WOODEN(it.color))
    body.position.y = it.h / 2
    g.add(body)
    for (const y of [0.28, 0.58, 0.82]) {
      const cone = cyl(0.07, 0.07, 0.02, PLASTIC('#15171A'), 20)
      cone.rotation.x = Math.PI / 2
      cone.position.set(0, y * it.h, 0.14)
      g.add(cone)
    }
    return g
  },

  // --- bathroom -----------------------------------------------------------
  // Porcelain is the whole material story here: low roughness, no metalness,
  // and a high env response, which is what separates a sanitary fixture from a
  // white-painted box.

  toilet: (it) => {
    const g = new THREE.Group()
    const porcelain = CERAMIC('#F6F6F4')

    const pedestal = box(0.3, 0.36, 0.42, porcelain, 0.07)
    pedestal.position.set(0, 0.18, 0.04)
    g.add(pedestal)

    const bowl = cyl(0.19, 0.15, 0.15, porcelain, 22)
    bowl.scale.z = 1.2
    bowl.position.set(0, 0.42, 0.09)
    g.add(bowl)

    const seat = cyl(0.2, 0.2, 0.03, PLASTIC('#FCFCFB'), 22)
    seat.scale.z = 1.2
    seat.position.set(0, 0.51, 0.09)
    g.add(seat)

    const tank = box(0.4, 0.36, 0.16, porcelain, 0.03)
    tank.position.set(0, 0.55, -0.18)
    g.add(tank)

    const lid = box(0.42, 0.03, 0.18, porcelain, 0.012)
    lid.position.set(0, 0.745, -0.18)
    g.add(lid)

    const flush = cyl(0.026, 0.026, 0.018, METAL('#C9CDD2'), 12)
    flush.position.set(0.12, 0.765, -0.18)
    g.add(flush)
    return g
  },

  vanity: (it) => {
    const g = new THREE.Group()
    const cab = box(0.9, it.h - 0.06, 0.48, WOODEN(it.color))
    cab.position.y = (it.h - 0.06) / 2
    g.add(cab)

    const top = box(0.96, 0.06, 0.52, STONE('#EDEAE4'))
    top.position.y = it.h - 0.03
    g.add(top)

    const basin = cyl(0.17, 0.13, 0.11, CERAMIC('#FFFFFF'), 24)
    basin.position.set(0, it.h + 0.045, 0.02)
    g.add(basin)

    // A faucet is a riser plus a spout reaching back over the basin.
    const riser = cyl(0.018, 0.018, 0.2, METAL('#C9CDD2'), 12)
    riser.position.set(0, it.h + 0.1, -0.17)
    g.add(riser)
    const spout = box(0.022, 0.022, 0.15, METAL('#C9CDD2'))
    spout.position.set(0, it.h + 0.19, -0.11)
    g.add(spout)

    for (const s of [-1, 1]) {
      const pull = box(0.16, 0.02, 0.02, METAL('#C9CDD2'))
      pull.position.set(s * 0.22, it.h * 0.52, 0.25)
      g.add(pull)
    }
    return g
  },

  bathtub: (it) => {
    const g = new THREE.Group()
    const porcelain = CERAMIC('#F7F7F5')

    const shell = box(1.65, it.h, 0.75, porcelain, 0.07)
    shell.position.y = it.h / 2
    g.add(shell)

    // Sinking a slightly darker, glossier well just under the rim reads as
    // depth far more cheaply than actually hollowing the geometry would.
    const well = box(1.48, 0.1, 0.58, ENAMEL('#E4EBEE'), 0.05)
    well.position.y = it.h - 0.04
    g.add(well)

    const spout = cyl(0.021, 0.021, 0.13, METAL('#C9CDD2'), 12)
    spout.rotation.z = Math.PI / 2
    spout.position.set(-0.72, it.h + 0.07, 0)
    g.add(spout)
    return g
  },

  shower: (it) => {
    const g = new THREE.Group()

    const tray = box(0.92, 0.09, 0.92, CERAMIC('#F4F4F2'), 0.03)
    tray.position.y = 0.045
    g.add(tray)

    // Two panels meeting at a corner — enough to read as an enclosure without
    // boxing the piece in from every side.
    const front = box(0.92, it.h - 0.12, 0.018, GLASS())
    front.position.set(0, (it.h - 0.12) / 2 + 0.09, 0.45)
    g.add(front)
    const side = box(0.92, it.h - 0.12, 0.018, GLASS())
    side.rotation.y = Math.PI / 2
    side.position.set(0.45, (it.h - 0.12) / 2 + 0.09, 0)
    g.add(side)

    const riser = cyl(0.016, 0.016, it.h * 0.45, METAL('#C9CDD2'), 10)
    riser.position.set(-0.36, it.h * 0.62, -0.36)
    g.add(riser)

    const head = cyl(0.095, 0.095, 0.025, METAL('#C9CDD2'), 18)
    head.position.set(-0.3, it.h * 0.86, -0.3)
    g.add(head)
    return g
  },

  towelrack: (it) => {
    const g = new THREE.Group()
    const chrome = METAL('#C9CDD2')

    const bar = cyl(0.014, 0.014, 0.62, chrome, 10)
    bar.rotation.z = Math.PI / 2
    g.add(bar)

    for (const s of [-1, 1]) {
      const arm = box(0.02, 0.02, 0.07, chrome)
      arm.position.set(s * 0.3, 0, -0.04)
      g.add(arm)

      const towel = box(0.24, 0.44, 0.045, FABRIC(it.color))
      towel.position.set(s * 0.15, -0.22, 0.03)
      g.add(towel)
    }
    return g
  },

  // --- kitchen ------------------------------------------------------------

  counter: (it) => {
    const g = new THREE.Group()
    const w = 1.8

    const carcass = box(w, it.h - 0.05, 0.62, WOODEN(it.color))
    carcass.position.y = (it.h - 0.05) / 2
    g.add(carcass)

    const top = box(w + 0.04, 0.05, 0.66, STONE())
    top.position.y = it.h - 0.025
    g.add(top)

    // Proud door fronts with a pull each. The gap between doors is what stops a
    // cabinet run from reading as one long slab.
    for (let i = 0; i < 3; i++) {
      const x = -w / 2 + (i + 0.5) * (w / 3)
      const door = box(w / 3 - 0.035, it.h - 0.2, 0.022, WOODEN(it.color))
      door.position.set(x, (it.h - 0.05) / 2, 0.32)
      g.add(door)

      const pull = box(w / 3 - 0.22, 0.018, 0.018, METAL('#C9CDD2'))
      pull.position.set(x, it.h - 0.19, 0.345)
      g.add(pull)
    }
    return g
  },

  kitchensink: (it) => {
    const g = new THREE.Group()
    const w = 1.2

    const carcass = box(w, it.h - 0.05, 0.62, WOODEN(it.color))
    carcass.position.y = (it.h - 0.05) / 2
    g.add(carcass)

    const top = box(w + 0.04, 0.05, 0.66, STONE())
    top.position.y = it.h - 0.025
    g.add(top)

    // An inset steel basin, dropped just below the counter line.
    const basin = box(0.62, 0.14, 0.42, METAL('#AEB3B8'), 0.02)
    basin.position.set(0, it.h - 0.075, 0.02)
    g.add(basin)

    const riser = cyl(0.02, 0.02, 0.26, METAL('#C9CDD2'), 12)
    riser.position.set(0, it.h + 0.13, -0.22)
    g.add(riser)
    const neck = box(0.026, 0.026, 0.2, METAL('#C9CDD2'))
    neck.position.set(0, it.h + 0.25, -0.13)
    g.add(neck)

    const door = box(w - 0.06, it.h - 0.34, 0.022, WOODEN(it.color))
    door.position.set(0, (it.h - 0.2) / 2, 0.32)
    g.add(door)
    return g
  },

  island: (it) => {
    const g = new THREE.Group()

    const carcass = box(1.5, it.h - 0.05, 0.9, WOODEN(it.color))
    carcass.position.y = (it.h - 0.05) / 2
    g.add(carcass)

    // The overhang on one side is what makes an island an island rather than a
    // free-standing cabinet — it's where stools go.
    const top = box(1.62, 0.06, 1.06, STONE())
    top.position.set(0, it.h - 0.03, 0.06)
    g.add(top)

    for (let i = 0; i < 2; i++) {
      const x = -0.36 + i * 0.72
      const door = box(0.66, it.h - 0.22, 0.022, WOODEN(it.color))
      door.position.set(x, (it.h - 0.05) / 2, -0.46)
      g.add(door)
    }
    return g
  },

  range: (it) => {
    const g = new THREE.Group()
    const steel = METAL('#B9BDC2')

    const body = box(0.76, it.h - 0.04, 0.62, steel)
    body.position.y = (it.h - 0.04) / 2
    g.add(body)

    const cooktop = box(0.78, 0.03, 0.64, ENAMEL('#17191C'))
    cooktop.position.y = it.h - 0.02
    g.add(cooktop)

    for (const [x, z] of [[-0.18, -0.14], [0.18, -0.14], [-0.18, 0.16], [0.18, 0.16]]) {
      const burner = cyl(0.082, 0.082, 0.01, mat('#0E1013', 0.35, 0.4, 0.9), 20)
      burner.position.set(x, it.h + 0.001, z)
      g.add(burner)
    }

    const oven = box(0.68, 0.42, 0.022, ENAMEL('#1B1D21'))
    oven.position.set(0, it.h * 0.4, 0.32)
    g.add(oven)

    const handle = cyl(0.018, 0.018, 0.66, steel, 10)
    handle.rotation.z = Math.PI / 2
    handle.position.set(0, it.h * 0.68, 0.35)
    g.add(handle)
    return g
  },

  fridge: (it) => {
    const g = new THREE.Group()
    const steel = METAL('#C2C6CB')

    const body = box(0.9, it.h, 0.72, steel)
    body.position.y = it.h / 2
    g.add(body)

    // Freezer-over-fridge. The door split and two offset handles carry the read;
    // without them it's a filing cabinet.
    const split = box(0.9, 0.014, 0.02, mat('#8E9297', 0.4, 0.6, 0.8))
    split.position.set(0, it.h * 0.68, 0.36)
    g.add(split)

    for (const [y, len] of [[it.h * 0.79, 0.2], [it.h * 0.45, 0.46]]) {
      const handle = cyl(0.016, 0.016, len, METAL('#8E9297'), 10)
      handle.position.set(0.31, y, 0.375)
      g.add(handle)
    }
    return g
  },

  dishwasher: (it) => {
    const g = new THREE.Group()
    const steel = METAL('#B9BDC2')

    const body = box(0.6, it.h, 0.6, steel)
    body.position.y = it.h / 2
    g.add(body)

    const panel = box(0.56, it.h * 0.78, 0.022, ENAMEL('#1B1D21'))
    panel.position.set(0, it.h * 0.44, 0.31)
    g.add(panel)

    const handle = cyl(0.015, 0.015, 0.5, steel, 10)
    handle.rotation.z = Math.PI / 2
    handle.position.set(0, it.h * 0.9, 0.33)
    g.add(handle)
    return g
  },

  // --- laundry ------------------------------------------------------------

  washer: (it) => frontLoader(it, '#9FB3BD'),
  dryer: (it) => frontLoader(it, '#C7BFB2'),
}

// ---------------------------------------------------------------------------
// Room shell
// ---------------------------------------------------------------------------

function buildShell({ shape, h, colors, windows }) {
  // Architecture wants crisp corners — a bevelled wall reads as a mistake, and
  // rounding the shell would also leave visible seams where planes meet.
  const box = hardBox
  const g = new THREE.Group()
  // Architectural surfaces barely reflect. Left at the default envMapIntensity
  // the environment map floods them and every palette washes out to white.
  const wallMat = mat(colors.wall, 0.96, 0.0, 0.12)
  const floorMat = mat(colors.floor, 0.72, 0.0, 0.3)
  const trimMat = mat(colors.trim, 0.7, 0.0, 0.18)
  const ceilMat = mat(colors.trim, 0.98, 0.0, 0.1)
  const t = 0.12

  // --- floor and ceiling, from merged cell runs --------------------------
  for (const run of floorRuns(shape)) {
    const slab = box(run.w, t, run.d, floorMat)
    slab.position.set(run.x, -t / 2, run.z)
    slab.receiveShadow = true
    slab.castShadow = false
    g.add(slab)

    const cap = box(run.w, t, run.d, ceilMat)
    cap.position.set(run.x, h + t / 2, run.z)
    g.add(cap)
  }

  // --- walls on every inside/outside boundary -----------------------------
  // The near wall (facing the camera) is left off so the room reads as a
  // dollhouse cutaway rather than a sealed box.
  const win = windows ? windowWall(shape) : null
  const bounds = shapeBounds(shape)
  const nearZ = bounds.d / 2

  for (const seg of wallRuns(shape)) {
    // Skip walls on the near edge — those are the ones we'd be looking through.
    if (seg.axis === 'x' && seg.facing === -1 && Math.abs(seg.z - nearZ) < 0.01) continue

    const isWindowWall =
      win && seg.axis === 'x' && Math.abs(seg.z - win.z) < 0.01 && Math.abs(seg.x - win.x) < 0.01

    const along = seg.axis === 'x' ? [seg.len, h, t] : [t, h, seg.len]

    if (!isWindowWall) {
      const wall = box(...along, wallMat)
      wall.position.set(seg.x, h / 2, seg.z)
      g.add(wall)
    } else {
      addWindowedWall(g, seg, h, t, { wallMat, trimMat })
    }

    // Baseboard hugging the inside face of every wall.
    const bbLen = seg.len
    const bb =
      seg.axis === 'x' ? box(bbLen, 0.09, 0.035, trimMat) : box(0.035, 0.09, bbLen, trimMat)
    bb.position.set(
      seg.x + (seg.axis === 'z' ? seg.facing * (t / 2 + 0.018) : 0),
      0.045,
      seg.z + (seg.axis === 'x' ? seg.facing * (t / 2 + 0.018) : 0)
    )
    g.add(bb)
  }

  return g
}

/** A wall run with a window opening cut into it, plus frame, glass and sky. */
function addWindowedWall(g, seg, h, t, { wallMat, trimMat }) {
  const box = hardBox
  const ww = Math.min(2.4, seg.len * 0.62)
  const sill = 0.9
  const top = Math.min(h - 0.45, sill + 1.6)
  const side = (seg.len - ww) / 2

  const below = box(seg.len, sill, t, wallMat)
  below.position.set(seg.x, sill / 2, seg.z)
  g.add(below)

  const above = box(seg.len, h - top, t, wallMat)
  above.position.set(seg.x, top + (h - top) / 2, seg.z)
  g.add(above)

  for (const s of [-1, 1]) {
    if (side <= 0.01) continue
    const pier = box(side, top - sill, t, wallMat)
    pier.position.set(seg.x + s * (ww / 2 + side / 2), sill + (top - sill) / 2, seg.z)
    g.add(pier)
  }

  const midY = sill + (top - sill) / 2
  const frame = box(ww + 0.1, top - sill + 0.1, t * 0.6, trimMat)
  frame.position.set(seg.x, midY, seg.z + seg.facing * 0.02)
  g.add(frame)

  const pane = new THREE.Mesh(
    new THREE.BoxGeometry(ww - 0.06, top - sill - 0.06, 0.02),
    new THREE.MeshPhysicalMaterial({
      color: 0xdcecf7,
      transmission: 0.85,
      transparent: true,
      opacity: 0.32,
      roughness: 0.05,
      metalness: 0,
    })
  )
  pane.position.set(seg.x, midY, seg.z)
  g.add(pane)

  // Sky card behind the glass, sized to the opening so it never peeks past the
  // wall from an exterior camera angle.
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(ww - 0.02, top - sill - 0.02),
    new THREE.MeshBasicMaterial({ color: 0xbdd9ec })
  )
  sky.position.set(seg.x, midY, seg.z - seg.facing * 0.12)
  sky.rotation.y = seg.facing > 0 ? 0 : Math.PI
  g.add(sky)
}

// ---------------------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------------------

function buildLights(scene, { shape, h, lighting, windows }) {
  const { w, d } = shapeBounds(shape)
  const added = []
  const add = (l) => {
    scene.add(l)
    added.push(l)
    return l
  }

  // The environment map now supplies most of the fill, so these are roughly a
  // third of what they were before it existed. Keeping the old values on top of
  // IBL blew every scene out to white.
  const rigs = {
    natural: { amb: 0.28, ambColor: 0xf3f1ea, sun: 2.1, sunColor: 0xfff6e8, fill: 0.22 },
    warm: { amb: 0.2, ambColor: 0xffd9a8, sun: 1.1, sunColor: 0xffb865, fill: 0.42 },
    cool: { amb: 0.3, ambColor: 0xe4edf7, sun: 1.7, sunColor: 0xd2e4ff, fill: 0.2 },
    moody: { amb: 0.06, ambColor: 0x5b5266, sun: 0.5, sunColor: 0xffa055, fill: 0.55 },
    golden: { amb: 0.18, ambColor: 0xffd9a0, sun: 2.4, sunColor: 0xffb95e, fill: 0.3 },
    overcast: { amb: 0.42, ambColor: 0xe8ebee, sun: 0.7, sunColor: 0xdfe6ec, fill: 0.15 },
  }
  const rig = rigs[lighting] || rigs.natural

  add(new THREE.AmbientLight(rig.ambColor, rig.amb))
  add(new THREE.HemisphereLight(rig.ambColor, 0x4a4238, rig.amb * 0.4))

  // Key light: through the window when there is one, from above when there isn't.
  const sun = new THREE.DirectionalLight(rig.sunColor, rig.sun)
  sun.position.set(windows ? -w * 0.2 : w * 0.4, h * 1.4, windows ? -d * 1.4 : d * 0.5)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.radius = 6
  sun.shadow.blurSamples = 16
  sun.shadow.bias = -0.0006
  sun.shadow.normalBias = 0.02
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far = 40
  const span = Math.max(w, d)
  sun.shadow.camera.left = -span
  sun.shadow.camera.right = span
  sun.shadow.camera.top = span
  sun.shadow.camera.bottom = -span
  add(sun)

  const fill = new THREE.PointLight(rig.sunColor, rig.fill * 12, Math.max(w, d) * 2, 2)
  fill.position.set(0, h - 0.3, d * 0.2)
  add(fill)

  return () => added.forEach((l) => scene.remove(l))
}

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

/**
 * Instantiate every entry at the coordinates the caller resolved. Each node is
 * tagged with the data the drag layer needs to move it and write it back.
 */
function placeItems(group, entries, placements) {
  const handles = []

  for (const { key, item } of entries) {
    const build = builders[item.model]
    if (!build) continue

    const p = placements[key]
    if (!p) continue

    const node = shadowed(build(item))
    node.position.set(p.x, p.y || 0, p.z)
    node.rotation.y = p.ry || 0
    node.userData = {
      key,
      itemId: item.id,
      name: item.name,
      model: item.model,
      zone: p.zone || zoneOf(item.model),
      radius: item.fp || 0.35,
      draggable: true,
    }

    group.add(node)
    handles.push(node)
  }

  return handles
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildRoom(scene, config) {
  const group = new THREE.Group()
  const shell = buildShell(config)
  shadowed(shell)
  group.add(shell)

  const handles = placeItems(group, config.entries, config.placements)
  scene.add(group)

  const disposeLights = buildLights(scene, config)

  const dispose = () => {
    disposeLights()
    scene.remove(group)
    group.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose()
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
        else o.material?.dispose()
      }
    })
  }

  return { dispose, handles, group }
}

// Superseded by three/atmosphere.js, which paints a gradient sky plus fog and
// exterior ground instead of a flat fill.
