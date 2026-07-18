# Powder Toy integration

## Current state

The default browser backend is the pinned official Powder Toy 100.0 simulation at revision `bde6b44edd8b6ef7b978fbdad3fb0bcb5f8a5939`, compiled as a single-threaded 612×384 ES-module WebAssembly target. `PowderToyBackend` owns its small C ABI; the compatibility C++ kernel and TypeScript backend are startup fallbacks.

`npm run build:wasm` fetches the pinned checkout, applies the reviewed headless Meson patch, copies the adapter and renderer-table definitions, compiles with project-local Emscripten and Meson, then publishes `stillroom_core.js` and `stillroom_core.wasm`. The headless target omits SDL UI, Lua, HTTP, pthreads, and Newtonian FFT gravity while retaining Powder Toy particle movement, native wall-grid physics, air, heat, element interactions, and ordinary vertical gravity.

## Projected material catalog

The frontend ABI defines 170 stable projected material IDs. The UI catalog contains 165 brush entries across powders, liquids, solids, gases, energy, explosives, special, radioactive, force, electronics, powered, sensors, and life; 160 are enabled in this headless build. Steam, salt water, gas, snow, and plasma are reaction-only products, while GRVT, GBMB, NBHL, NWHL, and GPMP remain visible but disabled because the headless engine intentionally omits Newtonian FFT gravity. Air-velocity-dependent behavior such as WHOL and VENT is marked as limited. `src/shared/materials.ts` is the catalog authority and `native/tpt/tpt_adapter.cpp` maps every ID bidirectionally to the pinned TPT engine. Clone/source particles, radioactive and nuclear materials, force particles, seeds, plants, yeast, and vines therefore use native TPT semantics; representative tests verify projection, pressure, water stability, deterministic save/load, and seed-driven plant growth.

## Tool taxonomy

Catalog entries are typed as particles, walls, signs, configured sources, or simulation tools rather than conflating TPT concepts. The current drawing surface exposes particle brushes—including native clone/source and force particles—and ten true TPT wall-grid brushes through a separate `bmap` ABI and wall brush. Native walls are rendered and serialized independently from particles, and their interactive dirty scan is bounded to the affected coarse-cell brush region. Signs, configured-source targeting, and simulation force/thermal gestures remain visible but disabled until their dedicated native operations and interaction contracts are exposed.

## Renderer contract

The adapter emits stable material IDs, a full-resolution view of the native coarse wall grid, pressure, particle-temperature, and velocity fields. Powder Toy particle structs and numeric element/wall IDs remain inside the C++ boundary; the frontend owns only copied views and mutates native state through explicit brush functions. The primary Pixi/WebGL presenter packs particles and walls into independent RGBA8 textures and reconstructs softened material fields in a palette/style-driven shader. Halo-aware 32-cell dirty regions bound static updates; dynamic temperature and velocity fields refresh the texture at the 30 Hz render cadence. The logical surface remains 612×384 while the default backing is 1224×768, and the Canvas2D field renderer remains the graceful compatibility path.
