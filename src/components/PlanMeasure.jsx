import { useState } from 'react'

export default function PlanMeasure({attachment,units,onMeasure}){
  const [mode,setMode]=useState('scale'),[points,setPoints]=useState([]),[scale,setScale]=useState(null),[distance,setDistance]=useState(''),[size,setSize]=useState({w:1,h:1})
  function click(e){const rect=e.currentTarget.getBoundingClientRect(),p={x:(e.clientX-rect.left)/rect.width*size.w,z:(e.clientY-rect.top)/rect.height*size.h};setPoints(old=>old.length===2?[p]:[...old,p])}
  const length=points.length===2?Math.hypot(points[1].x-points[0].x,points[1].z-points[0].z):0
  return <div className="plan-measure"><p>Optional image measurement: mark both ends of a known distance, then mark two opposite interior corners of this room. Use an axis-aligned plan. Verify the result against printed dimensions.</p>
    <div className="plan-measure-image"><img src={attachment.dataUrl} alt="Floorplan to measure" onLoad={e=>{setSize({w:e.target.naturalWidth,h:e.target.naturalHeight});setPoints([]);setScale(null);setMode('scale')}}/>
      <svg viewBox={`0 0 ${size.w} ${size.h}`} onClick={click} aria-label="Click two plan points">{points.map((p,i)=><circle key={i} cx={p.x} cy={p.z} r={size.w*.008} fill="#586cc1"/>)}{points.length===2&&(mode==='scale'?<line x1={points[0].x} y1={points[0].z} x2={points[1].x} y2={points[1].z} stroke="#586cc1" strokeWidth={size.w*.004}/>:<rect x={Math.min(points[0].x,points[1].x)} y={Math.min(points[0].z,points[1].z)} width={Math.abs(points[0].x-points[1].x)} height={Math.abs(points[0].z-points[1].z)} fill="#586cc144" stroke="#586cc1" strokeWidth={size.w*.003}/>)}</svg>
    </div>
    {mode==='scale'?<><label>Known length ({units}) <input type="number" min="0.01" step="any" value={distance} onChange={e=>setDistance(e.target.value)}/></label><button disabled={!length||!(Number(distance)>0)} onClick={()=>{setScale(Number(distance)/length);setMode('room');setPoints([])}}>Set scale</button></>:<><button disabled={points.length!==2||Math.abs(points[0]?.x-points[1]?.x)<2||Math.abs(points[0]?.z-points[1]?.z)<2} onClick={()=>{onMeasure({room:{x:Math.min(points[0].x,points[1].x)*scale,z:Math.min(points[0].z,points[1].z)*scale,width:Math.abs(points[1].x-points[0].x)*scale,depth:Math.abs(points[1].z-points[0].z)*scale},reference:`Image ${attachment.name}; ${distance} ${units} calibration; ${scale.toPrecision(8)} ${units}/pixel. Dimensions require designer verification.`});setPoints([])}}>Use rectangle for this room</button><button onClick={()=>{setMode('scale');setPoints([])}}>Recalibrate</button></>}
    <p>Keyboard alternative: enter the plan’s printed dimensions and room coordinates in the fields below.</p>
  </div>
}
