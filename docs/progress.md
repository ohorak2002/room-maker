# Progress — 2026-09-29

## Next work (supersedes the milestone 3 list below where they overlap)

1. Room realism at eye level, now the default view: ceiling and wall lighting (floor bounce), better procedural or permitted demo furniture, a real window view. Needs a visual reference; the user wants the room to feel like a real room.
2. Redesign the remaining panels (Design, Models, Place, Search, Photo) to the interface target.
3. Check the layout at narrower and wider window sizes; hand-test look-around drag and wheel walking.
4. Then the milestone 3 items: real licensed product GLB, remove-model action, portable project packages, finer room dimensions, installed-app import.

## Project location (2026-09-28)

Moved from `C:\Users\orenh\OneDrive\Desktop\Nested\nested-desktop` to `C:\dev\nested-desktop` to stop syncing build dependencies to OneDrive. Copied with robocopy (11,738 files, 0 failures). In the new location, `git fsck` was clean, HEAD matched (`04742d7`), and `npm test`, `npm run build` and `npm run test:desktop` passed before the OneDrive copy was removed. The branch was then pushed to GitHub and, at the user's request, fast-forwarded into `main` (no force-push; the prototype stays in history at `cc9ca25`). GitHub `main` is now the desktop application and the off-computer copy.

## Interface rebuild, first pass (Claude Code, 2026-09-29)

The user approved an interface mock-up (colour scheme and layout) and asked for the real interface to be rebuilt to match, with the room remaining real 3D that feels like standing inside it. The mock-up is saved in `references/interface-target/` (with a README of what it does and does not settle). An attempt to generate a photoreal reference image with the Higgsfield connector failed first: the account is on the free plan and every model returned "Requires basic plan or higher"; nothing was generated or charged.

Built:

- **Theme**: palette tokens from the mock-up in `src/App.css` (light; dark variants adjusted), Instrument Sans (interface) and Instrument Serif (wordmark, large titles) bundled via `@fontsource-variable/instrument-sans` and `@fontsource/instrument-serif`; Inter and Lora removed. No network font loading (CSP `font-src 'self'` unchanged).
- **One project bar** (`DesktopProjects.jsx`) replaces the old file bar and the workspace top bar: wordmark, inline-editable project/client names, short save status (full path in the tooltip), piece count and estimated total, side-panel toggle, shortcuts, Open…, a "⋯" menu (New project, Save as…, Export shopping list, Retake style quiz) and Save. Window-level UI state moved to `src/store/uiStore.js` (not saved in projects); shopping-list export moved to `src/data/shoppingList.js`. New shared `Icons.jsx` and `Menu.jsx`.
- **Shop** is a two-column card grid (3D thumbnail of the actual procedural model, "Concept" badge, category, name, estimated price, approximate height and retailer searched, Add to room / In room with quantity). The card of the piece selected in the room is highlighted. No finish swatches: the catalog has no finish variants. Category chips are one scrolling row. The Shop tab now opens first.
- **Room overlays** (`RoomCanvas.jsx/css`): room chip with approximate size, Overview | Eye level | Corner switch showing the active view, Undo / Auto-arrange / Export image, export toast, hint pill, a screen-space frame and name tag on the selected piece, and a selected-piece panel (price, model size W × D × H, "Concept model · real product size unknown" or "Placed size of your model", Rotate 45°, Duplicate, Remove). The old 3D BoxHelper outline was never visible (drawn without depth test but still writing depth, so later opaque geometry overwrote it); it now only tracks bounds.
- **Standing in the room**: the near wall is now built (it never casts shadows, so lighting is unchanged). All walls and the ceiling are cutaways: each frame, a wall is hidden only when the camera is outside the room's bounds on that wall's outer side (`updateCutaways` in `buildRoom.js`), by moving it to a layer the view camera skips and the shadow cameras still render. A room opens at eye level (1.6 m, back to the entrance wall). Eye level is a look-around mode: dragging turns the view (panorama-style), the scroll wheel walks forward and back, the position stays 35 cm inside the floor, and the idle drift is off.
- `scripts/scene-debug.mjs` accepts `NESTED_DEBUG_FULL=1` to capture the whole window.

Verified (Windows ARM64, Snapdragon X Plus, this session): `npm test` passes (3 files); `npm run test:desktop` passes in real Electron with no page errors (all save/open/recovery/export/import checks; selectors unchanged: Save, Open…, Export image, Project name, Overview); production `dist` contains no `__nestedEngine`. Visually inspected real Electron captures of the whole window, all three views and a selected sofa: `references/interface-rebuild/`.

Performance (rAF intervals, 240 frames, idle, reduced motion, canvas 2094 × 1342, debug room, `scene-debug.mjs`; display 120 Hz, so values quantize to 8.3 / 16.7 ms):

| View | AO at half resolution | AO at quarter resolution (shipped for eye level and corner) |
|---|---|---|
| Overview | 8.4 ms median | (half resolution kept) |
| Eye level | 16.6 ms | 8.4 ms |
| Corner | 16.6 ms | 8.4 ms |

At the old canvas height (1176) eye level was also 16.6 ms, so the cost is the enclosed view (AO over every pixel), not the taller canvas. Disabling AO alone gave 8.4 ms; bloom was not the cost; 8 AO samples or a lighter denoise did not help. Side-by-side eye-level captures at half and quarter AO showed no visible difference. The smoke test's own 120-frame sample (imported glass side table in view at eye level, under automation) gave median 16.7 ms, p95 50 ms; the transmission pass for that model was not measured separately.

Not verified / limitations:

- Look-around drag direction and wheel walking were reasoned through and exercised only by synthetic events, not by hand; the smoke test does not drag.
- Twice, the first `scene-debug.mjs` launch straight after a build misbehaved (once the view read Overview; once "Restore project" kept detaching until timeout). More than 20 other runs, including later first-after-build launches, were clean. Not diagnosed.
- The Models, Design, Place, Search and Photo panels keep their old internals under the new theme; only Shop was redesigned.
- Rendering realism is unchanged: the ceiling reads dark brown at eye level (mean grey ≈ 100 in the top 8 % of the frame), procedural furniture and the painted window view remain.
- The layout was checked at one window size (1427 × 727 CSS px); narrower windows rely on CSS fallbacks that were not inspected.

## Desktop-only cleanup (Claude Code, 2026-09-28)

At the user's request Nested is now only a downloadable application. Removed, all recoverable from Git history before this commit:

- The Vercel server API (`api/`: Meshy AI model generation, retailer page/dimension reading, photo colour sampling, Blob cache, legacy tintable GLB converter), `vercel.json`, `.env.example`, `scripts/try-model.mjs`, and their tests (`e2e`, `glb`, `dimensions`, `pid`). Also removed the dev-server plugin that emulated the API, `@vercel/blob` and `jpeg-js`.
- Renderer code that called it: background model upgrades, retailer size lookup (`modelUpgrade.js`, `productFacts.js`, `productId.js`, `upgradable.js`, `fit.js`). Pasted product links still create conceptual pieces and say the real size is unknown.
- Online address autocomplete (sent typed text to photon.komoot.io; the desktop CSP already blocked it), replaced by a plain local field.
- Browser behaviour: `localStorage` persistence (the desktop project/recovery files are the only save mechanism), the browser download fallback for images, web page metadata and favicon, `npm run dev`/`preview`, browser preview configs. Without the Electron bridge the page now only says Nested is a desktop app. Retailer links, which the app already blocked, are plain text.
- In a focused whole-home room, the button reads "Done · N pieces" instead of "Saved", because it does not save a file.

Verified after the change: `npm test` (3 offline test files) passes; `npm run test:desktop` passes in real Electron (all save/open/recovery/export/import checks; median frame interval 8.4 ms, p95 50 ms, 120 frames, under automation). Installer rebuilt with `npm run desktop:dist` (`release/Nested Setup 0.1.0.exe`, 224 MB, ARM64 + x64, unsigned). Both packaged builds launched via new `scripts/packaged-check.mjs` (ARM64 natively, x64 under emulation): `app.isPackaged` true, loads `nested://app/index.html`, narrow bridge, no Node in the renderer. The package contains no `api/`, `.env`, `vercel.json` or removed modules. The onboarding address step was not exercised by the automated tests. Unpacked build folders were deleted afterwards to save space; `npm run desktop:pack` recreates them.

## Milestone 3 (in progress): material-preserving imports and rendering fixes

Session by Claude Code on `codex/nested-desktop-foundation`, continuing from `2b0be17`.

### Completed

- **Private GLB import.** Models tab (desktop only) → native dialog → main process validates the GLB (header, length, glTF 2.0, no external file references, no required Draco/meshopt/KTX2 extensions) and copies it into `userData/assets/<sha256>.glb`. Renderer loads it via `nested://app/user-assets/<sha256>.glb` using the standard GLTFLoader. Nothing merges materials, drops textures or tints: `userData.tintable = false`, retailer facts/model upgrades never touch imported pieces. The legacy converter (`api/_lib/glb.js`) is untouched and unused by this path.
- **Explicit transforms only.** The model is re-seated on its own bounds (authored offsets are not treated as the floor origin). Units default to glTF metres; centimetres/millimetres/inches and 90° turns are designer choices recorded on the asset. A size hint appears when the largest side is implausible, and is never applied automatically.
- **Asset records** (`shared/assets.mjs`): checksum id, file name, size, authored extent, units, rotation, file statistics, optional product dimensions (nullable per axis), provenance source/rights (empty = unknown), `scope: 'private'`, `verification: 'unverified'`. The UI compares placed size against entered product dimensions (±1 cm) and says overall size is not detail verification. Imported pieces show "Price unknown".
- **Project format v2**: adds `state.assets`. v1 files migrate on open with an empty asset list; newer versions are still refused. Validation rejects malformed records, a key that differs from the checksum, and placed imported furniture without its record. Projects reference models by checksum, not by embedding them. A missing library file shows a warning and a footprint placeholder. It does not crash, and nothing is replaced.
- **Rendering defects from the baseline, diagnosed by measurement in real Electron:**
  - Dark translucent rectangle: GTAOPass drew `scene.background` (sky texture) into its normal buffer, corrupting the occlusion estimate. Background is now hidden only during that pass. The region measured 121.7 mean grey with AO, 139.6 after the fix, 140.0 with AO off.
  - Also fixed: the window's painted sky card and glass cast shadows, which blocked all sunlight through the window. Both are now non-casting; the window has a frame and mullion, clear low-opacity glass (no per-frame transmission pass) and an exterior view plane set back for parallax.
  - Ceiling hotspot: removed the point light hung 30 cm under the ceiling. It was replaced by a soft overhead directional light placed just under the ceiling (so the ceiling shadows the sun but not this light), plus a warmer floor-bounce hemisphere.
  - Floor/wall repetition: shell textures are now mapped in world metres (floor tile 2.4 m, wall tile per finish), instead of 0..1 per box face that grew with room size. New floorboard generator: 1024², fifteen 160 mm courses, two boards per course with staggered joints and per-board tone. Generated textures now use mipmaps and linear filtering (previously nearest, no mipmaps).
  - Shadow filter changed from VSM to PCF; plaster relief reduced; default exterior ground neutral grey instead of green.
- **Camera**: Overview / Eye level / Corner presets. Rebuilds (finish change, adding a piece, unit change) keep the designer's camera unless the room size changes.
- **Performance** (see measurements below): shadow maps are redrawn only when geometry changes; GTAO runs at half resolution.
- Original test fixture `test/fixtures/nested-side-table.glb` (generated by `npm run fixture:glb`, no third-party content); `scripts/scene-debug.mjs` for development-only scene inspection in Electron (requires a `VITE_NESTED_DEBUG=1` build; production builds do not expose the engine; verified absent from `dist`).

### Verified (2026-09-28, this machine)

- `npm run test:offline`: six files passed at the time (three were later removed with the server API), including new `assets.test.mjs` (fixture inspection, bounds through node transforms, rejection of truncated/external/Draco/non-2.0/meshless files, unit and rotation maths, dimension comparison with unknown axes, record validation, v2 round trip, orphan/rekeyed rejection, v1 migration, future-version refusal). Live retailer tests skipped.
- `npm run test:desktop` in actual Electron 44.4.5, Windows ARM64: all previous checks, plus: import fixture → file present in private library → placed size 60.0 × 60.0 × 50.0 cm → runtime reports 3 materials, 2 textures, 1 transmissive, 6 parts from the loaded three.js objects → centimetre correction changes placed size → product dimensions stored and difference reported → saved file contains the asset record and imported item → fresh process reloads the model from the library → moved library file produces the missing-model warning without page errors. Dialog selections remain stubbed.
- Visual inspection of real Electron captures: `references/milestone-3/` (overview, eye level, corner, imported model in room, workspace). These are evidence, not an approved visual direction.

### Performance measurements

Machine: Snapdragon X Plus X1P42100, Adreno X1-45, Windows build 26200. Scene: living room 7 × 5.5 × 2.9 m with prototype sofa, coffee table, floor lamp, rug. Canvas 2094 × 1176 device pixels. `requestAnimationFrame` intervals over 240 frames, idle camera, reduced motion, isolated runs via `scripts/scene-debug.mjs` (not GPU timings; the display appears to be 120 Hz, so 8.3 ms is the vsync floor):

| Configuration | Median | p95 |
|---|---|---|
| Before optimization (all fixes, full-res AO, shadows every frame) | 24.9 ms | 25.3 ms |
| Overhead light not casting shadows | 16.9 ms | 25.5 ms |
| AO disabled | 8.3 ms | 8.5 ms |
| Static shadows | 16.8 ms | 25.1 ms |
| **Static shadows + half-resolution AO (shipped)** | **8.3 ms** | **16.7 ms** |

The desktop smoke sample (120 frames, imported model present, run under automation) gave median 8.4 ms, p95 50 ms. Frame timing during drags was not measured.

### Remaining limitations / not verified

- Imported models: no Draco/meshopt/KTX2 decoders (clear rejection); animation/skins untested; `.gltf` + external files unsupported (use GLB); no automatic unit detection by design. Projects moved to another computer need the model files re-imported (same file → same checksum → restored); a bundled project/package export does not exist yet. Asset files are not garbage-collected when removed from projects, and there is no "remove model" action yet. The fixture is a simple generated piece, not a real product. No licensed real-product model has been tested; a CC-BY sample (for example Khronos glTF sample furniture) would need your approval to download.
- Transmissive glass in imported models uses three.js's transmission pass while visible; its cost was not measured separately.
- Visual quality still falls short of the goal. The procedural coffee table top shows a corrugated grain, the rug is plain (no patterned-rug verification), the sofa is fairly dark, and there is no glass object in the procedural set. The window view is a painted gradient.
- The inherited half-metre room grid remains approximate; do not claim exact room dimensions.
- Shadow redraw on every drag/nudge/menu path was reasoned through, not visually verified during a live drag.
- Unchanged from the foundation milestone: manual native dialogs, installer install/uninstall, clean machine, physical x64, signing, updates, power-loss durability, macOS.

### Next work

1. Test a real licensed or partner-supplied product GLB (with your approval of the source) for materials, scale and orientation; add a "remove model" action and library cleanup.
2. Portable project packages (project + referenced models) so files move between computers.
3. Replace or re-author the weakest procedural pieces (coffee table grain, plain rug, missing glass object) or use permitted demo assets with documented provenance; review from all three views.
4. Finer room dimensions than the 0.5 m grid.
5. Manually import a model in the installed app (installer install/uninstall still untested).

## Foundation milestone (earlier, Codex)

- Pulled `ohorak2002/room-maker` into this folder; original extraction and ZIPs untouched and verified identical to GitHub (92 files, line endings normalized).
- Electron with sandboxed, isolated renderer, local protocol/CSP, denied permissions/navigation, narrow validated IPC, single-instance lock.
- Versioned `.nested` projects with client/project names, New/Open/Save/Save as, atomic replacement, `.bak`, debounced recovery with restore on launch, close handling, PNG export and reveal-in-Explorer. Automatic retailer/model requests disabled in desktop; server API excluded from the package.
- Windows ARM64/x64 NSIS packaging (`release/Nested Setup 0.1.0.exe`, unsigned). Both packaged executables launched (x64 under ARM emulation); ASARs contain no server API or environment files. Not rebuilt since milestone 3 changes.
- Other known limitations: some UI still follows the consumer quiz; catalog prices/dimensions/models are conceptual; catalog search links blocked in desktop; project files capped at 32 MB; 500 ms autosave debounce; four development-tool dependency audit findings.

No custom asset-intake or visual-review skill yet. `scripts/scene-debug.mjs` and the smoke test are the current review workflow; encode a skill once the workflow is stable.
