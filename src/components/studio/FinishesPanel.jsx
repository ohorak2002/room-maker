import { useRoomStore } from '../../store/roomStore'
import { useUiStore } from '../../store/uiStore'
import Section from '../Section'
import PaletteImport from '../PaletteImport'
import PhotoImport from '../PhotoImport'
import { PALETTES, MOODS, WALL_MATERIALS } from '../../data/presets'
import { resolveItem } from '../../data/catalog'
import { MATERIAL_SETS, PILOT_MATERIALS } from '../../data/materialSources'

/** Which finish information to show for the piece selected in the room. */
function SelectedFinish() {
  const id = useUiStore((s) => s.selectedItemId)
  const synthetics = useRoomStore((s) => s.synthetics)
  const item = id ? resolveItem(id, synthetics) : null
  if (!item) return <p className="studio-note">Select a piece in the room to see what its surface is made from.</p>

  if (item.model === 'asset') {
    return (
      <div className="finish-card">
        <strong>{item.name}</strong>
        <span className="studio-tag">Private model</span>
        <p className="studio-note">Materials, textures and UVs are used exactly as authored in the file. Nested does not recolour them.</p>
      </div>
    )
  }
  if (item.materialSet === 'pilot') {
    const uph = MATERIAL_SETS[PILOT_MATERIALS.upholstery]
    const wood = MATERIAL_SETS[PILOT_MATERIALS.wood]
    const rows = item.model === 'sofa'
      ? [['Upholstery and cushions', uph], ['Legs', wood]]
      : [['Top, apron and legs', wood]]
    return (
      <div className="finish-card">
        <strong>{item.name}</strong>
        <span className="studio-tag">Concept finish</span>
        <ul className="finish-list">
          {rows.map(([part, set]) => (
            <li key={part}>
              <span>{part}</span>
              <strong>{set.name}</strong>
              <small>Poly Haven · {set.license} · sample tile {Math.round(set.tile[0] * 100)} cm{set.kind === 'wood' && part.startsWith('Legs') ? ' · stained darker' : ''}</small>
            </li>
          ))}
          <li><span>Hardware</span><strong>Brass-toned metal</strong><small>Plain metal, no texture</small></li>
        </ul>
        <p className="studio-note">A generic photographic material stands in for the real cloth or timber. It is not any retailer’s finish, and the product’s real finish, size and colour are unverified.</p>
      </div>
    )
  }
  return (
    <div className="finish-card">
      <strong>{item.name}</strong>
      <span className="studio-tag">Concept finish</span>
      <p className="studio-note">Colour and surface are generic stand-ins. Retail products will use their own finish variants once verified.</p>
    </div>
  )
}

/** The room's finishes as the Brief recorded them, with optional colour trials. */
function BriefFinishes() {
  const store = useRoomStore()
  const room = store.activeRoom()
  const colors = store.colors()
  if (!room) return <p className="studio-note studio-pad">Open a room to see the finishes its Brief recorded.</p>
  const s = room.surfaces
  const swatch = (c) => <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: c, border: '1px solid var(--line-strong)', marginRight: 6, verticalAlign: -1 }} />
  return (
    <section className="studio-section">
      <span className="studio-label">{room.name} · from the Brief</span>
      <ul className="finish-list">
        <li><span>Floor</span><strong>{swatch(s.floorColor)}{s.floor} · {s.floorFinish}</strong><small>Procedural preview at a {s.textureScale} m tile</small></li>
        <li><span>Walls</span><strong>{swatch(s.wallColor)}{s.wall} · {s.wallFinish}</strong><small>Procedural preview at a {s.textureScale} m tile</small></li>
        <li><span>Trim</span><strong>{swatch(s.trimColor)}{s.trimColor}</strong></li>
        <li><span>Accent</span><strong>{swatch(s.accentColor)}{s.accentColor}</strong><small>Recorded for the designer; not painted onto a surface</small></li>
      </ul>
      <p className="studio-note">These are the Brief’s colours and generic procedural surfaces, not a verified paint or product match. Paint references and product notes are in the Brief panel.</p>
      <span className="studio-label">Try a colour</span>
      <div className="override-grid">
        <label className="override"><span>Wall</span><input type="color" value={colors.wall} onChange={(e) => store.set('wallOverride', e.target.value)} /></label>
        <label className="override"><span>Floor</span><input type="color" value={colors.floor} onChange={(e) => store.set('floorOverride', e.target.value)} /></label>
      </div>
      {(store.wallOverride || store.floorOverride) && (
        <button className="link-btn" onClick={() => { store.set('wallOverride', null); store.set('floorOverride', null) }}>Back to the Brief’s colours</button>
      )}
    </section>
  )
}

export default function FinishesPanel() {
  const store = useRoomStore()
  const colors = store.colors()

  return (
    <div className="controls">
      <section className="studio-section">
        <span className="studio-label">Selected piece</span>
        <SelectedFinish />
      </section>

      {store.brief ? <BriefFinishes /> : <>
      <Section title="Palette" summary={PALETTES.find((p) => p.id === store.palette)?.name} defaultOpen>
        <div className="palette-list">
          {PALETTES.map((p) => (
            <button key={p.id} className={`palette-row ${store.palette === p.id ? 'active' : ''}`} aria-pressed={store.palette === p.id} onClick={() => store.set('palette', p.id)}>
              <span className="palette-chips">
                {[p.wall, p.floor, p.trim, p.accent].map((c) => <span key={c} style={{ background: c }} />)}
              </span>
              <span className="palette-name">{p.name}</span>
            </button>
          ))}
        </div>
        <div className="override-grid">
          <label className="override">
            <span>Wall</span>
            <input type="color" value={store.wallOverride || colors.wall} onChange={(e) => store.set('wallOverride', e.target.value)} />
          </label>
          <label className="override">
            <span>Floor</span>
            <input type="color" value={store.floorOverride || colors.floor} onChange={(e) => store.set('floorOverride', e.target.value)} />
          </label>
        </div>
        {(store.wallOverride || store.floorOverride) && (
          <button className="link-btn" onClick={() => { store.set('wallOverride', null); store.set('floorOverride', null) }}>
            Reset to palette colors
          </button>
        )}
      </Section>

      <Section title="Walls" summary={WALL_MATERIALS.find((m) => m.id === store.wallMaterial)?.name}>
        <div className="chip-grid">
          {WALL_MATERIALS.map((m) => (
            <button key={m.id} className={`chip ${store.wallMaterial === m.id ? 'active' : ''}`} aria-pressed={store.wallMaterial === m.id} title={m.blurb} onClick={() => store.set('wallMaterial', m.id)}>
              {m.name}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Your own palette" summary="Paste hex codes">
        <PaletteImport />
      </Section>

      <Section title="Palette from a photo" summary={store.photo ? 'Photo added' : 'Optional'}>
        <PhotoImport />
      </Section>

      <Section title="Feel" summary={MOODS.find((m) => m.id === store.mood)?.name}>
        <div className="chip-grid">
          {MOODS.map((m) => (
            <button key={m.id} className={`chip ${store.mood === m.id ? 'active' : ''}`} aria-pressed={store.mood === m.id} onClick={() => store.set('mood', m.id)}>
              {m.name}
            </button>
          ))}
        </div>
      </Section>

      </>}

      <p className="studio-note studio-pad">
        Palette colours and generic surfaces are concept finishes. They are not verified retail variants.
      </p>
    </div>
  )
}
