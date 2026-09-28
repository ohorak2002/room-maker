# Progress — 2026-09-28

## Completed

- Pulled `ohorak2002/room-maker` into `C:\Users\orenh\OneDrive\Desktop\Nested\nested-desktop`, on `codex/nested-desktop-foundation`. Original extraction and both ZIP files remain untouched. Compared all 92 ZIP files with the extraction and all tracked GitHub contents (normalizing line endings): no differences.
- Audited retained code and documented architecture/milestones. Chose Electron with a sandboxed, isolated renderer, a local content protocol/CSP, denied permissions/navigation and validated, narrow IPC. A single-instance lock avoids concurrent writes to the recovery file.
- Added client/project names, New/Open/Save/Save as, a versioned `.nested` format containing complete current room/home state, custom furniture, placements, uploaded reference images and finish settings. Runtime methods and undo history are excluded. Files are validated before replacing the editor state. Save as can preserve separate alternatives.
- Added native file dialogs, flushed temporary-file replacement, previous-save `.bak`, debounced recovery, restore on next launch, close-time recovery flush and save/cancel choices. Recovery errors are surfaced in the project bar. Normal project saves are explicit; recovery is a separate local file.
- Added PNG scene export and reveal-in-Explorer. Export includes the scene without selection/drag overlays. Shopping-list export is labeled separately.
- Disabled automatic retailer/model requests in desktop. The server API and privileged provider credentials are excluded from the package. Server-only blob tooling moved to development dependencies; production dependency audit reports zero findings.
- Added Windows ARM64/x64 NSIS packaging. Builds are unsigned development artifacts; no update feed configured.

## Verified

- `npm run test:offline`: all five files pass, including new project round-trip/shape/quantity/placement validation, whole-home persistence, backup and failed-write preservation. Live retailer tests deliberately skipped.
- `npm run build`: passes. Existing static/dynamic import overlap warnings remain.
- `npm run test:desktop`: passes in actual Electron 44.4.5 on Windows ARM64. Exercises preload isolation, renderer sandbox, saving, backups, reopening, cancellation, malformed-file rejection without replacing the active design, PNG export, abrupt process exit and recovery after relaunch. Filesystem and IPC are real; native dialog choices are stubbed for repeatability, so manual dialog interaction remains unverified.
- Inspected actual Electron workspace and exported PNG in `artifacts/desktop-workspace.png` and `artifacts/desktop-room.png`. Export is nonblank and reopens as a valid PNG.
- Build command: `npm run desktop:dist` (both Windows architectures). Output: `release/Nested Setup 0.1.0.exe`. Installer signing status is `NotSigned`. Installer install/uninstall and clean-machine compatibility remain unverified.
- Both packaged executables were launched and checked: ARM64 natively and x64 under Windows ARM emulation. Each reports `app.isPackaged: true`, loads `nested://app/index.html`, displays project controls and exposes the narrow preload bridge. Inspected both ASAR packages: no server API, environment file or server blob dependency. This is not a test on physical x64 hardware.

## Rendering evidence / limitations

Machine: Snapdragon X Plus X1P42100, Qualcomm Adreno X1-45, 15.6 GiB reported RAM, Windows build 26200. Sample scene: prototype sofa, coffee table, floor lamp, rug. Viewport: 1427 × 727 CSS pixels, device scale 2; scene export 2094 × 1176 pixels.

Latest 120-frame requestAnimationFrame sample: median interval 8.4 ms, 95th percentile 91.7 ms. This is one short desktop sample, not GPU timing or a responsiveness guarantee; the long tail needs investigation. The benchmark ran under automation while packaging work was also running, so it is not an isolated performance benchmark. The test room lacks the planned glass object and patterned-rug verification and does not establish furniture accuracy.

Visual defects observed: dark rectangular artifact in front of furniture, opaque-looking window patch, pronounced ceiling highlight, overly obvious floor texture repetition. Standard material-preserving GLB import is not yet implemented. This is the desktop foundation milestone, not the convincing-room milestone.

Other remaining limitations: the inherited half-metre room grid is approximate; some UI still follows the original consumer quiz; catalog prices/dimensions/models are conceptual; catalog search links are blocked in desktop until an explicit safe external-link flow exists. Multi-project browser storage migration is not implemented (browser exports were incomplete shopping summaries). Project files are capped at 32 MB; no external asset bundling exists yet. Autosave has a 500 ms debounce; sudden power loss can lose the latest edits, and power-loss durability has not been tested. Source-tree dependency audit still reports four development-tool findings, requiring review before release.

## Next work

1. Material-preserving private GLB import via GLTFLoader, local asset storage and explicit dimensions/orientation checks. Product/asset provenance records separate searchable listings from permitted placeable models.
2. Fix the observed window/shadow defects, texture scale and camera behavior; introduce representative upholstery/wood/metal/rug/glass demo assets with documented provenance.
3. Re-run an isolated repeatable visual/performance review from multiple angles. Review furniture dragging, unit conversion and geometry precision before claiming accurate room measurements.
4. Manually verify native dialogs, install/uninstall, clean-machine launches, Windows x64 hardware, and data recovery after real process crashes. Add signing and a controlled update feed before distribution. macOS remains untested.

No custom asset-intake or visual-review skill was created yet: establish these workflows before encoding them.
