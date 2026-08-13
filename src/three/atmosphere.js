import * as THREE from 'three'

/**
 * Everything outside the room's own walls: sky, fog, and exterior ground.
 *
 * The room shell only builds walls on interior/exterior cell boundaries, and
 * the wall facing the camera is deliberately omitted so the room reads as a
 * dollhouse cutaway. That means the camera can always see past the building —
 * up over the roofline, out through the open side, past a low wall. Without
 * something out there, "past the building" was a single flat THREE.Color,
 * which is exactly the flatness being complained about: no depth, no horizon,
 * a hard line wherever geometry stops and background starts.
 *
 * This adds three things, each solving one part of that:
 *   sky  - a vertical gradient instead of a flat fill, so there's an implied
 *          horizon and light direction even where no geometry exists
 *   fog  - exponential falloff tied to the sky's horizon color, so the edge
 *          where the floor or a wall stops is a fade, not a cut
 *   ground - a broad disc outside the footprint, so orbiting up or back
 *          reveals a plausible exterior instead of a void
 */

const RIG_SKY = {
  natural: { top: '#cfe0ea', horizon: '#f3ede1', ground: '#8a9a86' },
  warm: { top: '#e7c9a0', horizon: '#f6ddb8', ground: '#7c6a4e' },
  cool: { top: '#b9cbdc', horizon: '#e2ebf2', ground: '#7c8791' },
  moody: { top: '#171821', horizon: '#3a3040', ground: '#211d26' },
  golden: { top: '#e8a765', horizon: '#f7d59a', ground: '#6b5a3c' },
  overcast: { top: '#c7ccd1', horizon: '#dde1e4', ground: '#7d8286' },
}

const rigFor = (lighting) => RIG_SKY[lighting] || RIG_SKY.natural

/** A vertical two-stop gradient rendered to a small canvas — cheap, no geometry. */
function skyTexture(rig) {
  const c = document.createElement('canvas')
  c.width = 2
  c.height = 256
  const ctx = c.getContext('2d')
  const grad = ctx.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, rig.top)
  grad.addColorStop(1, rig.horizon)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 2, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Soft-edged exterior ground, faded to transparent so it blends into the fog. */
function groundTexture(rig) {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size / 2)
  grad.addColorStop(0, rig.ground)
  grad.addColorStop(0.7, rig.ground)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * @returns dispose() — call when swapping lighting or unmounting.
 */
export function buildAtmosphere(scene, { lighting, roomSpan, floorY = 0 }) {
  const rig = rigFor(lighting)
  const disposables = []

  const sky = skyTexture(rig)
  scene.background = sky
  disposables.push(sky)

  // Distance chosen relative to the room, not a fixed number, so a tiny studio
  // and a big loft both fog out at a sensible point past their own walls.
  const near = roomSpan * 1.4
  scene.fog = new THREE.FogExp2(new THREE.Color(rig.horizon).getHex(), 1.15 / (roomSpan * 3.2))

  const groundTex = groundTexture(rig)
  disposables.push(groundTex)
  const groundMat = new THREE.MeshBasicMaterial({
    map: groundTex,
    transparent: true,
    depthWrite: false,
    fog: false, // it's already faded to transparent; fogging it too double-dims the edge
  })
  const ground = new THREE.Mesh(new THREE.CircleGeometry(roomSpan * 3.5, 48), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = floorY - 0.02
  ground.renderOrder = -1
  scene.add(ground)
  disposables.push(groundMat, ground.geometry)

  return () => {
    scene.remove(ground)
    scene.fog = null
    for (const d of disposables) d.dispose?.()
  }
}
