import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getPalette, getShape, shapeBounds } from '../data/presets'

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
  // A hand-edited cell mask, when the user has painted their own footprint.
  // Null means "use the preset named by floorplan".
  customShape: null,
  customDims: null, // legacy; ceiling height override lives here as { h }
  planImage: null, // dataUrl of an uploaded floorplan, kept as a reference image
  windows: true,
  wallOverride: null,
  floorOverride: null,

  items: [], // [{ id, qty }]
  // Pieces generated from a search query rather than picked from the catalog.
  // Stored whole, since there's no catalog entry to look them up in later.
  synthetics: {}, // { [id]: item }
  placements: {}, // { [instanceKey]: { x, y, z, ry, zone } } — user-dragged only
  layoutRev: 0, // bumped to force a scene rebuild after auto-arrange

  photo: null, // { dataUrl, palette: [hex] } from an imported room photo
}

// Fields worth restoring on undo. Deliberately excludes onboarding answers and
// the photo — undo is for room edits, not for rewinding the whole session.
const TRACKED = ['items', 'placements', 'palette', 'lighting', 'floorplan', 'customShape', 'customDims', 'windows', 'wallOverride', 'floorOverride']

const snapshot = (s) => Object.fromEntries(TRACKED.map((k) => [k, s[k]]))

export const useRoomStore = create(
  persist(
    (set, get) => ({
      ...initial,

      // --- undo -----------------------------------------------------------
      // Kept out of persist(); a fresh page starts with a clean history rather
      // than offering to undo something you did yesterday.
      _past: [],

      pushHistory: () =>
        set((s) => ({ _past: [...s._past.slice(-24), snapshot(s)] })),

      undo: () =>
        set((s) => {
          if (!s._past.length) return s
          const prev = s._past[s._past.length - 1]
          return { ...prev, _past: s._past.slice(0, -1), layoutRev: s.layoutRev + 1 }
        }),

      canUndo: () => get()._past.length > 0,

      set: (key, value) => set({ [key]: value }),
      finishOnboarding: () => set({ onboarded: true }),
      restartOnboarding: () => set({ onboarded: false }),

      addItem: (id) => {
        get().pushHistory()
        set((s) => {
          const found = s.items.find((i) => i.id === id)
          if (found) return { items: s.items.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i)) }
          return { items: [...s.items, { id, qty: 1 }] }
        })
      },

      /** Add a generated piece, keeping its full definition alongside the count. */
      addSynthetic: (item) => {
        get().pushHistory()
        set((s) => {
          const found = s.items.find((i) => i.id === item.id)
          return {
            synthetics: { ...s.synthetics, [item.id]: item },
            items: found
              ? s.items.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i))
              : [...s.items, { id: item.id, qty: 1 }],
            layoutRev: s.layoutRev + 1,
          }
        })
      },

      addMany: (ids) => {
        get().pushHistory()
        set((s) => {
          const items = [...s.items]
          for (const id of ids) {
            const at = items.findIndex((i) => i.id === id)
            if (at >= 0) items[at] = { ...items[at], qty: items[at].qty + 1 }
            else items.push({ id, qty: 1 })
          }
          return { items, layoutRev: s.layoutRev + 1 }
        })
      },

      /** Remove one specific physical copy, e.g. the one selected in the 3D view. */
      removeInstance: (key) => {
        get().pushHistory()
        set((s) => {
          const [id] = key.split('#')
          const found = s.items.find((i) => i.id === id)
          if (!found) return s
          const placements = { ...s.placements }
          // Instance keys are positional, so drop the highest index and reindex.
          delete placements[`${id}#${found.qty - 1}`]
          const items =
            found.qty > 1
              ? s.items.map((i) => (i.id === id ? { ...i, qty: i.qty - 1 } : i))
              : s.items.filter((i) => i.id !== id)
          return { items, placements, layoutRev: s.layoutRev + 1 }
        })
      },

      removeItem: (id) => {
        get().pushHistory()
        set((s) => {
          const found = s.items.find((i) => i.id === id)
          if (!found) return s
          const placements = { ...s.placements }
          delete placements[`${id}#${found.qty - 1}`]
          if (found.qty > 1) {
            return { items: s.items.map((i) => (i.id === id ? { ...i, qty: i.qty - 1 } : i)), placements }
          }
          return { items: s.items.filter((i) => i.id !== id), placements }
        })
      },

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

      clearAll: () => {
        get().pushHistory()
        set((s) => ({ items: [], placements: {}, layoutRev: s.layoutRev + 1 }))
      },

      qtyOf: (id) => get().items.find((i) => i.id === id)?.qty || 0,

      // --- placement ------------------------------------------------------
      // History is pushed by the drag layer on pointer-down, not here — this
      // fires on every committed move and would otherwise flood the stack.
      setPlacement: (key, pos) =>
        set((s) => ({ placements: { ...s.placements, [key]: { ...s.placements[key], ...pos } } })),

      setPlacements: (map) => set((s) => ({ placements: map, layoutRev: s.layoutRev + 1 })),

      clearPlacements: () => {
        get().pushHistory()
        set((s) => ({ placements: {}, layoutRev: s.layoutRev + 1 }))
      },

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

      /**
       * The active room footprint: a hand-painted or exact-dimension mask if
       * there is one. Height precedence: the shape's own `h` (set when a mask
       * is generated from exact width/depth/ceiling, e.g. onboarding's size
       * step) wins first, then the separate `customDims.h` ceiling override
       * (set by the Design panel's shape editor, which doesn't touch the mask
       * itself), then the preset's height.
       */
      shape: () => {
        const custom = get().customShape
        const preset = getShape(get().floorplan)
        const fallbackH = get().customDims?.h ?? preset.h
        if (custom?.cells?.length) return { ...custom, h: custom.h ?? fallbackH }
        return { ...preset, h: fallbackH }
      },

      /** Metric bounds of the active shape, for camera framing and clamping. */
      dims: () => shapeBounds(get().shape()),

      /**
       * How full the room is: summed footprint area against floor area. Above
       * ~55% a room stops being walkable, which is when we warn.
       */
      crowding: (footprints) => {
        const shape = get().shape()
        // Area of the actual footprint, not the bounding box — an L-shaped room
        // has far less usable floor than its width times its depth.
        const area = shape.cells.length * 0.25
        const used = footprints.reduce((sum, r) => sum + Math.PI * r * r, 0)
        return area > 0 ? used / area : 0
      },

      reset: () => set({ ...initial, _past: [] }),
    }),
    {
      name: 'room-maker-v1',
      version: 2,
      // Undo history is session-only.
      partialize: (s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== '_past')),
    }
  )
)
