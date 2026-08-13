# Room Maker

Describe what you like — colors, feeling, light, size — and get a 3D room built from
your answers. Then furnish it from a shoppable catalog and see each piece appear in
the model.

![status](https://img.shields.io/badge/status-prototype-blue)

## How it works

1. **Four questions.** A short onboarding flow asks about palette, feel, light, and
   room size. Every answer maps to real values — the palette carries the actual hexes
   painted onto the walls and floor, the light choice swaps the whole lighting rig.
2. **The room builds itself.** Walls, floor, ceiling, baseboards, and a cut window
   are generated from the floorplan you picked.
3. **Shop it.** Add furniture, greenery, lighting, decor, and tech. Each item is
   built as a real 3D object and placed in the room automatically.
4. **Export.** Download the design as JSON, including the shopping list with links.

## Features

- Animated multi-step onboarding with progress, back/next, and a skip
- Six palettes plus per-surface wall/floor color overrides
- Four lighting rigs (Daylight / Warm / Cool / Moody) that change ambient, key light,
  shadow, and background together
- Four floorplans, from a 4×4 studio to a 9×7 loft
- 35-item catalog across six categories, heavy on greenery
- Live 3D: every change rebuilds the scene, orbit + zoom controls
- Design persists to `localStorage`; JSON export with a linked shopping list
- Light and dark themes, responsive down to mobile widths

## A note on prices

**Prices in the catalog are estimates, not live retail data.** There is no pricing
API wired up. What is real is the retailer and the search link, which opens that
store's own search for the item so you can check the current price yourself. The
data layer is shaped so a real price feed can replace the static numbers without
touching the UI — see `src/data/catalog.js`.

## Tech Stack

- **React 18** + **Vite** — UI and build
- **Three.js** — 3D scene, procedural geometry, lighting, shadows
- **Zustand** (with `persist`) — state, saved to localStorage

## Getting Started

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

```bash
npm run build     # production build to dist/
npm run preview   # serve the production build
```

## Project Structure

```
src/
├── components/
│   ├── Onboarding.jsx      # the four-question intro flow
│   ├── Workspace.jsx       # top bar + panel + stage shell
│   ├── ControlsPanel.jsx   # palette, feel, light, floorplan, thermostat
│   ├── ShopPanel.jsx       # catalog, search, cart
│   └── RoomCanvas.jsx      # Three.js mount, camera framing, rebuild-on-change
├── three/
│   └── buildRoom.js        # room shell, lighting rigs, object builders, placement
├── data/
│   ├── presets.js          # palettes, moods, lighting, floorplans
│   └── catalog.js          # shoppable items + retailer search links
└── store/
    └── roomStore.js        # zustand store, persisted
```

## Roadmap

- Drag furniture to reposition instead of automatic placement
- Real price lookups via a retail API
- Shareable room links
- Mobile app wrapper

## License

MIT
