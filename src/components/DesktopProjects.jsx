import { useEffect, useRef, useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import { useUiStore } from '../store/uiStore'
import { createProject, ROOM_DEFAULTS } from '../../shared/project.mjs'
import { formatUSD } from '../data/catalog'
import { exportShoppingList, projectTotals } from '../data/shoppingList'
import Icon from './Icons'
import Menu from './Menu'
import './DesktopProjects.css'

// The bar has room for a file name, not a full path; the path stays in the
// status element's title.
function shortStatus(status) {
  const done = /^(Saved|Opened) (.+)$/.exec(status)
  if (done) return `${done[1]} · ${done[2].split(/[\\/]/).pop()}`
  if (status.startsWith('Local recovery enabled')) return 'Not saved to a file yet · recovery copy on'
  return status
}

const api = window.nestedDesktop
async function unwrap(promise) {
  const result = await promise
  if (!result.ok) throw new Error(result.error)
  return result.value
}
export default function DesktopProjects() {
  const [ready, setReady] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const [details, setDetails] = useState({ name: 'Untitled project', client: '' })
  const [status, setStatus] = useState('Opening local workspace…')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const onboarded = useRoomStore((s) => s.onboarded)
  const total = useRoomStore((s) => projectTotals(s).total)
  const count = useRoomStore((s) => projectTotals(s).count)
  const panelOpen = useUiStore((s) => s.panelOpen)
  const togglePanel = useUiStore((s) => s.togglePanel)
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen)
  const detailsRef = useRef(details)
  detailsRef.current = details
  const document = () => createProject(useRoomStore.getState(), detailsRef.current)
  useEffect(() => {
    let live = true
    unwrap(api.initialize()).then(result => {
      if (!live) return
      setRecovery(result.recoveryAvailable)
      setReady(!result.recoveryAvailable)
      setError(result.recoveryError || '')
      setStatus('Local workspace')
    }).catch(err => setError(err.message))
    return () => { live = false }
  }, [])
  useEffect(() => {
    if (!ready) return
    const timer = setInterval(() => unwrap(api.status()).then(result => {
      if (result.recoveryError) setError(`Recovery failed: ${result.recoveryError}`)
    }).catch(err => setError(err.message)), 2000)
    return () => clearInterval(timer)
  }, [ready])
  useEffect(() => {
    if (!ready) return
    const stage = () => {
      try {
        unwrap(api.stage(document())).then(result => {
          if (result.recoveryError) setError(`Recovery failed: ${result.recoveryError}`)
        }).catch(err => setError(err.message))
        setStatus('Local recovery enabled • Save to create a project file')
      } catch (err) { setError(err.message) }
    }
    stage()
    return useRoomStore.subscribe(stage)
  }, [ready, details])
  const run = async fn => {
    if (busy) return
    setBusy(true); setError('')
    try { await fn() } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const load = result => {
    if (!result) return
    detailsRef.current = { name: result.doc.name, client: result.doc.client }
    setDetails(detailsRef.current)
    useRoomStore.setState({ ...structuredClone(ROOM_DEFAULTS), ...result.doc.state, _past: [] })
    setReady(true); setRecovery(false)
    setStatus(result.path ? `Opened ${result.path}` : 'Recovered project — save a project file to keep it')
  }
  const locked = !ready || busy
  const saveTo = (asNew) => run(async () => { const r = await unwrap(api.save(document(), asNew)); if (r) setStatus(`Saved ${r.path}`) })
  const newProject = () => run(async () => {
    if (await unwrap(api.newProject())) {
      detailsRef.current = { name: 'Untitled project', client: '' }
      setDetails(detailsRef.current)
      useRoomStore.getState().reset()
    }
  })
  const saved = /^(Saved|Opened) /.test(status)
  return <>
    <header className="appbar" aria-label="Project">
      <div className="appbar-brand">
        <Icon name="home" size={22} />
        <span className="appbar-wordmark">Nested</span>
      </div>
      <span className="appbar-divider" aria-hidden="true" />
      <div className="appbar-project">
        <div className="appbar-names">
          <input className="appbar-name" aria-label="Project name" value={details.name} maxLength={200} disabled={locked} onChange={e => setDetails({ ...details, name: e.target.value })} />
          <span className="appbar-for" aria-hidden="true">for</span>
          <input className="appbar-client" aria-label="Client name" placeholder="Add client" value={details.client} maxLength={200} disabled={locked} onChange={e => setDetails({ ...details, client: e.target.value })} />
        </div>
        <div className={`appbar-status ${error ? 'is-error' : saved ? 'is-saved' : ''}`} role={error ? 'alert' : 'status'} title={error || status}>
          {!error && <span className="appbar-dot" aria-hidden="true" />}
          {error || shortStatus(status)}
        </div>
      </div>
      <div className="appbar-spacer" />
      {onboarded && <>
        <span className="appbar-total">
          <strong>{count}</strong> {count === 1 ? 'piece' : 'pieces'} <span aria-hidden="true">·</span> <strong>{formatUSD(total)}</strong> est.
        </span>
        <span className="appbar-divider" aria-hidden="true" />
        <button type="button" className="icon-btn" aria-label={panelOpen ? 'Hide side panel' : 'Show side panel'} aria-pressed={panelOpen} title={panelOpen ? 'Hide side panel' : 'Show side panel'} onClick={togglePanel}><Icon name="panel" size={18} /></button>
        <button type="button" className="icon-btn" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" onClick={() => setShortcutsOpen(true)}><Icon name="help" size={18} /></button>
      </>}
      <button type="button" className="bar-btn" disabled={locked} onClick={() => run(async () => load(await unwrap(api.open())))}>Open…</button>
      <Menu
        label="More project actions"
        className="appbar-menu"
        disabled={locked}
        trigger={<Icon name="more" size={18} strokeWidth={2.4} />}
        items={[
          { label: 'New project', onSelect: newProject },
          { label: 'Save as…', onSelect: () => saveTo(true) },
          { label: 'Export shopping list', onSelect: () => exportShoppingList(useRoomStore.getState()), hidden: !onboarded },
          { label: 'Retake style quiz', onSelect: () => useRoomStore.getState().restartOnboarding(), hidden: !onboarded },
        ]}
      />
      <button type="button" className="bar-btn primary" disabled={locked} onClick={() => saveTo(false)}>Save</button>
    </header>
    {recovery && <div className="recovery-overlay"><section role="dialog" aria-modal="true" aria-labelledby="recovery-title">
      <h2 id="recovery-title">Continue your last project?</h2>
      <p>A local recovery copy is available. Restore it to continue editing, then save it as a project file.</p>
      <button autoFocus disabled={busy} onClick={() => run(async () => load(await unwrap(api.recover())))}>Restore project</button>
      <button disabled={busy} onClick={() => { setRecovery(false); setReady(true); useRoomStore.getState().reset() }}>Start a new project</button>
      {error && <p role="alert">{error}</p>}
    </section></div>}
  </>
}
