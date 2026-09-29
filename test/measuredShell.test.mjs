import assert from 'node:assert/strict'
import * as THREE from 'three'
import { newBrief,compileBrief } from '../shared/brief.mjs'
import {buildMeasuredShell,footprintGeometry} from '../src/three/measuredShell.js'
const d=newBrief();d.project={name:'Test',client:'Test',studio:'Test',designer:'Test'};d.plan.layoutVerified=true;d.review={approved:true,reviewedBy:'Test',date:'2026-09-29'}
Object.assign(d.rooms[0],{name:'Room',width:5.137,depth:4.219,height:2.743,measurementSource:'Designer measured',geometryVerified:true,openingsVerified:true,openings:[{id:'door',edge:0,type:'door',offset:1.2,width:.913,height:2.113,sill:0}]})
const shape=compileBrief(d).rooms[0],shell=buildMeasuredShell({shape,cutaway:false})
const floor=shell.children.find(x=>x.userData.measuredFloor);floor.geometry.computeBoundingBox()
const size=floor.geometry.boundingBox.getSize(new THREE.Vector3())
assert.ok(Math.abs(size.x-5.137)<1e-6);assert.ok(Math.abs(size.z-4.219)<1e-6)
const north=shell.children.find(x=>x.userData.measuredEdge===0)
assert.equal(north.userData.length,5.137)
for(const mesh of north.children){
  mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox.clone().translate(mesh.position)
  assert.equal(box.containsPoint(new THREE.Vector3(1.6,1,-.05)),false,'Door opening must remain empty')
}
const uv=floor.geometry.attributes.uv,pos=floor.geometry.attributes.position
for(let i=0;i<pos.count;i++){assert.ok(Math.abs(uv.getX(i)-pos.getX(i)/shape.surfaces.textureScale)<1e-6);assert.ok(Math.abs(uv.getY(i)-pos.getZ(i)/shape.surfaces.textureScale)<1e-6)}
const triangle=footprintGeometry([{x:0,z:0},{x:3,z:0},{x:0,z:4}]);assert.equal(triangle.attributes.position.count,3)
console.log('Measured mesh dimensions, true door cutout, polygon triangulation and meter-scale UV checks passed.')
