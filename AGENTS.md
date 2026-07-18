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
- Pixi filter `vTextureCoord` is not a world UV. The semantic field shader must use the sprite-local `vFieldCoord` supplied by `FIELD_VERTEX`.

Do not add an internal presentation multiplier (including the former 1.5 scale), stretch width and height independently, or introduce a second pointer transform.

After relevant changes, run:

```sh
npm run typecheck
npm test
npm run build
```

Also validate the actual painted footprint at multiple viewport positions and after cursor-anchored zoom; a HUD value computed by the same mapping is not sufficient evidence.

## Project hygiene

- Use `apply_patch` for source and documentation edits.
- Keep heavy toolchains and caches such as emsdk and ccache project-local.
- Preserve the manual GitHub Actions build/build-and-deploy controls and successful-build-only ccache persistence.
- Clean up locally launched Chrome and Vite processes immediately after browser validation.

