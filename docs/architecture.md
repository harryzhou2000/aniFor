# Architecture

## Core contract

The sandbox simulates one fixed `256 × 192` grid (49,152 cells) at 30 Hz. Given the same ruleset version, dimensions, serialized world state, ordered commands, and PRNG state, it produces the same next state. Rendering, camera state, wall time, and `Math.random()` do not participate in simulation results.

Ruleset v2 owns typed material, lifetime, and integer temperature arrays, the current tick, a seeded integer PRNG, and `WorldSnapshot` creation and restoration. A snapshot includes the ruleset, dimensions, tick, seed, PRNG state, and copies of all three arrays. The renderer receives a borrowed `SimulationView` and must not mutate it.

## Command and snapshot ownership

The app controller owns the command queue and the monotonically increasing command sequence. Live paint and erase commands target the current tick. Before each physics update—and before any authoritative snapshot—the controller drains commands. The engine accepts only valid commands for its current tick, orders accepted commands by sequence, and applies them without advancing time; stale and future commands are rejected rather than retargeted.

An app-owned authoritative snapshot combines the world snapshot with `nextSequence`. Clear drains pending work, stores one defensive recovery snapshot, clears the world, and retains tick, PRNG, and sequence identity. Recovery restores that one snapshot and consumes it. An import validates its incoming snapshot before atomically replacing the active timeline and storing the replaced timeline in that same one-slot recovery point.

## Runtime separation

| Layer | Responsibility |
| --- | --- |
| `simulation/` | Deterministic rules, integer rasterization, PRNG, world state, and snapshots. |
| `app/` | Command sequencing, queue draining, authoritative snapshots/recovery, and the fixed-step scheduler. |
| `input/` | Pointer capture, one-pointer paint versus two-pointer gesture ownership, and camera intents. |
| `renderer/` | WebGL/Pixi interpretation of the complete simulation view, deterministic material treatment, and camera transform. |
| `ui/` | Shell, controls, status, and semantic actions; it does not own simulation time or state. |
| `persistence/` | Canonical binary snapshot encoding and validation, Base64/file adapters, and local-storage autosave. |

Input rasterizes a stroke into integer grid points before sending a paint intent to the app. Camera pan and zoom remain renderer/input state and never enter the replay stream. The Pixi renderer converts the complete view to one packed RGBA texture and submits a full update when asked to render. Its material treatment is deterministic from cell position, material, lifetime, temperature, and neighboring occupancy; it does not mutate the simulation or use a TPT renderer. Fixed v2 visual baselines verify this renderer-only contract.

The scheduler uses `requestAnimationFrame` for responsive rendering while accumulating fixed 30 Hz simulation ticks. It clamps a frame delta to 250 ms, runs at most four ticks in one animation frame, and records dropped whole-tick backlog as diagnostics only. Pausing or hiding the page resets the frame timestamp so elapsed hidden time is not authoritative. A paused sandbox can still apply paint commands immediately and can advance one explicit step.

## Geometry and presentation

The physical world is a framed 4:3 bed. The outer atmospheric stage is presentation-only and non-paintable. Renderer, camera, input, and brush preview share the bed's CSS geometry; coordinates outside the transformed world resolve to no cell. DPR changes backing resolution, not world geometry.

## Persistence boundary

Persistence serializes authoritative snapshots as an uncompressed, little-endian `ANIF` v2 binary envelope. The envelope carries the ruleset, fixed dimensions, tick, PRNG state, sequence state, material/lifetime/temperature arrays, and a CRC-32 checksum. Base64 text and `.anif` file flows use that same payload. Input is bounded to 512 KiB of encoded text and 256 KiB of decoded binary or file data before structural and simulation-level validation. V1 envelopes are checksum-validated and migrated deterministically to v2; unsupported versions produce a distinct result rather than being treated as corrupt. An unsupported autosave is retained and blocks automatic writes until Clear or a successful import resolves it.

The app keeps one local-browser autosave and attempts to restore it at startup. It queues persistence after every authoritative simulation advance and rendered action; one 500 ms coalescing timer limits writes, including for static ticks, running simulation, and painting. It is best effort: browser storage can be unavailable or quota-limited, corrupt stored data is removed only when removal succeeds, and a pending save is not forced during page unload. Save/export and import do not change replay semantics; imports use the controller's atomic replacement/recovery seam.

## Material lifecycle

Each v2 tick runs thermal diffusion, gas, fire, solids, then liquids. Temperature uses bounded integer diffusion and ambient adjustment before material passes. Gas and fire scan upward; solids and liquids scan downward. Horizontal traversal alternates by tick. A generation marker prevents an occupant from updating twice, and first writer wins when movement conflicts.

- **Wall** stays fixed.
- **Sand** falls or settles diagonally and can swap downward through unprocessed water, oil, or acid.
- **Water** can freeze to ice or boil to steam before falling or spreading; it may displace unprocessed oil downward.
- **Oil** falls and spreads, and can ignite when heated by fire.
- **Fire** heats its fixed neighbors, can ignite oil and wood, is extinguished beside water, and expires to smoke or empty.
- **Wood** remains stationary unless ignited; **Ice** remains stationary until it melts to water.
- **Acid** falls or spreads, has a bounded lifetime, and may corrode sand, wood, or wall using the owned PRNG.
- **Smoke and Steam** are generated gases. They rise and expire; sufficiently cool steam becomes water.

For alternative lateral or diagonal choices, the owned PRNG selects an order with integer operations. These pass order, traversal, command, and PRNG rules are the determinism boundary.

## Constraints and deferrals

The app is static-only: no backend, database, accounts, or dynamic world sizes. It targets modern WebGL browsers and presents an unavailable state instead of a Canvas renderer.

The following remain intentionally deferred: a TPT backend, Canvas fallback, workers and `OffscreenCanvas`, WebGPU, dynamic world tiers, generalized undo, URL or browser-history sharing, compression, cloud sync, GPU partial texture uploads, metaballs, bloom/volumetric effects, interpolation, and a monorepo/package split. These are not part of the current architecture contract.
