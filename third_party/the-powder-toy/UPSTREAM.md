# The Powder Toy upstream

- Repository: <https://github.com/The-Powder-Toy/The-Powder-Toy>
- Pinned revision: `bde6b44edd8b6ef7b978fbdad3fb0bcb5f8a5939`
- Upstream version at that revision: `100.0.399` (June 2026)
- License: GNU GPL version 3

The upstream source is fetched reproducibly into ignored `.cache/the-powder-toy` by `scripts/fetch-powder-toy.sh`; it is not vendored into this directory. `patches/the-powder-toy-headless.patch`, `native/tpt/`, and `scripts/build-tpt-wasm.sh` contain the complete project-side modifications and build procedure.

The distributed `public/wasm/stillroom_core.wasm` is linked from that pinned upstream simulation. Stillroom is distributed under GPLv3; the repository, pinned revision, upstream license, notices, modifications, and build scripts constitute the corresponding source path for the static release. `public/wasm/powder_core.wasm` is the original compatibility fallback built solely from `native/powder_core.cpp`.
