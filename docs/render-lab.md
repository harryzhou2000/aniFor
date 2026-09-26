# Render lab

The render lab is a paused 612×384 material scene for inspecting presentation changes. It is separate from the native simulation and does not restore or write autosave.

```text
http://localhost:5173/?scene=render-lab&renderScale=2
http://localhost:5173/?scene=render-lab&renderScale=2&renderer=canvas2d
http://localhost:5173/?scene=showcase&renderScale=2
```

The atlas includes powder piles and fine structures, connected liquids, gas clouds, solids, emitters, walls, and blank controls. The showcase route arranges representative materials into a composed scene.

The current Visual Lab launcher produces side-by-side captures and a review page:

```sh
npm run visual-lab:review -- --candidate=water-motion
npm run visual-lab:review -- --cohort=material-lighting
```

For a direct screenshot from a built bundle:

```sh
npm run build
npm run audit:showcase-screenshot -- --webgl-only --screenshot=.artifacts/showcase-webgl.png
```

The old experiment-specific thresholds and release checklists are available in Git history. They are not active instructions for judging new visual work.
