> **Superseded in part (2026-09-29):** the Brief is now written inside Nested and saved with the project; there is no upload or file export, and the entry gate is "Start a new brief". The schema, validation and rendering notes below still apply. See docs/progress.md.

# Official Brief entry flow

This update replaces the initial questionnaire with Upload Brief on every launch. There is no bypass into a newly generated default room. Users create the official document in the built-in Brief editor, export `*.nested-brief.json`, then upload it. Files are analyzed and reviewed before project state changes.

## What works

- Light, responsive designer Brief editor with the five approved sections, named rooms, colors, materials, lighting and practical/reference notes.
- Version 1 official JSON export; strict format/schema checks; no furniture or accessories in the document schema.
- A PDF/PNG/JPEG attachment travels inside the JSON. Original files are retained in IndexedDB with the source brief. PNG/JPEG plans can be calibrated from a known length, then measured by selecting opposite interior corners. Measurements from image selection are draft values until manually verified.
- Direct measured room width, depth, ceiling height and shared-plan X/Z position, in meters or decimal feet. Floor numbers support a multi-storey home. Nonrectangular rooms accept simple measured polygons, without holes or curved walls.
- Explicit door, window and passage edge/offset/width/height/sill dimensions. Nothing invents extra doors or windows. Geometry, openings and the complete layout require verification, plus a recorded designer/client review.
- Rejection of missing dimensions, estimates, invalid colors/materials, overlapping room interiors, self-intersecting outlines, out-of-bounds or overlapping openings, missing source attachments and unsupported versions/fields. Drafts remain editable and can be saved before completion.
- Exact metric shell geometry in both 2D and 3D. The previous half-meter cell mask is only a furniture placement aid for measured rooms; it does not set their dimensions. Furniture starts empty. Architectural PBR maps use UV coordinates in meters so textures stay consistent between differently sized walls.
- Surface colors, supported material/finish types and lighting presets are applied; all other requirements remain readable in the workspace Brief panel. The floorplan view never uses the legacy guessed-opening algorithm for these homes.
- Re-uploading the exact same brief resumes current furniture and room edits. Uploading a different brief creates a new empty home after saving the previous project/source brief in IndexedDB. A previous-project JSON backup can be downloaded from the entry screen. Restoring that backup is currently a developer recovery operation, not a supported upload format. Existing legacy localStorage projects are retained until another brief is committed, and backed up at that point.
- Each measured room has its own furniture placement namespace. A manual placement in one room does not move the same catalog item in another.

## Boundaries to preserve

The v1 format marker and producer field verify compatibility, not cryptographic authorship. They reject arbitrary PDFs, Word documents, notes and earlier prototype templates as direct imports. Anyone able to edit JSON could reproduce the format. If a company requires proof that a document was issued by its official service, add a server-signed envelope with an authenticated issuer and verification key; do not put a signing secret into this client bundle.

The earlier downloadable `blank-brief.json` was a draft contract, not a runnable Nested import. Use this version's editor to export a version 1 document. The included sample uses fictional dimensions for testing and is not a client's plan.

PDF attachments are retained, but there is no PDF renderer, OCR or live LLM connection. The sidebar explicitly identifies its local palette suggestions and completeness checks. It must not be described as a live agent. No plan is sent to a third-party AI service. Add authenticated backend model access and reviewable structured proposals before claiming AI extraction.

No software can establish correct real-world dimensions from an uncalibrated image alone. The importer reproduces the verified structured coordinates; it cannot independently certify a designer's measurements or resolve discrepancies between a scanned plan and its entered values. Keep this distinction visible.

The renderer is a design preview. It uses existing procedural PBR surfaces, not brand-specific scanned materials. The texture scale (1 = the natural size used in ordinary rooms) controls tiling; written plank-direction or product references are retained notes. Ceilings are flat-height cutaways; slopes, beams, fireplaces, columns, built-ins, complex trim, real solar orientation and photometric fixture layouts are not generated from prose. The import review and Brief panel disclose these boundaries. Walls have a 10 cm visualization thickness outside the measured interior footprint. Enter real inter-room offsets/wall gaps from the plan; wall-construction layers are not modeled.

## Format details

`format = nested-official-design-brief`, `schemaVersion = 1`, `producer = Nested Brief Editor`.

The validation/compilation source of truth is `src/data/designBrief.js`. The document contains project identity, units, plan references and attachments, reviewed room specifications, notes, and client review. Rooms use one common X/Z origin, +X right and +Z down in plan. Each room's local outline is bounded by `[0,width] × [0,depth]`; a blank outline means a rectangle. Footprints must not overlap on the same floor. For accurate wall gaps, locate rooms by their interior faces, including the measured gap between them.

Edges follow outline point order. Default rectangle edges are 0 top left-to-right, 1 right top-to-bottom, 2 bottom right-to-left, 3 left bottom-to-top. Opening offsets start at the first point of the selected edge. All input dimensions use the document's units; texture scale always uses meters. Conversion uses exactly 0.3048 meters per foot. The mesh uses meter geometry without grid snapping.

Limits: 8 MB per brief, 2 MB per uploaded floorplan in the editor, up to four attachments in the format, 30 rooms, 64 outline points and 50 openings per room. Input dimensions and text lengths are bounded. Generated room state is stored under the existing Zustand persistence key; brief attachments and previous-project backups live in IndexedDB `nested-briefs`.

## Checks

Run `npm ci`, `npm run build`, and `npm run test:offline`. New tests cover schema rejection, unknown/furnishing fields, unit conversion, exact dimensions, multiroom placement, intersecting polygons, openings, footprint overlap, round-trip parsing, mesh extents, true door cutouts and meter-scaled UVs.

Browser verification in the implementation environment covered the upload gate, invalid filenames, review requirement, measured scene mounting, empty rooms, forced upload after reload, preservation of user furnishings on identical re-upload, draft saving, invalid export rejection, a complete editor/export/upload round trip, and 390px layout. The real project should also be tested on a hardware-accelerated desktop for material quality and large plans; headless software rendering is not a photorealism assessment.

## Next AI work

Connect a tenant-authenticated backend and configured provider; preserve the manual editor if no provider is available. Add PDF page rendering and validated OCR/vision proposals with source page/regions. Keep inferred measurements pending until the designer verifies them against a known scale. Model output must pass an allowlisted schema, show before/after values and require Apply. Never let an LLM mark measurements verified, certify accuracy, approve a brief, overwrite later user edits, or create furniture during brief import.
