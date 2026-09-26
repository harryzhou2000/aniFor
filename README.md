# AniforTPT

AniforTPT is a mobile-friendly particle playground backed by The Powder Toy. It provides native particles, walls, LIFE presets, sources, signs, and simulation tools through a browser interface. The renderer presents powders, liquids, gases, solids, and energy with material-specific lighting and volume effects.

## Run locally

```sh
npm install
npm run dev
```

The ordinary presentation uses WebGL/HDR where available. `?renderLook=classic` selects the lean comparison look, and `?renderLook=neon-lab` selects the alternate styled look. Canvas2D is the compatibility presentation. Detail 8× uses a separate compact WebGL path.

## Build

```sh
npm run setup:emsdk
npm run setup:build-tools
npm run build:all
```

`npm run build` creates the static site in `dist/`. The `verify-static-game` GitHub Actions workflow provides manual build and deployment controls for `main_codex`.

## Visual review

The Visual Lab launcher captures the selected scene and creates a current comparison package:

```sh
npm run visual-lab:review -- --candidate=water-motion
npm run visual-lab:review -- --cohort=powder-style
npm run visual-lab:review -- --cohort=material-lighting
```

`npm run visual-lab:review:reuse -- ...` uses an existing current `dist/` build. The review board displays OFF/A/B captures and measurements for visual inspection. Historical packages in `visual-baselines/` are optional references.

## Project notes

- [Visual design target](NEXT_STEP_RENDER.md) and [status](NEXT_STEP_RENDER_PROGRESS.md)
- [Viewport notes](docs/viewport-rendering-contract.md)
- [Render lab](docs/render-lab.md)
- [Powder Toy integration](docs/powder-toy-integration.md)
- [Earlier visual experiments](docs/visual-experiments.md)
