import assert from 'node:assert/strict'
import {newBrief,newBriefRoom,validateBrief,parseBrief,compileBrief,briefFingerprint} from '../shared/brief.mjs'
import {polygonArea,pointInPolygon,polygonsOverlap} from '../shared/briefGeometry.mjs'

const fixture=()=>{
  const doc=newBrief();doc.project={name:'Measured home',client:'Sample client',studio:'Sample studio',designer:'Sample designer'}
  doc.review={approved:true,reviewedBy:'Sample designer',date:'2026-09-29'};doc.plan.layoutVerified=true
  Object.assign(doc.rooms[0],{name:'Living room',width:5.137,depth:4.219,height:2.743,measurementSource:'Designer measured',geometryVerified:true,openingsVerified:true})
  doc.rooms[0].openings=[{id:'north-window',type:'window',edge:0,offset:1.117,width:1.413,height:1.257,sill:.811},{id:'entry',type:'door',edge:2,offset:.23,width:.91,height:2.1,sill:0}]
  return doc
}
assert.equal(validateBrief(newBrief()).errors.length>0,true)
const doc=fixture();assert.deepEqual(validateBrief(doc).errors,[])
const home=compileBrief(parseBrief(JSON.stringify(doc)).doc),r=home.rooms[0]
assert.equal(r.exactW,5.137);assert.equal(r.exactD,4.219);assert.equal(r.h,2.743)
assert.equal(r.openings[0].offset,1.117);assert.deepEqual(r.items,[])
assert.equal(home.measured,true);assert.ok(Math.abs(r.area-5.137*4.219)<1e-12)
assert.equal((await briefFingerprint(doc)).length,64)
const feet=fixture();feet.units='ft';const rf=feet.rooms[0];rf.width=16;rf.depth=13;rf.height=9;rf.openings=[]
assert.equal(compileBrief(feet).rooms[0].exactW,4.8768)
const reject=(change,pattern)=>{const d=fixture();change(d);const errors=validateBrief(d).errors;assert.ok(errors.some(e=>pattern.test(e)),JSON.stringify(errors));assert.throws(()=>compileBrief(d))}
reject(d=>d.format='generic-json',/official/)
reject(d=>d.schemaVersion=99,/version/)
reject(d=>d.furniture=[],/unsupported/)
reject(d=>d.rooms[0].items=[{id:'sofa'}],/unsupported/)
reject(d=>d.rooms[0].geometryVerified=false,/verify measurements/)
reject(d=>d.rooms[0].width=null,/width/)
reject(d=>d.rooms[0].width=-3,/width/)
reject(d=>d.rooms[0].height=999,/ceiling/)
reject(d=>d.rooms[0].openings[0].width=20,/opening exceeds/)
reject(d=>d.rooms[0].openings.push({...d.rooms[0].openings[0],id:'duplicate-span'}),/overlap/)
reject(d=>d.plan={...d.plan,source:'attachment',attachmentId:'missing'},/attachment is missing/)
reject(d=>d.review.approved=false,/client review/)
reject(d=>d.rooms[0].surfaces.wallColor='red',/HEX/)
reject(d=>{const r=structuredClone(d.rooms[0]);r.id='two';d.rooms.push(r)},/overlap/)
reject(d=>d.rooms[0].outline=[{x:0,z:0},{x:5.137,z:4.219},{x:0,z:4.219},{x:5.137,z:0}],/simple/)
const custom=fixture();custom.rooms[0].width=5;custom.rooms[0].depth=4;custom.rooms[0].openings=[];custom.rooms[0].outline=[{x:0,z:0},{x:5,z:0},{x:5,z:2},{x:3,z:2},{x:3,z:4},{x:0,z:4}]
const cr=compileBrief(custom).rooms[0];assert.equal(cr.area,16);assert.equal(pointInPolygon(cr.footprint,2,1),false)
const two=fixture(),next=newBriefRoom(2);Object.assign(next,{name:'Bedroom',width:3.2,depth:4.219,height:2.743,x:5.237,geometryVerified:true,openingsVerified:true,measurementSource:'Designer measured'});two.rooms.push(next)
assert.equal(compileBrief(two).rooms.length,2);assert.ok(Math.abs(compileBrief(two).w-8.437)<1e-10)
const rect=(x,z,w,d)=>[{x,z},{x:x+w,z},{x:x+w,z:z+d},{x,z:z+d}]
assert.equal(polygonsOverlap(rect(0,0,4,4),rect(4,0,3,4)),false)
assert.equal(polygonsOverlap(rect(0,0,4,4),rect(3,0,3,4)),true)
assert.equal(polygonsOverlap(rect(0,0,4,4),rect(0,0,4,4)),true)
assert.equal(polygonArea(rect(0,0,4,4)),16)
assert.throws(()=>parseBrief('not json'))
for(const value of [null,[],{},'text',42])assert.ok(validateBrief(value).errors.length)
console.log('Official brief validation, exact units, polygons, openings, overlap, no furnishing, and round-trip checks passed.')
