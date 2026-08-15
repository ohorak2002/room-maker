# Nested — 3D asset quality brief

Goal: Nested should look real enough that a user believes they are previewing
their actual room, furnished with the actual products they want to buy.

This is an asset-quality problem, not a rendering problem. Read the "Do not do
these" section before starting.

---

## Status

Most of this has now been implemented. What shipped:

- **Photo pieces keep their texture and drop out of palette tinting.** A piece
  identified by a pasted product page is generated textured, at a higher
  polycount, and rendered untinted. A piece described only by name still comes
  back as an untextured, tintable silhouette. `_lib/glb.js` has two modes;
  `_lib/meshy.js` asks for a texture only on the photo path.
- **Spec format is versioned** (`SPEC_FORMAT` in `api/model.js`) so a format
  change cannot serve stale meshes to a client expecting new fields.
- **Thumbnails follow the room.** `thumbnail.js` reads `peekUpgrade`, which
  never starts a job — browsing the shop must not bill for generations.
- **Fabric has sheen.** `FABRIC` is now a `MeshPhysicalMaterial`.

Two claims in the original draft of this brief were wrong and are corrected
below: durable shared caching already existed, and so did ambient occlusion.

Still open: §3c (curating models for top products), §4 (widening
`UPGRADABLE`), and the HDRI question in §5.

---

## 1. What already exists (verified — do not re-derive)

Project root: `room-maker/`. React 18, Vite 5, three.js 0.160, zustand.
Package name is `nested`.

### The 3D layer (~4,200 lines)

| File | Lines | Role |
|---|---|---|
| `src/three/buildRoom.js` | 1702 | Piece factories keyed by type: `sofa: (it) => {...}` |
| `src/three/textures.js` | 466 | Procedural textures generated in code via `jpeg-js` |
| `src/three/layout.js` | 327 | Placement; relies on piece bounding boxes |
| `src/three/buildHome.js` | 171 | |
| `src/three/shapeGeom.js` | 145 | |
| `src/three/atmosphere.js` | 141 | |
| `src/three/modelUpgrade.js` | 105 | Background request for a real mesh |
| `src/three/thumbnail.js` | 78 | Offscreen renders for UI thumbnails |
| `src/components/RoomCanvas.jsx` | 774 | Main renderer setup |
| `src/components/HeroRoom.jsx` | 319 | Landing-page scene |

### There is already a model-upgrade pipeline

**This is the single most important thing to understand before changing
anything.** Nested does not render only procedural geometry. It has a working
image-to-3D upgrade path:

1. `placeItems()` builds the procedural piece **synchronously**, so there is a
   draggable node, a floor shadow and a correct silhouette on frame one.
2. `requestUpgrade(item)` in `src/three/modelUpgrade.js` polls `/api/model` in
   the background, up to `MAX_WAIT_MS` (4 minutes), honouring `retryIn`.
3. If a mesh comes back, it replaces the procedural piece. If it never comes
   back, nothing is missing.

Supporting files: `api/model.js` (191 lines), `api/product.js` (90),
plus `api/glb.js`, `api/meshy.js`, `api/photo.js`, `api/dimensions.js`,
`api/cache.js`. Meshy is the image-to-3D provider.
Client-side identity/caching: `src/data/productId.js` (184 lines).

**Server-side files were not read when this brief was written. Read them first
and correct anything here that contradicts them.**

### Behaviour you must preserve

- **Upgrades never block.** The room is complete and interactive without them.
- **`requestUpgrade` never rejects.** A failed upgrade is a non-event.
- **Requests are memoised per session by cache key**, so eight dining chairs are
  one job, and a palette change reuses the mesh instead of re-requesting.
- **The promise is not tied to its caller** — the component that started it is
  often unmounted before the answer lands, and the answer is still kept.
- **Only `sourceUrl` is sent, never `item.url`.** `sourceUrl` is a product page
  the user pasted. `url` is a *store search link*. Sending the search link asks
  the server to scrape a results page for a photo of nothing in particular.
- **The `unavailable` latch.** Under plain `vite dev` there is no `/api`, so the
  dev server returns `index.html` with a 200. The code checks `content-type`
  rather than calling `res.json()`, because parsing that HTML throws on every
  piece in the room. Once unavailable, it stops asking for the session.
  **Test with `vercel dev`, not `vite dev`, or you are testing nothing.**

### The renderer is already correct — do not "fix" it

`ACESFilmicToneMapping`, `SRGBColorSpace`, `VSMShadowMap`, `PMREMGenerator`
environment maps, `MeshPhysicalMaterial` where it counts. This configuration is
right. Leave it alone.

---

## 2. Do not do these

- **Do not switch rendering engines.** Not Filament, not Babylon. three.js stays.
  Both implement the same PBR model; swapping costs a 4,200-line rewrite and
  buys a ~5% refinement.
- **Do not rewrite `buildRoom.js` wholesale.** Procedural builders remain the
  instant, free, tintable, any-size baseline and the permanent fallback.
- **Do not make any piece wait on a network call before it renders.**
- **Do not regress a piece type that currently renders.**
- **Do not widen `UPGRADABLE` without reading its rationale first.** See below.

---

## 3. The shop path is the priority

Most of what ends up in a user's room is not a default piece — it is something
they searched for, or a product page they pasted. Those items are the whole
promise of the product: *"the things I actually want, in my actual room."*
They are also where fidelity matters most, because the user knows exactly what
the real object looks like.

Work the shop path first. Entry points: `src/components/SearchPanel.jsx` (294),
`src/components/PieceMenu.jsx` (59), `src/components/ItemThumb.jsx` (42),
`api/product.js`, `api/photo.js`.

### 3a. Make generated models match the real product

A shop item carries `model` (shape type), `name`, and optionally `sourceUrl`.
The generated mesh should look like *that specific product*, not a generic
example of its category.

- Audit what image the pipeline actually feeds the generator for a shop item.
  A wrong or generic source image is the difference between "my sofa" and
  "a sofa".
- Check `api/dimensions.js` — a model at the wrong real-world size destroys the
  illusion faster than any material flaw, because the rest of the room gives the
  eye a ruler.
- Verify the colour/material of the generated mesh matches the listing, and
  decide explicitly whether palette tinting should apply to shop items at all.
  Tinting a product the user picked *for its colour* is a bug, not a feature.

### 3b. Persist upgrades across sessions — ALREADY DONE

**Correction.** The first draft of this brief called this the highest-leverage
missing change, on the strength of `inflight` in `src/three/modelUpgrade.js`
being a tab-lifetime `Map`. That map is a client-side request memo, not the
cache. The real cache is server-side and already has three layers
(`api/_lib/cache.js`):

1. **CDN.** A ready response carries `s-maxage=86400` with a week of
   `stale-while-revalidate`, so a repeat request is answered at the edge and the
   function is never invoked. This layer carries the traffic and costs nothing.
2. **Warm-instance LRU map**, 40 entries, free, gone on cold start.
3. **Vercel Blob**, the layer that survives a deploy and is shared across
   instances and regions — the one that stops the same sofa being paid for
   twice. Optional, gated on `BLOB_READ_WRITE_TOKEN`.

Keys come from the retailer's product id via `src/data/productId.js`, never the
URL, so tracking parameters don't fragment the cache.

**The only thing worth checking here is whether `BLOB_READ_WRITE_TOKEN` is
actually set on the deployment.** Without it layers 1 and 2 still work, but a
deploy throws the meshes away and they get paid for again.

### 3c. Curate the top products

For the most-added products, ship or commission proper models instead of relying
on generation. Generation is a good floor; it is not a good ceiling.

### 3d. Thumbnails must agree with the room

`thumbnail.js` and `ItemThumb.jsx` render pieces offscreen for the UI. If the
room shows an upgraded mesh and the thumbnail shows the procedural one, the
product looks broken. Whatever the room displays, the thumbnail displays.

---

## 4. Widen `UPGRADABLE` — carefully, with reasons

`src/data/upgradable.js` currently lists 17 types: upholstery (`sofa`,
`armchair`, `chair`, `diningchair`, `beanbag`, `pouf`, `stool`), lighting
(`floorlamp`, `desklamp`, `pendant`), greenery (`palm`, `plant`, `smallplant`,
`hanging`, `vase`), and sanitaryware (`bathtub`, `toilet`).
`HAND_MODELLED = {tree}` is excluded permanently — a generated fig would be a
downgrade on the existing hand-modelled mesh.

The list is short **on purpose**. Its stated test is not "would a generated model
be better" but "is the procedural one actually losing anything" — and boxy,
rectilinear things (bookcase, dresser) are things the builder already nails
instantly, for free, at any size, in any palette colour. Generating those is
"pure loss": slower, costlier, less tintable.

That reasoning is sound and each generation costs real money. So:

- Do **not** simply add every type.
- For each type you propose adding, state what the procedural version loses.
  "Its silhouette is defined by curves rounded boxes cannot find" is a reason.
  "It might look nicer" is not.
- Rectilinear casegoods stay procedural unless you can show otherwise with a
  side-by-side render.
- Report the projected cost change per room.

Strong candidates worth evaluating: curtains and soft furnishings, rugs with
real pile, bedding and pillows, anything with compound curves or fabric drape.

---

## 5. Room-level realism

Do these after the shop path, in this order.

1. **Real HDRI environment.** Replace `RoomEnvironment` (a synthetic box) with a
   real interior HDRI via `RGBELoader` + `PMREMGenerator`. Use it for
   `scene.environment` only, **not** `scene.background`. Keep `RoomEnvironment`
   as the fallback if the HDRI fails to load. Tune `envMapIntensity` per material
   class — `textures.js` already has a convention for this; follow it. In an
   enclosed room the walls should dominate the lighting, so a full-strength
   outdoor HDRI will look wrong.
2. **Contact shadows / ambient occlusion — ALREADY DONE.** Another correction:
   `RoomCanvas.jsx` has a tuned `GTAOPass` in its `EffectComposer`. Its radius
   is deliberately at furniture-contact scale (0.25m) and there is a comment
   explaining that a previous pass raised it to 1.0 and produced the "black
   slab" bug. **Do not touch that number.**
3. **Material variation — DONE.** `FABRIC` is now a `MeshPhysicalMaterial` with
   `sheen`, so upholstery gets the fibre rim-light that separates cloth from
   rubber. Other material classes are still uniform-roughness and could get the
   same treatment.

---

## 6. Assets and budgets

- CC0 or commercially-licensed only. Poly Haven is CC0 for models and HDRIs.
  Record the licence for every asset added.
- ≤ 2MB per GLB after Draco compression; 1K–2K textures, KTX2 where possible.
- Store static assets under `public/models/` and `public/hdri/`.
- Report total payload added when done.

---

## 7. Gotchas that will bite

- **Async vs sync.** `placeItems()` is synchronous by design so the room exists
  on frame one. Any new loading must preserve that. No flicker, no layout shift.
- **Origin placement.** `layout.js` positions by bounding box. A model whose
  origin is not at its base will sink into or hover above the floor.
- **`HeroRoom.jsx` has its own scene setup**, separate from `RoomCanvas.jsx`.
- **VSM shadows** can look wrong on high-poly imported meshes — check shadow bias.
- **`vite dev` has no `/api`.** Use `vercel dev` or the upgrade path is dead and
  silent.
- **Palette rebuilds** re-run the whole scene build. Meshes must survive that
  without re-requesting.

---

## 8. Order of work

1. Read the server side (`api/model.js`, `api/meshy.js`, `api/glb.js`,
   `api/product.js`, `api/photo.js`, `api/dimensions.js`, `api/cache.js`) and
   correct anything in this brief that contradicts it.
2. Ship §3b (persistent shared cache). Biggest win, no visual risk.
3. Ship §3a (product fidelity) and §3d (thumbnail parity).
4. Propose the §4 `UPGRADABLE` additions **with reasons and costs**, and stop for
   review before implementing.
5. Then §5, in order.

---

## 9. Verification — required

- Run under `vercel dev`, not `vite dev`.
- Screenshot the same room, same camera, before and after.
- For the shop path: add a real product from a pasted URL and show the result.
- Report visual diff, payload added, frame time, and projected generation cost
  per room.
- **Do not claim it works without a screenshot.**
