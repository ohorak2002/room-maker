import assert from 'node:assert/strict'
import { upholsteredBlock, loosePillowGeometry, pillowSeam } from '../src/three/upholsteryGeometry.js'

// Sculpted cloth must remain finite, outward-facing and affordable. A reversed
// face or oversized fold is visible in every catalog and room rendering.
const samples = [
  ['seat',upholsteredBlock(.603,.145,.68,{loft:.013,folds:.004,step:.019}),[.65,.19,.73],18000],
  ['back',upholsteredBlock(.611,.398,.165,{loft:.025,folds:.005,step:.018}),[.67,.46,.22],18000],
  ['pillow',loosePillowGeometry(.42,.42,.16,2),[.43,.44,.20],6000],
  ['seam',pillowSeam(.42,.42,.16,2),[.43,.43,.01],1100],
]
for(const [name,g,limit,budget] of samples) {
  const p=g.attributes.position,n=g.attributes.normal
  assert.ok([...p.array,...n.array].every(Number.isFinite),`${name}: finite coordinates and normals`)
  g.computeBoundingBox()
  const ext=g.boundingBox.max.clone().sub(g.boundingBox.min).toArray()
  ext.forEach((v,i)=>assert.ok(v>0 && v<=limit[i],`${name}: ${ext} inside padded dimensions`))
  assert.ok(g.index.count/3<=budget,`${name}: triangle budget`)
  for(let i=0;i<n.count;i++) assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.001,`${name}: normalized normals`)
  if(name==='pillow') {
    let front=0,back=0
    for(let i=0;i<p.count;i++) {
      if(p.getZ(i)>.07){assert.ok(n.getZ(i)>0);front++}
      if(p.getZ(i)<-.07){assert.ok(n.getZ(i)<0);back++}
    }
    assert.ok(front>50 && back>50,'both stuffed faces point outwards')
  }
  g.dispose()
}
console.log('Sculpted cloth bounds, normals and geometry budgets passed')
