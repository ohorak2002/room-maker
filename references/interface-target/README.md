# Interface target (approved 2026-09-29)

`workspace-mockup.dc.html` is the interface mock-up the user approved on 2026-09-29 ("I really like the color scheme and everything else"). It was designed in a Claude Design canvas (https://claude.ai/artifact/EPXVS4kqDfCcMZKqPKvdui, private to the user) and copied here unchanged. It is a Design Component file: it needs that canvas's runtime to render, but its markup is readable as a specification.

What it fixes as the target:

- One 56 px project bar: house mark + "Nested" wordmark (Instrument Serif), project name and client, save status, piece count and estimated total, Open…, Save (primary).
- Palette: ground `#F5F3EF`, surface `#FFFFFF`, sunk `#EFECE7`, ink `#1D1C1A`, soft ink `#4A4741`, muted `#66625B`, hairline `#E3DFD7`, accent `#2E5B4F`. Prices in ink, not a separate colour. Instrument Sans for all interface text.
- 380 px side panel with tabs Place · Design · Shop · Search · Photo · Models; Shop as a two-column retail card grid (photo on a light backdrop, eyebrow, name, estimated price, size line, Add to room / In room).
- The room fills the rest. Floating chrome over it: room chip (top left), Overview | Eye level | Corner switch (top centre), Undo / Auto-arrange / Export image (top right), hint pill (bottom left), selected-piece panel (bottom right), a thin rounded frame and name tag on the selected piece.

What it does not settle:

- **The room's rendering.** The mock-up's room is a flat placeholder drawing. The user's requirement is that the room is real 3D and feels like standing inside it; realism (lighting, materials, scale) still needs its own visual reference.
- **Product data.** The mock-up's products, prices and dimensions were samples. Catalog pieces remain conceptual; no finish swatches are shown because the catalog has no finish variants.
- Place, Search and Photo panels were not drawn.

Implementation evidence is in `references/interface-rebuild/`.
