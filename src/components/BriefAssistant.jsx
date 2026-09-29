import { useEffect, useState } from 'react'
import { applyProposal } from '../../shared/briefAi.mjs'

const api = window.nestedDesktop
const LABEL = (f) => f.replace(/^notes\./, 'Note: ').replace(/^surfaces\./, '').replace(/([A-Z])/g, ' $1').toLowerCase()
const show = (v) => (typeof v === 'string' && v.length > 90 ? `${v.slice(0, 90)}…` : v === '' ? '(empty)' : String(v))

/**
 * Help with filling out the Brief. It answers and proposes wording and supported
 * finishes; the designer reviews every change and applies it. It cannot change
 * measurements, openings, verification, the client review or project identity.
 */
export default function BriefAssistant({ doc, roomId, edit }) {
  const [connected, setConnected] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [answer, setAnswer] = useState(null)
  const [applied, setApplied] = useState([])
  useEffect(() => { api.aiStatus().then((r) => setConnected(r.ok && r.value.configured), () => setConnected(false)) }, [])

  async function ask() {
    if (!message.trim() || busy) return
    setBusy(true); setError(''); setAnswer(null); setApplied([])
    try {
      const r = await api.aiAssist(`${message}\n\n(The designer is currently editing room id ${roomId}.)`, doc)
      if (!r.ok) throw new Error(r.error)
      setAnswer(r.value)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const apply = (p, index) => {
    let ok = false
    edit((d) => { ok = applyProposal(d, p) })
    if (!ok) { setError('That value changed since the suggestion. Ask again for a fresh one.'); return }
    setApplied((a) => [...a, index])
  }
  const applyAll = () => answer.proposals.forEach((p, i) => { if (!applied.includes(i)) apply(p, i) })

  return (
    <aside className="brief-assistant" aria-label="Brief assistant">
      <span className="brief-eyebrow">A LITTLE HELP, ANYTIME</span>
      <h2>Your brief assistant.</h2>
      {connected === false && <p>The assistant is not connected on this computer, so it is unavailable. You can complete the Brief by hand.</p>}
      {connected && <>
        <p>Describe the room or ask what to write. It suggests wording, colours and supported finishes; you decide what to apply.</p>
        <span className="brief-badge">AI · sends this Brief’s text (no attachments, no client name) to Nested’s assistant service when you ask</span>
        <label className="brief-field"><span>Your question or idea</span><textarea aria-label="Ask the Brief assistant" rows="4" maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
        <button disabled={busy || !message.trim()} onClick={ask}>{busy ? 'Thinking…' : 'Ask'}</button>
        {error && <p className="brief-error" role="alert">{error}</p>}
        {answer && <div aria-live="polite">
          {answer.reply && <p>{answer.reply}</p>}
          {answer.proposals.map((p, i) => (
            <div key={i} className="brief-proposal">
              <strong>{p.roomName || 'Room'} · {LABEL(p.field)}</strong>
              <p>{show(p.before)} → {show(p.value)}</p>
              {p.reason && <p className="brief-caption">{p.reason}</p>}
              <button disabled={applied.includes(i)} onClick={() => apply(p, i)}>{applied.includes(i) ? 'Applied' : 'Apply'}</button>
            </div>
          ))}
          {answer.proposals.length > 1 && <button onClick={applyAll}>Apply all</button>}
          {answer.dropped > 0 && <p className="brief-caption">{answer.dropped} suggestion{answer.dropped === 1 ? ' was' : 's were'} ignored: the assistant may not change measurements, openings, verification or the review.</p>}
        </div>}
      </>}
      <p className="brief-caption">Measurements always come from your verified plan. Furniture and accessories come later. The assistant never marks anything verified.</p>
    </aside>
  )
}
