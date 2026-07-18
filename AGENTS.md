# AniforTPT agent guidance

## CodeGraph

When `.codegraph/` exists, use `codegraph explore` before grep/find or broad file reads when locating or understanding code. Ask it for the relevant symbols, complete source, and call paths. Use `rg` only after CodeGraph has established the area to inspect.

## Viewport, input, and rendering

Before changing viewport layout, pointer mapping, zoom/pan, Pixi setup, shader coordinates, canvas sizing, or device-pixel-ratio behavior, read [`docs/viewport-rendering-contract.md`](docs/viewport-rendering-contract.md).

The non-negotiable contract is:

- The simulation world is 612×384 cells.
- World, brush, and semantic texture coordinates use that same unscaled space.
- Layout performs one uniform aspect fit; camera zoom/pan performs one presentation transform.
- Device pixel ratio affects backing resolution only, never world or CSS coordinate math.
- The default render backing is 2× per axis (1224×768 for the 612×384 world); use `?renderScale=1` only for A/B diagnosis.
- Pixi filter `vTextureCoord` is not a world UV. The semantic field shader must use the sprite-local `vFieldCoord` supplied by `FIELD_VERTEX`.
- Native TPT walls are a separate `bmap`-derived field and texture. Never encode a wall ID as a particle/material ID; particles and walls may coexist at the same world cell and must be composited independently.
- The shared liquid texture is species-aware RGBA: RGB is the uniquely supported liquid color and alpha is density. Do not read red as density or choose a liquid halo color by fixed neighbor scan order; exact unlike-liquid ties must remain a visible interface.
- Compact portrait layout may use a square interaction panel, but zoom 1 must contain the full 612×384 field with a uniform scale and letterboxing. Do not crop the world merely to fill the square.
- One touch is the mobile brush and two touches are camera pan/pinch. Defer the initial touch mark until the gesture is known to be single-touch so every two-finger gesture does not leave an accidental dot.

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

Read [`docs/render-lab.md`](docs/render-lab.md) before changing reconstruction thresholds or blur radii. A TypeScript or Vite build does not compile Pixi's runtime GLSL; a browser screenshot with a clean shader console is required.

The native wall lab uses the real TPT backend, remains paused, and places ten wall types behind deterministic material gradients and mixtures. Use it after wall ABI, wall texture, or compositing changes to prove that native walls remain distinct from particles and survive the same 612×384-to-2× presentation path.

## Project hygiene

- Use `apply_patch` for source and documentation edits.
- Keep heavy toolchains and caches such as emsdk and ccache project-local.
- Preserve the manual GitHub Actions build/build-and-deploy controls and successful-build-only ccache persistence.
- Native save sharing uses raw `GameSave::Serialise()` bytes in `.cps` files. Do not expand new saves into URL hashes or the clipboard; keep `.anifortpt` visibly separate for non-native fallbacks.
- A successful Pages upload is not enough evidence. Preserve the recursive local and live asset-closure checks, and browser-test the cache-busted deployment because stalled runtime initialization can look like a missing asset.
- Do not permanently choose Canvas2D from a short Pixi initialization deadline. Pages cold loads can have WebGL2 and a valid Pixi chunk yet take more than 1.2 seconds to initialize. Mount the compatibility canvas promptly, expose the reason in the HUD/data attributes, and promote it in place when WebGL becomes ready.
- Clean up locally launched Chrome and Vite processes immediately after browser validation.
