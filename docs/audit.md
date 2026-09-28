# Baseline audit — 2026-09-28

Source: https://github.com/ohorak2002/room-maker at `cc9ca253eaa6546b185c0a3f4ae2f3a52bd53193`. Cloned with authenticated GitHub CLI into sibling `nested-desktop`; branch `codex/nested-desktop-foundation`. Original extraction was not edited. Both Downloads ZIPs have SHA-256 `6508CE83500DD26637B1109D82953DFB09483FE2BE8B8E51B9334CDE231FBA53`. All tracked source contents match the supplied extraction after normalizing CRLF/LF. No applicable repository AGENTS.md was present.

## Retain

- React/Vite, Zustand store, room/home geometry builders, cell masks, shape clamping, placement handles, undo, floorplan tracing/detection, unit conversion helpers. These provide a substantial usable base.
- Three.js PBR materials, generated texture library, environment reflections, ACES tone mapping, sRGB output, shadow maps, GTAO and bloom. They exist in code; visual quality and hardware performance require actual scene checks.
- Product identifier normalization, dimension parsing and API test fixtures. Their existence does not establish current retailer compatibility or permissions.

## Verified baseline

`npm ci`, `npm run test:offline`, `npm run build` passed. Four baseline offline test files passed: room detection, mocked API end-to-end flow, custom GLB conversion, product IDs. Live retailer dimensions were skipped. Existing e2e tests mock provider/retailer responses; they are not UI tests. Build has existing warnings about mixed static/dynamic imports. Dependency audit initially reports two moderate and two high findings; assess before release instead of blindly applying breaking upgrades.

## Confirmed limitations

- `src/data/catalog.js` contains generic category entries, estimated prices and retailer search links. These are conceptual examples, not verified exact SKU/variant records.
- `api/_lib/meshy.js` explicitly requests `should_texture: false`.
- `api/_lib/glb.js` deliberately discards textures and flattens material groups for palette tinting.
- `api/_lib/photo.js` averages photo colors; this cannot verify finishes or PBR surface properties.
- `Workspace.jsx` exports a shopping summary, omitting full editable geometry/placements/custom items. Browser localStorage was the sole save mechanism.
- Room width/depth are quantized to a half-metre grid. The UI's “exact dimensions” wording overstates geometric precision. Address this before claiming measured-room accuracy.
- Whole-home layouts are generated/trace-derived; opening geometry, furniture collision, and all floorplan edge cases have not been exhaustively verified.
- Automatic background model/fact requests are not suitable for an offline desktop or a permission-aware commercial asset pipeline. Disabled in desktop for now.

## Catalog/asset contract for the next milestone

Separate searchable ProductRecord from PlaceableAsset. Product records need brand, manufacturer IDs, exact variant, source URL/feed and update date, photographs with permissions, dimensions with explicit units and measurement source, material data, nullable price/availability. Asset records need source/license proof, scope (private designer upload vs shared catalog), permitted uses/redistribution/AI processing, source and optimized files, checksums, authored units/orientation, measured bounds, material/texture counts, verification status and reviewer/date. Unknown stays null. Feed access alone grants no model rights.

Standard GLTFLoader should retain authored UVs, textures, material groups, scale and orientation; apply explicit unit/orientation transforms only with evidence, and compare measured bounds with specifications. Keep legacy tintable geometry only for clearly labeled conceptual pieces. No authorized commercial catalog source has been established yet.
