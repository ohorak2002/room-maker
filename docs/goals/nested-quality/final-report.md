# Nested: what was done in this session (30 September 2026)

This is a plain-language report of everything I changed, added and checked in Nested during this session. It is honest about what is finished and what is not.

## The short version
- Nested starts, saves, reopens, exports, imports 3D models and packages into a Windows installer. I re-checked all of that today on the final code.
- I found and fixed **22 real problems** and added **8 small features**. Each fix was proved with a test or with before-and-after images, not just assumed.
- **Not everything is finished.** Of the 40 acceptance cases in the plan, **14 are fully checked, 24 are partly checked, 1 is blocked waiting for your decision, and 1 (the final review) is this report.** The list below says exactly what is missing.
- Nothing has been pushed anywhere. All changes are on your computer in `C:\dev\nested-desktop`, **not yet committed** (35 changed files and about 27 new ones).

## What I fixed (things that were wrong)
**Saving and projects**
1. The project bar could say "not saved" or lose the file name after small edits. It now tells the truth about the file, unsaved changes and recovery.
2. A slow reply from the Brief chat could appear inside the *next* project. Replies from a closed project are now thrown away.
3. After replacing a project, the side panel could show Furniture while no tool button was highlighted. They now always agree.
4. Re-importing a missing 3D model only said "already in this project" and did nothing until you restarted. It now restores the model straight away and keeps its placement.

**How rooms and furniture look**
5. The round coffee table's top was built inside-out, so you saw its underside as a dish. Fixed.
6. The floor lamp's glow swallowed the lampshade. The glow is now gentler and the shade is visible.
7. Edges looked jagged (stair-stepped) on table legs, rugs and floorboards. I added smoothing (SMAA).
8. Small plants (succulents, herb planter, bouquet) were sprawling and sinking into the floor. They are now compact and sit on it.
9. The sofa was listed as 80 cm tall but modelled at 94 cm. The listing now matches the model.
10. Wall pieces (moss wall, neon sign, framed art, LED strip) could poke past the end of a wall. Fixed.
11. Rooms built from a Brief had floor boards about 6 cm wide, while normal rooms had 16 cm. The scale is now the same by default.

**Behaviour and memory**
12. Every time a room was rebuilt, two large shadow textures were never released, so memory grew with each lighting change. They are now released and the count stays flat (55 textures before and after 30 changes; it used to grow to 117).
13. An empty living room offered a "Cozy bedroom" set. It now offers a living-room set (and matching sets for bedroom and office).
14. The Shop showed plants first for an empty living room. It now leads with the sofa, rug and lamp.
15. Searching inside one Shop category said "Nothing matches" even when other categories had matches. It now says where it looked and offers "Search all categories".
16. Small buttons and text fields were too small to hit reliably, one label was too faint to read, and pressing Escape in a menu lost your place. All fixed.
17. At the smallest window size the room name overlapped the Undo button. Fixed.
18. Some very thin parts (palm leaflets, bookshelf edges) used about 500 triangles each. I simplified them, and the sofa's cushions. Total triangles across the catalogue dropped from 366,000 to about 222,000 with no visible change.

**Housekeeping**
19. The wool texture's recorded size was wrong (now 2048 × 2091, matching the files).
20. The field-of-view slider did not say which field of view it meant (now "vertical").
21. There was no way to reset lighting. Added.
22. Image export size depended on the window size. It no longer does.

## What I added (new abilities)
1. **Redo** (button, Ctrl+Y, Ctrl+Shift+Z). Undo and redo are tested together with duplicate and auto-arrange.
2. **Update a saved view** to the current camera (keeps its name).
3. **Export size choice**: Match view, 1920×1080, 2560×1440 or 3840×2160, with a "Preparing…" state, safe cancel and a clear error if saving fails.
4. **Remove a 3D model from a project** (only when no copies are placed; the file stays in your private library).
5. **Select pieces with the keyboard** (`[` and `]`) so moving furniture does not need a mouse.
6. **Reset lighting** button (returns to the room's own lighting).
7. A **catalogue-wide check** that measures all 69 pieces against their listed sizes.
8. A **plain list of what is reachable in the app** (`inventory.md`).

## What I checked (and how)
- **Automatic tests:** the 10 offline test files pass, including two new ones (room geometry for an L-shaped room and a room with a diagonal wall, checked against independently worked-out numbers; and the room-set suggestions).
- **Real app runs:** about 25 scripts drive the real Electron app (save, close, import, export, drag, keyboard, window sizes, memory, packaging). All pass on the final code (one of them failed once in six runs, see the audit).
- **Packaged installer:** built with today's code (about 262 MB, unsigned). I ran a full journey in the packaged app on ARM64 and on x64 (under emulation): fonts, bundled materials, 3D model import, save, a 2560-pixel image export, no internet requests and no developer hooks. Both passed. The package contains no server code or keys.
- **Looked at pictures myself:** room views day and evening, close-ups, every catalogue piece, an L-shaped room, a diagonal-wall room, a windowless room, the smallest window size.

## The full audit of this session
I re-checked my own work at the end:
- I confirmed **32 of the changes above exist in the code** by searching for each one.
- I **re-ran every check script** on the final code. All passed, with one exception: the saved-views/undo script failed once in six runs and passed the other five. I could not catch the failure message (the first run happened while the computer was busy), so I treat it as an unexplained intermittent failure and have not ruled out a rare timing problem.
- I **read my own code changes** and made one more fix from that review (export on a hidden canvas could have divided by zero).
- I found and corrected two **wrong statements of mine**: the review page said the sofa was 80 cm (it is 94 cm), and my first count of test files was off by one.
- Two things are **only partly proved** and I say so below.

## What is still open
**Needs your decision**
1. **Sofa and coffee table pilot.** Please look at `artifacts/quality/pilot-review/index.html` and accept it or tell me what to change. I did not put photographic materials on any other piece, and the "dressed room" test (accessories, plants, books) cannot start until you decide. (The review images were made before the last small changes; those changes were visually checked and did not alter the look.)
2. **Beds, vanities, the bathtub and the kitchen sink** are modelled taller than the height shown in the Shop (for example a bed shows 55 cm but the headboard makes it 102 cm). Should the Shop show overall height?
3. **The slow camera orbit** in the overview moves about 2.5° per second when idle. Make it slower or opt-in?
4. **Commit the work?** I have not committed anything.

**Small visual flaws I could not fix**
- A faint diagonal shadow edge on some walls, and a dashed light line where the ceiling meets a wall. Both come from the sun's shadow; I ruled out many possible causes (shadow size, softness, bias, ambient occlusion, glow, ceiling overlap, side walls). They are minor.
- The floor mirror is a flat dark panel with no reflection; the first fridge has a harsh top highlight; a tiny bright dot appears at the window in some images; the sofa's Shop thumbnail looks lighter than the sofa in the room.

**Not tested at all**
- Installing and uninstalling the installer, a clean computer, real x64 hardware, signing and updates, native file dialogs (all my runs used stand-ins), screen readers, OS text scaling, and any live AI service.
- The remaining parts of the 24 partly-checked cases are listed one by one in `docs/goals/nested-quality/status-2026-09-30.md`.

## Where everything is
- Plain status per case: `docs/goals/nested-quality/status-2026-09-30.md`
- Detailed notes, numbers and image locations: `docs/goals/nested-quality/state.md`
- Running summary for future sessions: `docs/progress.md`
- Evidence images: `artifacts/quality/` and `artifacts/material/` (kept out of Git)
- The installer: `release/Nested Setup 0.1.0.exe`

## How to try it
- Run `npm run desktop:start` in `C:\dev\nested-desktop`, choose "Skip the Brief", add the living-room set, and try Undo/Redo, the Export size menu, the Views tab, and `[` `]` to select pieces.
- Re-run all checks any time with `npm test`, `npm run test:desktop`, `npm run test:brief`.
