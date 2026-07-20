# Viewport and rendering coordinate contract

This note records the viewport failure that was difficult to diagnose and the contract that fixed it. Read it before changing layout, camera transforms, input mapping, Pixi setup, or semantic-field shaders.

## Coordinate spaces

AniforTPT has four distinct spaces. Keep the conversion between each pair explicit.

1. **World space:** The Powder Toy field is exactly 612×384 cells. Painting and native field extraction both address `pmap[y][x]` directly; TPT's air `CELL` size does not scale particle coordinates.
2. **Viewport space:** CSS pixels in the `.viewport` content box. Desktop uses a uniformly aspect-fitted 612:384 viewport. Compact portrait layout uses a square interaction panel, but the 612:384 world remains uniformly contained and centered inside it. The unused vertical space is letterboxed; the world is never stretched or cropped at minimum zoom.
3. **Camera space:** `ViewTransform` applies one uniform fit × zoom scale and one CSS-pixel pan. Resize rescales pan by the fit-scale ratio so an off-center zoom does not slide.
4. **Backing space:** Canvas/WebGL pixels. The default output scale is 2× per axis, producing 1224×768 backing pixels for 612×384 logical cells. The in-app Detail control and `?renderScale=1|2|4|8` select real per-axis sampling; canonical 8× is 4896×3072. Backing scale must not enter world, brush, pan, or CSS layout math. WebGL 8× disables redundant MSAA and extra high-quality probes, draws the semantic shader directly on one mesh, uses only a 2× startup compatibility Canvas, and permits only one fenced GPU frame in flight while later mutations coalesce. Every temporary Canvas/contour backing is explicitly released after WebGL promotion.

WebGL context loss is a presentation failure, not a simulation reset. Cancel the
loss event, destroy the failed presenter, and only then recreate the bounded
Canvas fallback from the authoritative semantic grid. Report
`webgl-context-lost`, preserve the current camera transform, and never retain a
permanent duplicate of the 8× backing merely to make this recovery possible.

Both presenters expose an untransformed 612×384 logical CSS box. Its responsive displayed rectangle is produced by one presentation transform:

```text
translate3d(cameraX, cameraY, 0) scale(uniformCameraScale)
```

Pointer mapping uses the transformed canvas `getBoundingClientRect()` to recover a 0–612, 0–384 world point. Do not combine that mapping with another DPR or presentation-scale correction.

## The proportional cursor bug

The visible stroke once matched the cursor near the upper-left corner but diverged progressively toward the other edges. Native placement was initially suspected, but `_powder_set(x, y)` and `ExtractFields()` were confirmed to write and read the same `pmap[y][x]` coordinate.

The real cause was the Pixi filter coordinate. Pixi's default filter vertex shader produces `vTextureCoord` for the filter system's pooled input texture. A 612×384 sprite can be rendered through a larger temporary backing texture, commonly 1024×512. Therefore `vTextureCoord` does not necessarily span 0–1 across the sprite.

The semantic shader sampled an independent 612×384 field texture using that pooled coordinate. The result was a non-uniform, upper-left-anchored visual stretch while pointer math remained correct. This exactly mimicked a cursor scaling error.

The fix is a custom `FIELD_VERTEX` in `pixi-field-presenter.ts` that passes the quad's sprite-local `aPosition` as `vFieldCoord`. The fragment shader samples the semantic field with `vFieldCoord`, which is guaranteed to span 0–1 across the displayed sprite.

Do not replace `vFieldCoord` with Pixi's default `vTextureCoord` when sampling `uFieldTexture`.

## The 1.5-scale failure

An earlier Pixi presentation path mixed a 1.5 internal scene/presentation scale with responsive CSS sizing. This changed the apparent material aspect ratio and made coordinate reasoning ambiguous. Removing the multiplier restored the correct 612:384 presentation.

If higher visual resolution is needed, increase backing resolution or render quality without changing logical sprite dimensions or scene scale.

## Input and zoom rules

- Pointer events are owned by `.viewport`; canvases have `pointer-events: none`.
- Use `clientX/clientY` consistently. Do not mix page, offset, backing, and client coordinates.
- Left mouse and primary pen paint; right drag erases; middle-mouse drag pans without touching the simulation.
- One-finger touch paints continuously. A short tap paints once, but painting is deferred until the gesture is known to be single-touch so starting a two-finger gesture cannot leave a dot.
- Two-finger touch movement pans and pinches through the same camera gesture contract without painting; ending a pinch rebases the remaining finger without a jump or connecting stroke.
- Compact layout exposes one shared Draw/Eraser group as a quick bar above the catalog. It is fully visible with the search entry at initial `scrollY=0` at 390×844 and 360×640, is hidden on desktop, and is not duplicated in the lower actions card. The selected mode applies to the one-finger brush and to particle or wall tools consistently.
- Continuous strokes interpolate between the last and current world cells so sparse pointer events cannot leave gaps.
- Wheel deltas are normalized by `deltaMode`, and the cursor point is the zoom anchor.
- Pinch uses the same `ViewTransform.applyGesture` contract.
- The camera scale is uniform. Width and height must never be corrected independently.

## Validation requirements

Geometry-only tests are necessary but not sufficient. The earlier HUD cursor test was tautological because the HUD and brush used the same mapping; both could agree while the shader displayed material elsewhere.

For any viewport or shader-coordinate change, validate all of the following:

- Desktop remains exactly 612:384. Compact portrait layout is square, but minimum zoom contains the entire 612:384 field with a uniform world scale and square rendered cells.
- A cell occupies square screen pixels before and after zoom.
- A stationary cursor maps to the same world cell through wheel zoom.
- A zoomed view retains its camera anchor after page resize.
- While already zoomed and panned, changing DPR and browser page scale in the same session preserves zoom and world-space pan, repeats cursor-anchored wheel zoom, and paints one exact semantic/visible landmark. CSS-pixel pan is expected to scale by the fitted-canvas resize ratio; absolute rectangles may reflow.
- Left-drag painting is continuous.
- An immobile material painted near the upper-left, center, and lower-right appears under the cursor at all three positions.
- After an off-centre wheel zoom and middle-button pan, paint one radius-zero off-centre landmark and compare its semantic cell with the actual blank-differenced framebuffer peak. Transform-state equality alone is insufficient.
- The Canvas2D fallback obeys the same contract.
- At one fixed desktop CSS viewport, `renderScale=1`, `renderScale=2`, and WebGL `renderScale=8` produce identical canvas rectangles; only the backing changes between 612×384, 1224×768, and 4896×3072. Requested/effective 8× must both be reported as 8 on the supported canonical audit path.
- Browser validation cleans up Chrome and Vite even on failure.

The last painted-footprint check is the important regression test for the Pixi pooled-UV bug.

The desktop audit also performs a live scale transition without navigation: Canvas uses DPR 2→1→2 and WebGL uses 1→2→1, while page scale runs 1→1.2→1. Chrome device emulation can change the responsive CSS viewport even when DPR returns to its starting value, so the gate compares camera pan in fit-normalized space rather than requiring absolute geometry equality. Screenshot sampling during page zoom uses the visual viewport dimensions and offsets; layout `innerWidth` alone points at the wrong composed pixels.

`npm run audit:browser-input` proves the backing-scale invariant in both renderer backends. Its paired pass freshly navigates to 2× and 1× under the same explicit 1280×720 desktop emulation, waits for stable geometry at each scale, paints three radius-zero landmarks, repeats the off-centre wheel anchor, and repeats a 42×27 CSS-pixel middle drag. It then paints an off-centre radius-zero landmark after both transforms and requires the composed framebuffer peak to agree with the exact semantic cell before testing a zoomed resize. That active-camera resize crosses the 920px desktop layout breakpoint and returns, preserving zoom, normalized pan, and a relative viewport anchor. The mobile route similarly retains one finger after a two-finger pinch, requires the retained finger to paint an exact transformed line without a stray handoff dot, and crosses the 680px breakpoint in a 390→700→390 active-camera round trip. The WebGL half cold-loads a fresh 2× reference and true 8× page under those same metrics, requiring exact CSS-rectangle equality, a 4896×3072 backing, and zero browser errors. While still deeply zoomed at true 8×, it performs a real radius-zero click and requires both the exact semantic owner and a framebuffer peak within the clicked cell; backing scale therefore cannot be inferred away from pointer math. `node scripts/verify-browser-input.mjs --scale-eight-only` isolates that expensive proof, and `--mobile-only` isolates paired Canvas/WebGL touch behavior. A reference captured before applying the same device metrics is invalid because Chrome's launch window and emulated CSS viewport are different coordinate spaces.

The dedicated 8× gate also owns and records eight explicit presentation submissions before its composed material captures. Audit-owned frames are important for paused/static fixtures: a timer request must not wait for an unrelated animation or dynamic-field refresh. The 8× SwiftShader path reports bounded CPU-submission timing because giant elapsed-GPU queries can remain unavailable indefinitely even after a successful framebuffer; 1×–4× retain elapsed-GPU queries when supported.

The same audit cold-loads both Canvas2D and WebGL after enabling portrait mobile metrics, DPR 2, coarse touch input, and two touch points. This ordering matters because Pixi chooses shader quality when the presenter is constructed; resizing a desktop-created presenter is not a mobile-path test. Each backend must keep the square interaction panel as a letterboxed 612:384 world, translate a two-finger pinch by exactly 22 CSS pixels while preserving its world anchor, paint no stray cell during the gesture, then place and visibly present one radius-zero single-touch mark at the requested cell.

Audit screenshots freeze only the presentation clock; frame throttling and atmosphere/liquid/emission scheduling continue to use real monotonic time. Blank scale/mobile audit routes start without the material atlas so stale reconstructed fields cannot contaminate composed footprint checks. Production rendering still defaults presentation time to the real frame time.

## Debugging order

When alignment regresses, isolate the spaces in this order:

1. Confirm the `.viewport` bounding ratio and content-box dimensions.
2. Confirm the transformed canvas rectangle and that its cells are square.
3. Compare `screenToCell` at several normalized positions, not only the upper-left.
4. Pause the simulation and paint an immobile material so physics cannot move the evidence.
5. Compare the actual rendered footprint with the requested native cell.
6. Inspect shader UVs and sprite/filter bounds before changing native placement.
7. Only then inspect `_powder_set`/`pmap` if the native field itself disagrees.

This order avoids repeatedly adjusting mathematically correct pointer code to compensate for a rendering-only distortion.
