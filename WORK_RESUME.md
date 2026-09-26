# Project status

AniforTPT now has switchable 2D Pixi WebGL and Three.js 3D views over the existing native TPT WASM simulation. The rendering plan was rewritten before the implementation goal started. See [NEXT_STEP_RENDER.md](NEXT_STEP_RENDER.md) for architecture and [NEXT_STEP_RENDER_PROGRESS.md](NEXT_STEP_RENDER_PROGRESS.md) for implementation evidence and limits.

The ordinary 2D renderer now coalesces GPU work and waits for a completed startup frame with a 30-second allowance. The 3D studio has an open background, substantial body depth, opaque rounded sand piles, loose grains, physical materials, textured surfaces, shadows, contact occlusion and bloom. Surface picking works from angled and back views. Mode transitions preserve native world data and pause; empty worlds are retained.

Use `?view=3d` for the studio and `?view=2d` for the field view. `npm run audit:render-modes` checks native mode switching and save/open; `node scripts/render-modes-smoke.mjs --live-2d` checks live 2D native simulation and painting. `npm run audit:studio` checks depth, solid powder, camera gestures, drawing/erasing/walls, pointer release and mobile touch. The browser audits passed 14, 8 and 25 checks respectively. Evidence is under `.artifacts/render-modes/` and `.artifacts/open-studio/`.

Next development should improve liquid curvature, smooth motion and gas/fire appearance, informed by the rendered result and measurements. Physics remains two-dimensional and the editable domain finite despite the open background. Hardware performance has not been established by the software Chrome run. The historical full presenter suite has existing shader-source assertions that fail; the 65 focused tests for these changes pass separately.
