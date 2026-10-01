// Actual renderer evidence, never generated concept imagery. Requires an
// explicit VITE_NESTED_DEBUG=1 build; rebuild normally after this inspection.
import { _electron as electron } from 'playwright'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'
import { PILOT_PRODUCTS } from '../src/data/referencePilot.js'

const root=resolve('.'), out=join(root,'artifacts','realism-review')
await mkdir(out,{recursive:true})
const userData=await mkdtemp(join(tmpdir(),'nested-realism-')),env={...process.env,NESTED_TEST_USER_DATA:userData}
delete env.ELECTRON_RUN_AS_NODE
const app=await electron.launch({args:[root],env,timeout:60000}),errors=[]
try {
  const page=await app.firstWindow()
  page.setDefaultTimeout(60000)
  page.on('pageerror',e=>errors.push(e.message))
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  await page.setViewportSize({width:1586,height:992})
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.getByRole('button',{name:'Explore the living-room pilot'}).click()
  await page.waitForFunction(()=>window.__nestedEngine?.room?.handles?.length===5)
  await page.evaluate(()=>window.__nestedMaterials.ready())
  await page.waitForTimeout(1200)
  const measure=()=>page.evaluate(()=>{
    const e=window.__nestedEngine
    e.scene.updateMatrixWorld(true)
    const models=e.room.handles.map(h=>{
      const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity]
      let triangles=0,meshes=0
      const inv=h.quaternion.clone().invert()
      h.traverse(o=>{
        if(!o.isMesh)return
        meshes++; const n=o.isInstancedMesh?o.count:1
        triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*n
        const p=o.geometry.attributes.position,v=o.position.clone(),matrix=o.matrix.clone()
        for(let j=0;j<n;j++) {
          if(o.isInstancedMesh)o.getMatrixAt(j,matrix)
          for(let i=0;i<p.count;i++) {
            v.fromBufferAttribute(p,i)
            if(o.isInstancedMesh)v.applyMatrix4(matrix)
            v.applyMatrix4(o.matrixWorld).sub(h.position).applyQuaternion(inv)
            for(let k=0;k<3;k++){const a=v.getComponent(k);lo[k]=Math.min(lo[k],a);hi[k]=Math.max(hi[k],a)}
          }
        }
      })
      return {id:h.userData.itemId,dimensions:hi.map((a,k)=>a-lo[k]),minY:lo[1],triangles,meshes}
    })
    return {models,memory:{...e.renderer.info.memory},programs:e.renderer.info.programs.length}
  })
  const initial=await measure()
  for(const m of initial.models) {
    const p=PILOT_PRODUCTS.find(p=>p.id===m.id)
    ;[p.w,p.h,p.d].forEach((v,i)=>assert.ok(Math.abs(v-m.dimensions[i])<.003,`${m.id}: dimension ${i}: ${m.dimensions[i]} vs ${v}`))
    assert.ok(Math.abs(m.minY)<.003,`${m.id}: seated on floor`)
  }
  for(const [name,position,target] of [
    ['sofa',[.15,.90,.20],[-.20,.48,-1.20]],
    ['chair',[.25,.80,.90],[1.24,.46,-.30]],
    ['rug',[-.8,.60,.82],[-.25,.02,.35]],
  ]) {
    await page.evaluate(({position,target})=>{
      const e=window.__nestedEngine
      e.controls.enabled=false; e.mode='review'
      e.controls.minDistance=.01; e.controls.maxDistance=100
      e.camera.position.set(...position);e.controls.target.set(...target)
      e.camera.lookAt(e.controls.target);e.camera.fov=55;e.camera.updateProjectionMatrix()
    },{position,target})
    await page.waitForTimeout(450)
    await page.locator('.canvas-mount canvas').screenshot({path:join(out,`${name}-detail.png`)})
  }
  if (process.env.NESTED_CAPTURE_ONLY === '1') console.log('Captured three actual model close-ups')
  else {
  // Warm each relevant shader once, then verify repeated room reconstruction
  // does not continually allocate lights, model buffers or material programs.
  for(let i=0;i<16;i++) {
    await page.getByRole('button',{name:i%2?'Oatmeal upholstery':'Sage upholstery',exact:true}).click()
    await page.waitForTimeout(180)
    if(i===5) initial.warmed=await measure()
  }
  const final=await measure()
  assert.ok(final.memory.textures<=initial.warmed.memory.textures+2,'stable live texture count')
  assert.ok(final.memory.geometries<=initial.warmed.memory.geometries+2,'stable live geometry count')
  assert.ok(final.programs<=initial.warmed.programs+2,'stable material program count')
  assert.deepEqual(errors,[])
  const report={passed:true,initial,final,errors,note:'Actual Electron geometry bounds and resources; 16 upholstery changes. Close-ups are live 3D, not generated images.'}
  await writeFile(join(out,'review.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
  }
} finally {await app.evaluate(({app})=>app.exit(0)).catch(()=>{})}
