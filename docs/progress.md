# Progress — 2026-09-29 (skip the Brief)

Added "Skip the Brief — go straight to a room" on the start screen (and "Skip the Brief" inside the editor, which discards the draft). It opens the ordinary approximate room (living-room grid), no Brief, no measurements: for trying Nested without filling a Brief. Covered by `npm run test:brief` step 10.

# Progress — 2026-09-29 (Brief chat parked)

Decision: the hosted AI service is postponed. The Brief chat stays on screen, disabled, with "Doesn't work right now" so it remains a visible reminder; all plumbing is kept (IPC, allowlist, reference server, tests). It becomes live only if a service address is set in `NESTED_AI_URL` / `userData/ai.json`. Planned section of Nested: deploy a hosted service (hosting is cheap; model usage is pay-per-token), then add sign-in, rate limiting and a spend cap first.

# Progress — 2026-09-29 (Brief chat replaces the assistant panel)

Branch `feature/brief-chat` (from `main` at ce0e60a). The one-shot "Brief assistant" was replaced by a multi-turn **Brief chat** beside the editor: type anything to fill fields, troubleshoot (the service is sent the Brief's current failing checks, up to 25), or make descriptions richer. Same rules as before: Nested-hosted service via `NESTED_AI_URL`; sends Brief text only (no attachments, no client/studio/designer names) plus the conversation (max 24 messages, 4,000 characters each); replies are allowlisted proposals the designer applies one by one, with before/after shown; measurements, openings, verification, review, identity and furniture can't be changed (`shared/briefAi.mjs`, `validateChat`). The conversation is session-only, not saved in the project. `server/brief-assistant.mjs` (reference service, not packaged) now takes the conversation and issues; still **not run against the live API**, no sign-in or rate limiting, and no hosted service exists, so the chat is "not connected" until one is deployed.
Verified: `npm test` and `npm run test:brief` (real Electron; stand-in service; multi-turn, Enter sends, issues sent, ignored suggestions counted, client name absent from the payload). Not verified: real model behaviour, long-conversation cost, narrow-window layout of the chat.

# Progress — 2026-09-29 (Brief is written in the app; AI assistant)

## Upload removed; Brief written in Nested; assistant (Claude Code, follows the entry below)

- No upload or export of Briefs any more. A new project shows "Start a new brief"; the editor runs inside Nested and the draft is saved **with the project** (format **v5**, `briefDraft`; v4 files migrate). "Review and create the room" validates, shows the measured plan for confirmation, then creates the empty home (the Brief is stored in the project as `brief`). File IPC for Briefs was removed. Attaching a floorplan image/PDF inside the editor still reads a file the designer chooses. Revising a Brief after room creation is not possible yet (start a new project).
- **Brief assistant** (decision 2026-09-29: Nested-hosted service). The app's only network call: main process POSTs the Brief's text (no attachments, no client/studio/designer names) to the address in `NESTED_AI_URL` or `userData/ai.json` {"url"} (https, or http on localhost), only when the designer presses Ask, 45 s timeout, no redirects. Unset = "not connected". No provider key is in the app. Replies are allowlisted (`shared/briefAi.mjs`): wording of notes, room name/type, supported finishes, colours, lighting. Measurements, openings, verification flags, review, identity and furniture are refused and counted; the designer applies each change (stale ones are refused).
- `server/brief-assistant.mjs` is a **reference** service (holds `ANTHROPIC_API_KEY`, forced tool output). It is outside the packaged files, **was not run against the live API** (no key here) and has no sign-in or rate limiting: no hosted service exists yet, so in this build the assistant is unavailable until one is deployed and its URL configured.
- Verified: `npm test` (8 files, incl. new `briefAi`), `node scripts/desktop-smoke.mjs`, and `npm run test:brief` (real Electron; gate, draft survives crash, incomplete Brief refused, assistant against a local stand-in service, review, exact room, save, recovery, New project; no external requests other than that stand-in). Images: `references/brief-flow/`.
- Not verified: the live model's answer quality; a deployed service; installer/installed app.

# Earlier the same day: Upload Brief integration (superseded above)

## Upload Brief replaces the questionnaire (Claude Code, branch `feature/room-studio-and-materials`, uncommitted)

Merged the supplied "Nested Brief update" (`Downloads/Nested-brief-update`, written against the old browser prototype) by porting, not by applying its patch. Read `docs/official-brief.md` for the format; below is what differs in the desktop app.

- Ported as-is: validation/compile (`shared/brief.mjs`, `shared/briefGeometry.mjs`, moved to `shared/` so Electron main can validate too), `src/three/measuredShell.js`, editor, plan measure, measured plan, sample `examples/sample-home.nested-brief.json`, and its two tests.
- Adapted: no IndexedDB/localStorage/browser downloads. Upload, draft open/save and official-Brief save go through new narrow IPC (`brief:open`, `brief:save`; native dialogs, size and format checked in main). Project format is now **v4**: `brief: {fingerprint, source}` stores the verified Brief inside the project file (v1–v3 migrate with `brief: null`). `validateProject` recompiles the stored Brief and refuses a project whose measured rooms differ from it (only furniture lists may differ).
- Flow: a new/empty project shows the Upload Brief gate (no bypass, no quiz). Review + confirm → empty measured home; one room opens directly, several open on the exact measured plan. Identical-Brief "resume" is now simply reopening the saved project; "Start from another Brief" is New project (asks about unsaved changes first). No previous-project backup JSON exists any more: the `.nested` file is the backup.
- Rendering: measured shell gained a ceiling and the app's dynamic cutaways (walls/ceiling hide only while the camera is outside; edge walls at any angle), non-casting near wall, clear glass with no transmission pass. Per-room placement namespacing (`<roomId>:piece#n`) ported into the store. Brief rooms use the Brief's colours, not the palette; Room/Finishes panels show locked measured facts; a Brief tab shows retained notes and attachments.
- Removed: questionnaire (`Onboarding`, `HeroRoom`, `MoodPreview`, `LightPreview`, `MaterialPreview`, `moodScenes`); recoverable from Git.
- Verified: `npm test` (7 files) passes; `node scripts/desktop-smoke.mjs` passes (expects v4); new `npm run test:brief` (real Electron, dialogs stubbed) covers gate, wrong-file refusals, review, editor export/draft round trip, re-upload, exact room, no auto-furnishing, save, crash recovery, New project. No page errors, no external requests. Screenshots inspected: `references/brief-flow/`.
- Not done / limits: no PDF rendering, OCR or AI reading (as in the update); the whole Brief incl. attachments (up to ~12 MB) is inside the project, so autosave writes are large; project name/client are not prefilled from the Brief; default 1 m texture tile makes plank floors look fine-striped (designer-chosen scale); overview 3D of a multi-room home, sloped/complex rooms, drag-editing in non-rectangular rooms and the installed app were not hand-tested; installer not rebuilt.

# Progress — 2026-09-29 (room studio + material pilot)

## Room studio shell and material pilot (Claude Code, branch `feature/room-studio-and-materials`, not merged)

Two requests from the design hand-off (`Downloads/nested-room-studio-handoff`): integrate its room-first interface, then improve ONE sofa and ONE coffee table with photographic materials and present them for visual review. The catalog is untouched apart from a `materialSet` flag on those two entries.

### Phase 1: interface (built, run in real Electron, inspected)

- Layout: tool rail (Room, Pieces, Finishes, Light, Views) | room | collapsible inspector, with a strip of camera views underneath and a presentation mode (Present button, `P`, Esc). Existing panels were re-housed, not dropped: Room = measurements, shape editor, layout, whole-home planning, "what's included"; Pieces = Shop / Models / Search; Finishes = palette, wall construction, own palette, photo palette, feel, and what the selected piece's surface is made from; Light and Views are new. The retired `ControlsPanel.jsx` is in Git history.
- Project format is now v3: `studio {brightness, sun, accent}` and `views[]` (name, room, mode, position, target, FOV, JPEG preview). v1 and v2 files migrate on open (tested); malformed values are refused (tested). The prototype's demonstration room, colours and fixed dimensions were not used; the room, furniture, placements, save/open, recovery and export are the app's own.
- Lighting: Soft daylight / Golden hour / Evening map onto the existing `natural` / `golden` / `moody` rigs (Warm, Cool, Overcast remain under them). Brightness (exposure), sun height and accent lighting apply to the live scene without rebuilding it. Sun height defaults to the room's own value ("room default"), so old projects look unchanged.
- Views: field of view slider (30–65°), Overview / Eye level / Corner presets, saved views per room (thumbnail from the live scene). The strip's preset previews are regenerated from the scene after changes.
- Not done / labelled: no true fullscreen for presentation (window chrome hides, the OS window stays); "sun direction" is height only, not compass direction; per-piece finish variants do not exist in the catalog, so Finishes shows palette and wall choices plus an honest description of the selected piece's material.
- Verified: `npm test` (4 files, offline) and `npm run test:desktop` (real Electron, dialog selections stubbed) pass. The smoke test now also drives Light, FOV, save view, go-to view, presentation mode and Esc, saves and reads back the v3 file (lighting, studio state, view with FOV/mode/JPEG preview), crash-restarts and checks lighting and the saved view survived, checks the exported PNG is a real render, that production has no debug hooks, that all bundled maps loaded with status 200 and that there were no requests outside `nested://`, `data:` and `blob:` (including after restart). Fixed a latent race in that test (its "Saved" wait matched "Not saved").
- Inspected images: `references/studio-integration/` (1000, 1440, 1920 px wide). At 1000 px the tool row overlapped the room chip; fixed (icons only below 1300 px). Below 900 px the CSS stacks the inspector under the room; that layout was **not** inspected (the window minimum is 1000 px).
- Not verified: hand-use (drag, wheel walking, slider feel); keyboard/screen-reader pass beyond roles and labels; multi-monitor; the installed app (installer untouched; not rebuilt).

### Phase 2: sofa and table (built, run, inspected, measured where stated)

- Sources (all CC0, bundled offline in `public/materials/polyhaven/`, recorded in `SOURCES.md`, `src/data/materialSources.js`): Poly Wool Herringbone (`poly_wool_herringbone`, published tile 27.0 × 27.6 cm) for upholstery; Oak Veneer 01 (`oak_veneer_01`, tile 183 × 183 cm) for the table and sofa legs. 2K JPG diffuse, `nor_gl` normal, roughness; MD5s match the Poly Haven API. Downloaded 2026-09-29 through the documented API route, no scraping. AO/displacement not used.
- Correctness, read back from the loaded textures at run time: base colour `srgb`, normal and roughness non-colour, sizes 2048×2091 and 2048×2048. Scale comes from UVs in metres over the published tile. Grain: fabric warp runs up sides and front-to-back on tops; oak grain runs along Z on the table top, along each leg, around the apron; rim end-grain is darkened by vertex colour (an approximation: the source has no end-grain map).
- Material groups kept separate: sofa = upholstery, piping, wooden legs, brass hardware; table = top, apron, legs, end grain, brass hardware. Real geometry: subdivided, domed cushions with creases, piping cords round seat/back cushions and the frame, arms as full-height rounded blocks, bevelled table top, splayed legs with brackets and foot caps. Old builders untouched for every other piece.
- Bugs found and fixed on the way (worth remembering): mirrored UV handedness inverts normal maps (fixed by right-handed frames); a centre-to-rim lathe fan makes flat tops look dished; the sun/overhead shadow `normalBias` 0.02 caused ~1 cm shadow acne on near-horizontal tops (now 0.05; the old procedural table's stripes are its own texture and remain in the "before" images); the window view ignored the lighting preset (an "Evening" room looked out on noon; now dusk / golden variants).
- Compare: `references/material-pilot/index.html`. Three sets per lighting (daylight = `natural`, evening = `moody`), six cameras, 1600×900, fixed cameras/FOV/layout/exposure: **before** (original code), **before under the new lighting** (old pieces, `NESTED_LEGACY=1`), **after**. Use the middle set to judge the material change; the lighting fixes alone changed the first two.
- Shop cards: pilot pieces wait for their maps before drawing, and are drawn at lower exposure so a light cloth does not clip to white (the card is still lighter than the room).
- Measured (Snapdragon X Plus, Adreno X1-45, real window canvas 2094×1342, eye-level camera, idle, reduced motion, 240 rAF intervals, display quantises to 8.3 ms): baseline median 8.4 ms / p95 16.8 ms; this build 8.4 / 16.7 over five runs. One earlier run read 16.6 median and was not reproduced (cause unknown). The smoke test's own frame sample (imported glass model, automation) reads 16.6 median on both this branch and untouched `main` run the same day, so that figure reflects machine state, not this change (the 8.4 recorded earlier for it was on another day). Frame timing while dragging, or with transmissive glass, was not measured.
- Memory: six 2K maps ≈ 135 MB of GPU texture memory by arithmetic (RGBA8 + mips), and about twice that if the Shop's separate thumbnail renderer also holds them. That is an estimate; GPU memory was not measured. Reducing thumbnail cost (a 512 px set, or KTX2) is the obvious next step before this is used on more pieces.
- Not verified: other GPUs / macOS; a second lighting comparison with a physical swatch; that the herringbone weave reads correctly at typical viewing distance (it is a fine weave: at eye level it reads as flat cloth, only close-ups show weave); installed-app offline behaviour (dev/test Electron only; the packaged build was not rebuilt).
- Next, only after the two examples are accepted: write the material-intake pattern (`SOURCES.md` + `materialSources.js` + test) as a reusable doc and extend to other furniture. Nothing else was retextured.

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
