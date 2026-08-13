import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getPalette, getFloorplan } from '../data/presets'

const initial = {
  onboarded: false,

  // Where you live. Optional, free text, never leaves the browser — see the
  // note in the onboarding step. We store a building name only, never a unit.
  residence: '',
  prefurnished: [], // ids of pieces the unit already came with

  palette: 'clay',
  mood: 'cozy',
  lighting: 'natural',
  floorplan: 'bedroom',
  customDims: null, // { w, d, h } overrides the floorplan preset
  planImage: null, // dataUrl of an uploaded floorplan, kept as a reference image
  windows: true,
  temperature: 72,
  wallOverride: null,
  floorOverride: null,

  items: [], // [{ id, qty }]
  placements: {}, // { [instanceKey]: { x, y, z, ry, zone } } — user-dragged only
  layoutRev: 0, // bumped to force a scene rebuild after auto-arrange

  photo: null, // { dataUrl, palette: [hex] } from an imported room photo
}

export const useRoomStore = create(
  persist(
    (set, get) => ({
      ...initial,

      set: (key, value) => set({ [key]: value }),
      finishOnboarding: () => set({ onboarded: true }),
      restartOnboarding: () => set({ onboarded: false }),

      addItem: (id) =>
        set((s) => {
          const found = s.items.find((i) => i.id === id)
          if (found) return { items: s.items.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i)) }
          return { items: [...s.items, { id, qty: 1 }] }
        }),

      removeItem: (id) =>
        set((s) => {
          const found = s.items.find((i) => i.id === id)
          if (!found) return s
          const placements = { ...s.placements }
          delete placements[`${id}#${found.qty - 1}`]
          if (found.qty > 1) {
            return { items: s.items.map((i) => (i.id === id ? { ...i, qty: i.qty - 1 } : i)), placements }
          }
          return { items: s.items.filter((i) => i.id !== id), placements }
        }),

      /** Swap every unit of `fromId` for `toId`, e.g. taking the cheaper option. */
      swapItem: (fromId, toId) =>
        set((s) => {
          const from = s.items.find((i) => i.id === fromId)
          if (!from) return s
          const placements = { ...s.placements }
          for (const k of Object.keys(placements)) {
            if (k.startsWith(`${fromId}#`)) delete placements[k]
          }
          const existing = s.items.find((i) => i.id === toId)
          let items = s.items.filter((i) => i.id !== fromId)
          if (existing) items = items.map((i) => (i.id === toId ? { ...i, qty: i.qty + from.qty } : i))
          else items = [...items, { id: toId, qty: from.qty }]
          return { items, placements, layoutRev: s.layoutRev + 1 }
        }),

      clearAll: () => set({ items: [], placements: {}, layoutRev: get().layoutRev + 1 }),
      qtyOf: (id) => get().items.find((i) => i.id === id)?.qty || 0,

      // --- placement ------------------------------------------------------
      setPlacement: (key, pos) =>
        set((s) => ({ placements: { ...s.placements, [key]: { ...s.placements[key], ...pos } } })),

      setPlacements: (map) => set((s) => ({ placements: map, layoutRev: s.layoutRev + 1 })),

      clearPlacements: () => set((s) => ({ placements: {}, layoutRev: s.layoutRev + 1 })),

      // --- derived --------------------------------------------------------
      colors: () => {
        const p = getPalette(get().palette)
        return {
          wall: get().wallOverride || p.wall,
          floor: get().floorOverride || p.floor,
          trim: p.trim,
          accent: p.accent,
        }
      },

      dims: () => {
        const c = get().customDims
        if (c && c.w && c.d && c.h) return c
        const p = getFloorplan(get().floorplan)
        return { w: p.w, d: p.d, h: p.h }
      },

      reset: () => set({ ...initial }),
    }),
    { name: 'room-maker-v1', version: 2 }
  )
)
