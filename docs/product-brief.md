# Nested product direction

Paying customers are interior designers. Windows is the initial desktop platform; retain a portable renderer/main-process boundary for future macOS builds. Nested is separate from CardWise.

Workflow: create a client project; recreate measured rooms or floorplans; add openings and existing furniture; place dimensioned, exact product variants; edit interactively; save alternatives; export presentation images. Client feedback comes later.

## Implementation sequence

1. Preserve and audit the prototype. Compare GitHub with the supplied ZIP, run existing checks, record capability limits.
2. Wrap the existing renderer in Electron. Add client/project identity, native open/save/save-as, versioned project validation, atomic replacement, backup, autosave/recovery and Windows packaging. Verify using the actual Electron runtime.
3. Add standard GLTFLoader imports preserving textures, UVs, material groups, PBR properties and authored transforms. Keep private uploads separate from the shared catalog. Do not pass faithful models through the tintable converter.
4. Review one furnished room with upholstery, wood, metal, patterned rug and glass. Add exports and design alternatives. Benchmark on a stated machine at a stated resolution; do not guess timings.
5. Pilot a permitted source. Then consider client review, subscription services and optional separate final-render jobs.

## Desktop decision (2026-09-28)

Choose Electron: reuses this JavaScript renderer and ships a predictable Chromium version for Three.js. Costs: larger binary/download and ongoing Chromium/Node security updates. Use sandboxed renderer, context isolation, no Node integration, narrowly validated IPC, local content protocol and CSP.

Tauri can reuse the UI and produce smaller bundles, but adds Rust tooling and relies on platform webviews (WebView2 on Windows, WebKit on macOS). That increases the cross-platform rendering matrix. It remains a future evaluation option, not a reason to rewrite the editor now.

Package Windows with electron-builder/NSIS. Initial builds are unsigned development artifacts. Before public release: obtain signing credentials, sign installers, test install/uninstall and updates on clean Windows machines. Use a controlled HTTPS update feed with electron-updater for NSIS after release hosting is selected; never embed a private GitHub token. Automatic updating is deliberately not configured yet. macOS later needs its own signed/notarized builds and visual tests.

Official references consulted: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [native dialogs](https://www.electronjs.org/docs/latest/api/dialog), [updates](https://www.electronjs.org/docs/latest/tutorial/updates), [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/), [Tauri webviews](https://v2.tauri.app/reference/webview-versions/).

Offline scope: bundled geometry, procedural materials/fonts, local floorplan/photo data and local project files. Internet-only features: retailer information, provider-generated models, future catalog synchronization, licensed asset downloads, client sharing and updates. Server-side provider APIs stay out of the installer. Desktop automatically requesting those APIs is disabled pending an explicit authorized service design.
