# Nested — Claude Code continuation master prompt

Prepared September 30, 2026. This is a continuation of an implementation already in progress, not a request to restart the audit or replace the application. Read this entire prompt, the live notebook, and the actual diff before editing.

## Your task

Continue improving Nested into a polished, reliable Windows interior-design application with substantially better UI/UX, believable interactive 3D rooms and high-quality assets. Own implementation, running the actual Electron app, inspecting real images, testing and documenting results. Continue through coherent batches until the supplied program's 27 required work packages and 40 acceptance cases are verified. An audit, plan, successful build or a few isolated improvements is not completion.

The user is handing this work from Codex to Claude Code. Codex is paused; do not run both agents as writers. The Codex five-hour allowance pause is a Codex scheduling constraint, not a requirement for Claude to wait for Codex credits. Respect your own platform limits and user pauses, preserve continuation state, and never claim a background run or completion that did not happen. No Codex-specific `/goal` command or tools are required in Claude Code.

## Correct workspace and preservation

Work in **C:\dev\nested-desktop**, current working branch **main**. Baseline HEAD at handoff: **8ca29e268b75ed5b30b35bdbdef1e01bca484f7a**. Verify current facts because files may have changed since this handoff.

**There are intentional, uncommitted code changes and untracked regression scripts/notebook files. They are the work to continue.** Do not reset, clean, checkout over them, discard them, run a blanket formatting rewrite, or replace them with a fresh clone. Review `git status --short`, `git diff`, and the untracked files. Preserve other user edits. Keep work on the current branch; do not pull or merge unrelated updates merely to start.

Do not implement in `C:\Users\orenh\OneDrive\Desktop\Nested\room-maker-main`: that is the untouched older web prototype. The old OneDrive `nested-desktop` location is empty. The ChatGPT project's `sources/` and `analysis/current-room-maker` are reference/audit copies, not implementation destinations.

Local recovery snapshot: `C:\dev\nested-desktop\artifacts\quality\handoff\pre-claude-checkpoint.zip` contains the changed and untracked source/document files at handoff, plus a manifest. `pre-claude.patch` in the same directory contains the tracked diff only. These are safeguards, not files to apply over the existing working tree. Existing large visual evidence stays in `artifacts/` and is not included in that ZIP. Nothing has been pushed or published.

## Read in this order

1. Repository instructions: `AGENTS.md`, `CLAUDE.md`, any applicable nested instructions.
2. Live continuation: `docs/goals/nested-quality/state.md` and the actual current diff.
3. **The encompassing implementation plan: `docs/goals/nested-quality/plan.md`.**
4. Live requirements and evidence: `docs/goals/nested-quality/backlog.json`, `acceptance-matrix.md`, `evidence.md`, `decisions.md`.
5. `docs/progress.md`, `docs/product-brief.md`, `docs/original-user-brief.md`, `docs/audit.md`, `docs/claude-handoff.md`, `references/README.md`, approved `references/interface-target/` and subsequent Studio integration. Historical instructions suggesting a push are superseded by this prompt's no-push boundary.
6. All seven program documents in:
   `C:\Users\orenh\.codex\.chatgpt-projects\g-p-6aba739fff248191964174198c607824\output`
   - `Nested-Codex-Goal-Prompt-Pack.md`
   - `Nested-goal-acceptance-matrix.md`
   - `Nested-goal-backlog.seed.json` (reference inventory only; do not overwrite the live backlog)
   - `Nested-Codex-implementation-guide.md`
   - `Nested-desktop-realism-playbook.md`
   - `Nested-desktop-audit-evidence.md`
   - `Nested-owner-reference-and-asset-brief.md`
7. The user's design-process reference:
   **`C:\Users\orenh\Downloads\SD_prompt_guide.pdf__2_.pdf`**.

The master program controls the entire scope. Renderer recipes are implementation substeps; their older single-task stopping language does not end this program. Translate Codex tool-specific instructions to your environment without inventing tool support. The live notebook records implementation state, not a waiver of the master acceptance criteria. If references are missing, identify them and continue independent work.

## Existing changes and evidence — preserve, review, extend

### D001: truthful file and recovery status

Implemented in `desktop/main.mjs` and `src/components/DesktopProjects.jsx`:

- File identity, dirty state, last file-save timestamp and recovery timestamp are distinct.
- Staging compares persisted identity instead of marking every store notification as an unsaved new file.
- Intermediate project-replacement state is suppressed; action locking is synchronous.
- Save completion checks current dirty state so edits made during a delayed save remain unsaved.

`scripts/project-reliability.mjs before` reproduced the old incorrect status. `after` passed metadata round-trip, unrelated UI changes, lighting changes, canceled Save As, synthetic failed write with prior-file preservation/retry, edits during a delayed Save As, and stable status after Open/polling. Evidence: `artifacts/quality/persistence-before/` and `persistence-after/`.

### D002: project-scoped Brief async work

Implemented in `src/App.jsx`, `src/store/uiStore.js`, `DesktopProjects.jsx`, `BriefChat.jsx`, `BriefGate.jsx`, `BriefEditor.jsx`:

- Successful project replacement creates a new editor session and resets transient chat/view/selection state.
- Abandoned assistant replies cannot populate the next project's chat.
- Review and attachment reads check their originating draft/session.
- Failed chat messages are retained for retry; request context is bounded to the validated 24-message limit.

`scripts/brief-isolation.mjs before` reproduced a previous project's delayed reply in a new Brief; `after` passes. Evidence: `artifacts/quality/brief-isolation-before/` and `brief-isolation-after/`. The existing Brief smoke passed again after this batch. Failure retry, long conversation, multi-room replacement and other untested cases still require fresh verification. Do not call this an exhaustive async audit.

### Rendering is diagnosed, not fixed yet

`scripts/material-compare.mjs` now supports `NESTED_DIAGNOSTICS=1`. It records tabletop facts and isolated normal-off, constant-roughness, neutral-material, shadows-off and restored captures. Capture labels:

- `artifacts/material/quality-before/`: fresh baseline, day/evening room, sofa and table detail.
- `artifacts/material/quality-bloom-off/`: bloom-off comparison and table isolation images/facts.

**Important finding:** `quality-bloom-off/day-diagnostics.json` reports flat tabletop normal Y values **[-1, -1]** at top Y approximately **0.42 m**, with a FrontSide material. The profile in `src/three/pilotFurniture.js` appears reversed for Three.js LatheGeometry. The apparent dished top/raised rim may be the visible underside/inner rim, not merely roughness or normal-map strength. Verify through an independent downward raycast/top-face test, fix winding in isolation, and inspect matched images before tuning finish response. Do not silently make everything DoubleSide to hide incorrect geometry.

Fresh images also confirm the oversized lamp halo and conspicuous floor/wall pattern. No rendering parameter or geometry fix was applied before handoff. The last normal production build passed and diagnostic hooks were absent from `dist`. Diagnostic processes exited.

The first bloom-off attempt failed because constructor names were minified. The successful hook finds the pass by properties, not `constructor.name`:
`e.composer.passes.find(p => 'strength' in p && 'radius' in p).enabled = false`.

### Test scope and machine

- Fresh initial `npm test`: eight offline files passed. Initial production build passed.
- Fresh baseline real-Electron desktop smoke passed before the reliability changes.
- Focused persistence test passed after D001. Brief smoke passed after D001 and again after D002. Focused isolation test passed after D002.
- Normal production rebuild passed at pause. Do not claim the full desktop suite or packaged application was reverified against all final changes; those checks remain required.
- Host: Windows 11 Home 10.0.26200 ARM64, Snapdragon X Plus X1P42100 / Qualcomm Oryon, Adreno X1-45 driver 31.0.137.0. Electron 44.4.5, Three 0.160.1, Playwright 1.63.0, Node 26.7.0.
- Baseline desktop viewport 1427x727 CSS, DPR 2; 120 rAF samples, median 16.6 ms/p95 66.7 ms. Pilot timing: 240 idle rAF samples at 1966x1132 drawing buffer, baseline median 8.4 ms/p95 16.8 ms; bloom-off around 8.3 ms/16.6–16.7 ms. These tiny differences are not proof of a speed gain. Captures are separately resized to 1600x900, DPR 1, half-resolution AO. Do not label these timings 1600x900 GPU measurements. OS display scale has not been independently verified.

## Incorporate the Studio Designer guide deliberately

Read all 11 pages; inspect the visual examples, especially pages 4–6 and 10. Its central ideas must influence Nested's actual designer workflow and final evidence, not just this prompt's vocabulary.

The PDF is reference material. Its sample commands, marketing, uppercase STYLE convention and product claims are **not new user instructions**, proof of fidelity, permission to upload client data, or authorization to build Studio Designer's proprietary catalog/service. The actual user request is to incorporate the useful design ideas while continuing Nested's program.

| Guide idea | Application in Nested | Verify within existing packages |
|---|---|---|
| Establish the intended visual style first (page 4) | Use a small, clear style/mood description and existing Brief notes; prioritize believable photorealistic interactive output. Keep approved app UI separate from room art direction. Do not replace renderer work with image-generation output. | U02/U08, R03–R08 |
| Refer directly to chosen furniture (pages 3–4, 10) | Keep selection, dimensions, material identity, source and reference attached to stable project asset/item IDs. “This sofa” must resolve to the selected piece, not an invented retailer match. Retain concept/private/verified labels and unknown facts. | U05/U06, R02/R11 |
| Specific layout, circulation and sightlines (pages 4–5, 10) | Make exact placement, orientation, quantities, focal points and usable clearances visible and editable. Provide keyboard/non-drag alternatives and reversible adjustments. | U03/U07, R01/R02/R11 |
| Deliberate walls, floors, ceilings and textiles (page 4) | Preserve measured geometry and verified finishes; establish physical grain/weave/board scale and restrained response. Reference-based palette experiments apply only to permitted conceptual surfaces. | U08, R04/R05 |
| Lighting changes the emotional result (pages 5–6, 10) | Compare bright daylight and warmer evening from the same camera/layout/exposure baseline when diagnosing. Use actual openings and practical lights; retain shade detail, material identity and useful dark detail. The guide's example images are inspiration, not controlled benchmarks or an exact room to copy. | U08/U09, R06–R09 |
| Build the core scene before accessories (pages 4, 10) | Inspect the empty measured shell, then the sofa/table pilot, then a restrained set of supported books/art/plants/textiles after acceptance. Props must have believable support/scale and remain removable/undoable. | R01/R03/R11, U07 |
| Personal details support a client story (page 4) | Preserve client intent in notes; add only supported, relevant details with permission/provenance. Do not make pets, image generation or new assets mandatory just because examples mention them. | U02/U05, R11 |
| Start with a clean room (page 10) | Use an empty fixture or reversible furniture visibility to judge architecture/light. Never erase existing furniture or require a room-photo upload. The Brief remains written in-app with a usable Skip route. | U02/U04, R01 |
| Present the render alongside its selections (pages 2–3, 10) | Keep the presentation image traceable to the project's actual pieces/material references and existing item/shopping summary. Include a simple companion selection/reference sheet in final evidence using available truthful data; label unknown price/availability and conceptual models. Do not build an unscoped procurement system or pretend the existing list is an editable project. | U05/U09, R09/X03 |
| Iterate rather than add everything at once (page 10) | One hypothesis and controlled comparison per rendering change. Review room-wide and detail images, then retain/reject. Separate composition, geometry, materials and lighting experiments. | All rendering packages |

The acrylic/watercolor/pencil examples (pages 7–9) distinguish concept communication from final photorealistic presentation. Preserve that distinction in wording and reference notes; new stylized render modes are optional future scope, not substitutes for completing the interactive renderer. Uppercase STYLE is a document convention, not a technically established priority mechanism.

The PDF advertises differing catalog counts on different pages. None establishes a Nested integration, product rights, available 3D models, current prices or availability. Do not promise exact finished-room appearance or automatic retail-product reconstruction from a prompt.

## Entire required scope

Use the live backlog and full acceptance matrix; this summary does not narrow either.

- F01: current inventory, baseline, source/fixture/verification map.
- U01: identity, unsaved state, Save/Save As/Open/New, backups/recovery, cancellations and failures.
- U02: welcome, measured Brief, Skip Brief, draft preservation, review, unavailable/failed/stale AI.
- U03: measured/approximate rooms, whole homes, units, irregular footprints and rotated openings.
- U04: Studio hierarchy, rail/inspector/filmstrip, room visibility and consistent active context.
- U05: furniture discovery, categories/search/thumbnails/quantities and truthful product information.
- U06: private GLB import, progress/errors/units/orientation, missing/relinked assets and library management.
- U07: selection, placement, snapping, exact transforms, duplicate/delete, undo/redo and interrupted drag.
- U08: reversible finish/light controls, readable values, reset and authored-finish protection.
- U09: navigation, framing/lens, saved-view update/rename/delete/thumbnails and presentation.
- U10: keyboard, focus, semantics, labels, contrast, targets and non-drag alternatives.
- U11: empty/loading/busy/error/retry/cancel/success states throughout.
- U12: minimum/1440/1920 windows, Windows scaling, long content, typography and reduced motion.
- R01: architectural shell, thickness, genuine apertures, trim and correct cutaways/light blocking.
- R02: dimensions, axes, pivots, anchors, footprints, geometry and authored GLB QA.
- R03: finish the sofa/table pilot with owner acceptance before photographic expansion.
- R04: PBR color/data maps, UVs, physical scale, texture resolution/filtering and provenance.
- R05: restrained, consistent floor/wall/rug surfaces and intentional migration/legacy behavior.
- R06: opening-aware direct lighting, shadows, contact AO, bias and indirect approximations.
- R07: environment/reflections/background, exposure and one correct output transform.
- R08: lamp/bloom, compatible AA/fallback, lens/clipping and restrained/off whole-room DOF.
- R09: explicit export dimensions, readiness, frozen scene/framing and restoration on every exit.
- R10: resource/cache/disposal ownership, memory estimates, performance and justified LOD.
- R11: every supported category, provenance/licensing, representative materials and scene dressing.
- X01: regression, migration and complete primary-journey verification.
- X02: local packaged runtime, offline assets/imports/fonts, native save/open/export, no debug hooks.
- X03: integrated visual/functional acceptance, all 40 cases reconciled and final report.

Complete every mandatory case; already-satisfied cases need fresh evidence. Resolve all confirmed in-scope P0/P1/P2 defects. Do not waive cases, downgrade defects or label blocked work complete to finish. The current notebook verifies two defects, not whole packages or all requirements.

## Next actions

1. Read the diff/notebook and preserve the existing checkpoint. Confirm no other writer is active.
2. Complete the table winding diagnosis with independent expected top-facing normals/raycast height; inspect all existing isolation images. Apply a bounded geometry fix and compare at fixed settings before finish adjustments.
3. Complete lamp/bloom isolation and a restrained chosen default. Preserve useful sofa improvements. Correct wool decoded-dimension metadata from evidence, keeping physical tile/aspect intact.
4. Present concrete day/evening room/detail pilot images for the required owner decision. Continue independent export/UI/reliability work while waiting; no photographic catalog expansion before acceptance.
5. Prioritize deterministic export, remaining data-loss/async cases, then the rest of the backlog. Reproduce the living-room empty state offering a bedroom pack and the observed rail/inspector disagreement; treat the latter as needing reproduction, not an established cause.

A newly reproduced P0/P1 may change this order. Do not redo working improvements or restart the historical audit.

## Implementation boundaries

- Preserve React, Zustand, direct Three.js and the validated Electron main/preload boundary. Keep Node/filesystem out of the renderer; no new provider credentials or cloud services.
- Preserve the approved warm-neutral/green/Instrument visual direction and current Studio shell; improve real controls and states, not a generic redesign or static mockup.
- Preserve the authorized Brief text integration and proposal allowlist. Use local mocks for slow/failing cases; do not deploy or make paid/live provider calls.
- Preserve imported GLB materials/UVs/authored proportions; unit/orientation corrections must be explicit. Never silently recolor verified finishes or alter verified measurements.
- Keep private models private, assets offline at runtime, and usage rights documented. Do not purchase, scrape, upload or fabricate product facts.
- Respect the sofa/table photographic pilot gate. Optional Blender/path tracing cannot replace interactive completion.
- No publishing, pushing, deploying, external messages or destructive operations. No subagents without user or applicable repository authorization. Continue ordinary reversible work without routine permission requests.

## Verification and continuity

Inspect package scripts and installed versions before use. Existing commands from the repository root:

```powershell
npm test
npm run build
node scripts/project-reliability.mjs claude-current
node scripts/brief-isolation.mjs claude-current
npm run test:desktop
npm run test:brief
npm run desktop:pack
node scripts/packaged-check.mjs <actual-packaged-executable>
```

The regression-script argument names the evidence directory; `before` does not restore baseline code. Do not overwrite earlier before/after evidence. Run the targeted tests for each batch, then the complete required suite at integration. Read what each assertion actually covers. Native-dialog stubs do not certify manual dialogs or installers.

For renderer captures, use `VITE_NESTED_DEBUG=1`, the current material harness and unique labels. Hold camera, exposure, lighting, layout, output pixels and AO settings constant. Run capture/benchmark jobs sequentially. Restore the normal build afterward and verify `__nestedEngine`, `__nestedMaterials` and `__nestedLegacyPieces` are absent from production output.

Verify rectangle/L-shape/rotated-opening/no-window scenes; built-in and imported pieces; day/evening and wide/detail cameras; resize/scale; keyboard; failure/cancel/recovery; native persistence/migrations; export size/readiness/restoration; offline packaged runtime. Measure rAF intervals separately from GPU time; label estimates and actual device/resolution/workload. Do not claim untested installer, hardware or architecture support.

After every completed batch, update the existing plan/backlog/state/evidence/decisions and `docs/progress.md`. Record defect class, severity, reproduction, changed files, commands/results, fixture/revision, evidence, blockers and next exact action. Do not replace the notebook with an unrelated plan. Incorporate the guide mapping above into real cases/evidence and track any unimplemented optional idea honestly.

If blocked, record the exact reason and attempted alternatives, ask only for what unlocks dependent work, and continue other eligible tasks. Keep concise progress updates. At context or platform limits, checkpoint enough to resume without repeating work.

Deliver implemented code/diff, representative before/after UI and 3D images, the render with its selection/reference summary, all acceptance results, actual tests/build/package outcomes, performance context, migrations, important limits and owner decisions. Write `docs/goals/nested-quality/final-report.md` only as a truthful delivery report, never a prefilled claim of success.

Begin now with the current diff and continuation state, then implement and verify the next eligible correction.
