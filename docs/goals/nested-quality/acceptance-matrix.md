# Nested Goal acceptance matrix

Use with Nested-Codex-Goal-Prompt-Pack.md. These are required verification cases for the activated implementation goal, not claims about current failures or completed work. Date: September 30, 2026.

## How to record a result

For each row, record status (unassessed / fail / pass / blocked), tested revision, fixture, actions, expected versus actual result, evidence path, and defects discovered. “Already works” requires current evidence. “Not applicable” requires a source-supported explanation and cannot remove a core requirement without the user's scope decision.

Prefer an existing automated test where it actually covers the behavior. Use focused integration tests for state transitions, migrations and async failures. Use real Electron interaction and screenshots for layout and visual quality. Do not create brittle unit tests asserting incidental CSS or duplicating renderer formulas. Automated accessibility checks supplement keyboard and visual inspection.

A case cannot pass solely because a command exited successfully; its assertions and artifacts must establish the behavior. Screenshots prove appearance at a particular state, not save correctness or memory stability.

## Required user journeys and UI cases

| ID / packages | Exercise | Pass condition and evidence |
| --- | --- | --- |
| QA01 — F01 | Inspect the current branch, instructions, app entry points, scripts and existing fixes. Run baseline checks and map all work packages. | Source/diff, environment, reachable-surface inventory and baseline captures recorded. Old audit findings classified as still confirmed, resolved or requiring reproduction. |
| QA02 — U01 | New project; edit name/client; save; edit room; save again; reopen. | File identity, dirty state, last successful save and recovery status remain truthful. Metadata and scene round-trip together. State assertions plus project-bar capture. |
| QA03 — U01/X01 | Cancel New/Open/Save As; reject corrupt/unsupported project; simulate write failure through a test fixture. | Existing live project, user input and previous file remain intact. Clear failure/cancel behavior and no misleading “saved” state. Never test failure by damaging a real client file. |
| QA04 — U01/X01 | Recover after an interrupted test session; inspect backup and missing-path handling. | Recoverable scene is offered with clear identity; backup/recovery not confused with a chosen project file; saving recovered content succeeds. |
| QA05 — U02 | First launch: start measured Brief; separately use Skip the Brief. Return to a draft and correct errors. | Both routes work; approximate route is labeled; draft content survives; correct field/section identified; no mandatory upload/dead end. |
| QA06 — U02/U11 | Brief service unconfigured, slow, failed and returning a proposal. Change projects while a request is pending. | Manual work stays usable; request state clear; proposal only applies with intended user action and validated allowlist; stale response cannot mutate the wrong project. Use local mocks; no paid/live call needed. |
| QA07 — U03/R01 | Rectangular measured room and L-shaped room with an offset/rotated opening; feet/metres round-trip. | Expected footprint, height and opening coordinates preserved independently of bounding rectangle and display rounding. Matching plan/3D and persisted-state evidence. |
| QA08 — U03 | Invalid dimension/footprint edit, room switching, repeated room names and changing finishes in a measured room. | Last valid geometry survives rejection; active room stays unambiguous; aesthetic edits do not mutate measurements; retained notes remain accessible. |
| QA09 — U04/U12 | Room/Pieces/Finishes/Light/Views navigation, hide/show inspector and filmstrip, change active selection/view. | Current tool, room, selection and view agree. No stale inspector or unreachable primary control. Layout captures at supported sizes. |
| QA10 — U05 | Browse/search categories, zero matches, missing image, long title, unknown price; add twice then remove/undo. | Scope of search is truthful; counts and in-room state agree; conceptual status visible; no fabricated price/variant; result/empty states actionable. |
| QA11 — U06/R02 | Import a self-contained GLB with several materials, authored textures and known dimensions; choose units/orientation; place/save/reopen offline. | Materials/groups/UVs preserved; correction explicit; bounds/anchor predictable; reload matches. Capture and dimensions/import report. |
| QA12 — U06/U11 | Malformed, oversize, missing-data or unsupported-extension GLB; cancel import; import duplicate content. | Specific useful failure, no broken scene or false success, no stranded busy state; duplicate handling intentional and library records consistent. |
| QA13 — U06/R10 | Place the same model several times; remove one; make an asset unavailable then relink in a test project. | Shared instances continue rendering; placement removal does not destroy a shared library file; missing/relinked state preserves intended instance identity. |
| QA14 — U07 | Select overlapping/small objects; move/rotate/nudge; drag outside window; cancel/interruption. | Picking or list alternative usable; no stuck capture; accurate transform feedback; furniture not stretched; selection/inspector synchronized. |
| QA15 — U07/X01 | Duplicate/delete/auto-arrange; undo/redo through changes; invoke shortcuts while editing a text field. | Reversible edits restore expected transforms, IDs and quantities; drag history coalesced usefully; text editing retains native shortcut behavior. |
| QA16 — U08/R04 | Change room finish, concept finish, light preset, brightness and sun; reset; select an imported/verified material. | Only intended parameters change; reset restores correct recorded/default state; authored materials protected; values and constraints understandable. |
| QA17 — U09/R08 | Save/update/rename/delete a view; change window size; save/reopen; enter/exit presentation. | Intended framing/light return with fresh thumbnails; no implied layout snapshot unless actually supported; overlays return after presentation; no trapped camera. |
| QA18 — U10 | Keyboard-only primary controls, rail/tabs, ranges, menus and dialogs; Tab/Shift-Tab/arrows/Enter/Space/Escape. | Predictable order, visible focus, correct tab semantics, modal return focus and no unintended traps. At least one usable non-drag placement route. |
| QA19 — U10 | Inspect names/roles/status announcements; measure representative normal/large text contrast and pointer targets. | Controls named; selected/error states not color-only; published contrast/target criteria or valid exceptions met. Results distinguish measured checks from untested screen-reader behavior. |
| QA20 — U11 | Empty project/library/search; slow asset load; failed image export; retry; duplicate action during busy state. | Meaningful empty/loading/error/success states; no fake progress, blank app, lost input, duplicate operation or persistent false status. |
| QA21 — U12 | Supported minimum, 1440×900 and 1920×1080 logical windows; relevant OS scaling; enlarged text; long/Unicode content. | Primary tasks remain reachable; no clipped dialogs, accidental horizontal scroll or illegible values. Actual dimensions/scale recorded, not inferred from image alone. |
| QA22 — U12 | Reduced motion and normal motion; load resources while switching panels and navigating. | Motion respects preference and never blocks input; no distracting camera drift, reflow or stale animation. Inspect a short interaction sequence. |

## Required 3D and presentation cases

| ID / packages | Exercise | Pass condition and evidence |
| --- | --- | --- |
| QA23 — R01/R06 | Interior and outside cutaway for rectangle, L shape, rotated opening and no-window room. | Correct apertures/thickness, stable surfaces, sensible light blocking; no known leak or false panel; cutaways only serve intended navigation. |
| QA24 — R02/R11 | Inspect each supported built-in category and representative imports from multiple angles with measured bounds and anchors. | No untracked gross dimensional, missing-part, pivot or silhouette defects. Clear verification/provenance and appropriate correction route. |
| QA25 — R03 | Sofa room view, arm/seam, fabric/leg under day/evening with fixed camera/exposure. | Believable weave scale, supported cushions, plausible piping and variation; no conspicuous stretching or repeated fold defect; preserve pilot dimensions. |
| QA26 — R03/R04 | Table normal-off, constant-roughness, neutral material and light-shadow isolation, then chosen final material. | Root-cause evidence recorded; final satin/other selected finish explicit; no unexplained rim bands or exaggerated ridged highlights; restoration of diagnostic overrides proven. |
| QA27 — R04 | UV checker, grain/weave direction, grazing light, map metadata and physical repeat. | Correct color/data spaces and normal orientation; no hero seam/stretching; tile dimensions/aspect respected; map availability and license metadata recorded. |
| QA28 — R05 | Same floor/wall material in default and measured rooms; wide and close views with furniture/rug contacts. | Consistent physical scale and intentional migrated behavior; calmer joints/noise; no seams, floating rug or unintentional displacement-like pattern. |
| QA29 — R06 | Thin legs, rim, wall corner and window frame across sun/light changes; drag a caster. | No confirmed acne/detached contact or stale shadow; AO is local without broad halos; secondary fill does not create implausible competing silhouettes. |
| QA30 — R07 | Matte gray, white, wood, metal and supported glass under day/evening; environment/backdrop/sun consistency. | Material identity retained; plausible highlights/reflection context; one output transform; no exposure/tint compensation masquerading as material correction. |
| QA31 — R08 | Lamp wide/detail with bloom experiment; slow motion on window diagonals, legs and patterned surfaces. | Shade shape retained; restrained glow; stable edges/specular detail; tested AA fallback; no double effect/output conversion. |
| QA32 — R08/U09 | Eye-level and detail lenses at multiple aspects; level verticals, near-wall camera and saved-view reload. | Lens labels correspond to a defined sensor/FOV convention; no unintended wall clipping or misleading room distortion; framing reproducible. |
| QA33 — R09 | Export 1920×1080 and supported larger size from different window sizes/DPR; export immediately after import. | Exact pixels/crop; all required resources ready; no editor overlays; same scene revision/material identity; requested output independent of viewport. |
| QA34 — R09/U11 | Cancel export/dialog; fail resource load/write; resize/switch view during a controlled export test. | No unfinished image reported as success; coherent concurrency policy; camera/renderer/composer/AO/DPR/controls restored on every exit path. |
| QA35 — R10 | Fixed small/furnished scenes, orbit and drag, repeated room switch/import/remove; sample after warmup. | Timing/resource evidence with machine/resolution/workload; no attributable unbounded resource growth or broken shared resources; target and fallback policy explicit. |
| QA36 — R10/R11 | LOD thresholds and representative upholstered/wood/metal/glass/textile/organic assets as available after pilot gate. | No conspicuous silhouette/material pop; correct anchors/contact; footprint supports placement; asset acceptance and license evidence valid. Missing required assets remain blocked rather than silently passed. |
| QA37 — R11 | Dressed reference scene, day/evening; remove/undo props and reopen. | Plausible scale/support/clearance, restrained imperfections, stable procedural seeds and preserved scene state. Catalog pilot gate met before material expansion. |

## Final integration cases

| ID / packages | Exercise | Pass condition and evidence |
| --- | --- | --- |
| QA38 — X01 | Current complete offline suite plus relevant Electron desktop/Brief workflows on final code; supported project migrations. | Required tests pass with output recorded; independent state assertions cover key regressions; no debug mocks shipped as production behavior. |
| QA39 — X02 | Local packaged runtime on available target architecture without dev server; private GLB, maps/fonts, native save/open/export and offline operation. | Bundled resources/protocol work; debug hooks absent; no unexpected network; distinguish packaged launch from installer and cross-architecture testing. |
| QA40 — X03 | Final whole-app and clean-image review, diff review and backlog reconciliation. | All required rows pass; every work package evidenced; no unresolved in-scope P0/P1/P2; optional items and untested environments clearly separated. |

## Representative fixtures to retain

Keep fixtures deterministic and free of private client data. Use the repository's current material and smoke-test scenes where suitable.

- F-A: approximate room reached through Skip Brief, initially empty.
- F-B: measured rectangle with dimensions/openings supplied explicitly in the test.
- F-C: measured irregular room and rotated opening with independently expected geometry.
- F-D: sofa/table/lamp/rug pilot, fixed daylight and evening cameras.
- F-E: imported multi-material GLB with documented dimensions and shared instances.
- F-F: supported glass/metal/textile/organic pieces and a furnished stress room.
- F-G: invalid project, older version, missing model, interrupted recovery, delayed/failed resource and failed write fixtures.

Do not call the existence of a fixture a passed test. Store which cases actually ran against it.

## Stop and completion rules

If any mandatory row fails, fix it and retest the affected flow. If blocked, record the exact unmet input/capability, its impact and attempted alternatives; continue other eligible work. Do not auto-waive a row to complete the goal.

A completed goal includes the implementation, checked evidence and final report. A report of blockers is useful but is not the same outcome. Respect user pause and platform budgets, retain continuation state, and follow current goal-tool rules rather than bypassing limits.

User review of the photographic pilot is required when the repository's acceptance instruction requires it. Queue that concrete review with images; do not block unrelated UI/accessibility/export work while waiting. Objective checks and owner aesthetic acceptance are separate records.

