import { lazy, Suspense, useEffect, useState } from 'react'
import { useRoomStore } from '../../store/roomStore'
import { useUiStore } from '../../store/uiStore'
import { PILOT_PRODUCTS, FABRIC_SWATCHES } from '../../data/referencePilot'
import { viewBridge } from '../../three/viewBridge'
import Icon from '../Icons'
import ProductPreview, { ProductImage } from './ProductPreview'
import Shortcuts from '../Shortcuts'
import { autoArrange } from '../../three/layout'
import './PilotWorkspace.css'

const RoomCanvas = lazy(() => import('../RoomCanvas'))
export default function PilotWorkspace() {
  const store = useRoomStore()
  const selectedId = useUiStore(s => s.selectedItemId)
  const [inspectedId, setInspectedId] = useState('pilot-sofa')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [angle, setAngle] = useState('front')
  const [interactive, setInteractive] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [plan, setPlan] = useState(false)
  const [replace, setReplace] = useState(null)
  const [notice, setNotice] = useState('')
  const shortcutsOpen = useUiStore(s => s.shortcutsOpen)
  const products = PILOT_PRODUCTS.map(p => store.synthetics[p.id] || p)
  const item = products.find(p => p.id === inspectedId) || products[0]
  const count = store.items.find(p => p.id === item.id)?.qty || 0
  const visible = products.filter(p => (category === 'all' || p.cat === category) && `${p.name} ${p.detail}`.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    if (selectedId && PILOT_PRODUCTS.some(p => p.id === selectedId)) {
      setInspectedId(selectedId); setInspectorOpen(true)
    }
  }, [selectedId])
  useEffect(() => { setAngle('front'); setInteractive(false) }, [inspectedId])
  function select(p) {
    setInspectedId(p.id); setInspectorOpen(true); setCatalogOpen(false)
    viewBridge.api?.selectItem(p.id)
  }
  function add(p) {
    if (replace && replace !== p.id) {
      const old = store.items.find(i => i.id === replace)
      const nextQty = store.items.find(i => i.id === p.id)?.qty || 0
      if (old) {
        const placements = { ...store.placements }
        for (let n = 0; n < old.qty; n++) {
          if (placements[`${replace}#${n}`]) placements[`${p.id}#${nextQty + n}`] = { ...placements[`${replace}#${n}`] }
          delete placements[`${replace}#${n}`]
        }
        store.pushHistory()
        useRoomStore.setState({
          items: [...store.items.filter(i => i.id !== replace && i.id !== p.id), { id: p.id, qty: old.qty + nextQty }],
          placements, layoutRev: store.layoutRev + 1,
        })
        setNotice('Item replaced. Check its new footprint in Floor plan.')
      }
      setReplace(null)
    } else { store.addSynthetic(p); setNotice(`${p.name} added to your room.`) }
    select(p)
  }
  function finish(swatch) {
    store.pushHistory()
    useRoomStore.setState({ synthetics: { ...store.synthetics, [item.id]: { ...item, color: swatch.color, finish: swatch.id } }, layoutRev: store.layoutRev + 1 })
  }
  function action(name) {
    viewBridge.api?.selectItem(item.id)
    viewBridge.api?.itemAction(name)
  }
  function switchPlan(next) {
    setPlan(next)
    if (!next) viewBridge.api?.showPreset('eye')
  }
  return <div className={`pilot-workspace ${inspectorOpen ? '' : 'pilot-inspector-closed'} ${catalogOpen ? 'catalog-is-open' : ''}`}>
    <Shortcuts open={shortcutsOpen} onClose={() => useUiStore.getState().setShortcutsOpen(false)} />
    <aside className="pilot-catalog" aria-label="Pilot furniture catalog">
      <div className="pilot-catalog-heading"><h1>Furniture</h1><button className="icon-btn pilot-mobile-close" aria-label="Close catalog" onClick={() => setCatalogOpen(false)}><Icon name="close" /></button></div>
      <label className="pilot-search"><Icon name="search" size={19} /><input aria-label="Search the catalog" placeholder="Search the catalog" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <div className="pilot-tabs" role="tablist" aria-label="Furniture categories">{[['all','All'],['seating','Seating'],['tables','Tables']].map(([id, label]) => <button key={id} role="tab" aria-selected={category === id} onClick={() => setCategory(id)}>{label}</button>)}</div>
      {replace && <div className="pilot-replace-note">Choose a replacement.<button onClick={() => setReplace(null)}>Cancel</button></div>}
      <div className="pilot-product-list">
        {visible.map(p => <article key={p.id} className={`pilot-card ${item.id === p.id && inspectorOpen ? 'is-selected' : ''}`}>
          <button className="pilot-card-main" onClick={() => select(p)} aria-label={`Inspect ${p.name}`}>
            <ProductImage item={p} width={240} height={190} />
            <span><strong>{p.name}</strong><small>Demo item</small></span>
          </button>
          <button className="pilot-add" aria-label={`${replace ? 'Replace with' : 'Add'} ${p.name}`} disabled={replace === p.id} onClick={() => add(p)}><Icon name="plus" size={17} /></button>
        </article>)}
        {!visible.length && <div className="pilot-no-results">No pieces match this search.<button onClick={() => { setSearch(''); setCategory('all') }}>Show all five pieces</button></div>}
      </div>
      <div className="pilot-catalog-foot"><span>Five pieces. One considered room.</span><button onClick={() => useUiStore.getState().setPilotStudio(true)}><Icon name="room" size={16} />Open full room editor</button><small>Concept furniture · works offline</small></div>
    </aside>

    <main className="pilot-room" aria-label="Living room preview">
      <Suspense fallback={<div className="stage-loading">Building your room…</div>}><RoomCanvas pilot /></Suspense>
      <div className="pilot-room-label"><Icon name="room" size={17} /><span>Living room</span><span>·</span><span>4.5 × 3.8 m</span></div>
      <div className="pilot-edit-tools"><button aria-label="Undo" disabled={!store._past.length} onClick={store.undo}><Icon name="undo" /></button><button aria-label="Redo" disabled={!store._future.length} onClick={store.redo}><Icon name="redo" /></button></div>
      {plan && <PilotPlan products={products} items={store.items} placements={store.placements} selected={item.id} onSelect={select} />}
      <div className="pilot-view-toolbar" aria-label="Room view controls">
        <button className="pilot-catalog-toggle" onClick={() => setCatalogOpen(!catalogOpen)} aria-label="Browse furniture"><Icon name="pieces" /></button>
        <button aria-pressed={!plan} onClick={() => switchPlan(false)}><Icon name="room" size={20} />Room view</button>
        <button aria-pressed={plan} onClick={() => switchPlan(true)}><Icon name="arrange" size={18} />Floor plan</button>
        <label><Icon name={store.lighting === 'natural' ? 'light' : 'moon'} size={20} /><select aria-label="Room lighting" value={store.lighting} onChange={e => { store.pushHistory(); store.set('lighting', e.target.value) }}><option value="natural">Daylight</option><option value="warm">Evening</option></select></label>
      </div>
      {notice && <div className="pilot-notice" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><Icon name="close" size={14} /></button></div>}
      {!inspectorOpen && <button className="pilot-reopen" onClick={() => setInspectorOpen(true)}>Inspect {item.name}</button>}
    </main>

    {inspectorOpen && <aside className="pilot-inspector" aria-label="Product details">
      <div className="pilot-inspector-title"><h2>{item.name}</h2><button className="icon-btn" aria-label="Close product details" onClick={() => setInspectorOpen(false)}><Icon name="close" size={19} /></button></div>
      <p className="pilot-subtitle">Illustrative pilot product</p>
      <div className="pilot-main-product">{interactive ? <ProductPreview item={item} /> : <ProductImage item={item} angle={angle} width={720} height={510} />}</div>
      <div className="pilot-tabs" role="tablist" aria-label="Product preview mode"><button role="tab" aria-selected={!interactive} onClick={() => setInteractive(false)}>Product views</button><button role="tab" aria-selected={interactive} onClick={() => setInteractive(true)}>3D view</button>{interactive && <small>Drag to rotate</small>}</div>
      <div className="pilot-angle-strip">{['front','perspective','side','back'].map(a => <button key={a} aria-label={`${a} product view`} aria-pressed={!interactive && angle === a} onClick={() => { setAngle(a); setInteractive(false) }}><ProductImage item={item} angle={a} width={160} height={130} /></button>)}</div>
      {item.finish ? <div className="pilot-finish"><p>Finish <span>·</span> {FABRIC_SWATCHES.find(s => s.id === item.finish)?.name}</p><div>{FABRIC_SWATCHES.map(s => <button key={s.id} style={{ '--swatch': s.color }} aria-label={`${s.name} upholstery`} aria-pressed={item.finish === s.id} onClick={() => finish(s)} />)}</div></div> : <p className="pilot-fixed-finish">{item.detail}</p>}
      <div className="pilot-dimensions"><span>Dimensions</span><span>W {Math.round(item.w * 100)} / D {Math.round(item.d * 100)} / H {Math.round(item.h * 1000) / 10} cm</span></div>
      <figure className="pilot-material-detail">{item.materialImage ? <ProductImage item={item} angle="material" width={660} height={340} /> : <div className="pilot-metal-sample" />}<figcaption>{item.detail} · concept material</figcaption></figure>
      <div className="pilot-item-actions"><p>{count ? `In your room${count > 1 ? ` · ${count} copies` : ''}` : 'Ready to place'}</p><div>
        <button onClick={() => { if (count) { setReplace(item.id); setCategory(item.cat === 'seating' ? 'seating' : 'all'); setCatalogOpen(true) } else add(item) }}><Icon name={count ? 'redo' : 'plus'} />{count ? 'Replace item' : 'Add to room'}</button>
        <button className="primary" onClick={() => setInteractive(true)}><Icon name="room" />Inspect in 3D</button>
      </div>{count > 0 && <div className="pilot-secondary-actions"><button onClick={() => action('rotate')}><Icon name="rotate" size={15} />Rotate</button><button onClick={() => action('duplicate')}><Icon name="copy" size={15} />Duplicate</button><button onClick={() => action('remove')}><Icon name="trash" size={15} />Remove</button></div>}</div>
      <p className="pilot-footnote">Sample dimensions and finishes.<br />Rendered previews · not a retail listing.</p>
    </aside>}
  </div>
}

function PilotPlan({ products, items, placements, selected, onSelect }) {
  const roomStore = useRoomStore.getState()
  const entries = items.flatMap(entry => Array.from({ length: entry.qty }, (_, n) => ({ key: `${entry.id}#${n}`, item: products.find(p => p.id === entry.id) })).filter(e => e.item))
  const automatic = autoArrange(entries, { ...roomStore.dims(), shape: roomStore.shape() })
  return <div className="pilot-plan"><span className="pilot-plan-caption">Living room · placement plan</span><svg viewBox="-2.65 -2.35 5.3 4.7" role="img" aria-label="Floor plan showing furniture at its actual demo dimensions">
    <rect x="-2.25" y="-1.9" width="4.5" height="3.8" fill="#f1ece2" stroke="#c9bdab" strokeWidth=".055" />
    {[...items].sort((a,b) => Number(b.id === 'pilot-rug') - Number(a.id === 'pilot-rug')).flatMap(entry => {
      const p = products.find(p => p.id === entry.id)
      if (!p) return []
      return Array.from({ length: entry.qty }, (_, n) => {
        const at = { ...automatic[`${entry.id}#${n}`], ...placements[`${entry.id}#${n}`] }
        if (!at) return null
        return <g key={`${entry.id}#${n}`} transform={`translate(${at.x} ${at.z}) rotate(${-at.ry * 180 / Math.PI})`} role="button" tabIndex="0" aria-label={`Select ${p.name} in plan`} onClick={() => onSelect(p)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p) } }}>
          <rect x={-p.w / 2} y={-p.d / 2} width={p.w} height={p.d} rx=".04" fill={p.color} fillOpacity={entry.id === 'pilot-rug' ? .45 : 1} stroke={selected === p.id ? '#204b3f' : '#b6a990'} strokeWidth={selected === p.id ? '.035' : '.014'} />
          <text y=".03" textAnchor="middle" fontSize=".10" fill="#253c31">{p.name}</text>
        </g>
      })
    })}
    <text x="0" y="2.16" textAnchor="middle" fontSize=".13" fill="#726c61">4.50 m</text>
  </svg><p>Click a piece to inspect it. Move furniture in Room view.</p></div>
}
