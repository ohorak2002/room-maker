# Nested

A downloadable Windows desktop application for interior designers: create a client project, recreate a room, place furniture, explore it in 3D, save alternatives and export presentation images. Nested runs entirely on the designer's computer; there is no web service.

See [product direction](docs/product-brief.md), [verified progress and limitations](docs/progress.md) and [baseline audit](docs/audit.md). Agent rules are in [AGENTS.md](AGENTS.md).

```sh
npm ci
npm run desktop:start   # build and launch the app
npm test                # Node tests (offline)
npm run test:desktop    # real Electron checks
npm run desktop:dist    # Windows ARM64 + x64 installer in release/
```

- **Projects**: the top bar holds client/project names, New, Open, Save and Save as. A `.nested` file stores the editable project; `.nested.bak` keeps the previous save. A recovery copy is written to the app's user-data folder after 500 ms without changes and offered on the next launch. Save as keeps design alternatives.
- **Images**: `Export image` writes a PNG through a native dialog; `Show image file` reveals it in Explorer. Overview / Eye level / Corner give repeatable camera positions.
- **Your models**: the Models tab imports a self-contained `.glb` into a private library on this computer, keeping its textures and separate materials. Projects reference models by checksum. See `docs/progress.md` for what is verified.
- **Catalog**: built-in furniture is conceptual. Prices are estimates and dimensions approximate; nothing is looked up online.

Installers are unsigned development builds; signing and updates are not configured.

## Layout

```
desktop/     Electron main process, preload bridge, atomic file writes
shared/      project format (v2) and imported-asset validation, used by main, renderer and tests
src/         React editor, Zustand store, Three.js room renderer
scripts/     real-Electron smoke test, scene capture tool, test fixture generator
test/        Node tests and the original GLB fixture
references/  visual evidence captured from the app
docs/        brief, audit, progress, handoff
```

The original web prototype (Vercel API, AI model generation, retailer page reading) is in Git history before 2026-09-28.
