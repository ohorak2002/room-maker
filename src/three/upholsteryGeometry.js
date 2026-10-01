import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Metre-scale, deterministic cloth geometry. Kept independent of materials so
// its bounds, normals and triangle cost can be checked without a WebGL context.
export function upholsteredBlock(w, h, d, { radius = .025, loft = .012, folds = .0025, seed = 0, step = .024 } = {}) {
  const half = [w / 2, h / 2, d / 2], r = Math.min(radius, ...half.map(v => v * .7))
  let geo = new THREE.BoxGeometry(w, h, d, ...[w, h, d].map(v => Math.max(4, Math.ceil(v / step))))
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) {
    const v = [p.getX(i), p.getY(i), p.getZ(i)]
    const inner = v.map((a, k) => THREE.MathUtils.clamp(a, -half[k] + r, half[k] - r))
    const delta = v.map((a, k) => a - inner[k]), len = Math.hypot(...delta)
    const round = v.map((_, k) => inner[k] + delta[k] * r / len)
    const edge = round.map((a, k) => Math.max(0, 1 - (a / half[k]) ** 2))
    for (let k = 0; k < 3; k++) {
      const a = (k + 1) % 3, b = (k + 2) % 3
      const dome = Math.pow(edge[a] * edge[b], .7)
      // Folds cluster near a sewn edge and fade toward the stuffed centre.
      const border = Math.min(half[a] - Math.abs(round[a]), half[b] - Math.abs(round[b]))
      const fold = Math.sin(round[a] * 97 + round[b] * 13 + seed) * Math.sin(round[b] * 67 + seed * 2)
      round[k] += Math.sign(round[k]) * (loft * dome + folds * fold * Math.exp(-Math.max(0, border) * 18) * dome)
    }
    p.setXYZ(i, ...round)
  }
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv')
  geo = mergeVertices(geo, 1e-5); geo.computeVertexNormals()
  return geo
}

// A loose pillow has a pinched sewn perimeter, not a bevelled rigid box.
export function pillowPoint(u, v, side, w, h, d, seed = 0) {
  const envelope = Math.pow(Math.max(0, (1-u*u)*(1-v*v)), .58)
  const edge = Math.min(1-Math.abs(u), 1-Math.abs(v))
  const tucks = Math.sin(u*29 + v*7 + seed) * Math.exp(-edge*9) * Math.sin(Math.PI*Math.min(1,edge*4))
  return new THREE.Vector3(
    u*w/2*(1-.035*Math.sin(Math.PI*v)**2),
    v*h/2*(1-.045*Math.sin(Math.PI*u)**2) + .006*Math.sin(u*4+seed)*envelope,
    side*(.009 + d/2*envelope + .009*tucks) + .004*Math.sin(u*5+v*3+seed)*envelope,
  )
}
export function loosePillowGeometry(w, h, d, seed = 0, segments = 36) {
  const positions = [], indices = [], uv = []
  for (const side of [1,-1]) {
    const base = positions.length/3
    for (let j=0;j<=segments;j++) for(let i=0;i<=segments;i++) {
      const u=i/segments*2-1, v=j/segments*2-1
      positions.push(...pillowPoint(u,v,side,w,h,d,seed).toArray())
      uv.push(i/segments*w/.27008,j/segments*h/.2757)
    }
    for(let j=0;j<segments;j++) for(let i=0;i<segments;i++) {
      const a=base+j*(segments+1)+i, b=a+1, c=a+segments+1, e=c+1
      indices.push(...(side===1?[a,b,e,a,e,c]:[a,e,b,a,c,e]))
    }
  }
  // Connect the two faces at the perimeter, avoiding an open silhouette.
  const edge=[]
  for(let i=0;i<segments;i++) edge.push(i)
  for(let j=0;j<segments;j++) edge.push(j*(segments+1)+segments)
  for(let i=segments;i>0;i--) edge.push(segments*(segments+1)+i)
  for(let j=segments;j>0;j--) edge.push(j*(segments+1))
  const offset=(segments+1)**2
  for(let i=0;i<edge.length;i++) { const a=edge[i],b=edge[(i+1)%edge.length]; indices.push(a,a+offset,b,b,a+offset,b+offset) }
  const geo=new THREE.BufferGeometry()
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); geo.setIndex(indices); geo.computeVertexNormals()
  return geo
}

export function pillowSeam(w,h,d,seed=0) {
  const pts=[], n=24
  for(let i=0;i<n;i++) pts.push(pillowPoint(-1+2*i/n,-1,0,w,h,d,seed))
  for(let i=0;i<n;i++) pts.push(pillowPoint(1,-1+2*i/n,0,w,h,d,seed))
  for(let i=0;i<n;i++) pts.push(pillowPoint(1-2*i/n,1,0,w,h,d,seed))
  for(let i=0;i<n;i++) pts.push(pillowPoint(-1,1-2*i/n,0,w,h,d,seed))
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts,true),128,.0018,4,true)
}
