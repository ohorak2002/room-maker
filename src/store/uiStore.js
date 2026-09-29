import { create } from 'zustand'

// Window-level interface state shared by the app bar and the workspace. Kept
// out of roomStore on purpose: none of it belongs in a saved project.
export const useUiStore = create((set) => ({
  panelOpen: true,
  shortcutsOpen: false,
  // Catalog id of the piece selected in the room, so its Shop card can show it.
  selectedItemId: null,
  setSelectedItemId: (selectedItemId) => set({ selectedItemId }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
}))
