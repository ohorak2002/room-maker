import { create } from 'zustand'
import { getPalette, getShape, shapeBounds } from '../data/presets'
import { shapeArea } from '../three/shapeGeom'
import { compileBrief, newBrief } from '../../shared/brief.mjs'

import { ROOM_DEFAULTS, MAX_VIEWS } from '../../shared/project.mjs'
import { placedDimensions } from '../../shared/assets.mjs'

const initial = ROOM_DEFAULTS

// Fields worth restoring on undo. Deliberately excludes onboarding answers and
// the photo — undo is for room edits, not for rewinding the whole session.
const TRACKED = ['items', 'placements', 'palette', 'lighting', 'floorplan', 'customShape', 'customDims', 'windows', 'wallOverride', 'floorOverride', 'home', 'scope', 'focusedRoom', 'activeFloor', 'assets', 'synthetics']

const snapshot = (s) => Object.fromEntries(TRACKED.map((k) => [k, s[k]]))

export const assetItemId = (assetId) => `asset-${assetId.slice(0, 16)}`

/** The placeable piece for an imported model. Price and retailer are unknown. */
export function assetItem(record) {
  const { w, d, h } = placedDimensions(record.size, record.units, record.rotateY)
  return {
    id: assetItemId(record.id),
    assetId: record.id,
    name: record.name,
    model: 'asset',
    cat: 'imported',
    h,
    fp: Math.max(w, d) / 2,
    area: w * d,
    price: null,
    retailerName: 'Private model',
  }
}

// Projects are saved as .nested files and a local recovery copy by the desktop
// shell (DesktopProjects); the store itself keeps nothing in browser storage.
export const useRoomStore = create(
  (set, get) => ({
    ...initial,

    // --- undo -----------------------------------------------------------
    // Session-only: a reopened project starts with a clean history rather
    // than offering to undo something you did yesterday.
    _past: [],
    // Undone states, newest last. A new edit (pushHistory) discards them.
    _future: [],

    pushHistory: () =>
      set((s) => ({ _past: [...s._past.slice(-24), snapshot(s)], _future: [] })),

    undo: () =>
      set((s) => {
        if (!s._past.length) return s
        const prev = s._past[s._past.length - 1]
        return { ...prev, _past: s._past.slice(0, -1), _future: [...s._future.slice(-24), snapshot(s)], layoutRev: s.layoutRev + 1 }
      }),

    redo: () =>
      set((s) => {
        if (!s._future.length) return s
        const next = s._future[s._future.length - 1]
        return { ...next, _future: s._future.slice(0, -1), _past: [...s._past.slice(-24), snapshot(s)], layoutRev: s.layoutRev + 1 }
      }),

    canUndo: () => get()._past.length > 0,
    canRedo: () => get()._future.length > 0,

    set: (key, value) => set({ [key]: value }),
    /**
     * Go straight to an ordinary room without a Brief (for trying things out).
     * The room is the app's approximate half-metre one, not measured.
     */
    skipBrief: () => set({ onboarded: true, briefDraft: null, floorplan: 'living' }),

    /** Begin writing a Brief in the app. */
    startBrief: () => set({ briefDraft: newBrief() }),
    setBriefDraft: (briefDraft) => set({ briefDraft }),

    /**
     * Build the empty measured home from an official Brief that the Upload gate
     * has already validated and the designer has confirmed. Everything else in
     * the live project is replaced; the caller starts from a new project.
     */
    // (Named for the schema it produces: the official Brief document.)
    importOfficialBrief: ({ source, fingerprint }) => {
      const home = compileBrief(source)
      const first = home.rooms[0]
      set({
        ...structuredClone(initial),
        home, scope: 'home',
        focusedRoom: home.rooms.length === 1 ? first.id : null,
        activeFloor: Math.min(...home.rooms.map((r) => r.floor)),
        lighting: first.lighting,
        onboarded: true,
        brief: { fingerprint, source },
        layoutRev: get().layoutRev + 1,
        _past: [],
        _future: [],
      })
    },

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
        delete placements[get().placementKey(`${id}#${found.qty - 1}`)]
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
          if (k.startsWith(get().placementKey(`${fromId}#`))) delete placements[k]
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

    // --- private imported models ------------------------------------------
    // The record holds provenance and the authored units/orientation; the
    // placeable piece is a synthetic item pointing at it by checksum.
    addAsset: (record) => {
      get().pushHistory()
      set((s) => ({ assets: { ...s.assets, [record.id]: record } }))
    },

    updateAsset: (id, patch) => {
      const current = get().assets[id]
      if (!current) return
      get().pushHistory()
      const record = { ...current, ...patch }
      const itemId = assetItemId(id)
      set((s) => ({
        assets: { ...s.assets, [id]: record },
        synthetics: s.synthetics[itemId]
          ? { ...s.synthetics, [itemId]: assetItem(record) }
          : s.synthetics,
        layoutRev: s.layoutRev + 1,
      }))
    },

    /** Placed copies of an imported model in every room of the project. */
    assetPlacedCount: (id) => {
      const itemId = assetItemId(id)
      const s = get()
      const count = (items) => (items || []).reduce((n, i) => n + (i.id === itemId ? i.qty : 0), 0)
      return count(s.items) + (s.home?.rooms || []).reduce((n, r) => n + count(r.items), 0)
    },

    /**
     * Forget an imported model in this project. Refused while any copy is still
     * placed (in any room), so no placement is ever orphaned. The file stays in
     * the private library, where other projects may use it.
     */
    removeAsset: (id) => {
      if (!get().assets[id] || get().assetPlacedCount(id) > 0) return false
      get().pushHistory()
      const itemId = assetItemId(id)
      set((s) => {
        const { [id]: _a, ...assets } = s.assets
        const { [itemId]: _s, ...synthetics } = s.synthetics
        return { assets, synthetics, layoutRev: s.layoutRev + 1 }
      })
      return true
    },

    placeAsset: (id) => {
      const record = get().assets[id]
      if (record) get().addSynthetic(assetItem(record))
    },

    // --- room studio: lighting controls and saved camera views ---------------
    setStudio: (patch) => set((s) => ({ studio: { ...s.studio, ...patch } })),

    /** Saved views belong to a room: coordinates only make sense inside it. */
    viewRoomKey: () => (get().scope === 'home' && get().focusedRoom ? get().focusedRoom : 'room'),

    addView: (view) => {
      if (get().views.length >= MAX_VIEWS) return false
      set((s) => ({ views: [...s.views, view] }))
      return true
    },
    renameView: (id, name) =>
      set((s) => ({ views: s.views.map((v) => (v.id === id ? { ...v, name: name.trim().slice(0, 80) || v.name } : v)) })),
    /** Re-record a saved view from the camera as it is now (keeps its id and name). */
    updateView: (id, camera) =>
      set((s) => ({ views: s.views.map((v) => (v.id === id ? { ...v, ...camera } : v)) })),
    removeView: (id) => set((s) => ({ views: s.views.filter((v) => v.id !== id) })),

    clearAll: () => {
      get().pushHistory()
      get()._updateItems(() => [])
      get().setPlacements({})
    },

    qtyOf: (id) => get().activeItems().find((i) => i.id === id)?.qty || 0,

    // --- placement ------------------------------------------------------
    // History is pushed by the drag layer on pointer-down, not here — this
    // fires on every committed move and would otherwise flood the stack.
    // Rooms measured from a Brief each keep their own placements: the same
    // catalog item in two rooms must not share a position, so keys are
    // namespaced by room ("<roomId>:<piece>#<n>"). Callers keep using the plain
    // "<piece>#<n>" key; the store scopes it.
    placementKey: (key) => (get().home?.measured && get().focusedRoom ? `${get().focusedRoom}:${key}` : key),

    /** Placements of whatever is being edited, under their plain keys. */
    activePlacements: () => {
      const s = get()
      if (!s.home?.measured || !s.focusedRoom) return s.placements
      const prefix = `${s.focusedRoom}:`
      return Object.fromEntries(Object.entries(s.placements).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k.slice(prefix.length), v]))
    },

    setPlacement: (key, pos) => {
      const scoped = get().placementKey(key)
      set((s) => ({ placements: { ...s.placements, [scoped]: { ...s.placements[scoped], ...pos } } }))
    },

    setPlacements: (map) =>
      set((s) => {
        if (!s.home?.measured || !s.focusedRoom) return { placements: map, layoutRev: s.layoutRev + 1 }
        const prefix = `${s.focusedRoom}:`
        const others = Object.fromEntries(Object.entries(s.placements).filter(([k]) => !k.startsWith(prefix)))
        const mine = Object.fromEntries(Object.entries(map).map(([k, v]) => [prefix + k, v]))
        return { placements: { ...others, ...mine }, layoutRev: s.layoutRev + 1 }
      }),

    clearPlacements: () => {
      get().pushHistory()
      get().setPlacements({})
    },

    // --- derived --------------------------------------------------------
    colors: () => {
      const p = getPalette(get().palette)
      // A Brief's own colours are the room's finishes; the palette only applies
      // to rooms without one. The designer's overrides still win.
      const measured = get().activeRoom()?.surfaces
      if (measured) {
        return { wall: get().wallOverride || measured.wallColor, floor: get().floorOverride || measured.floorColor, trim: measured.trimColor, accent: measured.accentColor }
      }
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
          // Each measured room carries its own lighting preview and finishes.
          ...(room?.surfaces ? { lighting: room.lighting, wallOverride: null, floorOverride: null } : {}),
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
      if (focused) return { ...focused }
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
      const area = shapeArea(shape)
      const used = areas.reduce((sum, a) => sum + a, 0)
      return area > 0 ? used / area : 0
    },

    reset: () => set({ ...initial, _past: [], _future: [] }),
  })
)
