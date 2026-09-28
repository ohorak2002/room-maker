import { useEffect, useState } from 'react'
import { useRoomStore, assetItemId } from '../store/roomStore'
import { createAssetRecord, placedDimensions, compareDimensions, unitHint, UNIT_SCALES, ROTATIONS } from '../../shared/assets.mjs'
import { subscribeAssetStatus, assetStatus } from '../three/assetLoader'
import './ModelsPanel.css'

const api = window.nestedDesktop
const cm = (m) => (m * 100).toFixed(1)
const UNIT_LABELS = { m: 'Metres (glTF)', cm: 'Centimetres', mm: 'Millimetres', in: 'Inches' }
const FACING = { 0: 'As authored', 90: 'Turn 90°', 180: 'Turn 180°', 270: 'Turn 270°' }

async function unwrap(promise) {
  const result = await promise
  if (!result.ok) throw new Error(result.error)
  return result.value
}

/**
 * Private GLB models: imported on this computer, placed with their own
 * materials and textures, never recoloured. Provenance and product dimensions
 * are the designer's to record; empty means unknown.
 */
export default function ModelsPanel() {
  const assets = useRoomStore((s) => s.assets)
  const addAsset = useRoomStore((s) => s.addAsset)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState({})
  const [, setTick] = useState(0)

  useEffect(() => subscribeAssetStatus(() => setTick((t) => t + 1)), [])
  useEffect(() => {
    const ids = Object.keys(assets)
    if (!api || !ids.length) return
    let live = true
    unwrap(api.assetStatus(ids)).then((r) => live && setFiles(r)).catch((err) => setMessage(err.message))
    return () => { live = false }
  }, [assets])

  if (!api) {
    return <div className="models"><section className="models-section"><h3>Your models</h3>
      <p className="models-note">Importing private GLB models needs the Nested desktop app, which keeps them on this computer.</p>
    </section></div>
  }

  const importModel = async () => {
    setBusy(true); setMessage('')
    try {
      const result = await unwrap(api.importAsset())
      if (!result) return
      if (assets[result.id]) { setMessage(`${result.fileName} is already in this project.`); return }
      const record = createAssetRecord(result)
      addAsset(record)
      setFiles((f) => ({ ...f, [record.id]: true }))
      const hint = unitHint(record.size)
      setMessage(`Imported ${result.fileName}.${hint ? ` ${hint}` : ''}`)
    } catch (err) { setMessage(err.message) } finally { setBusy(false) }
  }

  const list = Object.values(assets)
  return (
    <div className="models">
      <section className="models-section">
        <h3>Your models</h3>
        <p className="models-note">
          Import a self-contained .glb file. Its textures, separate materials and finishes are kept exactly as authored,
          and the file stays private on this computer.
        </p>
        <button className="btn-primary" disabled={busy} onClick={importModel}>Import GLB model…</button>
        {message && <p className="models-message" role="status">{message}</p>}
      </section>
      {list.map((record) => <AssetCard key={record.id} record={record} fileState={files[record.id]} />)}
    </div>
  )
}

function AssetCard({ record, fileState }) {
  const updateAsset = useRoomStore((s) => s.updateAsset)
  const placeAsset = useRoomStore((s) => s.placeAsset)
  const qty = useRoomStore((s) => s.activeItems().find((i) => i.id === assetItemId(record.id))?.qty || 0)
  const runtime = assetStatus(record.id)
  const placed = placedDimensions(record.size, record.units, record.rotateY)
  const check = compareDimensions(placed, record.spec)
  const missing = fileState === false || runtime?.state === 'missing'

  const setSpec = (axis, value) => {
    const n = value.trim() === '' ? null : Number(value) / 100
    if (n !== null && !(Number.isFinite(n) && n > 0)) return
    const spec = { w: null, d: null, h: null, ...(record.spec || {}), [axis]: n }
    updateAsset(record.id, { spec: Object.values(spec).every((v) => v === null) ? null : spec })
  }
  const setText = (key, value) => {
    const provenance = { ...record.provenance, [key]: value.trim().slice(0, 500) }
    if (provenance[key] !== record.provenance[key]) updateAsset(record.id, { provenance })
  }

  return (
    <section className="models-section asset-card" aria-label={`Model ${record.name}`}>
      <div className="asset-head">
        <strong className="asset-name">{record.name}</strong>
        <span className="asset-tag">Private · unverified</span>
      </div>
      <p className="asset-file">{record.fileName} · {(record.bytes / 1024).toFixed(0)} KB</p>

      {missing ? (
        <p className="asset-warning" role="alert">Model file is missing on this computer. Import {record.fileName} again to restore it; the placeholder keeps its size.</p>
      ) : runtime?.state === 'loaded' ? (
        <p className="asset-runtime" data-asset-loaded={record.id}>
          Loaded: {runtime.stats.materials} materials · {runtime.stats.textures} textures
          {runtime.stats.transmissive > 0 && ` · ${runtime.stats.transmissive} transmissive`} · {runtime.stats.meshes} parts
        </p>
      ) : runtime?.state === 'error' ? (
        <p className="asset-warning" role="alert">Could not load: {runtime.message}</p>
      ) : (
        <p className="asset-runtime">In file: {record.stats.materials} materials · {record.stats.textures} textures · {record.stats.meshes} meshes</p>
      )}

      <p className="asset-size">Placed size: W {cm(placed.w)} × D {cm(placed.d)} × H {cm(placed.h)} cm</p>

      <div className="asset-grid">
        <label>Authored units
          <select value={record.units} onChange={(e) => updateAsset(record.id, { units: e.target.value })}>
            {Object.keys(UNIT_SCALES).map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
          </select>
        </label>
        <label>Facing
          <select value={record.rotateY} onChange={(e) => updateAsset(record.id, { rotateY: Number(e.target.value) })}>
            {ROTATIONS.map((r) => <option key={r} value={r}>{FACING[r]}</option>)}
          </select>
        </label>
      </div>

      <fieldset className="asset-spec">
        <legend>Product dimensions (cm, optional)</legend>
        {['w', 'd', 'h'].map((axis) => (
          <label key={axis}>{axis.toUpperCase()}
            <input
              key={`${axis}-${record.spec?.[axis] ?? ''}`}
              type="number" min="0" step="0.1" inputMode="decimal"
              aria-label={`Product ${{ w: 'width', d: 'depth', h: 'height' }[axis]} in centimetres`}
              defaultValue={record.spec?.[axis] != null ? cm(record.spec[axis]) : ''}
              onBlur={(e) => setSpec(axis, e.target.value)}
            />
          </label>
        ))}
      </fieldset>
      {check && (
        <p className={check.within ? 'asset-match' : 'asset-warning'}>
          {check.within
            ? 'Model matches the entered dimensions within 1 cm. Overall size only; details are not verified.'
            : `Differs from the entered dimensions: ${Object.entries(check.axes).filter(([, a]) => a && !a.within).map(([k, a]) => `${k.toUpperCase()} ${a.diff > 0 ? '+' : ''}${cm(a.diff)} cm`).join(', ')}`}
        </p>
      )}

      <label className="asset-field">Source
        <input key={`s-${record.provenance.source}`} defaultValue={record.provenance.source} placeholder="Unknown — where the file came from" maxLength={500} onBlur={(e) => setText('source', e.target.value)} />
      </label>
      <label className="asset-field">Usage rights
        <input key={`r-${record.provenance.rights}`} defaultValue={record.provenance.rights} placeholder="Unknown — licence or permission" maxLength={500} onBlur={(e) => setText('rights', e.target.value)} />
      </label>

      <button className="btn-quiet asset-place" onClick={() => placeAsset(record.id)}>
        Place in room{qty > 0 ? ` (${qty} placed)` : ''}
      </button>
    </section>
  )
}
