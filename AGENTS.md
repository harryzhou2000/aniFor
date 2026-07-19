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
- Configured sources are semantic tools, not ordinary source-particle brushes. Keep their emitter and retained target explicit, route them through the native `CtypeDraw` boundary after erase/tool handling and before ordinary paint, and return without fallback even when the capability is absent. Preserve the target as native particle `ctype` in OPS saves; do not mirror it in a JavaScript world map.
- TPT LIFE presets are semantic tools, not generic material IDs. IDs 171–194 are render projections of `PT_LIFE` ctypes 0–23; place them only through `powder_set_life`, keep occupied cells atomic, return without ordinary-paint fallback, and preserve native `ctype` in OPS saves. Never pass a LIFE projection ID through `powder_set` or use the LIFE brush as a configured-source shortcut.
- Headless Wind clears inactive particle-authored coarse `vx`/`vy` when a new gesture epoch begins, writes the authored velocity before `BeforeSim`, enables `AIR_ON` for exactly that update, then restores `AIR_VELOCITYOFF` before particle advection. Never inject Wind after `BeforeSim`: that bypasses diffusion, pressure coupling, clamping, and air-blocking walls. Preserve unstepped Wind through the namespaced optional OPS marker instead of inferring it from ordinary imported-save velocity.
- The shared liquid texture is species-aware RGBA: RGB is the uniquely supported liquid color and alpha is density. Do not read red as density or choose a liquid halo color by fixed neighbor scan order; exact unlike-liquid ties must remain a visible interface.
- Canvas dense-liquid cohesion is RGB-only and interior-only. Require high field and liquid-plane alpha, one exact smooth-eligible liquid species on all four cardinals, and at least one matching diagonal; world borders, shorelines, narrow streams, unlike species, trait-bearing liquids, and emissive liquids must remain unsmoothed. A cardinal empty cell may count only when it is an already reconstructed, high-density canonical-species pinhole. Read donors from the persistent three-row pre-smoothing ring and persistent per-source-row views so the result cannot cascade with scan order or allocate subarray views per frame, and preserve every alpha/material/density byte exactly.
- Dense-liquid lighting is field-owned even though alpha/support remains semantic and reconstruction-owned. In Canvas, scale raw-cell contour light down only when centre field alpha proves cohesion, and allow local top glints only when the semantic top is empty and the field above is genuinely sparse; unlike materials are seams, not air surfaces. Connected semantic cells and reconstructed holes share one hue-preserving relief basis derived from centre plus four-cardinal field alpha: upper-left slope, convex crown, and concave pocket response must be bounded, allocation-free, and gated off for isolated droplets. Semantic cells may scale that basis by their authoritative optics class; reconstructed empty support keeps the default gain. Keep Lava's body glow in the shared emission field and restrict its local accent to that same field-owned top surface so the twice-composited light plane cannot clip the whole liquid. In WebGL, promote lighting depth and suppress semantic micro-normals only when both centre density and the four-cardinal field mean prove connected support. Never use this RGB-lighting decision to widen alpha, mix neighbouring species RGB, or flatten an isolated droplet.
- Canvas gas relief is a presentation-only transform of the shared atmosphere texture: preserve alpha byte-for-byte and multiply RGB channels uniformly so lighting cannot widen the cloud or shift species hue. Dense WebGL gas should blend toward the atmosphere RGB instead of exposing raw semantic-particle dots. Curvature relief must reuse the same four cardinal alpha samples as the density slope: brighten bounded convex crowns, shade concave overlap pockets, and never add a field, texture fetch, pass, neighbouring-RGB read, or support/alpha change.
- Treat reconstructed volume density as silhouette support, not automatic opacity. Gas optical depth may darken RGB but must not widen its alpha. For liquids, derive optical depth from authoritative semantic occupancy plus local field support, keep reconstructed density for joined edges/holes, and use local slope for lips or depth rather than absolute world position. WebGL may promote depth only from its four already-sampled liquid neighbours so isolated droplets stay sparse; Canvas reconstructed holes may inherit RGB only from styled semantic neighbours of the uniquely supported liquid species.
- The palette lookup alpha byte stores `RenderOptics`; the style lookup alpha byte stores `RenderTrait`. Keep both textures nearest-sampled with `no-premultiply-alpha`. Optical classes may change RGB absorption, scatter, or gloss only; reconstructed empty-space support must keep the default class rather than guessing a material.
- Solid cavity reconstruction is a separate presentation-only alpha decision. Reconstruct only an interior exact solid material with zero different nonempty immediate neighbours, using either four-cardinal enclosure or at least five of eight matches with three cardinal supports. A two-opposing-cardinal thin crack is allowed only when all four matching diagonals prove continuous side walls and the missing axis is bounded by the same exact material two cells away; keep the distance-two bounds explicit so sparse crosses, clamped world edges, and mixed seams cannot qualify. Canvas must read the immutable semantic grid so fills cannot cascade, averaging ordinary matching styled pixels but using canonical palette RGB for trait-bearing solids; WebGL must reuse its eight immediate material samples and at most the two branched distance-two samples. Eligibility remains conservative and unchanged when tuning accepted-cavity appearance: once exact-material support qualifies, map its confidence into only the 0.90–0.98 display-opacity band. WebGL may apply that normalization only when `surfaceOnly` is set and reconstructed `density` is nonzero; nearby exact material alone is not proof of a cavity. Preserve powders, unlike-material seams, native walls, world borders, sparse crosses, and open notches. The browser gate must hold solid-tile dark-pit fraction at or below 0.08 and keep both matrix separators at RGB channels no greater than 20 with luma range no greater than 5. This closes proven cavities more convincingly; it does not establish that all cellularity has been removed. Never extend role traits into reconstructed empty cells.
- Dense solid relief is RGB-only and requires the exact same semantic material on all four cardinal neighbours. Keep its low-frequency lookup module-static and allocation-free, preserve silhouettes/alpha/powder granularity/unlike-material seams, and do not add a solid field or full-grid presentation pass. In WebGL, reuse the already decoded family/emission metadata and retain the low-quality discrete-shape early return.
- Dense-scene Canvas performance claims require the audit-only full presentation timer, not only reconstruction/helper microbenchmarks. Enable it only for `inputAudit=1`, time from scheduled-field selection through the final composed `restore()`, warm the deterministic full-grid Metal fixture, and exclude samples that rebuilt atmosphere/liquid/emission fields when reporting steady-state presentation telemetry. Keep the result nonblocking until a same-process paired comparison establishes a stable regression budget; production frames must not pay for timing calls.
- Treat the emission field as scene light as well as empty-space aura. In Canvas, composite the broad aura behind opaque matter and apply clamped bilinear samples only to exposed solid/powder/field RGB when the field contains light; never change surface alpha or semantic occupancy. Clamp the continuous field coordinate before computing its fractional interpolation weight, matching WebGL's clamp-to-edge sampler at world boundaries.
- Energy is a phase, not a solid texture profile. Keep occupied Fire/Plasma and radioactive carriers in the dedicated luminous-core path, preserve their palette identity at the semantic centre, and let the lower-resolution emission field own only the broader aura. Use a hue-preserving soft radiance knee for dense cores; do not rely on framebuffer clamping, which erases flow/scintillation detail. Canvas draws its local light plane twice, so its energy and volumetric-emissive alpha must remain a restrained accent rather than duplicating the shared aura. Do not add a new texture or scheduler stage for core animation when the existing semantic/temperature/velocity inputs suffice.
- Compact portrait layout may use a square interaction panel, but zoom 1 must contain the full 612×384 field with a uniform scale and letterboxing. Do not crop the world merely to fill the square.
- One touch is the mobile brush and two touches are camera pan/pinch. Defer the initial touch mark until the gesture is known to be single-touch so every two-finger gesture does not leave an accidental dot.
- Keep a compact bounded mobile catalog with `overscroll-behavior-y: auto`: its inner scroll must chain back to the document, and toolbox bottom padding must remain a safe touch target for page scrolling.
- Desktop tool filters use a fixed 68 px, two-row stacked rail; mobile keeps a fixed 40 px horizontal rail. Preserve those heights, keep every filter vertically contained, and browser-check a non-negative palette/actions gap at short desktop heights so the Brush card cannot cover the library.

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
?scene=render-lab&simulation=native&renderScale=2
?scene=wall-lab&renderScale=2
?scene=wall-lab&renderScale=2&renderer=canvas2d
```

The render-lab query uses a 612×384 in-memory backend, does not restore or write autosave, and contains powder density ramps, cohesive and sparse liquids, overlapping gas species, sand/water mixtures, adjacent liquid families, and representative rigid/organic/radioactive/emissive blocks. Keep canonical screenshots on this deterministic backend. The automated gate navigates separately to `simulation=native` for configured-source and LIFE smoke tests; never substitute native painting for the deterministic visual fixture. Capture the viewport itself at identical browser dimensions and keep local comparison shots under ignored `.artifacts/`.

Use the automated real-browser capture/interaction gate after shader or mapping changes:

```sh
mkdir -p .artifacts
npm run audit:browser-input -- --webgl-only --screenshot=.artifacts/render-lab-webgl.png
npm run audit:browser-input -- --canvas-only --screenshot=.artifacts/render-lab-canvas2d.png
```

The desktop gate performs a paired `renderScale=2` then `renderScale=1` navigation at the same explicit CSS viewport. It must report identical CSS canvas geometry while the backing changes only from 1224×768 to 612×384, and it repeats exact landmark painting, cursor-anchored wheel zoom, and 42×27 CSS-pixel middle-pan at 1×. Do not compare geometry captured under different device-emulation viewports; that tests browser setup rather than backing-scale independence.

The composed-output gate samples representative energy, dense solid, liquid, and gas regions. Keep dense fluid-core coverage, bounded luma range, and clipping checks in both Canvas2D and WebGL. The homogeneous lower Water/Oil/Acid/Lava columns additionally enforce bounded adjacent-pixel micro-contrast, nonzero five-by-five low-pass macro depth, paired Canvas/WebGL relief parity, and stable family hue so either flat matte fill, raw-cell glitter, or clipped Lava cannot return. Keep explicit Smoke/Oxygen/Noble Gas hue assertions because uniform curvature math alone does not protect later additive composition. Semantic unit tests alone cannot prove that a shader, compositor, or fallback draw order still presents the field.

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
- The Pages artifact must contain `revision.txt` generated from `ANIFORTPT_REVISION`/`GITHUB_SHA`, and the post-deploy verifier must match it exactly before accepting the asset closure. A cache-busting query alone does not prove that Pages serves the requested commit.
- Do not permanently choose Canvas2D from a short Pixi initialization deadline. Pages cold loads can have WebGL2 and a valid Pixi chunk yet take more than 1.2 seconds to initialize. Mount the compatibility canvas promptly, expose the reason in the HUD/data attributes, and promote it in place when WebGL becomes ready.
- Clean up locally launched Chrome and Vite processes immediately after browser validation.
