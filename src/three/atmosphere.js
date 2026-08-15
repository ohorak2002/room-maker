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

/**
 * Four stops, not two, and the middle two are the ones doing the work.
 *
 * A two-stop pale ramp reads as an empty browser gradient — which is what it
 * was, and why the room looked like it had been pasted onto a screenshot. Real
 * skies are dark overhead, lift through a mid tone, and glow just above the
 * horizon; that glow is the single cue that sells depth, because it implies
 * atmosphere between the camera and the distance.
 *
 * `deep` is deliberately darker and more saturated than the old `top`. The room
 * is the brightest thing on screen and should stay that way — a pale backdrop
 * competes with it, and the piece being designed loses.
 */
const RIG_SKY = {
  natural: { deep: '#7d9db4', mid: '#b4cbd9', glow: '#f2e4cd', horizon: '#e8dcc8', ground: '#6f7f6c', rim: '#4a5748' },
  warm: { deep: '#8a6242', mid: '#c99a6f', glow: '#f7d9a8', horizon: '#eccfa4', ground: '#63523c', rim: '#42361f' },
  cool: { deep: '#6d87a3', mid: '#a8c0d4', glow: '#dfe9f1', horizon: '#cfdde8', ground: '#66707a', rim: '#3f4750' },
  moody: { deep: '#0d0e14', mid: '#1c1d28', glow: '#453247', horizon: '#2e2634', ground: '#15131a', rim: '#08070b' },
  golden: { deep: '#a8622f', mid: '#dd9351', glow: '#ffd89a', horizon: '#f2c184', ground: '#57462c', rim: '#33280f' },
  overcast: { deep: '#9aa3ac', mid: '#bcc3ca', glow: '#dfe3e6', horizon: '#cfd4d8', ground: '#666d72', rim: '#3f4448' },
}

const rigFor = (lighting) => RIG_SKY[lighting] || RIG_SKY.natural

/** A vertical gradient rendered to a small canvas — cheap, no geometry. */
function skyTexture(rig) {
  const c = document.createElement('canvas')
  c.width = 2
  c.height = 512
  const ctx = c.getContext('2d')
  const grad = ctx.createLinearGradient(0, 0, 0, 512)
  grad.addColorStop(0, rig.deep)
  grad.addColorStop(0.42, rig.mid)
  // The glow sits just above where the ground meets the sky, not at the very
  // bottom — putting it at 1.0 would light the wrong part of the frame.
  grad.addColorStop(0.78, rig.glow)
  grad.addColorStop(1, rig.horizon)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 2, 512)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * Exterior ground: a disc that darkens outward and fades into the fog.
 *
 * The previous version was one flat colour out to 70% and then transparent,
 * which is why it read as a green sheet with a building resting on top of it.
 * Two changes fix that. The centre is darkened first, so the ground appears to
 * pass *under* the building and the building sits in a shallow well rather than
 * on a plate. Then the outer band falls off through a rim colour before going
 * transparent, giving the horizon somewhere to resolve to instead of a hard
 * edge that the eye reads as the end of the world.
 */
function groundTexture(rig) {
  const size = 512
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const half = size / 2

  const grad = ctx.createRadialGradient(half, half, 0, half, half, half)
  // A well under the building, so it is seated rather than stuck on.
  grad.addColorStop(0, rig.rim)
  grad.addColorStop(0.16, rig.ground)
  grad.addColorStop(0.55, rig.ground)
  // Falling toward the rim before vanishing gives the distance a colour.
  grad.addColorStop(0.82, rig.rim)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)

  // A whisper of noise. A perfectly smooth gradient across this many pixels
  // shows banding on a wide screen, and banding is the single most obvious
  // tell that a background was made by a computer.
  const img = ctx.getImageData(0, 0, size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 6
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)

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

  // Density relative to the room, not a fixed number, so a tiny studio and a
  // big loft both fade out a sensible distance past their own walls.
  //
  // Tuned down hard from where this started. At the old density a camera pulled
  // back to see the whole room sat far enough away that roughly a third of the
  // subject was fog — the room came out milky and every palette washed toward
  // the horizon colour. Fog belongs to the distance; the thing being designed
  // has to stay crisp, or the render is describing the air instead of the room.
  scene.fog = new THREE.FogExp2(new THREE.Color(rig.horizon).getHex(), 0.34 / (roomSpan * 3.2))

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
