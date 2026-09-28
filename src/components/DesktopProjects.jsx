import { useEffect, useRef, useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import { createProject, ROOM_DEFAULTS } from '../../shared/project.mjs'
import './DesktopProjects.css'

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
  return <>
    <div className="desktop-projects" aria-label="Project files">
      <div className="project-details">
        <label>Project<input aria-label="Project name" value={details.name} maxLength={200} disabled={!ready || busy} onChange={e => setDetails({ ...details, name: e.target.value })} /></label>
        <label>Client<input aria-label="Client name" placeholder="Optional client name" value={details.client} maxLength={200} disabled={!ready || busy} onChange={e => setDetails({ ...details, client: e.target.value })} /></label>
      </div>
      <div className="project-buttons">
        <button disabled={!ready || busy} onClick={() => run(async () => {
          if (await unwrap(api.newProject())) {
            detailsRef.current = { name: 'Untitled project', client: '' }
            setDetails(detailsRef.current)
            useRoomStore.getState().reset()
          }
        })}>New</button>
        <button disabled={!ready || busy} onClick={() => run(async () => load(await unwrap(api.open())))}>Open…</button>
        <button disabled={!ready || busy} onClick={() => run(async () => { const r = await unwrap(api.save(document())); if (r) setStatus(`Saved ${r.path}`) })}>Save</button>
        <button disabled={!ready || busy} onClick={() => run(async () => { const r = await unwrap(api.save(document(), true)); if (r) setStatus(`Saved ${r.path}`) })}>Save as…</button>
      </div>
      <div className="project-status" role={error ? 'alert' : 'status'}>{error || status}</div>
    </div>
    {recovery && <div className="recovery-overlay"><section role="dialog" aria-modal="true" aria-labelledby="recovery-title">
      <h2 id="recovery-title">Continue your last project?</h2>
      <p>A local recovery copy is available. Restore it to continue editing, then save it as a project file.</p>
      <button autoFocus disabled={busy} onClick={() => run(async () => load(await unwrap(api.recover())))}>Restore project</button>
      <button disabled={busy} onClick={() => { setRecovery(false); setReady(true); useRoomStore.getState().reset() }}>Start a new project</button>
      {error && <p role="alert">{error}</p>}
    </section></div>}
  </>
}
