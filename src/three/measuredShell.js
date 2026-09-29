import * as THREE from 'three'
import { applySurface } from './textures.js'

const FLOOR_SURFACE={oak:'plank','dark-wood':'plank',tile:'tile',stone:'stone',concrete:'concrete',carpet:'fabric'}
const WALL_SURFACE={plaster:'plaster',limewash:'plaster',brick:'brick',concrete:'concrete','wood-panel':'shiplap'}
const ROUGHNESS={matte:.9,satin:.55,gloss:.22}
function material(color,texture,finish){const m=new THREE.MeshStandardMaterial({color,roughness:ROUGHNESS[finish]??.9,metalness:0,envMapIntensity:.3});return applySurface(m,texture,1)}
// Geometry UVs are meters / selected tile size. The same map scale is used on
// every wall segment; a shorter wall no longer stretches the texture.
function meterUV(geometry,scale,offset={x:0,y:0,z:0}){
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv
  for(let i=0;i<p.count;i++){
    const x=p.getX(i)+offset.x,y=p.getY(i)+offset.y,z=p.getZ(i)+offset.z
    if(Math.abs(n.getY(i))>.5)uv.setXY(i,x/scale,z/scale)
    else if(Math.abs(n.getX(i))>.5)uv.setXY(i,z/scale,y/scale)
    else uv.setXY(i,x/scale,y/scale)
  }uv.needsUpdate=true;return geometry
}
export function footprintGeometry(footprint){
  const path=new THREE.Shape();footprint.forEach((p,i)=>i?path.lineTo(p.x,-p.z):path.moveTo(p.x,-p.z));path.closePath()
  const geometry=new THREE.ShapeGeometry(path);geometry.rotateX(-Math.PI/2);return geometry
}
// A flat ceiling slab over the measured footprint, facing down into the room.
function ceilingGeometry(footprint,thickness){
  const path=new THREE.Shape();footprint.forEach((p,i)=>i?path.lineTo(p.x,-p.z):path.moveTo(p.x,-p.z));path.closePath()
  const geometry=new THREE.ExtrudeGeometry(path,{depth:thickness,bevelEnabled:false});geometry.rotateX(-Math.PI/2);return geometry
}
// `cutaway` is kept for callers that want a static cut; the editor's room view
// uses the dynamic cutaways in `userData.cutaways` instead (see updateCutaways
// in buildRoom.js): walls and ceiling hide only while the camera is outside.
export function buildMeasuredShell({shape,colors,cutaway=false,overview=false}){
  const g=new THREE.Group(),s=shape.surfaces,scale=s.textureScale,t=.10,cutaways=[]
  const floorMat=material(colors?.floor||s.floorColor,FLOOR_SURFACE[s.floor],s.floorFinish)
  const wallMat=material(colors?.wall||s.wallColor,WALL_SURFACE[s.wall],s.wallFinish)
  const trimMat=material(colors?.trim||s.trimColor,'plaster','satin')
  const floor=new THREE.Mesh(meterUV(footprintGeometry(shape.footprint),scale),floorMat);floor.receiveShadow=true;floor.userData.measuredFloor=true;floor.userData.noCast=true;g.add(floor)
  const h=overview?Math.min(.6,shape.h):shape.h
  // Clear glass without a transmission pass, which would cost a second render
  // of the room every frame; it also never casts a shadow, so sun still enters.
  const glassMat=new THREE.MeshStandardMaterial({color:'#dcecf4',roughness:.08,metalness:0,transparent:true,opacity:.14,depthWrite:false})
  const signed=shape.footprint.reduce((a,p,i)=>{const q=shape.footprint[(i+1)%shape.footprint.length];return a+p.x*q.z-q.x*p.z},0),inward=signed>0?1:-1
  if(!overview){
    const ceilMat=material(colors?.trim||s.trimColor,'plaster','matte')
    const ceiling=new THREE.Mesh(meterUV(ceilingGeometry(shape.footprint,t),scale,{x:0,y:shape.h,z:0}),ceilMat);ceiling.position.y=shape.h;ceiling.receiveShadow=true
    g.add(ceiling);cutaways.push({axis:'y',at:shape.h,inward:-1,parts:[ceiling],hidden:false})
  }
  for(let edge=0;edge<shape.footprint.length;edge++){
    const a=shape.footprint[edge],b=shape.footprint[(edge+1)%shape.footprint.length],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)
    // A deliberate cutaway, never a change to the imported floorplan.
    const front=cutaway&&!overview&&Math.abs(a.z-shape.exactD/2)<1e-6&&Math.abs(b.z-shape.exactD/2)<1e-6
    const wall=new THREE.Group();wall.position.set(a.x,0,a.z);wall.rotation.y=-Math.atan2(dz,dx);wall.visible=!front;wall.userData={measuredEdge:edge,length:len,cutaway:front};g.add(wall)
    // Inward normal of this wall in shell space: it hides while the camera is
    // outside the room on the far side of this plane, never while inside.
    const nx=-inward*dz/len,nz=inward*dx/len
    if(!overview)cutaways.push({axis:'edge',px:a.x,pz:a.z,nx,nz,parts:[wall],hidden:false})
    // The near wall (facing back into the room along -Z) never casts shadows:
    // the room's lighting is tuned without it, as in every other room.
    const nearWall=Math.abs(dz)<1e-6&&Math.abs(a.z-shape.exactD/2)<1e-6&&nz<0
    function piece(start,end,bottom,top,mat=wallMat,thickness=t,centerZ=-inward*t/2){
      if(end-start<1e-6||top-bottom<1e-6)return
      const pos={x:(start+end)/2,y:(bottom+top)/2,z:centerZ}
      const mesh=new THREE.Mesh(meterUV(new THREE.BoxGeometry(end-start,top-bottom,thickness),scale,pos),mat)
      mesh.position.set(pos.x,pos.y,pos.z);mesh.castShadow=!nearWall&&mat!==glassMat;mesh.receiveShadow=true;if(nearWall||mat===glassMat)mesh.userData.noCast=true;wall.add(mesh)
    }
    const openings=shape.openings.filter(o=>o.edge===edge).sort((x,y)=>x.offset-y.offset)
    let cursor=0
    for(const o of openings){
      piece(cursor,o.offset,0,h);piece(o.offset,o.offset+o.width,0,Math.min(h,o.sill));piece(o.offset,o.offset+o.width,Math.min(h,o.sill+o.height),h)
      if(!overview){
        const frame=Math.min(.035,o.width/8,o.height/8),top=o.sill+o.height
        piece(o.offset,o.offset+frame,o.sill,top,trimMat,t*.6)
        piece(o.offset+o.width-frame,o.offset+o.width,o.sill,top,trimMat,t*.6)
        piece(o.offset,o.offset+o.width,top-frame,top,trimMat,t*.6)
        if(o.type==='window'){
          piece(o.offset,o.offset+o.width,o.sill,o.sill+frame,trimMat,t*.6)
          piece(o.offset+frame,o.offset+o.width-frame,o.sill+frame,top-frame,glassMat,.012)
        }
      }
      cursor=o.offset+o.width
    }
    piece(cursor,len,0,h)
    // Baseboards are interrupted at doors, never stretched across openings.
    let start=0
    for(const o of openings.filter(o=>o.sill<.09)){piece(start,o.offset,0,.09,trimMat,.018,inward*.009);start=o.offset+o.width}
    piece(start,len,0,.09,trimMat,.018,inward*.009)
  }
  g.userData={measured:true,width:shape.exactW,depth:shape.exactD,height:shape.h,cutaways,bounds:{w:shape.exactW,d:shape.exactD,h:shape.h}}
  return g
}

export function buildMeasuredHome(scene,{home,floor=0,addContents}){
  const group=new THREE.Group(),pickables=[]
  for(const room of home.rooms.filter(r=>r.floor===floor)){
    const shell=buildMeasuredShell({shape:room,overview:true,cutaway:false});shell.position.set(room.ox,0,room.oz);addContents?.(shell,room);group.add(shell)
    const geometry=footprintGeometry(room.footprint)
    const hit=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide}));hit.position.set(room.ox,.025,room.oz)
    hit.userData={roomId:room.id,roomName:room.name,sqft:Math.round(room.area*10.7639104167)};group.add(hit);pickables.push(hit)
    const highlight=new THREE.Mesh(geometry.clone(),new THREE.MeshBasicMaterial({color:'#cad5ff',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));highlight.position.set(room.ox,.03,room.oz);group.add(highlight);hit.userData.highlight=highlight
  }
  scene.add(group)
  return {group,pickables,dispose:()=>{scene.remove(group);group.traverse(o=>{if(o.isMesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())}})}}
}
