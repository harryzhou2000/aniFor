# Powder Toy integration

## Current state

The default browser backend is the pinned official Powder Toy 100.0 simulation at revision `bde6b44edd8b6ef7b978fbdad3fb0bcb5f8a5939`, compiled as a single-threaded 612×384 ES-module WebAssembly target. `PowderToyBackend` owns its small C ABI; the compatibility C++ kernel and TypeScript backend are startup fallbacks.

`npm run build:wasm` fetches the pinned checkout, applies the reviewed headless Meson patch, copies the adapter and renderer-table definitions, compiles with project-local Emscripten and Meson, then publishes `stillroom_core.js` and `stillroom_core.wasm`. The headless target omits SDL UI, Lua, HTTP, pthreads, and Newtonian FFT gravity while retaining Powder Toy particle movement, air, heat, element interactions, and ordinary vertical gravity.

## Curated mapping

| Stillroom material | Powder Toy element |
| --- | --- |
| Sand | `PT_SAND` |
| Water | `PT_WATR` |
| Stone | `PT_DMND` |
| Ember | `PT_FIRE` |
| Mist | `PT_SMKE` |

## Renderer contract

The adapter emits stable material IDs plus temperature and velocity fields. Powder Toy particle structs and numeric element IDs remain inside the C++ boundary; the frontend owns only copied views and never mutates upstream storage.
