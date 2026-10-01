# Nested reachable-surface inventory (2026-09-30)

Generated from the code on 2026-09-30 (`desktop/preload.cjs`, `desktop/main.mjs`, `src/components`, `scripts`, `test`). It answers "what can a user or a test reach?" and is the F01/QA01 inventory. It does not say any surface is correct; see `status-2026-09-30.md` for that.

## Desktop boundary (Electron main, validated IPC only)
Channels exposed to the page through `window.nestedDesktop` (no Node in the page):
`project:initialize`, `project:status`, `project:stage`, `project:save`, `project:open`, `project:recover`, `project:new`, `image:export`, `image:show`, `asset:import`, `asset:status`, `ai:status`, `ai:chat`.
- Files: native Save/Open/Export dialogs; `.nested` project (format v5), `.bak` backup, `recovery.nested`; private models in `userData/assets/<sha256>.glb`.
- Network: none in normal use. The only call is `ai:chat`, to an address set in `NESTED_AI_URL` or `userData/ai.json`; unset means "Doesn't work right now".
- Packaged contents: `desktop/`, `dist/` (app, fonts, bundled CC0 material maps), `shared/`, `package.json`, dependencies. No server code, scripts, artifacts or keys.

## Screens a user can reach
1. Start screen: Start a new brief, Skip the Brief, Restore project (after a crash).
2. Brief gate and editor (project, rooms, openings, surfaces, notes, attachments), Brief chat (disabled unless a service is configured), review and room creation.
3. Studio workspace: project bar (names, Open, Save, "..." menu: New project, Save as, shopping list, quiz), tool rail and inspector panels:
   - Brief (Brief projects only), Room (measurements, shape editor, layout, whole-home planning), Pieces (Shop, Models, Search), Finishes, Light, Views.
   - Room canvas: view switch (Overview, Eye level, Corner), Undo/Redo, Auto-arrange, Export image + size, field of view, Present, selected-piece actions, keyboard `[ ] arrows R Delete P ?`.
   - Filmstrip of saved views; shortcuts sheet; whole-home plan/3D overview.
4. Presentation mode (P / Present, Esc exits).

## Catalog and assets
- 69 built-in concept pieces (procedural geometry) in 8 categories; two pilot pieces (sofa, round coffee table) use bundled photographic materials.
- Private GLB import (self-contained GLB only; units and facing are the designer's explicit choices).

## Automated checks (all offline, real Electron where stated)
- `npm test`: 10 Node test files (project format, assets, Brief validation/compile/geometry, measured shell, Brief AI allowlist, materials files, room packs).
- `npm run test:desktop` (smoke), `npm run test:brief` (Brief flow).
- Scripts added this Goal: persistence, Brief isolation and retry, replace/close, rail/inspector, export, import, relink, history and views, shop and edit, light reset, empty state, drag, presentation and motion, window sizes, accessibility and keyboard audits, measured rooms, catalog bounds and sheet, resource growth, packaged journey; `material-compare.mjs` for fixed-camera renders.
- Debug-only hooks (`window.__nestedEngine` etc.) exist only in `VITE_NESTED_DEBUG=1` builds and are absent from production output (checked).

## Known unreachable or retired
- The style quiz, Upload Brief file flow, server API, retailer lookups and browser mode were removed earlier (Git history). `ControlsPanel.css` is a leftover stylesheet from the retired panel.
