# Licensing and The Powder Toy

The current application reimplements its sandbox behavior in TypeScript. It ships no code, WebAssembly module, assets, or renderer from [The Powder Toy](https://github.com/The-Powder-Toy/The-Powder-Toy). It does not integrate The Powder Toy.

Future reuse of The Powder Toy under GPLv3 is permissible only through a separately scoped TPT/WASM feasibility spike that pins the upstream revision and supplies the required source, build, license, and attribution compliance for the resulting distribution. That work may also require review of upstream bundled third-party components and the intended distribution boundary.

The spike is intentionally deferred. Upstream's browser build is coupled to the full application and its simulation, save, brush, rendering, and main-loop structures; extracting a small stable ABI is non-trivial. The threaded browser path also relies on `SharedArrayBuffer` and COOP/COEP response headers, which complicate simple static hosting, including GitHub Pages. Build size, determinism, performance, maintenance, and deployment compatibility remain gates for any future work.

Until that spike is completed and its obligations are documented, do not describe aniFor as using, porting, or embedding The Powder Toy.
