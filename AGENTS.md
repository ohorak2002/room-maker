# Nested

Windows-first desktop application for interior designers. Preserve the React / Three.js editor; work incrementally. The untouched ZIP/extraction is outside this checkout. Baseline commit: cc9ca253eaa6546b185c0a3f4ae2f3a52bd53193.

- Keep Node and filesystem access in Electron main; expose only narrow, validated preload operations. No provider credentials or server API code in the distributed application.
- Project state uses `shared/project.mjs`. Never treat the shopping-list export as a reopenable project. Validate before replacing live state; preserve backups and cancelled operations.
- Catalog entries and procedural/AI models are conceptual until provenance, dimensions, exact variant, material fidelity and usage rights are verified. Do not invent missing product facts or recolor verified retail finishes.
- Improve interactive rendering first. Blender is optional. Inspect actual images and report measurements; do not claim unmeasured performance or retail accuracy.
- `npm ci`, `npm run test:offline`, `npm run build` passed on the unmodified baseline. `test:offline` deliberately skips live retailer dimension scraping; its e2e file uses stubs, not browser automation.
- Desktop commands and validation outcomes are recorded in `docs/progress.md`. Keep this record current, distinguishing built, launched, visually inspected, and installer-tested.
- Verified desktop commands: `npm run desktop:start`, `npm run test:desktop` (real Electron with dialog selections stubbed), and `npm run desktop:dist` (Windows ARM64 + x64 NSIS). `npm run test:offline` now includes project persistence tests. Keep the Electron main module's app-ready work in a callback: top-level awaiting `app.whenReady()` prevents ESM main loading from completing.
- Use `docs/product-brief.md`, `docs/audit.md` and `references/README.md` for continuity. No automatic cloud uploads or model-generation requests in desktop builds.
