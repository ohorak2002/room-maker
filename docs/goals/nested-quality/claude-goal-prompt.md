/goal Continue Nested quality work in C:\dev\nested-desktop (branch main, uncommitted changes are the work; never reset/clean/checkout over them; no push, publish, deploy or subagents).

Start by reading: docs/goals/nested-quality/claude-code-master-prompt.md, state.md, plan.md, backlog.json, acceptance-matrix.md, evidence.md, decisions.md, docs/progress.md, AGENTS.md. Then `git status` and `git diff`.

Done so far: D001 persistence status, D002 Brief cross-project replies, R03 table lathe winding fix (verified, normal build restored). Do not redo these.

Work in order, one hypothesis per change, verified by real Electron images and measurements:
1. R08: isolate the oversized lamp halo (bloom threshold/strength/radius); choose a restrained default; matched day/evening before/after.
2. R04: correct wool decoded-dimension metadata from evidence, keeping physical tile and aspect intact.
3. R03: assemble day/evening room and detail pilot images plus a short selection/reference sheet; present for owner decision. Do not expand photographic materials to other pieces before acceptance. Continue other work meanwhile.
4. R09: deterministic export (explicit dimensions, readiness, frozen framing, restoration on every exit).
5. Remaining U01/U02/U04/U05 cases (replacement/close, failed Brief retry, multi-room open, living-room empty state offering a bedroom pack, rail/inspector disagreement: reproduce first).
6. Then the rest of the backlog: 27 packages, 40 acceptance cases, all in-scope P0-P2 defects resolved.

Rules: preserve React/Zustand/Three/Electron main-preload boundary, approved interface direction, GLB material fidelity, offline runtime. Run captures sequentially with fixed camera/exposure/lighting; rebuild normally afterwards and confirm __nestedEngine, __nestedMaterials, __nestedLegacyPieces are absent from dist. After each batch run targeted tests, then `npm test`; at integration run npm run test:desktop, npm run test:brief, desktop:pack and scripts/packaged-check.mjs. Update state.md, backlog, evidence, decisions and docs/progress.md after every batch, recording what was and was not verified.

Do not stop after a plan or a few fixes. Finish only when every package and case is verified with fresh evidence, then write docs/goals/nested-quality/final-report.md truthfully. If blocked, record why and continue other eligible work. Report honestly: failed checks, unmeasured claims, and owner decisions needed.
