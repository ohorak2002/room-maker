import { useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import { validateBrief, compileBrief, briefFingerprint } from '../../shared/brief.mjs'
import BriefEditor from './BriefEditor'
import MeasuredPlan from './MeasuredPlan'
import './DesignBrief.css'

/**
 * The start of every new project. The Brief is written inside Nested, in the
 * editor, and saved with the project. When it is complete the designer reviews
 * the measured space and confirms; only then is the (empty) home created.
 */
export default function BriefGate() {
  const draft = useRoomStore((s) => s.briefDraft)
  const startBrief = useRoomStore((s) => s.startBrief)
  const setBriefDraft = useRoomStore((s) => s.setBriefDraft)
  const [reviewing, setReviewing] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')

  async function review() {
    setError('')
    try {
      const { errors, warnings } = validateBrief(draft)
      if (errors.length) throw new Error(errors[0])
      setConfirmed(false)
      setReviewing({ doc: draft, warnings, home: compileBrief(draft), fingerprint: await briefFingerprint(draft) })
    } catch (e) { setError(e.message) }
  }
  function create() {
    setError('')
    try { useRoomStore.getState().importOfficialBrief({ source: reviewing.doc, fingerprint: reviewing.fingerprint }) } catch (e) { setError(e.message) }
  }

  if (!draft) {
    return (
      <div className="brief-app">
        <main className="brief-welcome">
          <span className="brief-eyebrow">YOUR SPACE. A CLEAR START.</span>
          <h1>Start with a Brief.</h1>
          <p className="brief-lead">Capture the plan, the measurements and the vision.<br />We’ll prepare the space for you to design together.</p>
          <div className="brief-start-actions">
            <button className="brief-primary" onClick={startBrief}>Start a new brief</button>
          </div>
          <p className="brief-caption">Everything happens here in Nested. Furniture and accessories come later, in the room editor. To continue a project you already started, choose Open… in the bar above.</p>
          <p className="brief-footnote">Nested uses only the measurements you verify. It does not infer exact dimensions from an image or document.</p>
        </main>
      </div>
    )
  }
  if (!reviewing) {
    return <>
      <BriefEditor onReview={review} onDiscard={() => setBriefDraft(null)} />
      {error && <p className="brief-error" role="alert">{error}</p>}
    </>
  }
  const { doc, home, warnings } = reviewing
  return (
    <div className="brief-app">
      <main className="brief-welcome">
        <section className="brief-analysis" aria-label="Brief review">
          <h2>Your measured space is ready.</h2>
          <p>{doc.project.name} · {home.rooms.length} measured room{home.rooms.length === 1 ? '' : 's'} · {doc.units === 'm' ? 'Meters' : 'Feet converted to meters'}</p>
          <MeasuredPlan home={home} />
          <div className="brief-room-review">
            {home.rooms.map((r) => (
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
            <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </details>
          <label className="brief-checkbox">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            I checked the layout, measurements and supported details above.
          </label>
          <div className="brief-start-actions">
            <button onClick={() => setReviewing(null)}>Back to the Brief</button>
            <button className="brief-primary" disabled={!confirmed} onClick={create}>Create the empty home</button>
          </div>
          {error && <p className="brief-error" role="alert">{error}</p>}
        </section>
      </main>
    </div>
  )
}
