# Powder Toy integration

## Current state

The default browser backend is the pinned official Powder Toy 100.0 simulation at revision `bde6b44edd8b6ef7b978fbdad3fb0bcb5f8a5939`, compiled as a single-threaded 612×384 ES-module WebAssembly target. `PowderToyBackend` owns its small C ABI; the compatibility C++ kernel and TypeScript backend are startup fallbacks.

`npm run build:wasm` fetches the pinned checkout, applies the reviewed headless Meson patch, copies the adapter and renderer-table definitions, compiles with project-local Emscripten and Meson, then publishes `stillroom_core.js` and `stillroom_core.wasm`. The headless target omits SDL UI, Lua, HTTP, pthreads, and Newtonian FFT gravity while retaining Powder Toy particle movement, air, heat, element interactions, and ordinary vertical gravity.

## Projected material catalog

The frontend ABI defines 42 stable projected IDs: 36 selectable brushes across powders, liquids, solids, gases, energy, explosives, and special materials, plus six reaction-only products such as steam, salt water, snow, coal, gas, and plasma. `src/shared/materials.ts` is the catalog authority and `native/tpt/tpt_adapter.cpp` maps those IDs to pinned TPT elements. Any other enabled reaction product is projected by its TPT physical-state flags, so it remains visible rather than disappearing.

## Renderer contract

The adapter emits stable material IDs plus pressure, particle-temperature, and velocity fields. Powder Toy particle structs and numeric element IDs remain inside the C++ boundary; the frontend owns only copied views and never mutates upstream storage.
