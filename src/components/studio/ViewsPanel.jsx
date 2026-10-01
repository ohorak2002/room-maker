import { useState } from 'react'
import { useRoomStore } from '../../store/roomStore'
import { useUiStore } from '../../store/uiStore'
import { viewBridge } from '../../three/viewBridge'
import { saveCurrentView } from './savedViews'
import Icon from '../Icons'

const PRESETS = [['overview', 'Overview'], ['eye', 'Eye level'], ['corner', 'Corner']]

export default function ViewsPanel() {
  const fov = useUiStore((s) => s.fov)
  const setFov = useUiStore((s) => s.setFov)
  const activeView = useUiStore((s) => s.activeView)
  const views = useRoomStore((s) => s.views)
  const roomKey = useRoomStore((s) => (s.scope === 'home' && s.focusedRoom ? s.focusedRoom : 'room'))
  const renameView = useRoomStore((s) => s.renameView)
  const removeView = useRoomStore((s) => s.removeView)
  const updateView = useRoomStore((s) => s.updateView)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const here = views.filter((v) => v.roomKey === roomKey)
  const elsewhere = views.length - here.length

  const save = () => {
    const result = saveCurrentView(name)
    if (typeof result === 'string') return setMessage(result)
    setName('')
    setMessage(`Saved “${result.name}” with this camera and field of view.`)
  }

  const update = (v) => {
    const bridge = viewBridge.api
    const camera = bridge?.captureView()
    if (!camera) return setMessage('The room is not ready yet.')
    updateView(v.id, { ...camera, thumb: bridge.thumbnail() })
    setMessage(`Updated “${v.name}” to the current camera and field of view.`)
  }

  return (
    <div className="studio-section">
      <span className="studio-label" id="view-presets">Camera</span>
      <div className="seg" role="group" aria-labelledby="view-presets">
        {PRESETS.map(([id, label]) => (
          <button key={id} className={activeView === id ? 'on' : ''} aria-pressed={activeView === id} onClick={() => viewBridge.api?.showPreset(id)}>{label}</button>
        ))}
      </div>

      <label className="studio-label studio-spread studio-space" htmlFor="view-fov">
        Field of view (vertical) <output>{Math.round(fov)}°</output>
      </label>
      <input id="view-fov" type="range" min="30" max="65" step="1" value={fov} onChange={(e) => setFov(Number(e.target.value))} />

      <div className="studio-rule" />

      <label className="studio-label" htmlFor="view-name">Save this view</label>
      <div className="studio-row">
        <input id="view-name" className="studio-input" type="text" maxLength={80} placeholder={`View ${here.length + 1}`} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
        <button className="studio-btn" onClick={save}><Icon name="bookmark" size={15} />Save</button>
      </div>
      <p className="studio-note" role="status">{message || 'Saves the camera position, direction and field of view. Views are stored in the project file.'}</p>

      <div className="studio-rule" />
      <span className="studio-label">Saved views{here.length ? ` · ${here.length}` : ''}</span>
      {here.length === 0 && <p className="studio-note">No saved views for this room yet.</p>}
      <ul className="view-list">
        {here.map((v) => (
          <li key={v.id} className={activeView === `saved:${v.id}` ? 'on' : ''}>
            <button className="view-go" onClick={() => viewBridge.api?.applyView(v)} aria-label={`Go to ${v.name}`}>
              {v.thumb ? <img src={v.thumb} alt="" width="64" height="36" /> : <span className="view-noimg" />}
            </button>
            <input className="view-name" aria-label={`Name of saved view ${v.name}`} defaultValue={v.name} maxLength={80} onBlur={(e) => e.target.value.trim() ? renameView(v.id, e.target.value) : (e.target.value = v.name)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
            <button className="icon-btn" aria-label={`Update ${v.name} to the current camera`} title="Replace this saved view with the camera as it is now" onClick={() => update(v)}><Icon name="focus" size={15} /></button>
            <button className="icon-btn" aria-label={`Delete ${v.name}`} title="Delete this saved view" onClick={() => removeView(v.id)}><Icon name="trash" size={15} /></button>
          </li>
        ))}
      </ul>
      {elsewhere > 0 && <p className="studio-note">{elsewhere} more saved in other rooms of this project.</p>}
    </div>
  )
}
