import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { CELL } from '../data/presets'
import { ROOM_KIND_COLORS, roomSqft } from '../data/homeLayout'
import { floorRuns, wallRuns } from './shapeGeom'
import { builders } from './buildRoom'
import { autoArrange, instanceKey, zoneOf } from './layout'
import { resolveItem } from '../data/catalog'

/**
 * A dollhouse view of a whole generated floorplan.
 *
 * Deliberately not the same renderer as a single room. At home scale you are
 * choosing which room to work on, not judging materials, so this trades
 * realism for legibility: low walls you can see over, flat colour-coded floors
 * per room type, and each room raycastable as one object so clicking it can
 * focus it.
 *
 * It does render the furniture, though, which it used to skip. Leaving rooms
 * empty here meant the overview couldn't answer the one question it exists to
 * answer — which rooms have I actually done — without opening every one of
 * them. Wall-mounted and ceiling pieces are dropped, because at this camera
 * angle they'd float over the low walls and read as clutter.
 */

const WALL_H = 0.55 // low enough to see the whole plan from a shallow angle

export function buildHome(scene, { home, palette, floor = 0, synthetics = {}, placements = {} }) {
  const group = new THREE.Group()
  const pickables = []

  const wallMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette?.trim || '#F2ECE6'),
    roughness: 0.95,
    metalness: 0,
    envMapIntensity: 0.15,
  })

  // One storey at a time. Stacking them would hide the lower floors under the
  // upper ones from any useful camera angle.
  const shown = home.rooms.filter((r) => (r.floor ?? 0) === floor)

  for (const room of shown) {
    const roomGroup = new THREE.Group()
    roomGroup.position.set(room.ox, 0, room.oz)

    // Whether anything has been put in this room yet. An unfurnished room is
    // drawn washed out, so the overview answers "which rooms have I done" the
    // same way the plan does — without that, the two views disagreed and you
    // had to open every room to find out.
    const furnished = (room.items || []).length > 0
    const tint = ROOM_KIND_COLORS[room.kind] || '#B8AFA2'
    const floorMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(tint),
      roughness: 0.9,
      metalness: 0,
      envMapIntensity: 0.2,
      transparent: !furnished,
      opacity: furnished ? 1 : 0.32,
    })

    const shape = { cols: room.cols, rows: room.rows, cells: room.cells, h: WALL_H }

    // Floor slabs, merged into runs.
    for (const run of floorRuns(shape)) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(run.w, 0.1, run.d), floorMat)
      slab.position.set(run.x, -0.05, run.z)
      slab.receiveShadow = true
      roomGroup.add(slab)
    }

    // Low perimeter walls.
    for (const seg of wallRuns(shape)) {
      const dims = seg.axis === 'x' ? [seg.len, WALL_H, 0.1] : [0.1, WALL_H, seg.len]
      const wall = new THREE.Mesh(new RoundedBoxGeometry(...dims, 2, 0.015), wallMat)
      wall.position.set(seg.x, WALL_H / 2, seg.z)
      wall.castShadow = true
      wall.receiveShadow = true
      roomGroup.add(wall)
    }

    // --- the room's contents ---------------------------------------------
    // Laid out with the same solver the single-room view uses, so a room looks
    // the same from up here as it does once you open it. Anything the user has
    // dragged by hand keeps its spot.
    const entries = []
    for (const entry of room.items || []) {
      const item = resolveItem(entry.id, synthetics)
      if (!item || !builders[item.model]) continue
      const zone = zoneOf(item.model)
      // Wall art and pendants would hang in mid-air over 0.55m walls.
      if (zone !== 'floor' && zone !== 'center') continue
      for (let n = 0; n < entry.qty; n++) {
        entries.push({ key: instanceKey(item.id, n), item })
      }
    }

    if (entries.length) {
      const roomDims = { w: room.cols * CELL, d: room.rows * CELL, h: room.h, shape }
      const solved = autoArrange(entries, roomDims)
      for (const { key, item } of entries) {
        const p = placements[`${room.id}:${key}`] || solved[key]
        if (!p) continue
        const node = builders[item.model](item)
        node.position.set(p.x, p.y || 0, p.z)
        node.rotation.y = p.ry || 0
        node.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true
            o.receiveShadow = true
          }
        })
        roomGroup.add(node)
      }
    }

    // One invisible slab covering the room's footprint, so a click anywhere in
    // the room selects it — including the gaps between furniture.
    const w = room.cols * CELL
    const d = room.rows * CELL
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.4, d),
      new THREE.MeshBasicMaterial({ visible: false })
    )
    hit.position.y = 0.2
    hit.userData = { roomId: room.id, roomName: room.name, sqft: roomSqft(room) }
    roomGroup.add(hit)
    pickables.push(hit)

    // A translucent cap that lights up on hover/selection.
    const highlight = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.06, 0.02, d - 0.06),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    )
    highlight.position.y = 0.06
    highlight.renderOrder = 2
    roomGroup.add(highlight)
    hit.userData.highlight = highlight

    group.add(roomGroup)
  }

  scene.add(group)

  const dispose = () => {
    scene.remove(group)
    group.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose()
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
        else o.material?.dispose()
      }
    })
  }

  return { dispose, group, pickables }
}

/** Lighting for the overview — flat and even, since this is a plan to read. */
export function buildHomeLights(scene, { span }) {
  const added = []
  const add = (l) => {
    scene.add(l)
    added.push(l)
    return l
  }

  add(new THREE.AmbientLight(0xf4f2ec, 0.55))
  add(new THREE.HemisphereLight(0xffffff, 0x585048, 0.5))

  const key = new THREE.DirectionalLight(0xfff6e8, 1.5)
  key.position.set(span * 0.5, span * 1.2, span * 0.7)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.radius = 5
  key.shadow.blurSamples = 12
  key.shadow.bias = -0.0006
  key.shadow.normalBias = 0.02
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = span * 5
  key.shadow.camera.left = -span
  key.shadow.camera.right = span
  key.shadow.camera.top = span
  key.shadow.camera.bottom = -span
  add(key)

  return () => added.forEach((l) => scene.remove(l))
}
