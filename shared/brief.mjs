import { isSimplePolygon, measuredShape, polygonBounds, polygonsOverlap } from './briefGeometry.mjs'

export const BRIEF_FORMAT = 'nested-official-design-brief'
export const BRIEF_VERSION = 1
export const MAX_BRIEF_BYTES = 8 * 1024 * 1024
export const KINDS = ['living','bedroom','kitchen','dining','bath','office','hallway','other']
export const FLOORS = ['oak','dark-wood','tile','stone','concrete','carpet']
export const WALLS = ['plaster','limewash','brick','concrete','wood-panel']
export const FINISHES = ['matte','satin','gloss']
export const LIGHTS = ['natural','warm','cool','moody','golden','overcast']
export const NOTE_FIELDS = ['roomPurpose','roomUsers','scope','targetDate','feeling','avoidColors','inspiration','paintReference','floorDetail','surfaceReferences','ceiling','trim','daylight','lightNotes','fixedFeatures','preserveArchitecture','access','avoidMaterials','budget','currency','budgetCovers','constraints','questions','needs']
const clone = v => JSON.parse(JSON.stringify(v))
export function newBriefRoom(index=1) {
  return {id:`room-${index}`,name:'',kind:'living',floor:0,x:0,z:0,width:null,depth:null,height:null,outline:[],geometryVerified:false,openingsVerified:false,measurementSource:'',openings:[],surfaces:{floor:'oak',wall:'plaster',floorColor:'#C6AC88',wallColor:'#EFE8DD',trimColor:'#FCF9F3',accentColor:'#CAA48E',floorFinish:'matte',wallFinish:'matte',textureScale:1},lighting:'natural',notes:Object.fromEntries(NOTE_FIELDS.map(k=>[k,'']))}
}
export function newBrief() {
  return {format:BRIEF_FORMAT,schemaVersion:BRIEF_VERSION,producer:'Nested Brief Editor',id:globalThis.crypto?.randomUUID?.()||`brief-${Date.now()}`,project:{name:'',client:'',studio:'',designer:''},units:'m',plan:{source:'measured',attachmentId:null,page:1,reference:'',layoutVerified:false},rooms:[newBriefRoom()],attachments:[],review:{approved:false,reviewedBy:'',date:''}}
}
function object(v){return v!==null&&typeof v==='object'&&!Array.isArray(v)}
function keys(v,allowed,path,errors){if(!object(v)){errors.push(`${path}: expected an object.`);return false}for(const k of Object.keys(v))if(!allowed.includes(k))errors.push(`${path}: unsupported field “${k}”.`);return true}
const num=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max
const str=(s,max=3000)=>typeof s==='string'&&s.length<=max
const hex=s=>typeof s==='string'&&/^#[a-f\d]{6}$/i.test(s)

// Validate completely before mutating the room store. A format marker is a
// compatibility check, not a cryptographic signature or proof of authorship.
export function validateBrief(doc) {
  const errors=[],warnings=[]
  if(!keys(doc,['format','schemaVersion','producer','id','project','units','plan','rooms','attachments','review'],'Brief',errors))return {errors,warnings}
  if(doc.format!==BRIEF_FORMAT||doc.producer!=='Nested Brief Editor')errors.push('Upload an official .nested-brief.json exported from the Nested Brief editor. PDFs, free-form notes and the old draft template cannot be imported directly.')
  if(doc.schemaVersion!==BRIEF_VERSION)errors.push('This brief version is not supported. Export version 1 from the current editor.')
  if(!str(doc.id,100)||!doc.id)errors.push('Brief ID is missing.')
  if(!['m','ft'].includes(doc.units))errors.push('Choose meters or decimal feet.')
  if(keys(doc.project,['name','client','studio','designer'],'Project',errors))for(const k of ['name','client','studio','designer'])if(!str(doc.project[k],200)||!doc.project[k].trim())errors.push(`Project: ${k} is required.`)
  if(keys(doc.review,['approved','reviewedBy','date'],'Review',errors)){
    if(doc.review.approved!==true||!str(doc.review.reviewedBy,200)||!doc.review.reviewedBy.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(doc.review.date||''))errors.push('The designer must record the client review, name and date before export.')
  }
  if(!Array.isArray(doc.attachments)||doc.attachments.length>4)errors.push('Use at most four floorplan attachments.')
  const attachmentIds=new Set()
  for(const a of (Array.isArray(doc.attachments)?doc.attachments:[])) {
    if(!keys(a,['id','name','mime','dataUrl'],'Attachment',errors))continue
    if(!str(a.id,100)||attachmentIds.has(a.id))errors.push('Attachment IDs must be unique strings.');attachmentIds.add(a.id)
    if(!str(a.name,200)||/[\\/]/.test(a.name))errors.push('Attachment names must be plain filenames.')
    const headers={'image/png':'iVBORw0KGgo','image/jpeg':'/9j/','application/pdf':'JVBERi0'}
    const prefix=`data:${a.mime};base64,`
    if(!headers[a.mime]||!str(a.dataUrl,3*1024*1024)||!a.dataUrl.startsWith(prefix+headers[a.mime])||!/^[A-Za-z0-9+/]*={0,2}$/.test(a.dataUrl.slice(prefix.length)))errors.push('Attach valid PNG, JPEG or PDF files up to 2 MB each.')
  }
  if(keys(doc.plan,['source','attachmentId','page','reference','layoutVerified'],'Floorplan',errors)){
    if(!['measured','attachment'].includes(doc.plan.source))errors.push('Choose a measured plan or attached blueprint.')
    if(doc.plan.layoutVerified!==true)errors.push('Verify the plan layout and room positions.')
    if(!num(doc.plan.page,1,1000)||!Number.isInteger(doc.plan.page)||!str(doc.plan.reference))errors.push('Enter a valid page and plan reference.')
    if(doc.plan.source==='attachment'&&!attachmentIds.has(doc.plan.attachmentId))errors.push('The selected floorplan attachment is missing.')
    if(doc.plan.source==='attachment'&&(typeof doc.plan.reference!=='string'||!doc.plan.reference.trim()))errors.push('Describe the blueprint scale / known measurement used to verify the plan.')
  }
  if(!Array.isArray(doc.rooms)||!doc.rooms.length||doc.rooms.length>30){errors.push('Include between 1 and 30 measured rooms.');return {errors,warnings}}
  if(errors.length)return {errors:[...new Set(errors)],warnings}
  const ids=new Set(),polygons=[];const factor=doc.units==='ft'?.3048:1
  for(const [i,r] of doc.rooms.entries()) {
    const p=`Room ${i+1}`
    if(!keys(r,['id','name','kind','floor','x','z','width','depth','height','outline','geometryVerified','openingsVerified','measurementSource','openings','surfaces','lighting','notes'],p,errors))continue
    if(!str(r.id,100)||!r.id||ids.has(r.id))errors.push(`${p}: use a unique room ID.`);ids.add(r.id)
    if(!str(r.name,100)||!r.name.trim()||!KINDS.includes(r.kind))errors.push(`${p}: name and room type are required.`)
    if(!num(r.floor,0,9)||!Number.isInteger(r.floor))errors.push(`${p}: floor must be a whole number from 0 to 9.`)
    if(!num(r.x,-300/factor,300/factor)||!num(r.z,-300/factor,300/factor))errors.push(`${p}: enter room X and Z positions.`)
    if(!num(r.width,.3/factor,60/factor)||!num(r.depth,.3/factor,60/factor)||!num(r.height,1.8/factor,10/factor))errors.push(`${p}: enter valid measured width, depth and ceiling height.`)
    if(r.geometryVerified!==true||!['Designer measured','Dimensioned floorplan'].includes(r.measurementSource))errors.push(`${p}: verify measurements and their source. Estimates cannot build the room.`)
    if(r.openingsVerified!==true)errors.push(`${p}: confirm that all doors and windows are recorded (including none, when correct).`)
    let polygon=rectangle(r.width,r.depth)
    if(!Array.isArray(r.outline)||r.outline.length>64)errors.push(`${p}: outline must contain at most 64 points.`)
    else if(r.outline.length){
      if(r.outline.length<3||r.outline.some(v=>!object(v)||Object.keys(v).some(k=>!['x','z'].includes(k))||!num(v.x,0,r.width)||!num(v.z,0,r.depth))||!isSimplePolygon(r.outline))errors.push(`${p}: outline must be a simple, non-intersecting measured polygon within the room bounds.`)
      else {polygon=r.outline;const b=polygonBounds(polygon);if(Math.abs(b.minX)>1e-6||Math.abs(b.minZ)>1e-6||Math.abs(b.w-r.width)>1e-6||Math.abs(b.d-r.depth)>1e-6)errors.push(`${p}: outline bounds must agree with width and depth, starting at X/Z zero.`)}
    }
    const metric=polygon.map(v=>({x:(v.x+r.x)*factor,z:(v.z+r.z)*factor}));polygons.push({floor:r.floor,polygon:metric,name:r.name})
    if(!Array.isArray(r.openings)||r.openings.length>50)errors.push(`${p}: use at most 50 openings.`)
    const openingIds=new Set()
    for(const o of Array.isArray(r.openings)?r.openings:[]){
      if(!keys(o,['id','type','edge','offset','width','height','sill'],`${p} opening`,errors))continue
      if(!str(o.id,100)||openingIds.has(o.id))errors.push(`${p}: opening IDs must be unique.`);openingIds.add(o.id)
      const a=polygon[o.edge],b=polygon[(o.edge+1)%polygon.length],len=a&&b?Math.hypot(b.x-a.x,b.z-a.z):0
      if(!['door','window','passage'].includes(o.type)||!Number.isInteger(o.edge)||o.edge<0||o.edge>=polygon.length||!num(o.offset,0,len)||!num(o.width,.05/factor,len)||!num(o.height,.05/factor,r.height)||!num(o.sill,0,r.height)||o.offset+o.width>len+1e-7||o.sill+o.height>r.height+1e-7||(o.type!=='window'&&o.sill!==0))errors.push(`${p}: an opening exceeds its wall/ceiling or has invalid measurements.`)
    }
    const openings=Array.isArray(r.openings)?r.openings:[]
    for(let a=0;a<openings.length;a++)for(let b=a+1;b<openings.length;b++){const u=openings[a],v=openings[b];if(u&&v&&u.edge===v.edge&&u.offset<v.offset+v.width-1e-7&&v.offset<u.offset+u.width-1e-7)errors.push(`${p}: openings on the same wall overlap. Record separate horizontal spans.`)}
    if(keys(r.surfaces,['floor','wall','floorColor','wallColor','trimColor','accentColor','floorFinish','wallFinish','textureScale'],`${p} surfaces`,errors)){
      const s=r.surfaces
      if(!FLOORS.includes(s.floor)||!WALLS.includes(s.wall)||!FINISHES.includes(s.floorFinish)||!FINISHES.includes(s.wallFinish)||!num(s.textureScale,.1,5))errors.push(`${p}: choose supported surface materials, finishes and texture scale.`)
      for(const k of ['floorColor','wallColor','trimColor','accentColor'])if(!hex(s[k]))errors.push(`${p}: ${k} must be a six-digit HEX color.`)
    }
    if(!LIGHTS.includes(r.lighting))errors.push(`${p}: choose a supported lighting preview.`)
    if(keys(r.notes,NOTE_FIELDS,`${p} notes`,errors))for(const [k,v] of Object.entries(r.notes))if(!str(v))errors.push(`${p}: ${k} must be text of at most 3,000 characters.`)
    if(typeof r.notes?.fixedFeatures==='string'&&r.notes.fixedFeatures.trim())warnings.push(`${r.name}: fixed-feature notes are retained; custom built-ins, columns and fireplaces are not automatically modeled.`)
    if(typeof r.notes?.ceiling==='string'&&r.notes.ceiling.trim()&&!/^flat$/i.test(r.notes.ceiling.trim()))warnings.push(`${r.name}: ceiling notes are retained; the shell uses the measured flat ceiling height.`)
  }
  for(let i=0;i<polygons.length;i++)for(let j=i+1;j<polygons.length;j++)if(polygons[i].floor===polygons[j].floor&&polygonsOverlap(polygons[i].polygon,polygons[j].polygon))errors.push(`Room footprints overlap: ${polygons[i].name} and ${polygons[j].name}. Correct the measured layout.`)
  warnings.push('Materials use procedural PBR previews. Product references, design intent and other notes stay in the Brief panel; they are not a guarantee of an exact product match.')
  return {errors:[...new Set(errors)],warnings:[...new Set(warnings)]}
}
export const rectangle=(w,d)=>[{x:0,z:0},{x:w,z:0},{x:w,z:d},{x:0,z:d}]
export function parseBrief(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BRIEF_BYTES)throw new Error('The official brief must be smaller than 8 MB.')
  let doc;try{doc=JSON.parse(text)}catch{throw new Error('This is not a valid Nested brief. Upload the .nested-brief.json exported by the official editor.')}
  const result=validateBrief(doc);return {doc,...result}
}
export function compileBrief(doc){
  const result=validateBrief(doc);if(result.errors.length)throw new Error(result.errors.join('\n'))
  const factor=doc.units==='ft'?.3048:1
  const rooms=doc.rooms.map(r=>{
    const poly=(r.outline.length?r.outline:rectangle(r.width,r.depth)).map(v=>({x:v.x*factor,z:v.z*factor}))
    const openings=r.openings.map(o=>({...o,offset:o.offset*factor,width:o.width*factor,height:o.height*factor,sill:o.sill*factor}))
    return {id:r.id,name:r.name,kind:r.kind,floor:r.floor,...measuredShape(poly,r.height*factor,openings),ox:(r.x+r.width/2)*factor,oz:(r.z+r.depth/2)*factor,items:[],surfaces:clone(r.surfaces),lighting:r.lighting,notes:clone(r.notes)}
  })
  const minX=Math.min(...rooms.map(r=>r.ox-r.exactW/2)),maxX=Math.max(...rooms.map(r=>r.ox+r.exactW/2)),minZ=Math.min(...rooms.map(r=>r.oz-r.exactD/2)),maxZ=Math.max(...rooms.map(r=>r.oz+r.exactD/2))
  rooms.forEach(r=>{r.ox-=(minX+maxX)/2;r.oz-=(minZ+maxZ)/2})
  return {measured:true,rooms,w:maxX-minX,d:maxZ-minZ,h:Math.max(...rooms.map(r=>r.h)),storeys:Math.max(...rooms.map(r=>r.floor))+1,beds:rooms.filter(r=>r.kind==='bedroom').length,baths:rooms.filter(r=>r.kind==='bath').length,sqft:Math.round(rooms.reduce((s,r)=>s+r.area,0)*10.7639104167)}
}
export async function briefFingerprint(doc){const bytes=new TextEncoder().encode(JSON.stringify(doc));const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('')}
// A saved draft is an unfinished official document. It must be the right format
// and shape to edit safely; completeness is only checked by validateBrief when
// the designer exports. Fields the editor knows are filled in from defaults, and
// anything else is kept so validateBrief can name it rather than lose it quietly.
export function normalizeDraft(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BRIEF_BYTES)throw new Error('The draft must be smaller than 8 MB.')
  let doc;try{doc=JSON.parse(text)}catch{throw new Error('This is not a Nested Brief draft.')}
  if(!object(doc)||doc.format!==BRIEF_FORMAT||doc.schemaVersion!==BRIEF_VERSION||!Array.isArray(doc.rooms)||!doc.rooms.length||doc.rooms.length>30||!doc.rooms.every(object))throw new Error('This is not a version 1 Nested Brief draft.')
  const base=newBrief()
  const merged={...base,...doc,project:{...base.project,...(object(doc.project)?doc.project:{})},plan:{...base.plan,...(object(doc.plan)?doc.plan:{})},review:{...base.review,...(object(doc.review)?doc.review:{})},attachments:Array.isArray(doc.attachments)?doc.attachments.slice(0,4):[]}
  merged.rooms=doc.rooms.map((r,i)=>{const b=newBriefRoom(i+1);return {...b,...r,surfaces:{...b.surfaces,...(object(r.surfaces)?r.surfaces:{})},notes:{...b.notes,...(object(r.notes)?r.notes:{})},outline:Array.isArray(r.outline)?r.outline:[],openings:Array.isArray(r.openings)?r.openings:[]}})
  return merged
}
