import * as THREE from 'three'

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

const mat = (color, roughness = 0.85, metalness = 0.0) =>
  new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness, metalness })

const glow = (color, intensity = 1.2) =>
  new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    roughness: 0.4,
  })

const box = (w, h, d, material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
const cyl = (rt, rb, h, material, seg = 16) =>
  new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material)
const sphere = (r, material, seg = 16) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), material)

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

const builders = {
  plant: (it) => {
    const g = new THREE.Group()
    const pot = cyl(0.16, 0.12, 0.26, mat('#B4785A', 0.9))
    pot.position.y = 0.13
    g.add(pot)
    for (let i = 0; i < 6; i++) {
      const blade = box(0.06, it.h - 0.2, 0.02, mat(it.color, 0.7))
      blade.position.set(Math.sin(i) * 0.07, 0.26 + (it.h - 0.2) / 2, Math.cos(i) * 0.07)
      blade.rotation.z = (i - 3) * 0.09
      g.add(blade)
    }
    return g
  },

  smallplant: (it) => {
    const g = new THREE.Group()
    const pot = cyl(0.11, 0.09, 0.12, mat('#D8CFC2', 0.9))
    pot.position.y = 0.06
    g.add(pot)
    for (let i = 0; i < 3; i++) {
      const bud = sphere(0.07, mat(it.color, 0.75))
      bud.scale.y = 0.8
      bud.position.set((i - 1) * 0.09, 0.16, 0)
      g.add(bud)
    }
    return g
  },

  tree: (it) => {
    const g = new THREE.Group()
    const pot = cyl(0.22, 0.17, 0.34, mat('#A8705A', 0.9))
    pot.position.y = 0.17
    g.add(pot)
    const trunk = cyl(0.035, 0.05, it.h - 0.4, mat('#6B5340', 0.95), 8)
    trunk.position.y = 0.34 + (it.h - 0.4) / 2
    g.add(trunk)
    const canopyY = it.h - 0.15
    for (let i = 0; i < 5; i++) {
      const leaf = sphere(0.24 - i * 0.02, mat(it.color, 0.8), 12)
      leaf.scale.set(1, 0.7, 1)
      leaf.position.set(Math.cos(i * 2.2) * 0.2, canopyY - i * 0.22, Math.sin(i * 2.2) * 0.2)
      g.add(leaf)
    }
    return g
  },

  palm: (it) => {
    const g = new THREE.Group()
    const pot = cyl(0.2, 0.16, 0.3, mat('#9E8A72', 0.9))
    pot.position.y = 0.15
    g.add(pot)
    for (let i = 0; i < 7; i++) {
      const frond = box(0.05, it.h - 0.3, 0.28, mat(it.color, 0.75))
      const a = (i / 7) * Math.PI * 2
      frond.position.set(Math.cos(a) * 0.18, 0.3 + (it.h - 0.3) / 2, Math.sin(a) * 0.18)
      frond.rotation.set(Math.sin(a) * 0.4, -a, Math.cos(a) * 0.4)
      g.add(frond)
    }
    return g
  },

  vase: (it) => {
    const g = new THREE.Group()
    const v = cyl(0.07, 0.05, 0.22, mat('#DCD3C6', 0.5))
    v.position.y = 0.11
    g.add(v)
    for (let i = 0; i < 8; i++) {
      const stem = box(0.015, 0.3, 0.015, mat(it.color, 0.7))
      stem.position.set((Math.random() - 0.5) * 0.12, 0.34, (Math.random() - 0.5) * 0.12)
      stem.rotation.z = (Math.random() - 0.5) * 0.5
      g.add(stem)
    }
    return g
  },

  hanging: (it) => {
    const g = new THREE.Group()
    const pot = cyl(0.12, 0.14, 0.16, mat('#C4B49A', 0.9))
    g.add(pot)
    for (let i = 0; i < 6; i++) {
      const vine = box(0.03, 0.4 + Math.random() * 0.3, 0.03, mat(it.color, 0.75))
      const a = (i / 6) * Math.PI * 2
      vine.position.set(Math.cos(a) * 0.1, -0.25, Math.sin(a) * 0.1)
      g.add(vine)
    }
    return g
  },

  chair: (it) => {
    const g = new THREE.Group()
    const seat = box(0.5, 0.08, 0.5, mat(it.color, 0.7))
    seat.position.y = 0.45
    g.add(seat)
    const back = box(0.5, 0.55, 0.07, mat(it.color, 0.7))
    back.position.set(0, 0.75, -0.22)
    g.add(back)
    const post = cyl(0.04, 0.04, 0.4, mat(DARK, 0.4, 0.6), 10)
    post.position.y = 0.22
    g.add(post)
    const base = cyl(0.28, 0.28, 0.04, mat(DARK, 0.4, 0.6), 16)
    base.position.y = 0.03
    g.add(base)
    return g
  },

  armchair: (it) => {
    const g = new THREE.Group()
    const m = mat(it.color, 0.9)
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
    const m = mat(it.color, 0.9)
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
    const b = sphere(0.45, mat(it.color, 0.95))
    b.scale.set(1, 0.65, 1)
    b.position.y = 0.3
    g.add(b)
    return g
  },

  pouf: (it) => {
    const g = new THREE.Group()
    const p = cyl(0.28, 0.3, 0.36, mat(it.color, 0.95), 20)
    p.position.y = 0.18
    g.add(p)
    return g
  },

  desk: (it) => {
    const g = new THREE.Group()
    const top = box(1.5, 0.06, 0.7, mat(it.color, 0.6))
    top.position.y = it.h
    g.add(top)
    for (const [x, z] of [[-0.68, -0.3], [0.68, -0.3], [-0.68, 0.3], [0.68, 0.3]]) {
      const leg = box(0.06, it.h, 0.06, mat(DARK, 0.5, 0.4))
      leg.position.set(x, it.h / 2, z)
      g.add(leg)
    }
    return g
  },

  table: (it) => {
    const g = new THREE.Group()
    const top = cyl(0.5, 0.5, 0.05, mat(it.color, 0.6), 24)
    top.position.y = it.h
    g.add(top)
    const stem = cyl(0.06, 0.1, it.h, mat(DARK, 0.5), 12)
    stem.position.y = it.h / 2
    g.add(stem)
    return g
  },

  nightstand: (it) => {
    const g = new THREE.Group()
    const body = box(0.45, it.h, 0.4, mat(it.color, 0.7))
    body.position.y = it.h / 2
    g.add(body)
    for (const y of [0.18, 0.4]) {
      const pull = box(0.16, 0.02, 0.02, mat('#D8CFC2', 0.4, 0.5))
      pull.position.set(0, y, 0.21)
      g.add(pull)
    }
    return g
  },

  bed: (it) => {
    const g = new THREE.Group()
    const base = box(1.6, 0.35, 2.0, mat(it.color, 0.9))
    base.position.y = 0.18
    g.add(base)
    const mattress = box(1.55, 0.22, 1.95, mat('#EFEAE2', 0.95))
    mattress.position.y = 0.46
    g.add(mattress)
    const head = box(1.6, 0.7, 0.12, mat(it.color, 0.9))
    head.position.set(0, 0.6, -1.0)
    g.add(head)
    for (const s of [-1, 1]) {
      const pillow = box(0.6, 0.14, 0.35, mat('#FFFFFF', 0.98))
      pillow.position.set(s * 0.38, 0.62, -0.72)
      g.add(pillow)
    }
    return g
  },

  shelf: (it) => {
    const g = new THREE.Group()
    const m = mat(it.color, 0.75)
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
    const r = box(2.6, 0.03, 1.9, mat(it.color, 1.0))
    r.position.y = 0.015
    g.add(r)
    return g
  },

  floorlamp: (it) => {
    const g = new THREE.Group()
    const base = cyl(0.18, 0.2, 0.04, mat(DARK, 0.4, 0.6), 20)
    base.position.y = 0.02
    g.add(base)
    const pole = cyl(0.02, 0.02, it.h, mat(DARK, 0.4, 0.6), 10)
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
    const base = cyl(0.1, 0.11, 0.03, mat(it.color, 0.5), 16)
    g.add(base)
    const arm = cyl(0.015, 0.015, 0.42, mat(it.color, 0.5), 8)
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
    const cord = cyl(0.008, 0.008, 0.7, mat(DARK, 0.6), 6)
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
    const frame = box(1.1, it.h, 0.05, mat('#2B2D31', 0.6))
    g.add(frame)
    const canvas = box(1.0, it.h - 0.1, 0.02, mat(it.color, 0.8))
    canvas.position.z = 0.03
    g.add(canvas)
    return g
  },

  wallpanel: (it) => {
    const g = new THREE.Group()
    const panel = box(1.0, it.h, 0.06, it.emissive ? glow(it.color, 1.6) : mat(it.color, 0.95))
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
    const frame = box(0.7, it.h, 0.06, mat('#8B7355', 0.6))
    frame.position.y = it.h / 2
    g.add(frame)
    const glass = box(0.62, it.h - 0.08, 0.02, mat(it.color, 0.05, 0.9))
    glass.position.set(0, it.h / 2, 0.04)
    g.add(glass)
    return g
  },

  curtain: (it) => {
    const g = new THREE.Group()
    for (const s of [-1, 1]) {
      const panel = box(0.42, it.h, 0.08, mat(it.color, 0.98))
      panel.position.set(s * 0.85, it.h / 2, 0)
      g.add(panel)
    }
    const rod = cyl(0.02, 0.02, 2.4, mat(DARK, 0.4, 0.6), 8)
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
    const neck = box(0.06, 0.18, 0.06, mat(it.color, 0.5))
    neck.position.y = 0.14
    g.add(neck)
    const foot = box(0.32, 0.03, 0.18, mat(it.color, 0.5))
    foot.position.y = 0.02
    g.add(foot)
    return g
  },

  tower: (it) => {
    const g = new THREE.Group()
    const body = box(0.22, it.h, 0.46, mat(it.color, 0.5, 0.3))
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
    const body = box(0.24, it.h, 0.26, mat(it.color, 0.7))
    body.position.y = it.h / 2
    g.add(body)
    for (const y of [0.28, 0.58, 0.82]) {
      const cone = cyl(0.07, 0.07, 0.02, mat('#15171A', 0.9), 14)
      cone.rotation.x = Math.PI / 2
      cone.position.set(0, y * it.h, 0.14)
      g.add(cone)
    }
    return g
  },
}

// Where each model type wants to live.
const ZONES = {
  rug: 'center',
  table: 'center',
  painting: 'wall',
  wallpanel: 'wall',
  tv: 'wall',
  curtain: 'window',
  ledstrip: 'ceilingEdge',
  pendant: 'ceiling',
  hanging: 'ceiling',
  bed: 'backwall',
  sofa: 'backwall',
  shelf: 'backwall',
  monitor: 'ondesk',
}
const zoneOf = (model) => ZONES[model] || 'perimeter'

// ---------------------------------------------------------------------------
// Room shell
// ---------------------------------------------------------------------------

function buildShell({ w, d, h, colors, windows }) {
  const g = new THREE.Group()
  const wallMat = mat(colors.wall, 0.95)
  const floorMat = mat(colors.floor, 0.8)
  const trimMat = mat(colors.trim, 0.7)
  const t = 0.12

  const floor = box(w, t, d, floorMat)
  floor.position.y = -t / 2
  floor.receiveShadow = true
  g.add(floor)

  const ceiling = box(w, t, d, mat(colors.trim, 0.98))
  ceiling.position.y = h + t / 2
  g.add(ceiling)

  // Left / right / front walls (front is +z, left open to the camera side).
  const right = box(t, h, d, wallMat)
  right.position.set(w / 2, h / 2, 0)
  g.add(right)

  const left = box(t, h, d, wallMat)
  left.position.set(-w / 2, h / 2, 0)
  g.add(left)

  // Back wall (-z), optionally with a window cut out of it.
  if (!windows) {
    const back = box(w, h, t, wallMat)
    back.position.set(0, h / 2, -d / 2)
    g.add(back)
  } else {
    const ww = Math.min(2.4, w * 0.5)
    const sill = 0.9
    const top = h - 0.45
    const side = (w - ww) / 2

    const below = box(w, sill, t, wallMat)
    below.position.set(0, sill / 2, -d / 2)
    g.add(below)

    const above = box(w, h - top, t, wallMat)
    above.position.set(0, top + (h - top) / 2, -d / 2)
    g.add(above)

    for (const s of [-1, 1]) {
      const pier = box(side, top - sill, t, wallMat)
      pier.position.set(s * (ww / 2 + side / 2), sill + (top - sill) / 2, -d / 2)
      g.add(pier)
    }

    const frame = box(ww + 0.1, top - sill + 0.1, t * 0.6, trimMat)
    frame.position.set(0, sill + (top - sill) / 2, -d / 2 + 0.02)
    g.add(frame)

    const pane = new THREE.Mesh(
      new THREE.BoxGeometry(ww - 0.06, top - sill - 0.06, 0.02),
      new THREE.MeshPhysicalMaterial({
        color: 0xdcecf7,
        transmission: 0.85,
        transparent: true,
        opacity: 0.35,
        roughness: 0.05,
        metalness: 0,
      })
    )
    pane.position.set(0, sill + (top - sill) / 2, -d / 2)
    g.add(pane)

    // Sky card behind the glass so the opening reads as "outside". Sized to the
    // opening so it never peeks above the roofline from an exterior angle.
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(ww - 0.02, top - sill - 0.02),
      new THREE.MeshBasicMaterial({ color: 0xbdd9ec })
    )
    sky.position.set(0, sill + (top - sill) / 2, -d / 2 - 0.12)
    g.add(sky)
  }

  // Baseboard
  for (const [px, pz, bw, rot] of [
    [0, -d / 2 + t / 2, w, 0],
    [-w / 2 + t / 2, 0, d, Math.PI / 2],
    [w / 2 - t / 2, 0, d, Math.PI / 2],
  ]) {
    const bb = box(bw, 0.09, 0.04, trimMat)
    bb.position.set(px, 0.045, pz)
    bb.rotation.y = rot
    g.add(bb)
  }

  floor.castShadow = false
  return g
}

// ---------------------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------------------

function buildLights(scene, { w, d, h, lighting, windows }) {
  const added = []
  const add = (l) => {
    scene.add(l)
    added.push(l)
    return l
  }

  const rigs = {
    natural: { amb: 0.75, ambColor: 0xf3f1ea, sun: 1.5, sunColor: 0xfff6e8, fill: 0.35 },
    warm: { amb: 0.5, ambColor: 0xffd9a8, sun: 0.7, sunColor: 0xffc078, fill: 0.5 },
    cool: { amb: 0.8, ambColor: 0xe4edf7, sun: 1.1, sunColor: 0xd8e8ff, fill: 0.3 },
    moody: { amb: 0.22, ambColor: 0x6b6070, sun: 0.35, sunColor: 0xffb066, fill: 0.6 },
  }
  const rig = rigs[lighting] || rigs.natural

  add(new THREE.AmbientLight(rig.ambColor, rig.amb))
  add(new THREE.HemisphereLight(rig.ambColor, 0x4a4238, rig.amb * 0.5))

  // Key light: through the window when there is one, from above when there isn't.
  const sun = new THREE.DirectionalLight(rig.sunColor, rig.sun)
  sun.position.set(windows ? -w * 0.2 : w * 0.4, h * 1.4, windows ? -d * 1.4 : d * 0.5)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
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

function perimeterSlots(w, d) {
  const inset = 0.65
  const slots = []
  const along = (n, fn) => {
    for (let i = 0; i < n; i++) slots.push(fn((i + 0.5) / n))
  }
  // back wall, then right, then left, then front
  along(4, (t) => ({ x: -w / 2 + inset + t * (w - inset * 2), z: -d / 2 + inset, ry: 0 }))
  along(3, (t) => ({ x: w / 2 - inset, z: -d / 2 + inset + t * (d - inset * 2), ry: -Math.PI / 2 }))
  along(3, (t) => ({ x: -w / 2 + inset, z: -d / 2 + inset + t * (d - inset * 2), ry: Math.PI / 2 }))
  along(3, (t) => ({ x: -w / 2 + inset + t * (w - inset * 2), z: d / 2 - inset, ry: Math.PI }))
  return slots
}

function placeItems(group, { w, d, h }, entries) {
  const perim = perimeterSlots(w, d)
  let pi = 0
  let wallSlot = 0
  let backSlot = 0
  let centerSlot = 0
  let ceilSlot = 0
  let deskTop = null

  // Desks first so a monitor has something to sit on.
  const ordered = [...entries].sort((a, b) => (a.model === 'desk' ? -1 : b.model === 'desk' ? 1 : 0))

  for (const it of ordered) {
    const build = builders[it.model]
    if (!build) continue
    const zone = zoneOf(it.model)
    const node = shadowed(build(it))

    if (zone === 'wall') {
      const span = w - 1.4
      const x = -span / 2 + ((wallSlot + 0.5) / 3) * span
      node.position.set(x, h * 0.55, -d / 2 + 0.12)
      wallSlot = (wallSlot + 1) % 3
    } else if (zone === 'window') {
      node.position.set(0, 0, -d / 2 + 0.2)
    } else if (zone === 'ceiling') {
      node.position.set((ceilSlot % 2 ? 1 : -1) * w * 0.2, h - 0.25, (ceilSlot % 2 ? 1 : -1) * d * 0.15)
      ceilSlot++
    } else if (zone === 'ceilingEdge') {
      node.position.set(0, h - 0.08, -d / 2 + 0.16)
    } else if (zone === 'backwall') {
      const x = backSlot === 0 ? 0 : (backSlot % 2 ? -1 : 1) * w * 0.28
      node.position.set(x, 0, -d / 2 + 1.15)
      backSlot++
    } else if (zone === 'center') {
      node.position.set(centerSlot * 0.5, 0, centerSlot * 0.4)
      centerSlot++
    } else if (zone === 'ondesk' && deskTop) {
      node.position.set(deskTop.x, deskTop.y, deskTop.z)
      node.rotation.y = deskTop.ry
    } else {
      const s = perim[pi % perim.length]
      pi++
      node.position.set(s.x, 0, s.z)
      node.rotation.y = s.ry
    }

    if (it.model === 'desk') {
      const s = perim[(pi - 1 + perim.length) % perim.length]
      deskTop = { x: node.position.x, y: it.h + 0.03, z: node.position.z, ry: s ? s.ry : 0 }
    }

    group.add(node)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildRoom(scene, config) {
  const group = new THREE.Group()
  group.add(buildShell(config))
  placeItems(group, config, config.entries)
  shadowed(group)
  scene.add(group)

  const disposeLights = buildLights(scene, config)

  return () => {
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
}

export const BACKDROPS = {
  natural: 0xe9e7e1,
  warm: 0xe8dccb,
  cool: 0xe3e9ef,
  moody: 0x1b1a20,
}
