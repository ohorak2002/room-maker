import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getPalette } from '../data/presets'

const initial = {
  onboarded: false,
  palette: 'clay',
  mood: 'cozy',
  lighting: 'natural',
  floorplan: 'bedroom',
  windows: true,
  temperature: 72,
  wallOverride: null,
  floorOverride: null,
  items: [], // [{ id, qty }]
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
          if (found.qty > 1) return { items: s.items.map((i) => (i.id === id ? { ...i, qty: i.qty - 1 } : i)) }
          return { items: s.items.filter((i) => i.id !== id) }
        }),

      clearItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clearAll: () => set({ items: [] }),
      qtyOf: (id) => get().items.find((i) => i.id === id)?.qty || 0,

      // Effective colors: an explicit override wins over the palette default.
      colors: () => {
        const p = getPalette(get().palette)
        return {
          wall: get().wallOverride || p.wall,
          floor: get().floorOverride || p.floor,
          trim: p.trim,
          accent: p.accent,
        }
      },

      reset: () => set({ ...initial }),
    }),
    { name: 'room-maker-v1' }
  )
)
