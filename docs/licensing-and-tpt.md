# Licensing and The Powder Toy

The current application reimplements its sandbox behavior in TypeScript. It ships no Powder Toy code, WebAssembly module, assets, or renderer in the application build. The TypeScript v2 engine remains the default backend.

The project ran an isolated, project-local Gate A spike against the official pinned [The Powder Toy](https://github.com/The-Powder-Toy/The-Powder-Toy) browser build. The official build, startup, and transfer inventory were feasible: required cold-cache Brotli assets totalled 1.30 MiB. The spike output remains outside the normal Vite build and static deployment path.

Gate A did not qualify the runtime: it has no stable 30-second runtime proof, native save/reload proof, or memory-budget proof. It is therefore neither shipped nor a default backend, and Gate B is not authorized. Upstream's full-game build remains coupled to its simulation, save, brush, rendering, and main-loop structures; the threaded browser route also requires `SharedArrayBuffer` and COOP/COEP headers, which complicate simple static hosting.

Any future TPT reuse under GPLv3 requires a separately approved, pinned, attributed effort with corresponding source, build instructions, license compliance, and review of bundled third-party components and the distribution boundary. Do not describe aniFor as using, porting, or embedding The Powder Toy.
