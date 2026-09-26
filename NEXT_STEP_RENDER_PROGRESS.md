# Visual overhaul status

The [design target](NEXT_STEP_RENDER.md) is physically inspired, stylized realism for the AniforTPT particle playground.

The 2026-08-17 roadmap audit recorded the scoped visual overhaul as complete in the canonical WebGL/HDR renderer. It identified HDR lighting and bloom, connected liquid and gas presentation, and material-specific responses as implemented. The last retained visual change refined dense-gas crown lighting. The optional WebGPU probe executes a separate density-smoothing compute test when an adapter is available; it is not a production renderer. The recorded local browsers reported no WebGPU adapter, so adapter-backed execution was not established there.

This is a historical checkpoint, not a claim about today's deployment or hardware. The detailed experiment log and its evidence references remain available in Git history through commit `3a853a5`.
