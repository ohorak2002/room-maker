/**
 * How the panels and the filmstrip talk to the room's camera. RoomCanvas owns
 * the renderer and registers its operations here while mounted; everything else
 * calls them. Kept outside React state on purpose: a camera move is not a
 * render, and a saved view must capture the camera as it is this instant.
 *
 *   showPreset(name)   'overview' | 'eye' | 'corner'
 *   applyView(view)    a saved view: { mode, position, target, fov }
 *   captureView()      the current camera as a saved-view record (no name/id)
 *   thumbnail()        a small JPEG data URL of what the camera sees now
 *   refreshPresetThumbs()
 */
export const viewBridge = { api: null }
export const withBridge = (fn, fallback = null) => (viewBridge.api ? fn(viewBridge.api) : fallback)
