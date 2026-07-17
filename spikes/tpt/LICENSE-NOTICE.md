# TPT spike licensing

The Powder Toy is GPL-3.0-or-later. This spike pins the official upstream
repository at `v100.0.399` (`9c94feba3ed5eaa75a819ac000c0d29e4ce92570`) and
does not copy its source or generated assets into the committed application.
The Emscripten SDK is used under its own licenses; its installed cache and
toolchain remain ignored project-local files.

Before distributing a TPT-derived artifact, perform a complete dependency
license audit and provide the corresponding source and notices required by
the GPL and by Emscripten/SDL and other bundled dependencies. The build
scripts retain the upstream source checkout so that audit can be reproduced.
