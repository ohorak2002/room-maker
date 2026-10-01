# Nested reference pilot

`nested-pilot-reference.png` is the original generated concept selected by the owner. It is the design target, not a screenshot of the application. `nested-pilot-desktop.png` and `nested-pilot-compact.png` are actual Electron screenshots of this implementation.

## Open the pilot

From `C:\dev\nested-desktop`, run `npm run desktop:start`. Choose **Explore the living-room pilot** on the new-project screen. If an existing project opens, use **Open…** and select `C:\dev\nested-desktop\outputs\nested-pilot.nested`. Save existing work first if prompted.

The pilot includes five concept pieces, catalog search and filters, selectable furniture, four upholstery finishes, product views and an interactive 3D preview, a floor plan, daylight/evening lighting, undo/redo, rotation, duplication, replacement, save/reopen, and a 2560-pixel room-image export. **Open full room editor** accesses the existing tools; **Back to pilot** returns to this layout.

## What the pilot establishes

The reference's ivory and green interface, three-column composition, catalog cards, product inspector and floating room controls are implemented in React around the existing live Three.js room. Product thumbnails and room furniture use the same builders and finishes. The room is editable geometry, not the generated picture used as a background.

The five pieces are Nested-authored demonstrations, not verified retail products. They have no invented prices or retailer links. Materials derive from the already bundled Poly Haven CC0 maps. The sofa is labelled wool-blend, consistent with that material, rather than the reference's linen label. Product views are rendered views, not product photographs. The export button saves the current 3D render; it does not invoke AI or an offline path tracer.

## Remaining visual work

This is a functioning interface and material pilot, not a pixel-identical or photorealistic reproduction. The generated reference has more detailed upholstery, a patterned rug, richer architecture and decoration, and softer indirect lighting. The next visual milestone is to replace the concept sofa and chair with carefully authored or licensed high-detail assets, validate their dimensions and materials, and compare the same camera and lighting against the reference. No LLM integration was added.

## Validation

`npm run test:pilot` runs the real Electron application with isolated test data. It checks search, categories, finishes, undo/redo, interactive preview, floor plan, lighting, rotation, duplicate/remove, replacement position, save/open, PNG export, the 1000 × 700 compact layout, and the full-editor round trip. Native dialog selections are stubbed; project IPC and filesystem operations are real. The run reported zero renderer errors and zero external network requests.

Detailed captures and the machine/timing report are in `artifacts/reference-pilot/`. Idle frame intervals over 120 samples were median 8.3 ms / p95 8.5 ms on Windows ARM64, Snapdragon X Plus X1P42100, canvas 866 × 934, window 1586 × 992, DPR 1. These are requestAnimationFrame intervals, not GPU measurements or performance guarantees.

The normal production build, offline tests and original desktop smoke test also passed. The installer in `release/` was not rebuilt or installed for this pilot; launch from source to see these changes.

## Realism pass 2 (2026-10-01, Claude Code)

- Chair joinery fixed: leg tops now run up into the armrest undersides (previously stopped ~4 cm short); stretchers pulled in to the leaned legs. Checked in a live close-up (`artifacts/realism-review/chair-detail.png`).
- The checkerboard wall art is replaced by one generated abstract painting (canvas texture, original, no third-party content: soft colour fields, mottled brushwork, one dark block). Brushwork still reads slightly streaky/brick-like up close.
- Re-verified: `npm test`, `npm run test:pilot`, `npm run test:desktop` (no errors), debug review (all furniture within 3 mm of declared size, resources stable over 16 upholstery changes: 129 geometries, 41 textures). Normal build restored; no `__nestedEngine` in `dist`. Delivery screenshots refreshed.
- Still short of the reference: cushion shapes remain regular, architecture (arched niche, shelving) is simplified, rug pile is modelled relief not real pile, lighting reads as a realtime render. Not photorealistic. Installer not rebuilt; nothing committed.
