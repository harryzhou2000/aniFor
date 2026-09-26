# Powder Toy integration

The browser backend uses a pinned Powder Toy 100.0 build compiled to WebAssembly for a 612×384 world. A small C ABI connects native particle, wall, LIFE, source, sign, and simulation-tool behavior to the TypeScript application.

The frontend presents stable projected material IDs and native walls through separate renderer inputs. Current native save exchange uses Powder Toy OPS bytes in `.cps` files; fallback backends use the app's separate `.anifortpt` format.

This page is an architecture overview. The detailed historical ABI and feature notes remain available in Git history.
