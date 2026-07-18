# AniforTPT agent guidance

## CodeGraph

When `.codegraph/` exists, use `codegraph explore` before grep/find or broad file reads when locating or understanding code. Ask it for the relevant symbols, complete source, and call paths. Use `rg` only after CodeGraph has established the area to inspect.

## Viewport, input, and rendering

Before changing viewport layout, pointer mapping, zoom/pan, Pixi setup, shader coordinates, canvas sizing, or device-pixel-ratio behavior, read [`docs/viewport-rendering-contract.md`](docs/viewport-rendering-contract.md).

The non-negotiable contract is:

- The simulation world is 612×384 cells.
- World, brush, and semantic texture coordinates use that same unscaled space.
- Layout performs one uniform aspect fit; camera zoom/pan performs one presentation transform.
- Coalesce viewport fitting through `requestAnimationFrame` from the frame `ResizeObserver`, `window.resize`, `visualViewport.resize`, and compact-media changes. A frame can change during an in-place desktop resize without a timely observer delivery; never rely on one resize signal alone.
- Device pixel ratio affects backing resolution only, never world or CSS coordinate math.
- The default render backing is 2× per axis (1224×768 for the 612×384 world); use `?renderScale=1` only for A/B diagnosis.
- Pixi filter `vTextureCoord` is not a world UV. The semantic field shader must use the sprite-local `vFieldCoord` supplied by `FIELD_VERTEX`.
- Native TPT walls are a separate `bmap`-derived field and texture. Never encode a wall ID as a particle/material ID; particles and walls may coexist at the same world cell and must be composited independently.
- Simulation tools are neither particles nor walls. Brush tools consume sampled points; vector tools consume raw consecutive grid segments and must explicitly no-op in the point path so they never fall through to the selected particle brush.
- Headless Wind clears inactive particle-authored coarse `vx`/`vy` when a new gesture epoch begins, writes the authored velocity before `BeforeSim`, enables `AIR_ON` for exactly that update, then restores `AIR_VELOCITYOFF` before particle advection. Never inject Wind after `BeforeSim`: that bypasses diffusion, pressure coupling, clamping, and air-blocking walls. Preserve unstepped Wind through the namespaced optional OPS marker instead of inferring it from ordinary imported-save velocity.
- The shared liquid texture is species-aware RGBA: RGB is the uniquely supported liquid color and alpha is density. Do not read red as density or choose a liquid halo color by fixed neighbor scan order; exact unlike-liquid ties must remain a visible interface.
- Canvas gas relief is a presentation-only transform of the shared atmosphere texture: preserve alpha byte-for-byte and multiply RGB channels uniformly so lighting cannot widen the cloud or shift species hue. Dense WebGL gas should blend toward the atmosphere RGB instead of exposing raw semantic-particle dots.
- Treat reconstructed volume density as silhouette support, not automatic opacity. Gas optical depth may darken RGB but must not widen its alpha. For liquids, derive optical depth from authoritative semantic occupancy where available, keep reconstructed density for joined edges/holes, and use local slope for lips or depth rather than absolute world position.
- Treat the emission field as scene light as well as empty-space aura. In Canvas, composite the broad aura behind opaque matter and apply clamped bilinear samples only to exposed solid/powder/field RGB when the field contains light; never change surface alpha or semantic occupancy. Clamp the continuous field coordinate before computing its fractional interpolation weight, matching WebGL's clamp-to-edge sampler at world boundaries.
- Energy is a phase, not a solid texture profile. Keep occupied Fire/Plasma and radioactive carriers in the dedicated luminous-core path, preserve their palette identity at the semantic centre, and let the lower-resolution emission field own only the broader aura. Do not add a new texture or scheduler stage for core animation when the existing semantic/temperature/velocity inputs suffice.
- Compact portrait layout may use a square interaction panel, but zoom 1 must contain the full 612×384 field with a uniform scale and letterboxing. Do not crop the world merely to fill the square.
- One touch is the mobile brush and two touches are camera pan/pinch. Defer the initial touch mark until the gesture is known to be single-touch so every two-finger gesture does not leave an accidental dot.
- Keep a compact bounded mobile catalog with `overscroll-behavior-y: auto`: its inner scroll must chain back to the document, and toolbox bottom padding must remain a safe touch target for page scrolling.

Do not confuse the 2× backing resolution with an internal presentation multiplier. Never add scene scaling such as the former 1.5 multiplier, stretch width and height independently, or introduce a second pointer transform.

After relevant changes, run:

```sh
npm run typecheck
npm test
npm run build
```

Also validate the actual painted footprint at multiple viewport positions and after cursor-anchored zoom; a HUD value computed by the same mapping is not sufficient evidence.

## Visual regression lab

Use the paused deterministic material atlas before and after material-shader changes:

```text
?scene=render-lab&renderScale=2
?scene=render-lab&renderScale=2&renderer=canvas2d
?scene=wall-lab&renderScale=2
?scene=wall-lab&renderScale=2&renderer=canvas2d
```

The render-lab query uses a 612×384 in-memory backend, does not restore or write autosave, and contains powder density ramps, cohesive and sparse liquids, overlapping gas species, sand/water mixtures, adjacent liquid families, and representative rigid/organic/radioactive/emissive blocks. Capture the viewport itself at identical browser dimensions and keep local comparison shots under ignored `.artifacts/`.

Use the automated real-browser capture/interaction gate after shader or mapping changes:

```sh
mkdir -p .artifacts
npm run audit:browser-input -- --webgl-only --screenshot=.artifacts/render-lab-webgl.png
npm run audit:browser-input -- --canvas-only --screenshot=.artifacts/render-lab-canvas2d.png
```

Read [`docs/render-lab.md`](docs/render-lab.md) before changing reconstruction thresholds or blur radii. A TypeScript or Vite build does not compile Pixi's runtime GLSL; a browser screenshot with a clean shader console is required.

The style lookup is an RGBA data texture, not display color: RGB stores phase/profile/emission and alpha stores the static `RenderTrait` mask. Keep nearest sampling and `no-premultiply-alpha`; zero-valued trait alpha must never erase the RGB metadata.

Canvas role styling belongs before the existing final pixel write. Reuse its fixed RGB scratch and per-frame clocks; do not reintroduce a post-composite typed-pixel read/clamp/write pass. Preserve the direct path for zero-trait, non-emissive fluids and keep animation residues/cadence stable when optimizing arithmetic.

The native wall lab uses the real TPT backend, remains paused, and places ten wall types behind deterministic material gradients and mixtures. Use it after wall ABI, wall texture, or compositing changes to prove that native walls remain distinct from particles and survive the same 612×384-to-2× presentation path.

## Project hygiene

- Use `apply_patch` for source and documentation edits.
- Keep heavy toolchains and caches such as emsdk and ccache project-local.
- Preserve the manual GitHub Actions build/build-and-deploy controls and successful-build-only ccache persistence.
- Native save sharing uses raw `GameSave::Serialise()` bytes in `.cps` files. Do not expand new saves into URL hashes or the clipboard; keep `.anifortpt` visibly separate for non-native fallbacks.
- A successful Pages upload is not enough evidence. Preserve the recursive local and live asset-closure checks, and browser-test the cache-busted deployment because stalled runtime initialization can look like a missing asset.
- Do not permanently choose Canvas2D from a short Pixi initialization deadline. Pages cold loads can have WebGL2 and a valid Pixi chunk yet take more than 1.2 seconds to initialize. Mount the compatibility canvas promptly, expose the reason in the HUD/data attributes, and promote it in place when WebGL becomes ready.
- Clean up locally launched Chrome and Vite processes immediately after browser validation.
