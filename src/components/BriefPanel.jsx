import { useRoomStore } from '../store/roomStore'
import { useUiStore } from '../store/uiStore'
import './DesignBrief.css'

const LABELS = { roomPurpose: 'Room purpose', roomUsers: 'Room users', scope: 'Scope', targetDate: 'Target date', feeling: 'Atmosphere', avoidColors: 'Colors to avoid', inspiration: 'Inspiration', paintReference: 'Paint references', floorDetail: 'Floor details', surfaceReferences: 'Surface references', ceiling: 'Ceiling notes', trim: 'Trim notes', daylight: 'Daylight orientation', lightNotes: 'Lighting notes', fixedFeatures: 'Fixed features (not auto-modeled)', preserveArchitecture: 'Preserve', access: 'Access and comfort', avoidMaterials: 'Materials to avoid', budget: 'Preparation budget', currency: 'Currency', budgetCovers: 'Budget includes', constraints: 'Constraints', questions: 'Open questions', needs: 'Everyday needs' }

/** The source Brief, kept readable beside the room: every note it carried. */
export default function BriefPanel() {
  const brief = useRoomStore((s) => s.brief)
  const home = useRoomStore((s) => s.home)
  const focusedRoom = useRoomStore((s) => s.focusedRoom)
  const focusRoom = useRoomStore((s) => s.focusRoom)
  const requestNewProject = useUiStore((s) => s.requestNewProject)
  if (!brief || !home) return null
  const { source } = brief
  const rooms = focusedRoom ? home.rooms.filter((r) => r.id === focusedRoom) : home.rooms
  return (
    <div className="brief-panel">
      <h3>{source.project.name}</h3>
      <p>{source.project.client} · {source.project.designer}</p>
      <p>Official Brief v1 · measured room foundation</p>
      <button onClick={requestNewProject}>Start a new brief…</button>
      <p>Furniture and accessories are chosen here with your client. Brief geometry is locked; start a new project and Brief to change it.</p>
      {rooms.map((r) => (
        <section key={r.id}>
          <h3>{r.name}</h3>
          <p>{r.exactW.toFixed(3)} × {r.exactD.toFixed(3)} × {r.h.toFixed(3)} m · {r.area.toFixed(2)} m²</p>
          <p>{r.openings.length} measured openings · {r.surfaces.floor} · {r.surfaces.wall}</p>
          {!focusedRoom && <button onClick={() => focusRoom(r.id)}>Design this room</button>}
          <dl>
            {Object.entries(r.notes).filter(([, v]) => v.trim()).map(([k, v]) => <div key={k}><dt>{LABELS[k] || k}</dt><dd>{v}</dd></div>)}
          </dl>
        </section>
      ))}
      <h4>Preview limits</h4>
      <p>Surface textures are procedural PBR previews. Product references, complex ceiling details and fixed-feature notes are retained for the designer and are not automatically modeled. From outside the room, the walls and ceiling between you and the room are hidden so you can see in.</p>
      {source.attachments.map((a) => (
        <div key={a.id}>
          <h4>{a.name}</h4>
          {a.mime.startsWith('image/') ? <img src={a.dataUrl} alt="Source floorplan" /> : <p>PDF is kept with the Brief.</p>}
        </div>
      ))}
    </div>
  )
}
