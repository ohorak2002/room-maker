# Room Maker

Describe what you like — colors, feeling, light, size — and get a 3D room built from
your answers. Then furnish it from a shoppable catalog and see each piece appear in
the model.

![status](https://img.shields.io/badge/status-prototype-blue)

## How it works

1. **Five questions.** Where you live (optional), palette, feel, light, and room
   size. Every answer maps to real values — the palette carries the actual hexes
   painted onto the walls and floor, the light choice swaps the whole lighting rig,
   and the feel drives which products get recommended to you.
2. **The room builds itself.** Walls, floor, ceiling, baseboards, and a cut window
   are generated from your dimensions.
3. **It arranges itself, then you take over.** A layout solver places everything
   where it belongs — bed against the back wall, nightstand beside it, monitor on
   the desk, plants in the corners. Then drag anything you want to move.
4. **Shop it.** Recommendations ranked to your vibe, with the cheapest equivalent
   surfaced next to every item.
5. **Export.** Download the design as JSON, including the shopping list with links.

## Features

- Animated five-step onboarding with progress, back/next, and a skip
- **Drag-to-place**: click any piece to select, drag to move, arrow keys to nudge,
  `R` to rotate. Floor pieces slide in the floor plane, wall art slides on the wall.
  Positions clamp to the room and persist.
- **Auto-arrange**: a rule-based layout solver (anchor by role, then relax overlaps
  apart) that you can re-run at any time to wipe manual placements
- Six palettes plus per-surface wall/floor color overrides
- Four lighting rigs that change ambient, key light, shadow, and background together
- Preset floorplans **or exact dimensions**, plus floorplan image upload as reference
- Pre-furnished tracking, so you don't get recommended a bed you already have
- 47-item catalog with vibe-ranked recommendations
- **Cheapest-equivalent swaps**: every item shows a cheaper interchangeable option
  and what you'd save
- **Photo import**: drop in a room photo, extract its palette in-browser, apply it
  to your walls, and get matching product suggestions
- Design persists to `localStorage`; JSON export with a linked shopping list
- Light and dark themes, responsive down to mobile widths

## Honest limits

Three things this app deliberately does *not* do, and why:

**Prices are estimates, not live retail data.** There is no pricing API wired up.
What is real is the retailer and the search link, which opens that store's own
search so you can check the current price. `src/data/catalog.js` is shaped so a
real price feed can replace the static numbers without touching the UI.

**No apartment floorplan lookup.** Property managers publish floorplans as marketing
images with no structured data behind them, and a browser app can't scrape them
anyway. Instead you enter exact dimensions and can upload your own floorplan image
as a reference. The building-name field is stored locally and looks nothing up.

**No object recognition in photos.** Palette extraction is real and runs entirely
in your browser. Identifying the actual chair or lamp in a photo needs a vision
model, which isn't wired up — matches are by color and vibe, so treat them as
starting points rather than a parts list.

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
│   ├── Onboarding.jsx      # five-question intro, residence + exact dimensions
│   ├── Workspace.jsx       # top bar + panel + stage shell
│   ├── ControlsPanel.jsx   # palette, feel, light, layout, floorplan, thermostat
│   ├── ShopPanel.jsx       # vibe-ranked catalog, cheapest swaps, cart
│   ├── PhotoImport.jsx     # photo → palette extraction → product matches
│   └── RoomCanvas.jsx      # Three.js mount, raycast drag layer, camera framing
├── three/
│   ├── buildRoom.js        # room shell, lighting rigs, object builders
│   └── layout.js           # zones + the auto-arrange solver
├── data/
│   ├── presets.js          # palettes, moods, lighting, floorplans
│   └── catalog.js          # items, vibes, substitute groups, recommendations
└── store/
    └── roomStore.js        # zustand store, persisted
```

## Roadmap

- Real price lookups (Amazon via the Product Advertising API needs an Associates
  account; other retailers have affiliate feeds)
- Object detection on imported photos
- Shareable room links
- Mobile app wrapper

## License

MIT
