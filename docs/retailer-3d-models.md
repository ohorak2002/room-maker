# Can we fetch retailers' own 3D models?

Short answer: **no, not as a server-side feature.** This note records what was
actually tested, so the question doesn't get re-opened from memory and answered
wrong a second time.

The idea was appealing: rather than paying an image-to-3D service, fetch the
3D model the retailer already has. Free, instantly accurate, correctly
dimensioned. It does not survive contact with the sites.

## What was tested

Two probes, on 2026-08-14:

1. A plain server-side `fetch` of a product page, scanning the HTML for
   `.glb` / `.gltf` / `.usdz` assets, `<model-viewer>`, AR Quick Look markup,
   and the major 3D-commerce vendors (Threekit, Emersya, Cylindo, Marxent /
   3D Cloud, Levar, Vertebrae).
2. A real browser on a live product page, reading `performance.getEntriesByType
   ('resource')` — so assets loaded by XHR after render are counted too, which
   the HTML scan alone would miss.

## Results

| Retailer | HTTP | Verdict |
| --- | --- | --- |
| IKEA | 200, 1167KB | **No 3D.** No glb/gltf/usdz, no model-viewer, no 3D vendor among the 21 hosts it references. |
| West Elm | 200, 508KB | **No 3D.** Same scan, nothing. |
| Wayfair | 429 to fetch; real browser served *"Access to this page has been denied"* | **Blocked.** |
| Home Depot | 403 | Blocked. |
| CB2 | 403 | Blocked. |
| Walmart | 200 but a 15KB shell | Blocked / JS-gated. |
| Target, Article | 404 | Untested — the probe URLs were wrong. |

IKEA deserves a note because it was the linchpin of the plan and the assumption
was that it published GLBs. It does not. A deeper scan for 3D vocabulary found
six hits on `3d-`, and all six were hex fragments inside UUIDs.

## Why this is fatal, beyond the missing files

Wayfair, Home Depot, Target and Amazon really do ship AR previews on some
products — that part was not imagined. But:

- **The sites actively refuse automated access.** Wayfair denied a real browser,
  not just a scripted fetch. A server-side feature has to fetch from a data
  centre IP, which is the easiest traffic in the world to block. This alone ends
  the plan regardless of what the pages contain.
- **Coverage is partial.** AR exists on a minority of SKUs, concentrated in
  furniture, absent from the long tail.
- **The assets are served through their own apps and SDKs**, undocumented and
  free to change without notice.
- **Terms of service.** Scraping product assets is generally prohibited. Building
  a core feature on it is a business risk, not just a technical one.

## What is actually free and reachable

The parts of "make it look like the real product" that survive:

- **Dimensions.** Published in structured data on every retailer, and reachable
  because it is part of the page rather than a gated asset. For a room planner
  this is the highest-value free signal by a wide margin — whether a 228cm sofa
  fits a wall matters more than the mesh.
- **The true colour**, averaged from the product photo. `api/_lib/photo.js`
  already locates the correct plain product shot.
- **Openly licensed mesh libraries** — Objaverse, Sketchfab CC0, ambientCG.
  Hundreds of thousands of real models, free, no terms problem. Not *that exact*
  granite table, but a real granite table instead of a procedural box.

## Status

Not pursued. `api/model.js` still generates from the product photo via Meshy,
which works and is gated to the shapes the builders cannot do. The cache, the
GLB reader and the async swap are provider-agnostic, so a different mesh source
can be dropped in behind them without touching the client.
