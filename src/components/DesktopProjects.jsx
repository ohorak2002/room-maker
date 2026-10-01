import { useEffect, useRef, useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import { useUiStore } from '../store/uiStore'
import { createProject, projectIdentity, ROOM_DEFAULTS } from '../../shared/project.mjs'
import { formatUSD } from '../data/catalog'
import { exportShoppingList, projectTotals } from '../data/shoppingList'
import Icon from './Icons'
import Menu from './Menu'
import './DesktopProjects.css'
import { viewBridge } from '../three/viewBridge'

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
  const [persistence, setPersistence] = useState(null)
  const busyRef = useRef(false)
  const replacing = useRef(false)
  const lastStaged = useRef(null)
  const statusRequest = useRef(0)
  const onboarded = useRoomStore((s) => s.onboarded)
  const pilotProject = useRoomStore((s) => s.customShape?.pilot === true)
  const pilotStudio = useUiStore((s) => s.pilotStudio)
  const pilot = pilotProject && !pilotStudio
  const [exporting, setExporting] = useState(false)
  useEffect(() => {
    if (pilotProject && detailsRef.current.name === 'Untitled project') setDetails(d => ({ ...d, name: 'My living room' }))
  }, [pilotProject])
  const total = useRoomStore((s) => projectTotals(s).total)
  const count = useRoomStore((s) => projectTotals(s).count)
  const panelOpen = useUiStore((s) => s.panelOpen)
  const togglePanel = useUiStore((s) => s.togglePanel)
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen)
  const detailsRef = useRef(details)
  detailsRef.current = details
  const document = () => createProject(useRoomStore.getState(), detailsRef.current)
  const acceptStatus = result => {
    setPersistence(result)
    if (result.recoveryError) setError(`Recovery failed: ${result.recoveryError}`)
    setStatus(result.path
      ? `${result.dirty ? 'Unsaved changes' : 'Saved'} · ${result.path.split(/[\\/]/).pop()}`
      : result.recovered ? 'Recovered project · Save to keep a project file' : 'Not saved to a file yet · local recovery enabled')
  }
  const updateStatus = async promise => {
    const request = ++statusRequest.current
    const result = await unwrap(promise)
    if (request === statusRequest.current && result) acceptStatus(result)
    return result
  }
  useEffect(() => {
    let live = true
    unwrap(api.initialize()).then(result => {
      if (!live) return
      setRecovery(result.recoveryAvailable)
      setReady(!result.recoveryAvailable)
      setError(result.recoveryError || '')
      acceptStatus(result)
    }).catch(err => setError(err.message))
    return () => { live = false }
  }, [])
  useEffect(() => {
    if (!ready) return
    const timer = setInterval(() => updateStatus(api.status()).catch(err => setError(err.message)), 2000)
    return () => clearInterval(timer)
  }, [ready])
  useEffect(() => {
    if (!ready) return
    const stage = () => {
      if (replacing.current) return
      try {
        const doc = document()
        const identity = projectIdentity(doc)
        if (identity === lastStaged.current) return
        lastStaged.current = identity
        updateStatus(api.stage(doc)).catch(err => { lastStaged.current = null; setError(err.message) })
      } catch (err) { setError(err.message) }
    }
    stage()
    return useRoomStore.subscribe(stage)
  }, [ready, details])
  const run = async fn => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true); setError('')
    try {
      // Flush the latest input before native replacement decisions.
      if (ready) await updateStatus(api.stage(document()))
      await fn()
    } catch (err) { setError(err.message) } finally {
      busyRef.current = false; setBusy(false)
    }
  }
  const load = result => {
    if (!result) return
    detailsRef.current = { name: result.doc.name, client: result.doc.client }
    replacing.current = true
    useUiStore.getState().resetProjectUi()
    setDetails(detailsRef.current)
    useRoomStore.setState({ ...structuredClone(ROOM_DEFAULTS), ...result.doc.state, _past: [], _future: [] })
    replacing.current = false
    lastStaged.current = null
    setReady(true); setRecovery(false)
    acceptStatus(result)
  }
  const locked = !ready || busy
  const saveTo = (asNew) => run(async () => {
    await unwrap(api.save(document(), asNew))
    // Read after the write; edits made during a dialog/write remain dirty.
    await updateStatus(api.status())
  })
  const newProject = () => run(async () => {
    if (await unwrap(api.newProject())) {
      detailsRef.current = { name: 'Untitled project', client: '' }
      replacing.current = true
      useUiStore.getState().resetProjectUi()
      setDetails(detailsRef.current)
      useRoomStore.getState().reset()
      replacing.current = false
      lastStaged.current = null
      await updateStatus(api.stage(document()))
    }
  })
  // "Upload another Brief" elsewhere in the app asks for the same thing as New
  // project: confirm unsaved changes, then return to Upload Brief.
  const newRequests = useUiStore((s) => s.newProjectRequests)
  const newRequestSeen = useRef(newRequests)
  useEffect(() => {
    if (newRequests === newRequestSeen.current) return
    newRequestSeen.current = newRequests
    newProject()
  })
  const saved = Boolean(persistence?.path && !persistence.dirty)
  const statusTitle = [status, persistence?.path, persistence?.savedAt && `Last file save: ${new Date(persistence.savedAt).toLocaleString()}`, persistence?.recoverySavedAt ? `Local recovery updated: ${new Date(persistence.recoverySavedAt).toLocaleString()}` : 'Local recovery pending'].filter(Boolean).join('\n')
  return <>
    <header className="appbar" aria-label="Project">
      <div className="appbar-brand">
        {!pilot && <Icon name="home" size={22} />}
        <span className="appbar-wordmark">{pilot ? 'nested' : 'Nested'}</span>
      </div>
      <span className="appbar-divider" aria-hidden="true" />
      <div className="appbar-project">
        <div className="appbar-names">
          <input className="appbar-name" aria-label="Project name" value={details.name} maxLength={200} disabled={locked} onChange={e => setDetails({ ...details, name: e.target.value })} />
          <span className="appbar-for" aria-hidden="true">for</span>
          <input className="appbar-client" aria-label="Client name" placeholder="Add client" value={details.client} maxLength={200} disabled={locked} onChange={e => setDetails({ ...details, client: e.target.value })} />
        </div>
        <div className={`appbar-status ${error ? 'is-error' : saved ? 'is-saved' : ''}`} role={error ? 'alert' : 'status'} title={error || statusTitle}>
          {!error && <span className="appbar-dot" aria-hidden="true" />}
          {error || status}
        </div>
      </div>
      <div className="appbar-spacer" />
      {pilot && <span className="pilot-header-caption">Pilot concept</span>}
      {pilotProject && pilotStudio && <button className="bar-btn" onClick={() => useUiStore.getState().setPilotStudio(false)}>Back to pilot</button>}
      {onboarded && !pilot && <>
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
        ]}
      />
      <button type="button" className="bar-btn primary" disabled={locked} onClick={() => saveTo(false)}>Save</button>
      {pilot && <button type="button" className="pilot-render-button" disabled={locked || exporting} onClick={async () => {
        setExporting(true)
        try { await viewBridge.api?.exportImage() } finally { setExporting(false) }
      }} title="Save a high-resolution PNG of the current 3D view"><Icon name="camera" size={16} />{exporting ? 'Preparing image…' : 'Create realistic image'}</button>}
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
