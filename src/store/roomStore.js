import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getPalette, getShape, shapeBounds } from '../data/presets'

const initial = {
  onboarded: false,

  // 'room'  — design one room, the original behavior
  // 'home'  — generate a whole floorplan, then focus one room at a time
  scope: 'room',
  home: null, // { beds, baths, sqft, storeys, rooms: [...], w, d, h } from generateHome()
  focusedRoom: null, // room id being edited while in home scope
  activeFloor: 0, // storey shown in the whole-home views


  // Where you live. Optional, free text, never leaves the browser — see the
  // note in the onboarding step. We store a building name only, never a unit.
  residence: '',
  prefurnished: [], // ids of pieces the unit already came with

  palette: 'clay',
  mood: 'cozy',
  lighting: 'natural',
  wallMaterial: 'plaster',
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
const TRACKED = ['items', 'placements', 'palette', 'lighting', 'floorplan', 'customShape', 'customDims', 'windows', 'wallOverride', 'floorOverride', 'home', 'scope', 'focusedRoom', 'activeFloor']

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

      /**
       * Items live in one of two places depending on scope: the top-level
       * `items` array in single-room mode, or the focused room's own `items`
       * when editing inside a generated home. Every mutation routes through
       * here so callers never have to care which.
       */
      _updateItems: (fn) =>
        set((s) => {
          if (s.scope === 'home' && s.focusedRoom && s.home) {
            return {
              home: {
                ...s.home,
                rooms: s.home.rooms.map((r) =>
                  r.id === s.focusedRoom ? { ...r, items: fn(r.items || []) } : r
                ),
              },
            }
          }
          return { items: fn(s.items) }
        }),

      /** The item list for whatever is currently being edited. */
      activeItems: () => {
        const focused = get().activeRoom()
        return focused ? focused.items || [] : get().items
      },

      addItem: (id) => {
        get().pushHistory()
        get()._updateItems((items) => {
          const found = items.find((i) => i.id === id)
          if (found) return items.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i))
          return [...items, { id, qty: 1 }]
        })
      },

      /** Add a generated piece, keeping its full definition alongside the count. */
      addSynthetic: (item) => {
        get().pushHistory()
        set((s) => ({ synthetics: { ...s.synthetics, [item.id]: item } }))
        get()._updateItems((items) => {
          const found = items.find((i) => i.id === item.id)
          if (found) return items.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i))
          return [...items, { id: item.id, qty: 1 }]
        })
        set((s) => ({ layoutRev: s.layoutRev + 1 }))
      },

      addMany: (ids) => {
        get().pushHistory()
        get()._updateItems((prev) => {
          const items = [...prev]
          for (const id of ids) {
            const at = items.findIndex((i) => i.id === id)
            if (at >= 0) items[at] = { ...items[at], qty: items[at].qty + 1 }
            else items.push({ id, qty: 1 })
          }
          return items
        })
        set((s) => ({ layoutRev: s.layoutRev + 1 }))
      },

      /** Remove one specific physical copy, e.g. the one selected in the 3D view. */
      removeInstance: (key) => {
        const [id] = key.split('#')
        get().removeItem(id)
      },

      removeItem: (id) => {
        get().pushHistory()
        const found = get().activeItems().find((i) => i.id === id)
        if (!found) return
        // Instance keys are positional, so drop the highest index.
        set((s) => {
          const placements = { ...s.placements }
          delete placements[`${id}#${found.qty - 1}`]
          return { placements, layoutRev: s.layoutRev + 1 }
        })
        get()._updateItems((items) =>
          found.qty > 1
            ? items.map((i) => (i.id === id ? { ...i, qty: i.qty - 1 } : i))
            : items.filter((i) => i.id !== id)
        )
      },

      /** Swap every unit of `fromId` for `toId`, e.g. taking the cheaper option. */
      swapItem: (fromId, toId) => {
        const from = get().activeItems().find((i) => i.id === fromId)
        if (!from) return
        set((s) => {
          const placements = { ...s.placements }
          for (const k of Object.keys(placements)) {
            if (k.startsWith(`${fromId}#`)) delete placements[k]
          }
          return { placements, layoutRev: s.layoutRev + 1 }
        })
        get()._updateItems((items) => {
          const existing = items.find((i) => i.id === toId)
          let next = items.filter((i) => i.id !== fromId)
          if (existing) next = next.map((i) => (i.id === toId ? { ...i, qty: i.qty + from.qty } : i))
          else next = [...next, { id: toId, qty: from.qty }]
          return next
        })
      },

      clearAll: () => {
        get().pushHistory()
        get()._updateItems(() => [])
        set((s) => ({ placements: {}, layoutRev: s.layoutRev + 1 }))
      },

      qtyOf: (id) => get().activeItems().find((i) => i.id === id)?.qty || 0,

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

      // --- whole-home scope -------------------------------------------------
      setHome: (home) => {
        get().pushHistory()
        set((s) => ({ home, scope: 'home', focusedRoom: null, layoutRev: s.layoutRev + 1 }))
      },

      /** Focus a room, following it to its storey so leaving lands you there. */
      focusRoom: (roomId) =>
        set((s) => {
          const room = s.home?.rooms.find((r) => r.id === roomId)
          return {
            focusedRoom: roomId,
            activeFloor: room?.floor ?? s.activeFloor,
            layoutRev: s.layoutRev + 1,
          }
        }),

      setFloor: (floor) => set((s) => ({ activeFloor: floor, layoutRev: s.layoutRev + 1 })),

      /** Rooms on the storey currently being shown. */
      floorRooms: () => {
        const s = get()
        if (!s.home) return []
        return s.home.rooms.filter((r) => (r.floor ?? 0) === s.activeFloor)
      },

      exitRoom: () => set((s) => ({ focusedRoom: null, layoutRev: s.layoutRev + 1 })),

      setScope: (scope) => set((s) => ({ scope, focusedRoom: null, layoutRev: s.layoutRev + 1 })),

      /** The room object currently being edited, or null in single-room scope. */
      activeRoom: () => {
        const s = get()
        if (s.scope !== 'home' || !s.focusedRoom || !s.home) return null
        return s.home.rooms.find((r) => r.id === s.focusedRoom) || null
      },

      /**
       * The active room footprint. In home scope with a focused room, that
       * room's own mask wins; otherwise it's the single-room shape.
       *
       * Height precedence for the single-room case: the shape's own `h` (set
       * when a mask is generated from exact width/depth/ceiling, e.g.
       * onboarding's size step) wins first, then the separate `customDims.h`
       * ceiling override (set by the Design panel's shape editor, which
       * doesn't touch the mask itself), then the preset's height.
       */
      shape: () => {
        const focused = get().activeRoom()
        if (focused) return { cols: focused.cols, rows: focused.rows, cells: focused.cells, h: focused.h }
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
       *
       * Takes areas in m², already filtered to floor-standing pieces by the
       * caller — see footprintArea() in the catalog for why a radius isn't
       * good enough for long fixtures like a bathtub or a cabinet run.
       */
      crowding: (areas) => {
        const shape = get().shape()
        // Area of the actual footprint, not the bounding box — an L-shaped room
        // has far less usable floor than its width times its depth.
        const area = shape.cells.length * 0.25
        const used = areas.reduce((sum, a) => sum + a, 0)
        return area > 0 ? used / area : 0
      },

      reset: () => set({ ...initial, _past: [] }),
    }),
    {
      name: 'room-maker-v1',
      version: 2,
      // Undo history is session-only.
      partialize: (s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== '_past')),

      /**
       * Carry an older saved room forward.
       *
       * Without this, zustand logs "State loaded from storage couldn't be
       * migrated" and *discards the save* — so anyone who used the app before a
       * version bump silently loses their room on their next visit. That is a
       * bad way to greet a returning user, and the only ones who ever see it
       * are the people who liked the app enough to come back.
       *
       * Merging over `initial` rather than returning the old state directly is
       * what makes this safe for future bumps: fields added since the save
       * arrive at their defaults instead of `undefined`.
       */
      migrate: (persisted, from) => {
        if (!persisted || typeof persisted !== 'object') return { ...initial }
        const next = { ...initial, ...persisted }
        // v1 stored a single `dims` object where v2 splits preset from custom.
        if (from < 2 && persisted.dims && !persisted.customDims) {
          next.customDims = persisted.dims
          delete next.dims
        }
        return next
      },
    }
  )
)
