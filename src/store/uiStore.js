import { create } from 'zustand'

// Window-level interface state shared by the app bar, the rail, the inspector,
// the filmstrip and the room. Kept out of roomStore on purpose: none of it
// belongs in a saved project (saved views and lighting live in roomStore).
export const useUiStore = create((set) => ({
  // Ephemeral work belongs to one open project, including pending Brief replies.
  projectSession: 0,
  resetProjectUi: () => set(s => ({ projectSession: s.projectSession + 1,
    briefChat: [], activePanel: 'pieces', selectedItemId: null, activeView: 'eye', fov: 52,
    presetThumbs: {}, presenting: false, shortcutsOpen: false })),
  // Export image size: 'view' (view's own aspect, 2560 px long edge) or an exact 'WxH'.
  exportSize: 'view',
  setExportSize: (exportSize) => set({ exportSize }),
  panelOpen: true,
  // Which inspector panel the rail shows: room | pieces | finishes | light | views.
  activePanel: 'pieces',
  shortcutsOpen: false,
  // Presentation mode: only the room, plus an exit control.
  presenting: false,
  // Camera: field of view in degrees, and which view is current
  // ('overview' | 'eye' | 'corner' | 'saved:<id>').
  fov: 52,
  activeView: 'eye',
  // Small previews of the three built-in views for the filmstrip; regenerated
  // from the live scene, never saved.
  presetThumbs: {},
  // The room's own sun height in degrees, shown by the Light panel when no
  // override is set.
  sunDefault: 27,
  // Catalog id of the piece selected in the room, so its Shop card can show it.
  selectedItemId: null,
  setSelectedItemId: (selectedItemId) => set({ selectedItemId }),
  // Bumped to ask the project bar to start a new project (which asks about
  // unsaved changes first) and so return to Upload Brief.
  // The Brief chat's conversation: this session only, never saved in a project.
  briefChat: [],
  setBriefChat: (briefChat) => set({ briefChat }),
  newProjectRequests: 0,
  requestNewProject: () => set((s) => ({ newProjectRequests: s.newProjectRequests + 1 })),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  /** Show a panel; choosing the one already showing collapses the inspector. */
  choosePanel: (id) =>
    set((s) => (s.panelOpen && s.activePanel === id ? { panelOpen: false } : { activePanel: id, panelOpen: true })),
  openPanel: (id) => set({ activePanel: id, panelOpen: true }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setPresenting: (presenting) => set({ presenting }),
  setFov: (fov) => set({ fov }),
  setActiveView: (activeView) => set({ activeView }),
  setPresetThumbs: (presetThumbs) => set({ presetThumbs }),
  setSunDefault: (sunDefault) => set({ sunDefault }),
}))
