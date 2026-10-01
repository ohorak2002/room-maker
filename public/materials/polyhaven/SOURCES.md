# Bundled material sources

These texture sets are bundled so Nested loads them offline. Nothing is fetched from the internet at run time.

| | Fabric (sofa upholstery) | Wood (coffee table, sofa legs) |
|---|---|---|
| Asset | Poly Wool Herringbone | Oak Veneer 01 |
| ID | `poly_wool_herringbone` | `oak_veneer_01` |
| Page | https://polyhaven.com/a/poly_wool_herringbone | https://polyhaven.com/a/oak_veneer_01 |
| Authors | colormass (photography), Rico Cilliers (processing) | Jenelle van Heerden |
| Published | 2025-09-05 | 2024-03-08 |
| License | CC0 1.0 (https://polyhaven.com/license) | CC0 1.0 |
| Published real-world size of one tile | 27.0 × 27.6 cm | 183 × 183 cm |
| Maps bundled | `diff` (sRGB base colour), `nor_gl` (OpenGL normal, linear), `rough` (linear) | same |
| Resolution / format | 2048 × 2091 JPG ("2k", decoded from the files) | 2048 × 2048 JPG ("2k") |
| Fetched | 2026-09-29 | 2026-09-29 |

Files were downloaded once from the URLs returned by `https://api.polyhaven.com/files/<id>` (the documented API, identified with a User-Agent; no scraping) and checked against the MD5 values the API publishes. The same checksums are recorded in `src/data/materialSources.js`, and `test/materials.test.mjs` verifies the files on disk.

Not bundled: ambient-occlusion, displacement, metalness and other maps. The pilot does not use them.

## What these are, and are not

- The **tile size** is the size Poly Haven publishes for the photographed sample. It sets the texture's physical scale in Nested. It says nothing about any product's weave or grain.
- In Nested these are **concept finishes**: a generic grey wool-blend cloth and oak stand in for whatever a real product uses. They are not verified retailer finishes and must never replace one.
- Poly Haven's *website content, previews and API access* have separate terms from the CC0 asset downloads (see their license page and API notes). Only the asset files are redistributed here; no previews or site content are.
