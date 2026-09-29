import { useState } from 'react'
import './DesignBrief.css'

// The same exact polygons and openings used by the 3D shell. Never infer doors.
export default function MeasuredPlan({home,onPick,floor,onFloor}){
  const [localFloor,setLocalFloor]=useState(0),active=floor??localFloor
  const rooms=home.rooms.filter(r=>r.floor===active),pad=.8
  return <div className="measured-plan"><div className="measured-plan-head"><strong>Measured floorplan</strong><div>{Array.from({length:home.storeys},(_,i)=><button key={i} aria-pressed={active===i} onClick={()=>onFloor?onFloor(i):setLocalFloor(i)}>{i===0?'Ground':`Floor ${i+1}`}</button>)}</div></div>
    <svg viewBox={`${-home.w/2-pad} ${-home.d/2-pad} ${home.w+pad*2} ${home.d+pad*2}`} role="img" aria-label="Exact measured room footprints and recorded openings">
      {rooms.map(r=><g key={r.id} transform={`translate(${r.ox},${r.oz})`}>
        <polygon points={r.footprint.map(v=>`${v.x},${v.z}`).join(' ')} fill={r.surfaces?.floorColor||'#e8dfd0'} fillOpacity=".55" stroke="#586581" strokeWidth=".04"/>
        {r.openings.map(o=>{const a=r.footprint[o.edge],b=r.footprint[(o.edge+1)%r.footprint.length],l=Math.hypot(b.x-a.x,b.z-a.z),dx=(b.x-a.x)/l,dz=(b.z-a.z)/l;return <line key={o.id} x1={a.x+dx*o.offset} y1={a.z+dz*o.offset} x2={a.x+dx*(o.offset+o.width)} y2={a.z+dz*(o.offset+o.width)} stroke={o.type==='window'?'#627cb8':'#faf9f6'} strokeWidth=".09"><title>{o.type}: {o.width.toFixed(2)} m</title></line>})}
      </g>)}
    </svg><p>Blue = recorded windows · gaps = doors / passages · room coordinates are measured in meters.</p>
    <div className="measured-plan-rooms">{rooms.map(r=>onPick?<button key={r.id} onClick={()=>onPick(r.id)}>{r.name} · {r.area.toFixed(2)} m²</button>:<span key={r.id}>{r.name} · {r.area.toFixed(2)} m²</span>)}</div>
  </div>
}
