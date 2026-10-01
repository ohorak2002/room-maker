import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { upholsteredBlock, loosePillowGeometry, pillowSeam } from './upholsteryGeometry'
import { photoMaterial, boxUV, axialUV } from './photoMaterials'
import { PILOT_MATERIALS, MATERIAL_SETS } from '../data/materialSources'

const woodTile = MATERIAL_SETS[PILOT_MATERIALS.wood].tile
const clothTile = MATERIAL_SETS[PILOT_MATERIALS.upholstery].tile
const wood = (color = '#c6ac88') => photoMaterial(PILOT_MATERIALS.wood, { color, normalScale: .065, env: .3, specular: .2, neutralBase: .24, grainContrast: .48 })
const cloth = color => photoMaterial(PILOT_MATERIALS.upholstery, { color, normalScale: .85, sheen: .5, env: .25, specular: .15, neutralBase: .22 })
function stripedCloth(color) {
  const m=cloth(color), base=m.onBeforeCompile
  m.onBeforeCompile=shader=>{ base(shader); shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
    #ifdef USE_MAP
      float stripe = pow(0.5 + 0.5 * cos(vMapUv.x * 90.0), 12.0);
      diffuseColor.rgb *= 1.0 - 0.28 * stripe;
    #endif
    #include <roughnessmap_fragment>
  `) }
  m.customProgramCacheKey=()=> 'reference-woven-stripe-v1'
  return m
}
export function referenceMaterialSample(it) {
  const g = new THREE.Group(), fabric = ['referenceSofa', 'referenceRug'].includes(it.model)
  const sample=box(g, [.26, .18, .004], it.model === 'referenceRug' ? rugMaterial(it.color) : fabric ? cloth(it.color) : wood(), [0, .09, 0], 'material-sample', fabric)
  if(it.model === 'referenceRug') boxUV(sample.geometry,[.62,.62])
  return g
}
export function referenceFloorMaterial() {
  const m = wood('#bda782'), compile = m.onBeforeCompile
  m.normalScale.set(.18, .18)
  m.onBeforeCompile = shader => {
    compile(shader)
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #ifdef USE_MAP
        vec2 boardUV = vMapUv * vec2(2.4 / 0.18, 2.4 / 1.35);
        float row = floor(boardUV.x);
        vec2 boardCell = fract(boardUV + vec2(0.0, mod(row, 3.0) / 3.0));
        float seam = min(min(boardCell.x, 1.0 - boardCell.x) * 0.18, min(boardCell.y, 1.0 - boardCell.y) * 1.35);
        float plankVariation = 0.96 + 0.04 * sin(row * 13.1 + floor(boardUV.y) * 3.3);
        diffuseColor.rgb *= mix(0.72, plankVariation, smoothstep(0.0003, 0.0011, seam));
      #endif
      #include <roughnessmap_fragment>
    `)
  }
  m.customProgramCacheKey = () => 'nested-reference-oak-floor-v1'
  return m
}
function part(g, geo, material, pos, name) {
  const m = new THREE.Mesh(geo, material)
  m.position.set(...pos); m.name = name; m.castShadow = true; m.receiveShadow = true; g.add(m)
  return m
}
function box(g, dims, mat, pos, name, fabric = false) {
  const geo = new RoundedBoxGeometry(...dims, 3, Math.min(.035, ...dims.map(n => n / 3)))
  boxUV(geo, fabric ? clothTile : woodTile)
  return part(g, geo, mat, pos, name)
}
function cylinder(g, r1, r2, h, mat, pos, name) {
  const geo = new THREE.CylinderGeometry(r1, r2, h, 40)
  axialUV(geo, woodTile, (r1 + r2) / 2)
  return part(g, geo, mat, pos, name)
}
// Exact authored demo dimensions, not an automatic fit-to-room operation.
function dimensions(g, it) {
  const bounds = new THREE.Box3().setFromObject(g, true), size = bounds.getSize(new THREE.Vector3())
  const content = new THREE.Group(); content.add(...[...g.children])
  content.position.y = -bounds.min.y
  const root = new THREE.Group(); root.add(content)
  root.scale.set(it.w / size.x, it.h / size.y, it.d / size.z)
  root.userData.pilot = true
  return root
}
export function referenceSofa(it) {
  const g = new THREE.Group(), fabric = cloth(it.color), leg = wood('#76604a')
  padded(g,[1.9,.21,.9],fabric,[0,.155,0],'upholstered-plinth',{loft:.003,folds:.001})
  padded(g,[1.94,.53,.13],fabric,[0,.445,-.39],'rear-frame',{loft:.006})
  for(const x of [-1.015,1.015]) padded(g,[.17,.55,.92],fabric,[x,.32,0],'tailored-arm',{radius:.027,loft:.004,folds:.0015})
  for(const x of [-.92,.92]) for(const z of [-.34,.34]) box(g,[.07,.065,.07],leg,[x,.0325,z],'recessed-oak-foot')
  for(let i=0;i<3;i++) {
    const x=(i-1)*.616
    const seat=padded(g,[.603,.145,.68],fabric,[x,.329,.072],'seat-cushion',{radius:.025,loft:.013,folds:.004,seed:2+i,step:.019})
    // Fine welt lies on the cushion's side at mid-height, clear of its loft.
    seam(g,.603,.68,.025,[x,.329,.072],fabric,'seat-welt')
    const back=padded(g,[.611,.398,.165],fabric,[x,.572,-.261],'back-cushion',{radius:.026,loft:.025,folds:.005,seed:8+i*3,step:.018})
    back.rotation.set(-.13,0,(i-1)*.011)
    seat.rotation.z=(i-1)*.003
  }
  addPillow(g,{w:.42,h:.42,d:.16,pos:[-.72,.59,-.015],rotation:[-.16,-.12,.13],seed:2,mat:fabric})
  addPillow(g,{w:.32,h:.32,d:.14,pos:[-.49,.526,.105],rotation:[-.2,.1,-.14],seed:5,mat:cloth('#939277')})
  addPillow(g,{w:.40,h:.40,d:.17,pos:[.7,.59,.008],rotation:[-.21,.16,-.14],seed:7,mat:stripedCloth(it.color)})
  return dimensions(g, it)
}
function padded(g,dims,mat,pos,name,opts) { return part(g,boxUV(upholsteredBlock(...dims,opts),clothTile),mat,pos,name) }
function seam(g,w,d,r,pos,mat,name) {
  const pts=[]
  for(const [x,z,a] of [[w/2-r,d/2-r,0],[-w/2+r,d/2-r,Math.PI/2],[-w/2+r,-d/2+r,Math.PI],[w/2-r,-d/2+r,Math.PI*1.5]]) {
    for(let i=0;i<=12;i++) { const angle=a+i/12*Math.PI/2; pts.push(new THREE.Vector3(x+Math.cos(angle)*r,0,z+Math.sin(angle)*r)) }
  }
  const geo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts,true),112,.0015,4,true)
  boxUV(geo,clothTile); part(g,geo,mat,pos,name)
}
function addPillow(g,{w,h,d,pos,rotation,seed,mat}) {
  const pillow=new THREE.Group(); pillow.position.set(...pos); pillow.rotation.set(...rotation)
  part(pillow,loosePillowGeometry(w,h,d,seed),mat,[0,0,0],'loose-pillow')
  part(pillow,boxUV(pillowSeam(w,h,d,seed),clothTile),mat,[0,0,0],'pillow-seam')
  g.add(pillow)
}
export function referenceChair(it) {
  const g = new THREE.Group(), oak = wood(), fabric = cloth(it.color)
  for (const x of [-.31, .31]) {
    for (const z of [-.29, .29]) {
      // Leg tops run up into the armrest underside (arm bottom ≈ .538) and land at x; the splay moves the foot inward.
      const lean = .09, h = .56, leg = cylinder(g, .026, .019, h, oak, [x - Math.sign(x) * Math.sin(lean) * h / 2, h / 2 * Math.cos(lean), z], 'oak-leg')
      leg.rotation.z = -Math.sign(x) * lean
    }
    box(g, [.069, .043, .73], oak, [x, .56, 0], 'armrest').rotation.x=.035
    box(g, [.04, .38, .045], oak, [x, .59, -.29], 'back-upright').rotation.x = -.16
  }
  box(g, [.64, .065, .66], oak, [0, .35, 0], 'seat-frame')
  padded(g, [.59, .13, .6], fabric, [0, .43, .015], 'seat-cushion', {loft:.013,folds:.004,seed:3})
  seam(g,.59,.6,.025,[0,.43,.015],fabric,'seat-welt')
  padded(g, [.59, .36, .12], fabric, [0, .64, -.27], 'back-cushion', {loft:.022,folds:.004,seed:7}).rotation.x = -.17
  box(g, [.63, .07, .05], oak, [0, .75, -.34], 'top-rail')
  for(let i=0;i<7;i++) box(g,[.022,.34,.026],oak,[(i-3)*.077,.55,-.335],'back-spindle').rotation.x=-.17
  for(const x of [-.285,.285]) box(g,[.024,.03,.55],oak,[x,.20,0],'side-stretcher')
  addPillow(g,{w:.28,h:.26,d:.10,pos:[.08,.58,-.06],rotation:[-.23,.15,-.16],seed:3,mat:cloth('#96947e')})
  return dimensions(g, it)
}
export function referenceTable(it) {
  const g = new THREE.Group(), oak = wood()
  const top = cylinder(g, .525, .525, .055, oak, [0, .35, 0], 'oak-top')
  top.geometry.dispose()
  const profile = [[0,.027],[.507,.027],[.52,.023],[.525,.012],[.525,-.014],[.517,-.027],[0,-.027]].reverse().map(([x,y]) => new THREE.Vector2(x,y))
  top.geometry = new THREE.LatheGeometry(profile, 80)
  boxUV(top.geometry, woodTile)
  for (const angle of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) cylinder(g, .09, .085, .323, oak, [Math.sin(angle) * .32, .1615, Math.cos(angle) * .32], 'oak-column')
  return dimensions(g, it)
}
export function referenceRug(it) {
  const g = new THREE.Group(), fabric = rugMaterial(it.color)
  box(g, [it.w, it.h*.75, it.d], fabric, [0, it.h*.375, 0], 'woven-backing', true)
  const geo=new THREE.PlaneGeometry(it.w-.012,it.d-.012,160,120); geo.rotateX(-Math.PI/2)
  const p=geo.attributes.position
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),z=p.getZ(i)
    p.setY(i,it.h-.003 + .0018*Math.sin(x*530)*Math.cos(z*490) + .0008*Math.sin(x*71+z*59))
  }
  geo.computeVertexNormals(); boxUV(geo,[.62,.62])
  part(g,geo,fabric,[0,0,0],'woven-pile')
  // Bound selvage and short yarn tassels stay inside the declared footprint.
  for(const z of [-1,1]) {
    box(g,[it.w-.012,.007,.016],cloth('#bcb099'),[0,.012,z*(it.d/2-.012)],'bound-edge',true)
    const yarnGeo=new THREE.CylinderGeometry(.0011,.0011,.025,4), yarnMat=cloth('#d8cbb3')
    const yarn=new THREE.InstancedMesh(yarnGeo,yarnMat,Math.floor(it.w/.008)), dummy=new THREE.Object3D()
    for(let i=0;i<yarn.count;i++){dummy.position.set(-it.w/2+.008+i*.008,.006,z*(it.d/2-.014));dummy.rotation.set(Math.PI/2,0,.10*Math.sin(i*3));dummy.updateMatrix();yarn.setMatrixAt(i,dummy.matrix)}
    yarn.castShadow=true; yarn.receiveShadow=true; g.add(yarn)
  }
  return g
}
function rugMaterial(color) {
  const m=cloth(color), compile=m.onBeforeCompile
  m.normalScale.set(1.1,1.1)
  m.onBeforeCompile=shader=>{ compile(shader); shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
    #ifdef USE_MAP
      vec2 p = vMapUv * 0.62;
      float fleck = sin(p.x*387.0+sin(p.y*121.0))*sin(p.y*291.0);
      float row = floor(p.y/0.32);
      vec2 motif = abs(fract(vec2(p.x/0.44+mod(row,2.0)*0.5,p.y/0.32))-0.5);
      float diamond = 1.0-smoothstep(0.022,0.065,abs(motif.x+motif.y-0.38));
      float wear = 0.55+0.45*sin(p.x*19.0+p.y*13.0)*sin(p.y*33.0-p.x*7.0);
      diffuseColor.rgb *= 0.95 - 0.23*diamond*wear + 0.055*fleck;
    #endif
    #include <roughnessmap_fragment>
  `) }
  m.customProgramCacheKey=()=> 'reference-wool-rug-v2'
  return m
}
export function referenceLamp(it) {
  const g = new THREE.Group(), bronze = new THREE.MeshStandardMaterial({ color: it.color, roughness: .48, metalness: .72 })
  cylinder(g, .17, .19, .028, bronze, [0, .014, 0], 'base')
  cylinder(g, .012, .012, 1.5, bronze, [0, .76, 0], 'stem')
  const arm = cylinder(g, .011, .011, .34, bronze, [.12, 1.5, 0], 'arm'); arm.rotation.z = -.8
  const shade = cylinder(g, .022, .16, .19, bronze, [.25, 1.4, 0], 'shade')
  shade.material.side = THREE.DoubleSide
  const glow = new THREE.MeshStandardMaterial({ color: '#fff5dd', emissive: '#ffd6a0', emissiveIntensity: .5, roughness: .8 })
  glow.userData.glow = .5
  part(g, new THREE.CircleGeometry(.145, 32), glow, [.25, 1.305, 0], 'shade-diffuser').rotation.x = Math.PI / 2
  const light = new THREE.PointLight('#ffe2b2', .55, 3, 2); light.position.set(.25, 1.27, 0); g.add(light)
  return dimensions(g, it)
}

// Original abstract plaster-and-pigment painting (generated, no third-party content): layered soft colour fields, one dark block.
let artTexture
function abstractArtTexture() {
  if (artTexture) return artTexture
  const W = 768, H = 656, c = document.createElement('canvas'); c.width = W; c.height = H
  const x = c.getContext('2d')
  let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  x.fillStyle = '#d9cdb4'; x.fillRect(0, 0, W, H)
  const fields = [[0, 0, .62, .55, '#d2c3a5'], [.55, .08, .45, .5, '#c9b998'], [0, .5, .5, .5, '#bfae8d'], [.38, .55, .34, .45, '#cdbf9f'], [.68, .52, .32, .48, '#3c392f']]
  for (const [fx, fy, fw, fh, col] of fields) {
    x.globalAlpha = 1; x.fillStyle = col; x.fillRect(fx * W, fy * H, fw * W, fh * H)
    for (let i = 0; i < 700; i++) { // dry-brush / plaster mottling inside each field
      x.globalAlpha = .05 + rnd() * .07; x.fillStyle = rnd() < .5 ? '#ffffff' : '#000000'
      x.fillRect(fx * W + rnd() * fw * W, fy * H + rnd() * fh * H, 8 + rnd() * 70, 2 + rnd() * 14)
    }
  }
  x.globalAlpha = 1
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return (artTexture = t)
}

// Architectural dressing belongs to this illustrative pilot shell only.
export function referenceDressing() {
  const g = new THREE.Group(), oak = wood('#b69c76'), plaster = cloth('#d6c9ae')
  box(g, [1.23, 1.06, .035], oak, [-.2, 1.60, -1.84], 'art-frame')
  box(g, [1.17, 1, .04], plaster, [-.2, 1.60, -1.815], 'art-canvas')
  const art = new THREE.Mesh(new THREE.PlaneGeometry(1.17, 1), new THREE.MeshStandardMaterial({ map: abstractArtTexture(), roughness: .92, metalness: 0 }))
  art.position.set(-.2, 1.60, -1.787); art.name = 'art-painting'; art.userData.noCast = true; g.add(art)
  // Linen curtains flank a real opening in the left wall.
  const curtainMat = cloth('#e1d6be')
  for (const z of [-1.64, .83]) {
    const geo = new THREE.PlaneGeometry(.32, 2.57, 24, 1)
    const p = geo.attributes.position
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 74) * .033)
    geo.computeVertexNormals(); boxUV(geo, clothTile)
    curtainMat.side = THREE.DoubleSide
    part(g, geo, curtainMat, [-2.13, 1.36, z], 'curtain').rotation.y = Math.PI / 2
  }
  // Dark mullions make the daylight aperture legible.
  const frame = new THREE.MeshStandardMaterial({ color: '#54534a', roughness: .55 })
  for (const z of [-1.58, -.45, .72]) box(g, [.045, 2.48, .025], frame, [-2.22, 1.37, z], 'window-frame')
  for (const y of [.13, 1.35, 2.61]) box(g, [.045, .025, 2.3], frame, [-2.22, y, -.43], 'window-frame')
  // A small olive tree is scene dressing, not a sixth purchasable product.
  const plant = new THREE.Group(); plant.position.set(-1.85, 0, -.57)
  const pot = new THREE.MeshStandardMaterial({ color: '#b3a487', roughness: .95 })
  cylinder(plant, .18, .125, .32, pot, [0,.16,0], 'planter')
  const bark = new THREE.MeshStandardMaterial({ color: '#625844', roughness: 1 })
  cylinder(plant, .012, .022, 1.16, bark, [0,.78,0], 'trunk')
  const leafGeo = new THREE.SphereGeometry(1, 6, 4)
  const leafMat = new THREE.MeshStandardMaterial({ color: '#66704a', roughness: .85 })
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, 420), dummy = new THREE.Object3D()
  for (let b=0;b<20;b++) {
    const a=b*2.4, y=.65+b*.035
    const start=new THREE.Vector3(0,y,0), end=new THREE.Vector3(Math.cos(a)*(.21+.10*Math.sin(b)),y+.24,Math.sin(a)*.28)
    const delta=end.clone().sub(start)
    const branch=cylinder(plant,.002,.004,delta.length(),bark,start.clone().add(end).multiplyScalar(.5).toArray(),'olive-branch')
    branch.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize())
    for(let l=0;l<21;l++) {
      const i=b*21+l,t=.22+.78*l/20
      dummy.position.copy(start).lerp(end,t); dummy.position.x+=.035*Math.sin(l*2.4+a); dummy.position.z+=.035*Math.cos(l*2.4+a)
      dummy.scale.set(.011,.037,.0025); dummy.rotation.set(.65,a+l*.7,.8*Math.sin(l))
      dummy.updateMatrix(); leaves.setMatrixAt(i,dummy.matrix)
      leaves.setColorAt(i,new THREE.Color().setHSL(.20,.18,.26+.10*((Math.sin(i*13)+1)/2)))
    }
  }
  leaves.castShadow = true; leaves.receiveShadow = true; plant.add(leaves); g.add(plant)
  return g
}
