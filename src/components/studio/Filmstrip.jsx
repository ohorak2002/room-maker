import { useState } from 'react'
import { useRoomStore } from '../../store/roomStore'
import { useUiStore } from '../../store/uiStore'
import { viewBridge } from '../../three/viewBridge'
import { saveCurrentView } from './savedViews'
import Icon from '../Icons'

const PRESETS = [['overview', 'Overview'], ['eye', 'Eye level'], ['corner', 'Corner']]

/** The strip under the room: the three built-in views and this room's saved ones. */
export default function Filmstrip() {
  const activeView = useUiStore((s) => s.activeView)
  const thumbs = useUiStore((s) => s.presetThumbs)
  const views = useRoomStore((s) => s.views)
  const roomKey = useRoomStore((s) => (s.scope === 'home' && s.focusedRoom ? s.focusedRoom : 'room'))
  const [status, setStatus] = useState('')
  const here = views.filter((v) => v.roomKey === roomKey)

  const save = () => {
    const result = saveCurrentView('')
    setStatus(typeof result === 'string' ? result : `Saved “${result.name}”`)
  }

  return (
    <footer className="filmstrip" aria-label="Camera views">
      <div className="film-label">
        <strong>Views</strong>
        <small>Preset and saved cameras</small>
      </div>
      <div className="film-cameras" role="group" aria-label="Camera views">
        {PRESETS.map(([id, label]) => (
          <button key={id} className="film-cam" aria-pressed={activeView === id} onClick={() => viewBridge.api?.showPreset(id)}>
            {thumbs[id] ? <img src={thumbs[id]} alt="" width="96" height="54" /> : <span className="film-noimg" />}
            <span>{label}</span>
          </button>
        ))}
        {here.map((v) => (
          <button key={v.id} className="film-cam" aria-pressed={activeView === `saved:${v.id}`} onClick={() => viewBridge.api?.applyView(v)}>
            {v.thumb ? <img src={v.thumb} alt="" width="96" height="54" /> : <span className="film-noimg" />}
            <span>{v.name}</span>
          </button>
        ))}
        <button className="film-add" onClick={save} title="Save the current camera as a view">
          <Icon name="bookmark" size={16} />
          <span>Save view</span>
        </button>
      </div>
      <p className="film-status" role="status">{status}</p>
    </footer>
  )
}
