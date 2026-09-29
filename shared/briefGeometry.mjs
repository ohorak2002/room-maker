// Exact metric geometry for official briefs. Legacy cell masks remain placement
// hints only; they never define the measured shell.
export const polygonArea = (p) => Math.abs(p.reduce((a, v, i) => {
  const n = p[(i + 1) % p.length]; return a + v.x * n.z - n.x * v.z
}, 0)) / 2

export function polygonBounds(p) {
  const xs = p.map(v => v.x), zs = p.map(v => v.z)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
  return { minX, maxX, minZ, maxZ, w: maxX - minX, d: maxZ - minZ }
}
export function pointInPolygon(p, x, z) {
  let inside = false
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[j], b = p[i]
    const cross = (x - a.x) * (b.z - a.z) - (z - a.z) * (b.x - a.x)
    if (Math.abs(cross) < 1e-8 && x >= Math.min(a.x,b.x)-1e-8 && x <= Math.max(a.x,b.x)+1e-8 && z >= Math.min(a.z,b.z)-1e-8 && z <= Math.max(a.z,b.z)+1e-8) return true
    if ((a.z > z) !== (b.z > z) && x < (b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x) inside = !inside
  }
  return inside
}
const orient = (a,b,c) => (b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x)
export function segmentsCross(a,b,c,d) {
  return orient(a,b,c)*orient(a,b,d) < -1e-10 && orient(c,d,a)*orient(c,d,b) < -1e-10
}
function intersects(a,b,c,d) {
  if (segmentsCross(a,b,c,d)) return true
  const on = (p,q,r) => Math.abs(orient(p,q,r))<1e-8 && r.x>=Math.min(p.x,q.x)-1e-8 && r.x<=Math.max(p.x,q.x)+1e-8 && r.z>=Math.min(p.z,q.z)-1e-8 && r.z<=Math.max(p.z,q.z)+1e-8
  return on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b)
}
export function isSimplePolygon(p) {
  for(let i=0;i<p.length;i++) {
    const a=p[i], b=p[(i+1)%p.length]
    if(Math.hypot(a.x-b.x,a.z-b.z)<.01)return false
    for(let j=i+1;j<p.length;j++) {
      if(j===i+1||(i===0&&j===p.length-1))continue
      if(intersects(a,b,p[j],p[(j+1)%p.length]))return false
    }
  }
  return polygonArea(p)>.1
}
export function polygonsOverlap(a,b) {
  // Exclude boundary-only contact; shared walls are valid.
  const strictlyInside=(p,v)=>pointInPolygon(p,v.x,v.z)&&!p.some((x,i)=>{
    const y=p[(i+1)%p.length],l=Math.hypot(y.x-x.x,y.z-x.z)
    return Math.abs(orient(x,y,v))/l<1e-7 && v.x>=Math.min(x.x,y.x)-1e-7 && v.x<=Math.max(x.x,y.x)+1e-7 && v.z>=Math.min(x.z,y.z)-1e-7 && v.z<=Math.max(x.z,y.z)+1e-7
  })
  if(a.some(v=>strictlyInside(b,v))||b.some(v=>strictlyInside(a,v)))return true
  for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)if(segmentsCross(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]))return true
  // Identical or aligned overlapping rectangles can have only collinear edges.
  for(const p of [a,b])for(let i=0;i<p.length;i++) {
    const v=p[i],n=p[(i+1)%p.length],len=Math.hypot(n.x-v.x,n.z-v.z)
    for(const sign of [-1,1]){
      const q={x:(v.x+n.x)/2+sign*(n.z-v.z)/len*1e-5,z:(v.z+n.z)/2-sign*(n.x-v.x)/len*1e-5}
      if(strictlyInside(a,q)&&strictlyInside(b,q))return true
    }
  }
  return false
}
export function measuredShape(polygon,h,openings=[]) {
  const b=polygonBounds(polygon),cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2
  const footprint=polygon.map(p=>({x:p.x-cx,z:p.z-cz}))
  const cols=Math.ceil(b.w/.5), rows=Math.ceil(b.d/.5),cells=[]
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)if(pointInPolygon(footprint,-b.w/2+(c+.5)*.5,-b.d/2+(r+.5)*.5))cells.push(`${c},${r}`)
  return {cols,rows,cells,h,footprint,exactW:b.w,exactD:b.d,area:polygonArea(polygon),openings}
}
