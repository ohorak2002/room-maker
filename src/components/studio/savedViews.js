import { useRoomStore } from '../../store/roomStore'
import { viewBridge } from '../../three/viewBridge'
import { MAX_VIEWS } from '../../../shared/project.mjs'

const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`)

/**
 * Saves the camera as it is right now, with a preview, into the project. The
 * record is exactly what shared/project.mjs validates. Returns the view, or a
 * string explaining why nothing was saved.
 */
export function saveCurrentView(name) {
  const bridge = viewBridge.api
  const store = useRoomStore.getState()
  if (!bridge) return 'The room is not ready yet.'
  if (store.views.length >= MAX_VIEWS) return `A project keeps up to ${MAX_VIEWS} saved views. Delete one first.`
  const camera = bridge.captureView()
  if (!camera) return 'The room is not ready yet.'
  const roomKey = store.viewRoomKey()
  const inRoom = store.views.filter((v) => v.roomKey === roomKey).length
  const view = {
    id: newId(),
    name: (name || '').trim().slice(0, 80) || `View ${inRoom + 1}`,
    roomKey,
    ...camera,
    thumb: bridge.thumbnail(),
  }
  store.addView(view)
  return view
}
