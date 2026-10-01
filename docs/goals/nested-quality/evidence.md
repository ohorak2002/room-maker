# Evidence

## Initial baseline — 2026-09-30

- Source: main at 8ca29e268b75ed5b30b35bdbdef1e01bca484f7a, initially clean.
- `npm test`: all eight offline test files passed.
- `npm run build`: passed, Vite 5.4.21, 150 modules. Normal production build.
- Windows 11 Home 10.0.26200 ARM64; Node 26.7.0; Electron 44.4.5; Three 0.160.1; Playwright 1.63.0. GPU/scale and actual window measurements to be recorded with captures.
- `node scripts/desktop-smoke.mjs`: passed, zero page errors/external requests. Fresh baseline retained in artifacts/quality/baseline. Native dialog selections stubbed; actual IPC/filesystem/import/recovery/rendering. 1427x727 CSS, DPR 2, 120 idle rAF intervals: median 16.6 ms, p95 66.7 ms (not GPU timing, not a general performance result).
- CPU Snapdragon X Plus X1P42100 / Qualcomm Oryon; GPU Qualcomm Adreno X1-45, driver 31.0.137.0. DPR is recorded separately from OS display scale, which has not yet been verified.

## Findings awaiting reproduction

- U01 source-supported risk: DesktopProjects subscribes to every room-store notification and overwrites status with “not saved to a file yet”; no persisted-field identity comparison. Source-supported async risks: React busy state alone is not a synchronous operation lock; save completion does not distinguish later edits.

## Batch 1 — persistence truth

- Reproduced D001 in real Electron: scripts/project-reliability.mjs before fails after editing saved client metadata; screenshot and assertion in artifacts/quality/persistence-before. Inspected screenshot personally.
- Desktop main now returns chosen path, dirty state, last file-save timestamp and recovery timestamp separately. Renderer stages only persisted identity changes, suppresses intermediate project-replacement state, uses a synchronous busy guard, and refreshes actual dirty state after saving.
- Normal production build passed. scripts/project-reliability.mjs after passed eight checks: metadata round-trip/dirty identity; unrelated UI state; lighting edit; canceled Save As; failed synthetic-directory write with prior-file preservation; retry; edit during delayed save; stable status after open/poll. Images in artifacts/quality/persistence-after inspected personally.
- scripts/brief-smoke.mjs passed after persistence change: measured creation, draft/recovery, local mock chat, save/restart, Skip Brief; zero errors/external renderer requests, two mock chat requests. This covers parts of QA05–08/QA38, not every required failure state.
- Inspection also reveals a living-room empty state offering “Add the cozy bedroom” and rail selection disagreement after a room rebuild; record for subsequent U04/U05 investigation.

## Batch 2 — Brief project isolation

- scripts/brief-isolation.mjs before reproduced an old assistant response and conversation in a new Brief. Local delayed stand-in only; artifacts/quality/brief-isolation-before.
- Successful New/Open/Recover increments a session boundary and remounts the editor; transient chat/view/selection state resets. Abandoned chat completions cannot write new-session state. Async review and attachment operations validate their originating draft. Failed messages are retained for retry; request context bounded to the validated 24-message limit.
- Normal build and scripts/brief-isolation.mjs after passed. Existing scripts/brief-smoke.mjs passed again, no page errors/external renderer calls. Full failed retry/long-chat/multiple-room replacement cases still need explicit verification.
