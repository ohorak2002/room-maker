import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '../store/uiStore'
import { applyProposal } from '../../shared/briefAi.mjs'

const api = window.nestedDesktop
const LABEL = (f) => f.replace(/^notes\./, 'Note: ').replace(/^surfaces\./, '').replace(/([A-Z])/g, ' $1').toLowerCase()
const show = (v) => (typeof v === 'string' && v.length > 220 ? `${v.slice(0, 220)}…` : v === '' ? '(empty)' : String(v))
const STARTERS = [
  'What is still missing from this Brief?',
  'Why can’t I create the room yet?',
  'Make this room’s descriptions richer and more specific.',
  'Help me describe the atmosphere for this room.',
]

/**
 * A chat just for the Brief. Type anything: ask what to write, have it fill in
 * fields, work out why the Brief will not validate, or make descriptions more
 * detailed. It proposes edits; you review each one and apply it. It cannot change
 * measurements, openings, verification, the client review or furniture.
 */
export default function BriefChat({ doc, roomId, edit }) {
  const messages = useUiStore((s) => s.briefChat)
  const setMessages = useUiStore((s) => s.setBriefChat)
  const [connected, setConnected] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const end = useRef(null)
  useEffect(() => { api.aiStatus().then((r) => setConnected(r.ok && r.value.configured), () => setConnected(false)) }, [])
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'end' }) }, [messages, busy])

  async function send(content) {
    const body = content.trim()
    if (!body || busy) return
    const next = [...messages, { role: 'user', content: body }]
    setMessages(next); setText(''); setBusy(true); setError('')
    try {
      const r = await api.aiChat(next.map(({ role, content }) => ({ role, content })), doc, roomId)
      if (!r.ok) throw new Error(r.error)
      const { reply, proposals, dropped } = r.value
      setMessages([...next, { role: 'assistant', content: reply || (proposals.length ? 'Here are some suggestions.' : 'I have nothing to change there.'), proposals, dropped, applied: [] }])
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const markApplied = (at, index) => setMessages(useUiStore.getState().briefChat.map((m, i) => (i === at ? { ...m, applied: [...m.applied, index] } : m)))
  function apply(at, index) {
    const p = messages[at].proposals[index]
    let ok = false
    edit((d) => { ok = applyProposal(d, p) })
    if (!ok) { setError('That value changed since the suggestion. Ask again for a fresh one.'); return }
    setError(''); markApplied(at, index)
  }
  const applyAll = (at) => messages[at].proposals.forEach((_, i) => { if (!useUiStore.getState().briefChat[at].applied.includes(i)) apply(at, i) })

  return (
    <aside className="brief-assistant brief-chat" aria-label="Brief chat">
      <span className="brief-eyebrow">BRIEF CHAT</span>
      <h2>Ask about your Brief.</h2>
      {connected !== true && <>
        <p className="brief-chat-off" role="status"><strong>Doesn’t work right now.</strong> The Brief chat is planned for a later version of Nested. Until then, complete the Brief by hand.</p>
        <div className="brief-chat-log" aria-hidden="true"><p className="brief-caption">Type anything, or ask what to write, fix or make richer. Suggestions will appear here for you to review.</p></div>
        <label className="brief-field"><span>Message</span><textarea aria-label="Message the Brief chat" rows="3" disabled placeholder="Coming later…" /></label>
        <div className="brief-start-actions"><button className="brief-primary" disabled>Send</button></div>
      </>}
      {connected && <>
        <span className="brief-badge">AI · when you send a message, this Brief’s text (no attachments, no client name) goes to Nested’s chat service</span>
        <div className="brief-chat-log" role="log" aria-live="polite" aria-label="Conversation">
          {!messages.length && <div>
            <p>Type anything, or start here:</p>
            {STARTERS.map((s) => <button key={s} className="brief-chip" disabled={busy} onClick={() => send(s)}>{s}</button>)}
          </div>}
          {messages.map((m, at) => (
            <div key={at} className={`brief-msg brief-msg-${m.role}`}>
              <p>{m.content}</p>
              {m.proposals?.map((p, i) => (
                <div key={i} className="brief-proposal">
                  <strong>{p.roomName || 'Room'} · {LABEL(p.field)}</strong>
                  <p><span className="brief-caption">Now:</span> {show(p.before)}</p>
                  <p><span className="brief-caption">Suggested:</span> {show(p.value)}</p>
                  {p.reason && <p className="brief-caption">{p.reason}</p>}
                  <button disabled={m.applied.includes(i)} onClick={() => apply(at, i)}>{m.applied.includes(i) ? 'Applied' : 'Apply'}</button>
                </div>
              ))}
              {m.proposals?.length > 1 && <button onClick={() => applyAll(at)}>Apply all {m.proposals.length}</button>}
              {m.dropped > 0 && <p className="brief-caption">{m.dropped} suggestion{m.dropped === 1 ? ' was' : 's were'} ignored: the chat may not change measurements, openings, verification or the review.</p>}
            </div>
          ))}
          {busy && <p className="brief-caption" role="status">Thinking…</p>}
          <div ref={end} />
        </div>
        {error && <p className="brief-error" role="alert">{error}</p>}
        <label className="brief-field"><span>Message</span>
          <textarea aria-label="Message the Brief chat" rows="3" maxLength={4000} value={text} placeholder="Ask anything about this Brief…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text) } }} />
        </label>
        <div className="brief-start-actions">
          <button className="brief-primary" disabled={busy || !text.trim()} onClick={() => send(text)}>Send</button>
          {messages.length > 0 && <button disabled={busy} onClick={() => { setMessages([]); setError('') }}>Clear chat</button>}
        </div>
      </>}
      <p className="brief-caption">Measurements always come from your verified plan. Furniture comes later. The chat never marks anything verified, and nothing changes until you press Apply.</p>
    </aside>
  )
}
