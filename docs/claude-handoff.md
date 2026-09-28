# Claude Code handoff — 2026-09-28

## Where to continue

Update (Claude Code, later on 2026-09-28): milestone 3 work is committed on this branch after `2b0be17`. It adds private GLB import, project format v2, the rendering-defect fixes and performance changes. `docs/progress.md` records exactly what was verified and measured. The recommended milestone below is now partly done; the progress file's "Next work" list supersedes it.

Active working copy: `C:\dev\nested-desktop`. It was moved out of OneDrive on 2026-09-28 to save cloud storage, so OneDrive no longer backs it up. The branch is pushed to GitHub (`origin/codex/nested-desktop-foundation`, first pushed 2026-09-28); push new commits to keep that copy current. The untouched prototype `room-maker-main` remains at `C:\Users\orenh\OneDrive\Desktop\Nested\room-maker-main`.
Branch: `codex/nested-desktop-foundation`.
Desktop implementation checkpoint: `f4a60f4`.
GitHub remote: `https://github.com/ohorak2002/room-maker`.

The original `room-maker-main` sibling folder is the untouched prototype, not the current implementation. The two Downloads ZIPs are preserved originals. All 92 ZIP files were compared with the extraction; the GitHub baseline matched after line-ending normalization. See docs/audit.md for hashes and baseline commit.

The branch `codex/nested-desktop-foundation` is on GitHub; `main` there is still the untouched prototype baseline. On another computer, clone the repository and check out this branch (`node_modules`, `release` and `artifacts` are not in Git; run `npm ci`).

## Product decisions and collaboration preferences

- Nested is a downloadable desktop application for interior designers and their clients, separate from CardWise. Windows first; keep future macOS feasible.
- Controlled restart, preserving useful React/Vite/Three.js/Zustand work. Electron was selected and implemented. Do not restart the architecture debate or rewrite the editor without concrete evidence.
- Improve interactive rendering first. No required Blender installation, cloud rendering or expensive rendering on furniture moves. Optional final rendering is a later separate job.
- No visual reference images have been supplied for the new direction. Neutral, reversible aesthetics until then. The screenshot evidence below is the prototype output, not a user-approved visual target.
- Real products need exact variants, source/dimension/material evidence and permissions. Unknowns remain unknown. Private designer uploads are separate from a shared commercial catalog; photo/feed access does not imply AI-processing or model redistribution rights.
- Preserve original materials for faithful assets. (The prototype's converter dropped textures/material groups and its Meshy integration requested untextured models; both were removed with the server API.) Keep conceptual/AI geometry clearly labeled; do not automatically recolor retail finishes.
- Continue authorized reversible work without repeatedly asking permission. Ask only when missing information materially affects an important decision. Use plain language and report measured evidence, failed checks and unverified areas honestly.

## Current implementation map

- `desktop/main.mjs`: Electron window, local protocol/CSP, narrow IPC, native dialogs, recovery, close handling. No Node in renderer. App-ready work must be in a callback, not top-level await, to avoid the observed ESM startup deadlock.
- `desktop/preload.cjs`: isolated renderer bridge.
- `desktop/files.mjs`: atomic save replacement, previous-save backup, bounded read.
- `shared/project.mjs`: defaults, project schema/validation, serialization; inspect compatibility before changing saved fields.
- `src/components/DesktopProjects.jsx`: project/client fields and save/open/recovery UI.
- `src/store/roomStore.js`: preserved editor store; defaults now come from shared/project.mjs.
- `src/components/RoomCanvas.jsx`: interactive renderer, camera, placement UI and PNG export.
- `src/three/buildRoom.js`, `textures.js`, `atmosphere.js`: room/furniture/material/lighting implementation.
- Online model generation, retailer size lookup and the server API were removed (desktop-only decision); imported models go through `src/three/assetLoader.js` and `shared/assets.mjs`.
- `test/project.test.mjs`, `scripts/desktop-smoke.mjs`: persistence and real Electron smoke checks. The latter stubs native dialog selections, uses a temporary user-data folder and verifies restart recovery.

## Evidence available to you

Tracked copies in `references/desktop-baseline/`: `desktop-workspace.png`, `desktop-room.png`, `desktop-validation.json`. These are evidence from the final implementation smoke test, not reference inspiration. Original generated versions also remain in ignored `artifacts/` locally.

Local ignored build output: `release/Nested Setup 0.1.0.exe` and ARM64/x64 unpacked executables. Installer is unsigned. Both packaged executables launched; install/uninstall and clean-machine behavior remain unverified. Rebuild with `npm run desktop:dist` when needed. `node_modules`, `dist`, `release` and `artifacts` are not transferred by Git.

The 120-frame sample was collected while packaging was running. Do not present it as an isolated performance benchmark. Actual images show a dark rectangular artifact, opaque-looking window, strong ceiling highlight and obvious floor texture repetition. No convincing-room quality milestone has been claimed.

## Recommended next bounded milestone

Read the original brief, progress and audit, then inspect the baseline images. Implement a material-preserving private GLB path with standard GLTFLoader, local asset persistence and explicit authored units/orientation handling. Preserve UVs, textures, separate material groups and PBR properties; do not route faithful assets through the tintable converter. Verify loading and saving/reopening a project offline with its imported asset. Use an authorized or original test fixture and record provenance.

Then fix the observed visual defects and review a small room containing upholstery, wood, metal, patterned rug and glass from multiple angles. Improve measured precision beyond the inherited half-metre grid before claiming exact room dimensions. Run targeted tests and inspect images. Keep subsequent catalog partnerships, client sharing, signing/updates and optional final rendering scoped to later work.

## Continuity limits

This is a factual handoff, not an import of Codex's live conversation or private internal state. The original user brief is copied verbatim to docs/original-user-brief.md; project decisions and results are in these files. Tool access, credentials, plugin installations, user-level instructions and model behavior may differ in Claude Code. Discover available capabilities; do not assume Codex tools exist there. No credentials were exported.

The local Git installation had no author identity configured. The implementation checkpoint used a per-command Codex identity; no global Git configuration was changed. Avoid assuming the user's desired commit author identity is configured.
