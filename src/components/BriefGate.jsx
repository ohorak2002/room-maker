import { useRef, useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import { parseBrief, compileBrief, briefFingerprint } from '../../shared/brief.mjs'
import BriefEditor from './BriefEditor'
import MeasuredPlan from './MeasuredPlan'
import './DesignBrief.css'

const api = window.nestedDesktop
async function unwrap(promise) {
  const result = await promise
  if (!result.ok) throw new Error(result.error)
  return result.value
}

/**
 * The start of every new project: upload the official Brief. There is no
 * bypass into a generated default room. The file is analysed and shown for
 * review before any project state changes, and the designer confirms it.
 */
export default function BriefGate() {
  const sequence = useRef(0)
  const [editor, setEditor] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  async function upload() {
    const version = ++sequence.current
    setError(''); setAnalysis(null); setConfirmed(false); setBusy(true)
    try {
      const file = await unwrap(api.openBrief('brief'))
      if (!file || version !== sequence.current) return
      const result = parseBrief(file.text)
      const home = result.errors.length ? null : compileBrief(result.doc)
      const fingerprint = home ? await briefFingerprint(result.doc) : null
      if (version === sequence.current) setAnalysis({ ...result, home, fingerprint, name: file.name })
    } catch (e) { if (version === sequence.current) setError(e.message) } finally { if (version === sequence.current) setBusy(false) }
  }
  function create() {
    setError('')
    try { useRoomStore.getState().importOfficialBrief({ source: analysis.doc, fingerprint: analysis.fingerprint }) } catch (e) { setError(e.message) }
  }

  if (editor) return <BriefEditor initial={analysis?.errors.length === 0 ? analysis.doc : null} onClose={() => setEditor(false)} />
  return (
    <div className="brief-app">
      <main className="brief-welcome">
        <span className="brief-eyebrow">YOUR SPACE. A CLEAR START.</span>
        <h1>Upload your Brief.</h1>
        <p className="brief-lead">Bring the plan, the measurements and the vision.<br />We’ll prepare the space for you to design together.</p>
        <div className="brief-upload">
          <strong>The official Nested Design Brief</strong>
          <p>Choose the .nested-brief.json file exported by the Brief editor.</p>
          <button className="brief-primary" disabled={busy} onClick={upload}>Upload Brief…</button>
          <span>Version 1 · up to 8 MB · floorplans travel inside the brief</span>
        </div>
        <div className="brief-start-actions">
          <button onClick={() => setEditor(true)}>Create or complete the official Brief</button>
        </div>
        <p className="brief-caption">Furniture and accessories come later, in the room editor. To continue a project you already started, choose Open… in the bar above.</p>
        {busy && <p role="status">Checking the brief and preparing measured geometry…</p>}
        {error && <p className="brief-error" role="alert">{error}</p>}
        {analysis && (
          <section className="brief-analysis" aria-label="Brief analysis">
            <h2>{analysis.errors.length ? 'A few details need attention.' : 'Your measured space is ready.'}</h2>
            {analysis.errors.length ? (
              <>
                <ul className="brief-errors">{analysis.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                <p>Correct these in the official Brief editor, then export and upload again.</p>
              </>
            ) : (
              <>
                <p>{analysis.doc.project.name} · {analysis.home.rooms.length} measured room{analysis.home.rooms.length === 1 ? '' : 's'} · {analysis.doc.units === 'm' ? 'Meters' : 'Feet converted to meters'}</p>
                <MeasuredPlan home={analysis.home} />
                <div className="brief-room-review">
                  {analysis.home.rooms.map((r) => (
                    <div key={r.id}>
                      <strong>{r.name}</strong>
                      <span>{r.exactW.toFixed(3)} × {r.exactD.toFixed(3)} × {r.h.toFixed(3)} m</span>
                      <span>{r.openings.length} recorded openings · {r.surfaces.floor} floor · {r.surfaces.wall} walls</span>
                    </div>
                  ))}
                </div>
                <details>
                  <summary>Applied details and retained notes</summary>
                  <p>Exact measured footprints, positions, ceiling heights, openings, surface colors, supported finishes and lighting presets will be applied. Style, budget, practical requirements and reference notes remain available in the Brief panel.</p>
                  <ul>{analysis.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </details>
                <label className="brief-checkbox">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                  I checked the layout, measurements and supported details above.
                </label>
                <button className="brief-primary" disabled={!confirmed || busy} onClick={create}>Create the empty home</button>
              </>
            )}
          </section>
        )}
        <p className="brief-footnote">Nested validates the official format and uses verified measurements. It does not infer exact dimensions from an unmeasured image or free-form document. Automatic PDF or AI reading is not connected.</p>
      </main>
    </div>
  )
}
