# Nested

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

Paste a link to a real sofa and, given a provider key, the app will go and build a
3D model of *that* sofa from the retailer's own photo — see
[Generated models](#generated-models).

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

## Generated models

Every shape in the app is one of about forty-five builders written in code. That
is fast, free, palette-aware and instant — and it means every sofa is the same
sofa. `/api/model` is the way out of that: give it a product link and it fetches
the retailer's own photo, sends it to an image-to-3D service, and returns the
resulting silhouette as geometry the app can draw.

**Only for shapes the builders can't do.** A bookcase is a grid of boards and a
dresser is a box with drawer fronts — the builders nail those, instantly and for
nothing. Generating them would be slower, dearer and *worse*. The gate is in
`src/data/upgradable.js` and it is short on purpose: upholstery, lighting,
greenery, sanitaryware. Everything rectilinear keeps the builder it has.

**The room never waits.** `placeItems()` draws the procedural piece
synchronously, so there is a node to drag and a shadow on the floor from the
first frame. Generation takes one to three minutes; the mesh swaps in when it
lands, and if it never lands nothing is missing.

**Geometry only, never textures.** The provider is asked not to texture at all,
and any texture that arrives anyway is discarded. This is not an optimisation —
three multiplies `material.color` by the albedo map, so a mesh with a photo of a
charcoal sofa baked into it can never be tinted lighter and the palette stops
reaching it. What these services are good at is the outline; the app already
knows how to light and colour a surface.

**Cached by product id, never by URL.** The link you copy carries a session id
or a search rank or a campaign tag, and it differs every time. Keying on the URL
would mean paying for the same sofa on every visit. `src/data/productId.js`
pulls out the retailer's own article number — `s79305103` from an IKEA link —
and that is the cache key.

Set `MESHY_API_KEY` to switch it on; see `.env.example` for the rest. With no
key set the endpoint answers "unavailable" and the app behaves exactly as it did
before. `npm run dev` serves the endpoint too, so dev and production match.

Rough edges, stated plainly:

- **A generated lamp doesn't glow.** Its point light is preserved through the
  swap, so it still lights the room, but the mesh is one undivided surface and
  there is no way to tell the shade from the base without a texture — so nothing
  is made emissive. The procedural lamp still wins on that one detail.
- **The Vercel Blob cache is written against the documented SDK but has not been
  run against a real store here.** Without it the CDN and each warm instance
  still cache; a deploy just throws the meshes away.
- **The rate cap is per-instance and in memory.** It is a brake on one runaway
  client, not a billing control. A public deployment wants a real identity check
  in front of this endpoint.

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

**A generated model is a likeness, not the product.** It comes from one
marketing photo, at a few thousand triangles, with no texture. It gets the
silhouette right, which is what the built-in builders can't do. It does not get
the stitching, the wood grain or the exact proportions.

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
api/
├── model.js                # GET /api/model — generate, cache, return a mesh
└── _lib/
    ├── meshy.js            # the image-to-3D provider, behind two functions
    ├── photo.js            # og:image lookup, on an allowlist of retailers
    ├── glb.js              # GLB → geometry in this app's contract
    └── cache.js            # CDN + warm instance + Vercel Blob
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
│   ├── modelUpgrade.js     # background request + swap for a generated mesh
│   └── layout.js           # zones + the auto-arrange solver
├── data/
│   ├── presets.js          # palettes, moods, lighting, floorplans
│   ├── catalog.js          # items, vibes, substitute groups, recommendations
│   ├── productId.js        # retailer article numbers → cache keys
│   └── upgradable.js       # which shapes are worth generating
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
