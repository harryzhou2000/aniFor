# AniforTPT Work Resume

Last reconciled: 2026-07-26 (Asia/Shanghai)

This is the authoritative handoff for the active AniforTPT workstream. The goal is not complete.

## Active objective

Build a polished browser reinterpretation of The Powder Toy that keeps the pinned native TPT simulation authoritative while replacing direct pixel/cell presentation with a smooth, expressive material renderer. The current major correctness phase is closed: viewport/input mapping, stable world geometry, adjustable true supersampling, and bounded 8× recovery are now protected non-regression foundations. Direct the clear majority of new effort to material breadth, material behavior, graphics, and aesthetic cohesion: phase-continuous reaction families, broader exact identities, richer surface and volume optics, stable curved silhouettes, readable fine structures, and representative composed scenes at normal fit view. Preserve native reactions and save state, broad element coverage, distinct particle/wall/sign/source/tool semantics, bounded performance, a faithful Canvas2D compatibility path, mobile-first controls, and a cached manual GitHub Pages deployment pipeline.

Immediate priorities are:

1. Make material and graphics improvement the active main phase. Direct most implementation and validation effort here: render coherent material bodies rather than exposed particle cells, while retaining small semantic structures and readable isolated grains. Prioritize fit-view readability and family identity: rough granular powders, cohesive packed earth/clay/concrete, hard stone and metal, glassy/translucent solids, wet liquids with surface tension and optical depth, borderless volumetric gases, emissive energy, organic/plant growth, devices, and radioactive matter should each have recognizable visual behavior rather than palette-only differences.
2. Protect renderer correctness as an invariant rather than a competing phase: the full field remains visible at minimum zoom with no aspect stretch; brush/cursor coordinates remain exact; desktop middle-button pan, one-finger mobile draw, and two-finger pan/pinch stay correct; 1×/2×/4×/8× presentation preserves the same world geometry; true 8× recovers safely from stalls or context loss without a duplicate full-size target.
3. Refine silhouettes without erasing simulation detail. Compatible packed solid and liquid cells should form stable curved outer boundaries; isolated powder particles remain round in styled modes and exactly square in Grains mode; thin columns, ledges, branches, one- or two-cell ridges, intentional cavities, and mixed-material contact seams remain present. Moving powder, liquid, and gas neighbours must not make a resting solid boundary flicker. Unlike species may meet along a shared smooth contact curve, but their colors and ownership must never overlap.
4. Replace flat fills with restrained, phase- and optics-aware depth: broad directional key/fill lighting, low-frequency body relief, thickness absorption, transparency/transmission, controlled reflection/specular highlights, contact shadow, caustics where appropriate, and stable material variation. Effects must read at fit view, preserve hue and authoritative occupancy, avoid whole-frame blur, and remain deterministic enough for paired Canvas/WebGL visual tests. Canvas2D may be simpler, but must preserve the same silhouettes, material families, and scene composition.
5. Maintain adjustable supersampling as presentation quality rather than simulation scale. Keep 2× as the crisp default, 4× as the practical high-quality mode, and true 8× as an explicit inspection mode. New visual work must avoid per-output-pixel CPU reconstruction, unnecessary full-resolution textures/passes, watchdog-prone shader expansion, and allocations that scale unexpectedly with output resolution.
6. Expand practical TPT interface coverage, especially forces, sources, radioactive/nuclear elements, growing plants, LIFE presets, signs, and simulation tools without misclassifying them as ordinary particles.
7. Keep native TPT file-based save/share, desktop/mobile tool discovery, the completed responsive UI geometry pass, and the compact non-obstructive field/backend HUD working while visual work proceeds.
8. Checkpoint reviewed visual tranches on `main_codex`; after GitHub authentication is available, run the manual cached `build-and-deploy` and verify the live Pages revision, recursive asset closure, WASM MIME, backend promotion, and representative material scene rather than accepting a successful workflow alone.

### Active execution emphasis

### Current structural-rigid body identity checkpoint

- Brick, Metal, Ceramic, BMTL, Gold, Iron, and Titanium now retain their
  shared smooth rigid contours, body optics, and thickness absorption while
  gaining sparse, material-specific construction identity: Brick courses,
  machined metal brush/glints, ceramic glaze/crazing, repaired BMTL plates,
  gold grain, iron oxide scale, and titanium lamellae. This gives common
  construction scenes readable material character instead of one generic rigid
  texture.
- The Canvas2D and WebGL implementations are deterministic world-grid RGB
  arithmetic only. They apply after common solid-body lighting and before
  traits/state overlays, and reject reconstructed support, walls, halos,
  emissive matter, and trait owners. They introduce no field, texture/sampler,
  neighbour query, pass, target, alpha/support/ownership mutation, native-state
  dependency, or output-scale resource; every other material is an exact no-op.
- The structural layer is independently switchable through the browser audit
  bridge. Focused helper and shader-boundary tests cover the exact seven-member
  mapping, deterministic bounded alpha-invariant RGB response, unique material
  fingerprints, protected controls, uniform seeding, and the no-texture/no-alpha
  shader guard. The current full local suite is `117` files / `743` tests;
  TypeScript, the production build, static 19-asset closure, and paired Canvas2D
  plus WebGL material-atlas browser compilation gate pass with zero reported
  browser errors.

### Current Smooth-powder contour and 8× queue checkpoint

- Settled Smooth powder now gives an already-proven wide, exact-species density
  field priority over loose per-cell grain contact when choosing its Canvas and
  WebGL diagonal contour blend. The change is strictly presentation-local:
  Grains, Local, moving powder, narrow columns, authored holes, unlike seams,
  traits, and emissive matter retain their prior paths. Grains remains the
  square discrete reference; Smooth no longer leaks the local semantic
  staircase across a deeply supported shallow Sand slope.
- The composed browser gate now captures Grains, Local, and Smooth against the
  same blank page and compares their long shallow Sand contour to the analytic
  fixture edge. Canvas/WebGL Smooth RMS/max edge error stays within
  `0.75`/`1.25` world cells and must improve tangent/curvature continuity over
  Local while Grains remains measurably discrete. Exact semantic recall and
  authored-hole checks remain separate from this visual metric.
- An 8× timing audit request now waits to *own* a completed presentation frame
  before reporting acceptance. It cannot be silently queued behind the one
  permitted 15-million-fragment frame/fence. Browser timing checks use the
  required bounded 30-second queue-ownership deadline and a distinct
  completed-frame sample deadline; the unit harness covers the unsignalled
  fence rejection.
- A fresh full `audit:8x` release run passed at true `4896×3072` with zero
  browser errors. It completed material-atlas, source-target, VIBR, DEUT,
  forced-stall, and real context-loss recovery checks; its final recovery stage
  completed in `707526 ms`. The full local suite is now `116` files / `738`
  tests, with TypeScript, production build, static 19-asset closure, and audit
  script syntax checks all green. No audit Chrome process remains.

### Current LIFE colony mesostructure refinement

- All 24 exact native `PT_LIFE` projections (`171..194`) retain their existing
  deterministic ctype-derived identity, but their Canvas/WebGL 16-cell motif
  now includes a preset-oriented chord through the existing membrane. Dense
  colonies consequently read as joined cellular bodies rather than only a
  sequence of engraved stripes, while each preset's palette, static band,
  node, membrane, and core grammar remains distinct.
- This is an arithmetic-only RGB refinement. It adds no native state projection,
  clock, neighbour query, texture/sampler, field, pass, target, allocation,
  alpha/support change, semantic mutation, or output-scale resource. Dead LIFE
  cells remain unreconstructed, and authored holes, tendrils, isolated cells,
  guarded blanks, the native `ctype`/OPS contract, and semantic LIFE placement
  remain authoritative.
- Focused Canvas/WebGL source and all-24 fixture tests pass; the paired real
  browser Cellular gate confirms exact flat→styled→flat mask/support recovery,
  bounded `8–10` byte RGB response, and zero browser errors in both Canvas2D
  and WebGL. The full local suite remains `116` files / `738` tests with the
  production 19-asset build closure. A fresh true-8× `4896×3072` release gate
  completed every atlas, interaction, source/VIBR/DEUT, forced-stall, and real
  context-loss recovery check in `731113 ms` with zero browser errors.

### Current Canvas phase-presence reconstruction guards

- The Canvas fallback now records solid and liquid semantic presence during its
  existing 612×384 material loop. It skips the full solid reconstruction scan
  when no solids exist, and skips liquid reconstruction, reconstructed
  suspension styling, and liquid-to-base compositing when no liquid exists.
- This changes no mixed frame: a single qualifying material retains the exact
  previous pipeline. It adds no field, allocation, output-scale work, or
  viewport/input dependency. Gas- and energy-only frames avoid impossible
  full-world scans while preserving the existing atmosphere and emission fields.
- The quick profile measures the independently bounded solid/liquid scans at
  `3.13 ms` / `5.82 ms` median respectively before their avoided compositing
  work. The Canvas showcase plus dedicated 17-gas and 21-energy/radioactive
  browser atlases pass with zero errors and their topology/off→on→off controls
  intact; the full local suite is `114` files / `728` tests.

### Current Canvas field-backed liquid pinholes

- At 2× and above, the contour scratch now retains an already reconstructed
  ordinary-liquid pinhole only when the shared liquid RGBA field proves one
  exact canonical liquid species at that semantic-empty, non-wall cell. The
  retained pixel stays `Empty` in `ownerMaterials`, bypasses all Hermite/
  material branches, and copies its pre-styled RGBA payload without changing
  alpha, occupancy, physics, or liquid-field topology.
- Ambiguous or absent field species, zero field density, native walls, LIFE
  payloads, and all Canvas liquid-identity materials remain rejected. This
  keeps authored holes and semantic roles stable while letting ordinary Water,
  Oil, and Acid body support remain continuous rather than becoming visibly
  punctured only in Canvas.
- Focused liquid-surface/contour coverage (`44` tests), production build,
  Canvas liquid-identity and liquid-depth browser gates, and a zero-error
  Canvas showcase capture pass. The full local suite is `114` files / `729`
  tests. The liquid-identity gate was compared against the prior committed
  baseline after it exposed an interaction, then restored without relaxing its
  response bounds.

### Current Canvas translucent-rigid shell coverage

- The RGB-only Canvas translucent shell now covers the whole established
  `TranslucentRigid` family: DRIC, NICE, QRTZ, and RIME join Glass and Ice.
- Glass and Ice retain their exact existing branches. The new branches reuse
  only the existing relief and edge-light scalars, add no field, sample,
  buffer, topology, alpha, or physics work, and leave non-translucent material
  as an exact no-op.
- DRIC/RIME receive restrained frosted depth, NICE a cooler nitrogen-ice rim,
  and QRTZ a light cyan prism response. Focused coverage proves determinism,
  alpha invariance, blue-weighted crystalline response, bounded magnitude, and
  the opaque-material no-op control.
- The dominant Canvas NICE cold face and QRTZ broad prism faces now retain
  enough of their bounded RGB motif through Canvas body optics to remain
  visible at normal fit. This restores the previously failing paired
  crystalline gate without relaxing a threshold: normal-fit Canvas/WebGL
  ratios are DRIC `0.3668`, NICE `0.4094`, QRTZ `0.3730`, and RIME `0.3617`.
  Topology, alpha/support signatures, exact flat→styled→flat repetition, and
  browser errors remain clean in both backends. The focused coverage, full
  114-file / 728-test suite, production bundle, and paired browser capture
  all pass.

- **Primary work — material identity and graphics:** deepen family-specific silhouettes, internal structure, lighting, transmission, reflection, motion, and contact response. Each tranche must improve a representative scene at normal fit view, not only magnified diagnostic crops.
- **Immediate material-identity tranche:** configured-source targets, all fourteen non-emissive native powder explosives, authoritative ACEL/DCEL activity, native POLO radioactive lifecycle graphics, SPNG hydration, typed Lava ancestry, complete SEED/PLNT lifecycle graphics, and conductor-aware SPRK host/lifetime graphics are release-complete locally.
- **Graphics-led effort:** move from a succession of narrow state projections to a graphics-led material program. As a planning target, spend roughly two thirds of implementation and visual-validation effort on composed material appearance and one third on the native behavior/state needed to make those visuals truthful. Infrastructure, viewport, and layout receive regression work only.
- **Energy-state contract:** PHOT spectrum and co-located energy use an independent 612×384 state projection; never squeeze its 30-bit wavelength mask into the matter-owned state path while `pmap` can hide a co-located photon. Preserve this separate plane when extending energy graphics.
- **Material breadth:** expose and visually validate as much of the native TPT catalog as practical, with special attention to explosives, forces/sources, radioactive and nuclear matter, living/growing plants, unusual phase products, devices, and LIFE presets. Converted or reaction-produced elements must render correctly even when they are not currently selected in the toolbox.
- **Correctness constraints:** preserve authoritative occupancy, thin structures, intentional holes, unlike-material ownership, stable resting boundaries, square Grains mode, exact cursor/input mapping, and identical world geometry at every render scale.
- **Performance constraints:** prefer shared semantic fields and bounded per-world-cell work; avoid new output-resolution reconstruction passes. Treat 2× as the normal target, 4× as high quality, and true 8× as a robust inspection mode with tested recovery.
- **Secondary work:** address remaining desktop/mobile layout polish and GitHub Pages verification after each coherent graphics tranche, rather than allowing UI or deployment work to displace the material phase unless it blocks testing or use.

### Current explosive-powder identity checkpoint

- All fourteen authoritative non-emissive native powder explosives now have distinct deterministic RGB signatures in Canvas2D and WebGL: GUNP, THRM, PLEX/C4, FWRK, BANG, BOMB, C5, DEST, FIRW, FSEP, FUSE, IGNT, LITH, and RBDM. Compressed charges, pyrotechnics/fuses, cold charge, and reactive metals share restrained family cadence while retaining exact per-material marks.
- Styling is world-integer, time-free, sample-free, topology-neutral, and bounded to ±14 source bytes. It applies only to authoritative trait-free, non-emissive Powder without a native wall. Nitro, CFLM, LIGH, LRBD, THDR, Water, Metal, reconstructed support, and empty space remain controls. No texture, field, pass, target, upload, persistent allocation, or output-scale resource was added.
- The paired 7×2 browser atlas preserves 56 authored hole cells, 42 air-open notches, all 812 one-cell columns, 14 isolated cells, guarded blanks, and unlike-Sand contacts. Grains retains 39,144 exact square 2×2 backing cells; Local retains all 826 column/isolated controls. Flat→styled→flat is byte-exact, all fourteen response signatures are distinct in both backends, and browser errors are zero.
- Local validation passes TypeScript, all 101 test files / 636 tests, the production build and 19-file asset closure, the dedicated paired explosive gate, and the renderer-wide true-8× gate. True 8× remains exact at 4896×3072 with eight GPU-fence samples at 5108.2/5155.3/5174.0 ms median/p90/max, complete material-atlas/input/powder checks, forced-stall recovery, independent context-loss recovery, and zero browser errors. No audit Chrome session remains.
- The explosive tranche is closed; the following native SEED checkpoint completes its immediate botanical successor.

### Current native SEED-to-tree checkpoint

- The canonical native planter now proves real SEED growth rather than a hand-authored render fixture. At tick 300 the OPS1 checkpoint contains 39 Wood/Plant cells; a fresh official backend resumes it for 600 ticks and reaches 568 cells (494 Wood, 74 Plant). The native dirty stream reports 532 grown cells, including every newly grown post-checkpoint index. Identical 900-tick no-water and no-soil controls produce zero growth.
- The paired browser fixture runs three guarded planters in one official 612×384 world for 900 native ticks, measures the final dirty stream, then reloads the exact final OPS save so the renderer receives every final cell. The canonical planter deterministically yields 530 Wood and 22 Plant cells in a 39×73 tree; both controls and unassigned space retain zero growth.
- Canvas2D and WebGL each present all 552 generated cells with zero unsupported centres or alpha drift. Botanical styling changes RGB only, flat→styled→flat repeats exactly, Canvas/WebGL response is 2.5166/2.5389 RGB RMS with closely matched spatial profiles, and browser errors are zero. The fixture remains paused after its native stepping so capture does not invent further growth.
- Local validation passes TypeScript, all 102 test files / 641 tests, the 822-module production build and 19-file asset closure, the focused native unit/OPS test, and the paired native browser gate. No Chrome session remains. The following force-device checkpoint is complete; reaction/phase materials and their graphics are now active.

### Current ACEL/DCEL native-activity checkpoint

- Exact native ACEL/DCEL owners now project state word `1` only when their latest official update left `tmp != 0`, meaning the device acted on an eligible neighbouring particle; isolated devices remain `0`. A focused native fixture proves both owners before/after one tick and proves OPS1 reload retains active versus isolated `tmp` without JavaScript inference.
- Canvas2D and WebGL add one independent RGB-only, deterministic world-integer activity cue after exact owner and state-bit checks. ACEL receives a directional acceleration chevron/wake; DCEL receives a distinct cool braking ring/core. The style is bounded to 16 source bytes and adds no clock, sample, texture, field, pass, target, upload, persistent allocation, alpha/support change, ownership change, or output-scale resource.
- The paired four-card browser atlas preserves authored holes, open notches, one-cell structures, isolated devices, inactive exact-owner controls, active-state Sand/Water/Metal controls, and guarded blanks. Flat→styled→flat repeats exactly; inactive and wrong-owner controls are byte-exact. Canvas/WebGL ACEL response is `5.4497/5.4497` RGB RMS and DCEL is `5.7459/5.7459`, with chroma cosine `1`, profile distance at most `0.00007`, and zero browser errors.
- Local release validation passes TypeScript, all `104` test files / `653` tests, the `824`-module production build, 19-file static asset closure, project-local Emscripten 6.0.3 native/WASM rebuild, and `audit:force-activity`. The renderer-wide true-8× gate passes requested/effective `8/8` at `4896×3072`, all `217/217` material projections, anchored wheel/click input, Local/Smooth powder recall, square deep-zoom Grains, queued-presentation checks, forced-stall recovery, and independent context-loss recovery with zero browser errors. Eight GPU-fence samples complete at `5141.4/5213.9/5256.8 ms` median/p90/max. No audit Chrome session remains.
- This closes the current stateful force-device tranche. Active work now shifts to native reaction/phase families and richer composed material graphics; viewport/input stays a protected regression contract.

### Current POLO radioactive lifecycle checkpoint

- Exact native POLO now projects its authoritative neutron-emission count (`tmp` `0..5`), cooldown (`life` `0..15`), and absorbed-proton dose (`tmp2` `0..10`) through the existing owner-multiplexed 612×384 `Uint16` plane. Bit 11 explicitly marks even default neutron-ready POLO as present; every non-POLO owner remains zero and high bits are reserved.
- A real native fixture uses configured CLNE→PROT emitters to prove every accepted co-located dose from one through ten, exact initial and mid-dose OPS1 round trips, and the official next-update POLO→PLUT conversion. JavaScript neither infers the reaction nor invents a parallel state machine.
- Canvas2D and WebGL add the same deterministic 16-cell, RGB-only lifecycle grammar: cool neutron-ready crown, warm cooldown shell, proton-capture ladder, and spent-grey state. The cue is bounded to 16 source bytes, independently toggleable, and adds no clock, neighbour sample, texture, field, pass, target, upload, persistent allocation, alpha/support change, ownership change, physics change, or output-scale resource.
- The paired five-card browser atlas preserves 4,124 body cells per state fixture, authored holes, open notches, one-cell structures, isolated particles, and exact zero-state/wrong-owner/PLUT/PROT/NEUT/blank controls. Flat→styled→flat repeats byte-exactly. Canvas/WebGL response ratios are `0.9987–1.0003`, normalized profile distance is at most `0.00189`, chroma cosine is `1`, and both backends report zero browser errors.
- Release validation passes TypeScript, all `106` test files / `664` tests, the `826`-module production build with 19-file static asset closure, project-local Emscripten 6.0.3 native/WASM rebuild, the dedicated `audit:polo-state` real-browser gate, and the renderer-wide true-8× gate. True 8× remains requested/effective `8/8` at `4896×3072`; eight GPU-fence samples complete at `5205.6/5276.5/5286.3 ms` median/p90/max, all `217/217` projected material identities remain visible, anchored wheel/click and powder recall pass, and forced-stall plus independent context-loss recovery preserve state and camera in Canvas 2× with zero browser errors. No audit Chrome session remains.
- This closes the immediate POLO state slice. Next material work prioritizes native SPNG hydration and typed molten ancestry/phase continuity, followed by stronger family-specific silhouettes, internal depth, transmission, reflection, lighting, and composed fit-view art direction. Viewport/input remains a protected regression contract.

### Current native-state graphics checkpoint

- VIBR and BVBR now respond to authoritative native charge, explosion countdown, and alternate/CFLM mode across their solid and powder phases. Native TPT owns the values and exposes one bounded 612×384 `Uint16` presentation-state plane: bits 0–6 are visible charge, bits 7–14 are normalized countdown life, and bit 15 is alternate mode. The final positive life step remains visibly nonzero, state zero is an exact no-op, and a wrong material owner cannot consume stale state.
- The state plane costs 470,016 bytes and is refreshed by the same native field extraction used for semantic cells. Canvas reads it directly. WebGL reuses the spare B/A channels of the existing wall RGBA texture, preserving native-wall and exterior-air channels and adding no sampler, texture read, field, pass, target, upload class, or output-scale allocation.
- The visual language is material- and state-specific but RGB-only: stored charge energizes the existing lattice, countdown adds stable ring/burst structure, and alternate mode bends the family toward cyan/blue. It changes neither occupancy, silhouette, authored holes, fine structures, phase, native reactions, nor OPS state. A dedicated audit toggle isolates the effect independently of the broader radioactive identity layer.
- The paired Canvas/WebGL browser fixture covers five native states for both owners, bodies, authored cavities, open notches, one-cell structures, isolated owners, exact zero-state owners, wrong-owner controls, and unrelated Water/Metal controls. Flat→styled→flat repeats exactly with zero browser errors; backend response ratios remain 0.942–1.003, normalized spatial-profile distance is at most 0.0161, chroma cosine is at least 0.9888, and all zero/wrong-owner controls stay within one byte.
- Release evidence passes TypeScript, all 95 test files / 613 tests, the 815-module production build with 19 referenced assets, native/WASM rebuild under project-local Emscripten 6.0.3, and the focused `audit:vibr-state` browser gate. The renderer-wide `audit:8x` gate passes at true 4896×3072, retains the complete 217-material atlas, proves nonzero VIBR state styling, and preserves exploding state word `24676`, occupancy, topology, camera, and response through forced-stall recovery to Canvas 2× and the independent context-loss path, with zero browser errors.
- VIBR/BVBR established the reusable owner-multiplexed state path now used by DEUT. Configured-source target identity and botanical lifecycle state are next; PHOT spectrum remains behind an independent co-located energy projection so it cannot be incorrectly squeezed into the matter-owned state plane.

### Current DEUT concentration graphics checkpoint

- Exact DEUT now projects native `life` as its authoritative concentration word over the complete `0..65535` range. Default concentration `10`, the native `239→240` glow threshold, ordinary electron loading through `6000`, reaction-yield state `17000`, and maximum imported state `65535` remain transport- and save-distinct; the restrained visual response intentionally saturates at `6000`. The owner-multiplexed state plane stays exactly 470,016 bytes; Canvas reads it directly and WebGL reuses wall-texture B/A without another texture, fetch, pass, field, target, or output-scale allocation.
- The style is deterministic and RGB-only. A restrained cold aqueous compression motif grows monotonically with concentration, while the exact 240 threshold adds pearlescent bloom. It changes no alpha, support, liquid reconstruction, ownership, phase, reaction, authored hole, fine structure, or OPS state. State zero and stale words under Sand, Water, Metal, EXOT, and ISOZ are exact no-ops.
- The paired seven-state fixture covers `0/10/80/160/239/240/6000`, plus exact high-word probes `17000/65535`, shaped bodies, holes, notches, one-cell structures, isolated owners, unlike contacts, co-located native walls, and protected controls. Flat→styled→flat repeats exactly with zero browser errors. Canvas/WebGL response ratios are `0.9705–1.0049`, normalized spatial-profile distance is at most `0.02445`, motif correlation is at least `0.47264`, chroma cosine is at least `0.97656`, and the glow gain is `2.0789/2.1159`.
- The renderer-wide true-8× gate passes at requested/effective `8/8` and `4896×3072`, with all 217 material projections, exact anchored input, full Local/Smooth powder recall, and square deep-zoom Grains. Eight GPU-fence frames complete at `4842.7/4930.6/4955.1 ms` median/p90/max. Both forced WebGL stall and independent context loss preserve DEUT word `240`, VIBR word `24676`, full high-word state, occupancy, topology, camera, Canvas response, and wall controls while rebuilding Canvas 2×; the context-loss radius-zero marker retains a `0.2478`-cell framebuffer footprint error, with zero browser errors. No Chrome process remains.
- Local release validation passes TypeScript, all `97` test files / `619` tests, the `817`-module production build, 19-file static asset closure, project-local Emscripten 6.0.3 native/WASM rebuild, the dedicated paired DEUT browser gate, and the renderer-wide true-8× gate.
- Next, prioritize configured-source target identity and botanical lifecycle state, then broader composed fit-view material optics and family coverage. Treat viewport/input as a protected regression contract, not the active development phase.

### Post-SPRK effort allocation

After the conductor-aware SPRK checkpoint, concentrate the workstream on material breadth and composed graphics rather than reopening the completed viewport phase. The next major milestones are:

1. **Broader exact material identity:** work through remaining native families and reaction products in bounded groups, prioritizing radioactive/native-state variants, botanical growth products, configured sources, channels, forces, and other elements that are produced by reactions even when they are not directly selected.
2. **Phase-coherent presentation:** give related liquid, powder, solid, gas, and energy states a recognizable shared visual language while preserving each phase's physical silhouette and native transition behavior.
3. **Material-scale aesthetics:** improve curved boundaries, internal mesostructure, thickness absorption, transmission, reflection, contact response, and atmospheric volume so normal fit-view scenes read as styled bodies rather than enlarged cells.
4. **Composed-scene direction:** judge each tranche in representative mixtures and interactions, including fine structures, authored holes, unlike-material seams, isolated particles, reaction products, and moving/resting contacts—not only single-material diagnostic cards.
5. **Bounded delivery:** retain Canvas/WebGL parity, true-8× completion and recovery, exact semantic support, mobile usability, cached CI, and live Pages verification as release gates for the material work.

Viewport geometry, cursor mapping, zoom/pan, responsive layout, and deployment infrastructure should receive only regression fixes and small enabling refinements during this sequence. They become a major phase again only if a demonstrated defect blocks interaction, graphics evaluation, or release.

The native LIFE, sensor/device, unusual-powder, unusual-solid, exact-liquid, exact-gas, first energy/radioactive, growing-organic, porous-SPNG, cross-phase VIRS/VRSG/VRSS, WAX/MWAX, DRIC/NICE/QRTZ/RIME crystalline, and PSTE/PSTS plus RSST/RSSS paste/resist graphics phases are complete locally and have passed their paired-browser and true-8× checkpoint gates. The active sequence is now broader material identity and physical presentation, led by bounded native-state fidelity for radioactive, botanical, configured-source, and channel families. Richer packed-powder/solid and liquid boundary treatment and deeper lighting, transmission, reflection, volume, and composed fit-view art direction remain the visual acceptance axis. Viewport, responsive UI, CI, and deployment remain maintenance gates unless they block testing or use.

LIFE checkpoint evidence: all 24 projected native presets have distinct static engraved colony motifs in Canvas and WebGL; the deterministic atlas retains all 96 authored hole cells, 24 isolated controls, tendrils, and guarded blanks. Direct integral-backing probes prove exact topology and off→on→off stability independently of CSS screenshot resampling, while composed captures prove visible motifs and bounded silhouette drift. Canvas/WebGL spatial response parity passes. TypeScript, all 69 test files / 451 tests, the 788-module production build, static asset closure, and the paired browser gate pass. True 8× also passes at 4896×3072 with GPU-fence completion, powder/volume/input/atlas checks, forced-stall recovery, and context-loss recovery to a 2× Canvas fallback without losing state or camera.

The native sensor/device and first unusual-powder identity tranches are complete. DTEC, INVIS, LDTC, LSNS, PSNS, TSNS, and VSNS have stable instrument faces; ANAR, BGLA, BREC, BRMT, FRZZ, GRAV, SAWD, SLCN, DYST, and BCOL have distinct topology-neutral powder motifs. BIZRS, PSTS, SHLD1–4, and VRSS now complete the first unusual-solid/reaction-product tranche. The next active tranche is liquid/gas material behavior and volume, followed by energy/radioactive and growing-organic depth.

Sensor checkpoint evidence: the deterministic paired browser atlas preserves all 21 air-open notch cells, 112 one-cell wire cells, seven isolated controls, and 3,780 guarded blank cells at raw backing resolution in flat, styled, and repeated-flat states. Off→on→off is byte exact; all seven response signatures are distinct; normalized 4×4 Canvas/WebGL profiles pass; support masks remain authoritative; and both backends report zero browser errors. Canvas backing response is 1.46–2.16 RGB RMS with a 14-byte peak; WebGL is 3.21–7.12 RMS with a 23-byte peak. TypeScript, all 71 test files / 460 tests, the 790-module production build, and the 19-file asset closure pass.

Unusual-powder checkpoint evidence: all ten exact IDs have distinct deterministic RGB motifs in Canvas and WebGL, including velocity-directed GRAV bands, with no alpha/support/resource changes. The paired 5×2 atlas preserves 40 fully transparent authored hole cells, 30 visibly open antialiased edge-notch cells, 580 one-cell columns, ten isolated grains, ten exact unlike-Sand contacts, and all guarded blanks through Smooth flat→styled→flat, Local, and Grains. Grains maps all 39,560 occupied controls to exact square 2×2 backing cells; Local retains all 590 fine column/isolated controls. Off→on→off is exact, all ten response signatures are distinct, normalized spatial parity passes, and browser errors are zero. Canvas backing response is 0.99–1.89 RGB RMS; WebGL is 2.52–6.36 RMS after matching FRZZ amplitude. All 73 test files / 470 tests, typecheck, the 792-module production build, and 19-file asset closure pass. True 8× remains exact at 4896×3072 with eight GPU-fence frames at 3963.5/4026.8/4037.9 ms median/p90/max, all 217 atlas projections visible, zero wheel-anchor error, and state/camera-preserving forced-stall plus context-loss recovery to Canvas 2×.

Unusual-solid checkpoint evidence: BIZRS has angular prismatic facets, PSTS compressed strata, SHLD1–4 progressively nested shell plates, and VRSS a restrained membrane/capsid response in both Canvas2D and WebGL. Styling is deterministic and RGB-only; authoritative alpha, ownership, silhouettes, air-open edge notches, one-cell shell rings, ten-cell spurs, isolated cells, guarded blanks, and unlike-Metal contacts remain intact through flat→styled→flat. Authored cavities remain open: every central 4×4 body-hole cell and central 14×14 shell-interior cell stays fully transparent while the surrounding cell ring may receive the renderer's ordinary antialiased contour coverage. The neighboring Metal side is an exact RGB no-op. All seven backing response signatures are distinct, the four shield stages remain ordered and distinct, normalized Canvas/WebGL spatial profiles pass, and both backends report zero browser errors. All 75 test files / 481 tests, TypeScript/Vite production build, and 19-file static asset closure pass. True 8× remains exact at 4896×3072 with eight GPU-fence frames at 3960.0/4006.5/4025.8 ms median/p90/max, all 217 atlas projections visible, zero wheel-anchor error, and state/camera-preserving forced-stall plus context-loss recovery to Canvas 2× with 0.0159-cell footprint error.

Exact-liquid checkpoint evidence: Soap, BIZR, CBNW, GEL, GLOW, VIRS, FRZW, and RFGL now have distinct deterministic material motifs in both Canvas2D and WebGL. Their shared reconstructed liquid body, surface tension, optical depth, and transmission remain authoritative; identity styling changes RGB only, and its direct helper delta is bounded to fourteen channel bytes before the ordinary material compositor. The paired eight-card atlas enumerates every backing subpixel and preserves all 128 central cavity cells, 96 one-cell strands, eight isolated droplets, eight guarded blanks, and exact Water/Metal contact ownership. Each 30-cell open chimney retains at least 29 fully transparent central samples, with only its antialiased closed endpoint permitted to fringe. Flat→styled→flat backing bytes repeat exactly, all eight response signatures are distinct, normalized Canvas/WebGL spatial profiles pass, Water and Metal control sides are exact no-ops, and both backends report zero browser errors. The Canvas lookup is 24,920 static bytes, independent of world and presentation scale; its synthetic full-grid styled helper loop measures 13.28/13.61/15.11 ms median/p90/max versus a matched 4.41/5.17/5.97 ms input/setup loop. All 77 test files / 495 tests, the 796-module production build, and 19-file static asset closure pass. The separate renderer-wide true-8× maintenance gate remains exact at 4896×3072 with eight GPU-fence frames at 4102.8/4172.5/4233.3 ms median/p90/max, all 217 atlas projections visible, zero wheel-anchor error, and state/camera-preserving forced-stall plus context-loss recovery to Canvas 2× with 0.0159-cell footprint error; the dedicated exact-liquid topology/parity gate currently runs at the normal 2× presentation scale.

Exact-gas checkpoint evidence: Smoke, Steam/WTRV, Gas, Oxygen, Hydrogen, Carbon Dioxide, Noble Gas, BOYL, CAUS, FOG, RFRG, CFLM, AMTR, WARP, BIZG, MORT, and VRSG now carry 17 distinct deterministic motifs across the shared borderless atmosphere volume in both Canvas2D and WebGL. A half-resolution nearest identity plane follows the existing weighted gas blur, neutralizes near-equal species mixtures, and reserves a two-texel categorical guard around authoritative non-gas particles and native walls; blended atmosphere RGB, density, alpha, and support remain unchanged. Nearby non-gas or wall edits explicitly redirty the guard while distant edits are rejected through the continuous atmosphere support, so contact protection cannot become stale. The paired 6×3 browser atlas checks every backing subpixel and passes all 34,799 dense-cloud samples, 6,596 atmosphere-halo samples, 204 sparse wisps, 7,905 guarded blank samples, 833 authored-void cells, 1,020 channel cells, all 17 wisp gaps and isolated carriers, and 1,360 Water plus 1,360 Metal control samples on each backend. Flat→styled→flat RGB repeats exactly, alpha/support hashes are stable, all 17 response signatures are distinct, and normalized Canvas/WebGL 4×4 profile distance is 0.00500–0.03333 with zero browser errors. Canvas dense/halo RGB RMS is 3.0775–7.0792 / 2.7211–7.0093; WebGL is 2.5795–5.0996 / 3.7718–5.4826. The 17,851-byte static lookup and 72-byte reusable class-weight scratch are independent of presentation scale; the half-resolution Canvas identity pass measures 3.31/3.85/4.69 ms styled versus 2.33/2.47/2.52 ms flat, while a full atmosphere rebuild measures 16.85/17.81/18.03 ms at its bounded cadence. Shared renderer fields allocate 12,169,040 bytes. The WebGL R8 uploader explicitly enforces one-byte unpack alignment before rendering so the native 306-byte style rows upload without padding or a duplicate field. All 79 test files / 514 tests pass. True 8× remains exact at 4896×3072 with eight GPU-fence frames at 4176.9/4216.1/4220.5 ms median/p90/max, all 217 material projections visible, zero wheel-anchor error, and state/camera-preserving forced-stall plus context-loss recovery to Canvas 2× with 0.0159-cell footprint error.

## Current energy and radioactive identity checkpoint

- All nine renderer-facing Energy-phase identities now have exact RGB-only physical motifs in Canvas2D and WebGL: FIRE rising tongues, PLSM ion cells, ELEC branches, GRVT lens rings, NEUT dashed tracks, PHOT wave bands, PROT charged beads, BRAY coherent rails, and EMBR detached sparks. BRAY and EMBR remain renderable native reaction products even though they are not directly selectable. The existing semantic core and one-third-resolution emission aura still own support, alpha, density, and glow; the exact identity layer adds no texture, field, pass, upload, output-scale allocation, or semantic mutation.
- Radioactive matter is now phase-aware and exact across the complete native 98–114 family. AMTR/WARP retain their exact atmosphere motifs. DEUT, EXOT, and ISOZ extend the exact-liquid system with concentration bands, interference diamonds, and decay rings; its module-static lookup is now 34,169 bytes for eleven liquids and remains independent of world/render scale. BVBR, PLUT, POLO, SING, URAN, ISZS, and VIBR receive exact-owner powder/solid motifs; the helper owns only a 256-byte material-class table and never runs on fluid controls or reconstructed empty support.
- The uncontended synthetic full-612×384 Canvas ceiling measures 29.42 ms for the generic energy core, 31.86 ms with relief but exact identity disabled, and 42.29 ms with both relief and exact NEUT identity. The seven-material radioactive body loop measures 15.20 ms styled versus 2.58 ms matched setup and owns 256 static lookup bytes; the eleven-liquid identity loop is 13.07 ms versus 4.49 ms. All work is per logical world cell and independent of 1×/2×/4×/8× output scale. Production visits only authoritative cells of the relevant phase/material and retains the existing dirty-chunk/field cadence.
- A deterministic 7×3 fixture covers the exact 21-material union of nine Energy-phase and seventeen Radioactive-family identities, including 336 authored hole cells, 672 open-channel cells, 168 sparse carriers, isolated particles, guarded blanks, and 42 Water/Metal contact controls. Its paired production-bundle gate proves all 21 semantic/topology controls, exact flat→styled→flat repetition, distinct signatures within all four presentation groups, bounded per-backend response, and Canvas/WebGL spatial parity with zero browser errors. Reconstructed radioactive body/liquid/gas response ratios are 0.6849–1.7801 with normalized profile max distance 0.00739–0.05663. Sparse premultiplied Energy cores are checked by mandatory nonzero/repeatable per-backend response and normalized spatial identity rather than a composed-RMS ratio; their profile max distance is 0.00688–0.69461, with the high end belonging to one-cell BRAY rails.
- The full release evidence passes TypeScript, the 801-module production build, 19-file static asset closure, all 82 test files / 529 tests, the paired material gate, and the renderer-wide true-8× gate. True 8× remains requested/effective 8/8 at 4896×3072; eight SwiftShader GPU-fence samples complete at 5719.4/5794.4/5842.3 ms median/p90/max, below the existing 8/12-second release ceilings. All 217 projections remain visible, Local and Smooth powder retain 2316/2316 occupied cells, wheel-anchor error is zero, and forced-stall/context-loss recovery preserves camera/state and returns to Canvas 2× with 0.0159-cell footprint error. The complete 8× capture matrix took about 381 seconds because it repeatedly captures every existing style toggle at 15 megapixels; the completed-frame watchdog metrics, not wall-clock matrix duration, remain the production safety criterion.
- Native simulation, phase conversion, reactions, and OPS persistence remain TPT-owned and unchanged. Two renderer fidelity gaps are now explicitly recorded for a later native-adapter tranche: when native energy and matter coexist, `ExtractFields` currently prefers `pmap` and can hide the photon/energy projection; and material/temp/velocity export cannot reproduce native state such as PHOT spectrum, DEUT concentration, or VIBR/BVBR charge. Fix those with an independent projected Energy plane and, if needed, a bounded native-state byte rather than overloading temperature, velocity, or presentation auxiliary fields.

## Active organic and plant graphics phase

- The first bounded lifecycle set is exactly WOOD, PLNT, SEED, YEST, VINE, and the retained nonselectable DYST reaction product. This covers seed germination, plant/tree/vine growth, wood production, yeast budding, and yeast death without conflating viruses, LIFE automata, actors, shields, or mechanical TRON growth.
- A default-on, independently auditable botanical identity layer now gives WOOD growth rings and axial rays, PLNT veins and green dapple, VINE strands and nodes, SEED an annular husk and embryo, and YEST an annular colony and bud. Canvas2D and WebGL use the same integer-coordinate arithmetic and canonical colors; the bounded RGB-only response does not alter alpha, support, ownership, simulation state, or silhouettes. DYST retains its existing exact unusual-powder identity.
- The deterministic 3×2 fixture covers dense bodies, 150 authored cavity cells, 180 open-gap cells, 690 one-cell growth-topology cells, six canopy gaps, isolated seed/products, guarded blanks, and exact Sand/Water contacts. Its paired production-bundle gate proves exact flat→styled→flat repetition, all six distinct identities, topology/contact preservation, and Canvas/WebGL response/profile parity with zero browser errors. Normalized backend profile distance is `0.00098–0.01991`; DYST deliberately exercises the existing unusual-powder path while the five botanical materials exercise the new shared layer.
- Native rendering currently receives material, temperature, velocity, walls, and pressure—not PLNT/SEED `ctype`, `life`, or `tmp` growth state. Therefore this phase may truthfully improve static species morphology and observed topology, but must not invent hydration, age, growth direction, genome, or active-tip animation. A later optional kind-specific native presentation byte is the appropriate path for those states.
- The release checkpoint passes all `83` test files / `534` tests, the `802`-module production build and 19-file static asset closure. True 8× remains requested/effective `8/8` at `4896×3072`; eight retained GPU-fence samples complete at `5682.0/5839.7/5958.9 ms` median/p90/max, all `217/217` material projections remain visible, Local/Smooth occupied recall is `2316/2316`, wheel-anchor error is zero, and forced-stall/context-loss recovery returns to Canvas 2× with `0.0159`-cell footprint error and no browser errors.
- This phase is checkpointed. Porous SPNG and cross-phase virus-family identity are also release-complete; move the clear majority of subsequent effort to broader exact catalog identities and composed material aesthetics. Improve curved packed-material and liquid silhouettes, stable unlike-material contact seams, translucency, thickness, restrained highlights/reflections, contact shadow, granular variation, and gas volume at normal fit view while keeping topology, occupancy, Canvas/WebGL parity, and true-8× cost bounded.

## Current porous SPNG material checkpoint

- SPNG now reads as one coherent porous body rather than a flat brown block. Canvas applies a deterministic exact-owner pore core and lit/shadow lip to RGB only; the shared solid optical-depth byte carries matching pore volume into both presenters, so WebGL consumes its existing guarded `r8` depth sample without a new shader branch, sampler, texture, pass, upload, target, or output-scale resource.
- The 19×19 motif deliberately leaves the first solid-depth layer unchanged. One-cell ribs, isolated particles, authored holes, open notches, unlike Water/Metal/Sand contacts, alpha, ownership, support, and physics therefore remain authoritative. This historical tranche was explicitly structural porosity and did not invent hydration; the later native-hydration checkpoint below now adds exact `life` state without replacing this shape contract.
- A dedicated paired production-bundle fixture covers a 280×176 body, 232 authored hole cells, 208 open-notch cells, 344 unique one-cell structure cells, isolated SPNG, 12,544 guarded blank cells, three unlike-material contact families, and 271 core/lit-rim probe pairs. Flat→styled→flat repeats exactly with zero browser errors. Canvas/WebGL normal-fit RGB RMS is `3.05/1.07`, backing RMS is `3.3479/1.1833`, pore ordering passes `1.0000/0.9483`, and pore contrast is `18.0721/5.0352`; semantic topology and support remain exact.
- A direct bespoke SPNG fragment branch was rejected because it reproducibly crossed the true-8× first-frame timing cliff. Moving the WebGL appearance into the already-live phase-local optical-depth plane restored the bounded architecture and full gate. The final true-8× run is requested/effective `8/8` at `4896×3072`, with eight retained GPU-fence frames at `5975.9/6029.5/6167.8 ms` median/p90/max, all `217/217` projections visible, Local/Smooth recall `2316/2316`, zero wheel-anchor error, and camera-preserving forced-stall/context-loss recovery to Canvas 2× with `0.0159`-cell footprint error.
- Release evidence passes all `85` test files / `541` tests, the `804`-module production build, 19-file static asset closure, the paired `audit:sponge` gate, and the renderer-wide true-8× gate. Cross-phase virus continuity across VIRS/VRSG/VRSS is now the completed follow-up checkpoint; wider catalog identity and composed fit-view material art direction are active.

## Current native SPNG hydration checkpoint

- The earlier porous-body checkpoint remains authoritative for SPNG shape. Native `life` is now additionally projected through the shared 612×384 `Uint16` state plane: bits 0–5 retain exact absorbed-fluid count `0..50`, and bit 6 distinguishes authoritative dry SPNG from every non-owner zero state. A focused official-Wasm fixture proves deterministic real WATR absorption, bounded reservoir growth, exact OPS1 restoration, heat-triggered native WATR release with decreased hydration, and non-SPNG zero state.
- Canvas2D and WebGL layer one independent moisture treatment after ordinary sponge morphology. Dry/presence-only SPNG is byte-exact; increasing native hydration monotonically darkens and cools the body while restrained pore-lip sheen preserves its porous volume. The deterministic 19-cell grammar is RGB-only and bounded to 20 source bytes, with no neighbour sample, clock, texture, field, pass, target, upload, persistent allocation, alpha/support change, ownership change, physics change, or output-scale resource.
- The five-card paired atlas carries exact states `64/74/89/104/114` for dry/low/mid/high/saturated owners. It preserves authored holes, open notches, one-cell structures, isolated SPNG, literal zero-state owners, Sand/Water/Steam/Salt controls, and guarded blanks through exact flat→styled→flat repetition. Wet Canvas/WebGL response ratios are `0.9973–1.0006`, normalized profile distance is at most `0.00112`, chroma cosine is `1`, saturation-to-low response gain is `4.9539/4.9407`, and both backends report zero browser errors.
- The pre-existing `audit:sponge` porous-body gate remains green with all 232 authored hole cells, 208 open-notch cells, 344 one-cell structure cells, three unlike contacts, 271 pore pairs, and normal-fit visibility intact. Release validation passes TypeScript, all `108` test files / `675` tests, the `828`-module production build with 19-file asset closure, project-local Emscripten 6.0.3 native/WASM rebuild, `audit:sponge`, `audit:spng-state`, and the renderer-wide true-8× gate. True 8× remains requested/effective `8/8` at `4896×3072`; eight GPU-fence samples complete at `5175.6/5254.6/5300.9 ms` median/p90/max, all `217/217` material projections remain visible, anchored input and powder recall pass, and forced-stall plus independent context-loss recovery preserve state and camera in Canvas 2× with zero browser errors. No audit Chrome session remains.
- This closes authoritative SPNG hydration without replacing its existing structural treatment. Typed molten ancestry/phase continuity is the next native material tranche, followed by deeper family-specific lighting, transmission, reflection, volume, and composed fit-view art direction.

## Current phase-continuous virus-family graphics checkpoint

- VIRS, VRSG, and VRSS now share one deterministic 16-cell membrane/capsid/attachment grammar while retaining phase-specific optics: VIRS receives a soft liquid membrane and bridge, VRSG receives pale vesicles through the existing half-resolution atmosphere identity plane, and VRSS receives a sharper solid shell and joints. The Canvas implementation owns one module-static `2,304`-byte signed-RGB lookup. WebGL evaluates the same discrete topology arithmetically for liquid VIRS and solid VRSS and continues to consume the existing gas identity atlas for VRSG. Exact virus paths suppress the unrelated generic green Organic fibre, while botanical and actor Organic styling remains unchanged.
- This is presentation-only RGB morphology. It adds no field, sampler, texture, upload, pass, framebuffer target, persistent output-scale allocation, time term, support change, or semantic mutation. Liquid reconstruction, atmosphere support, solid silhouettes, alpha, phase ownership, authored holes, one-cell structures, unlike-material contacts, and the existing 1×/2×/4×/8× geometry remain authoritative.
- Native TPT owns the phase loop and the focused native regression proves VIRS→VRSS→VIRS across the `305 K` boundary and VIRS→VRSG→VIRS across the `673 K` boundary. The renderer projection exports exact material phase, temperature, and velocity, but not native virus `tmp2` progenitor type, `tmp3` cure countdown, or `tmp4` lifetime. The graphics therefore do not invent infection ancestry, cure progress, or age; exposing any of those later requires an explicit bounded native-state projection.
- The deterministic three-card fixture aligns `112×112` bodies to the same modulo-16 origin and preserves a `12×12` authored cavity, connected `4×50` open chimney, liquid strand, 24 gas wisps with an authored gap, solid spur and one-cell shell, isolated controls, Water/Metal contacts, guarded blanks, and half-resolution-safe `2×2` motif probes. Flat→styled→flat repeats exactly, all semantic/support/contact controls pass, and both production backends report zero browser errors. Backing-level probes additionally hold the VIRS/VRSS cavity and chimney openings, the VRSG inter-wisp gap, and the VRSS shell interior; VRSG's dense body may still reconstruct atmosphere into its internal semantic air as intended by field-owned gas volume.
- Paired browser evidence is already complete at the normal `2×` release-audit scale. Canvas phase correlations for VIRS/VRSG/VRSS are `0.85521/0.92463/0.88724`; WebGL correlations are `0.91056/0.98122/0.92545`. Their backing-response ratios are `0.8379/1.0442/0.9154`, composed normal-fit ratios are `0.8284/1.1923/0.9130`, normalized profile maximum distances are `0.00566/0.00244/0.00176`, and cross-backend motif correlations are `0.92972/0.89948/0.99611`, in the same phase order.
- Release evidence passes TypeScript, all `87` test files / `552` tests, the `806`-module production build with 19-file static asset closure, the focused paired `audit:virus` gate, and the renderer-wide true-8× gate. The final clean `4896×3072` run retained requested/effective `8/8`, completed eight GPU-fence samples at `4442.6/4485.5/4587.0 ms` median/p90/max, kept all `217/217` atlas identities visible, retained Local/Smooth recall at `2316/2316` with zero deep-hole leak, held wheel-anchor error at zero, and recovered camera/state to Canvas 2× after both forced stall and context loss with `0.0159`-cell footprint error and zero browser errors. The earlier isolated late-capture timeout coincided with orphaned SwiftShader Chrome trees from aborted audits; clearing them restored the full bounded run, and no audit Chrome processes remain.

## Current phase-continuous WAX/MWAX graphics checkpoint

- Solid WAX and liquid MWAX share one deterministic 32-cell lamella, bloom, fold, and joint grammar with phase-specific optics: WAX keeps sharper crystalline cooling structure while MWAX softens the same topology into viscous flow bands. Canvas owns one module-static `6,144`-byte signed-RGB lookup; WebGL evaluates matching sample-free arithmetic and adds no sampler, texture, field, pass, target, upload, or output-scale allocation.
- Native TPT remains authoritative for WAX→MWAX melting at `319 K`, MWAX→WAX cooling below `318 K`, and MWAX→FIRE at `673 K`. The focused native regression verifies localized, count-exact conversion rather than merely finding a product somewhere in the scene.
- The deterministic paired fixture preserves matched solid/liquid bodies, authored cavities and open chimneys, phase-appropriate thin structures, isolated controls, Water/Metal contacts, guarded blanks, and aligned motif probes. Styling is RGB-only: semantic, alpha, support, contact, and repeated-off signatures remain exact. Canvas WAX/MWAX responses are `2.48/2.61` RGB RMS; WebGL responses are `4.84/3.63`; normalized spatial profile distance is `0.00478/0.00402`, with zero browser errors.
- Release evidence passes all `89` test files / `563` tests, TypeScript, the `808`-module production build, 19-file static asset closure, real runtime GLSL compilation, the focused paired `audit:wax` gate, and the renderer-wide true-8× gate. The clean `4896×3072` run retained requested/effective `8/8`, completed eight GPU-fence samples at `4529.4/4638.2/4686.4 ms` median/p90/max, kept all `217/217` projections visible, retained Local/Smooth recall at `2316/2316` with zero deep-hole leak, held wheel-anchor error at zero, and recovered camera/state to Canvas 2× after both forced stall and context loss with `0.0159`-cell footprint error and zero browser errors.

## Current crystalline/cold-solid graphics checkpoint

- DRIC, NICE, QRTZ, and RIME now have exact, deterministic 32-cell mesostructures layered over their existing `TranslucentRigid` thickness, transmission, refraction, contour, and optical-depth systems. DRIC carries sublimation fractures and frost lips; NICE uses crossed cryogenic facets; QRTZ has prismatic edges and cleavage planes; RIME grows deposited spines and branches. Powder `Quartz` remains a separate native identity and exact no-op control.
- Both presenters use world-anchored, sample-free arithmetic with no field, texture, sampler, pass, target, upload, persistent buffer, clock term, neighbour read, or output-scale allocation. The identity layer changes authoritative RGB only; alpha, support, reconstruction, cavities, native walls, unlike ownership, and physics remain unchanged. NICE receives a WebGL-only amplitude calibration because its pale translucent compositor otherwise preserved roughly twice the final identity response of the Canvas pre-optics path.
- Native regressions are localized and count-exact: CO₂↔DRIC across its hysteresis, liquid nitrogen↔NICE plus evaporation above `77 K`, typed Lava↔QRTZ proving native `ctype` restoration, direct RIME→Water, and Steam→RIME→Distilled Water proving retained ancestry. QRTZ speckle/growth/pressure history and RIME acidity/ancestry are still not projected as renderer state; OPS preserves them, and the graphics do not invent them.
- The deterministic four-card normal-fit fixture preserves four `14,704`-cell bodies, authored cavities and open chimneys, material-specific one-cell structures, isolated cells, `2,800`-cell guarded blanks, cyclic unlike-crystal seams, Metal controls, and eight aligned motif probe sets per material. Flat→styled→flat semantic, alpha, support, topology, and Metal-control signatures repeat exactly. Canvas/WebGL body-response ratios are `0.5062/0.4809/0.4858/0.5136`, normal-fit ratios are `0.4913/0.4094/0.4737/0.4962`, profile distances are `0.00394–0.00567`, motif correlations are `0.81487–0.95902`, and both backends report zero browser errors.
- Release evidence passes all `91` test files / `580` tests, TypeScript, the `810`-module production build, 19-file static asset closure, real runtime GLSL compilation, the focused paired `audit:crystal` gate, and the renderer-wide true-8× gate. The clean `4896×3072` run retained requested/effective `8/8`, completed eight GPU-fence samples at `4771.0/4803.9/4834.2 ms` median/p90/max, kept all `217/217` projections visible, retained Local/Smooth recall at `2316/2316` with zero deep-hole leak, held wheel-anchor error at zero, and recovered camera/state to Canvas 2× after forced stall and context loss with `0.0159`-cell footprint error and zero browser errors.

Queued after the renderer checkpoint: revisit desktop/mobile geometry as a dedicated visual pass. Desktop tool categories must not become an unscrollable over-wide row, short windows must never let the Brush card cover the tool library, and constrained scaling must retain usable catalog height. Mobile must keep the material menu conspicuous, compact the pressure/temperature/backend HUD, avoid page-width overflow, and leave deliberate whitespace so touch users can hand page scrolling back from nested tool lists.

The final direct native-wall invalidation regression brings the current unit/native total to 79 files / 515 tests.

## Current family-chromatic solid-body follow-up

- Dense rigid, organic, device, radioactive, and translucent-rigid bodies now replace their remaining neutral macro-height band with a family-coloured crown reflection and pocket absorption. The response reuses the existing signed relief and exact-species optical-depth byte, so it adds no field, texture read, upload, pass, target, or persistent allocation.
- The new response begins beyond the protected first solid layer and is fully weighted after seven exact-species cells. Exposed skin, thin strokes, authored holes, unlike-material seams, reconstructed cavity support, semantic ownership, alpha, and silhouettes remain unchanged. Positive crowns are deliberately weaker than pockets so bodies retain optical thickness instead of appearing self-emissive.
- The focused Canvas/WebGL browser gate covers Metal, Wood, Plant, Device, radioactive matter, and Glass. Accepted RGB RMS ranges are `1.72–9.87` for Canvas and `1.56–8.49` for WebGL, with a 25-byte maximum response, exact off→on→off repetition, unchanged support within 0.01%, exact protected controls, and zero browser errors.
- The full-grid Canvas solid-body helper measures `14.05/15.06/16.97 ms` median/p90/max on the current host, including a `7.56/7.67/7.77 ms` production-shaped loop baseline. Work remains per logical world cell and independent of 1×/2×/4×/8× presentation resolution.
- Fresh paired fit-view screenshots were visually inspected. The lower-right family matrix retains its material texture and gaps while gaining broader coloured depth bands.

## Current lighting-coupled solid-mesostructure follow-up

- Canvas already shades family texture before applying body absorption, relief, reflection, and scene lighting. Radioactive solids now retain a deterministic isotope grain underneath their sparse animated decay accent by reusing the existing per-cell noise; no second hash, field, allocation, or traversal was added.
- WebGL rigid/translucent bevels, organic fibres/pores, and device traces/nodes now source their additive structure from the already shaded body color instead of the untouched canonical palette. Existing multiplicative strata already followed body light; the remaining accents now inherit depth, contact, environment, and specular response rather than reading as flat late decals.
- The WebGL correction adds no texture read, waveform, derivative, pass, target, upload, persistent state, or output-scale allocation. It replaces three branch-local palette references with the already-live `color`, avoiding the long-lived pattern registers that are risky across 15,040,512 true-8× fragments.
- The focused paired solid-depth gate passes with zero browser errors. Deep Canvas/WebGL family responses remain bounded (`1.74–9.87` / `1.56–8.59` RGB RMS), while the exposed Metal surface, authored hole, unlike seam, and one-cell stroke remain exact zero responses in both backends.
- The WebGL material atlas keeps all `217/217` projections visible. A fresh fit-view capture was visually inspected, retaining the liquid/gas/powder/energy composition and distinct rigid, organic, radioactive, device, Glass, and Ice material cards.
- True 8× remains exact at `4896×3072`: eight GPU-fence samples completed at `3580.6/3625.4/3674.8 ms` median/p90/max with zero discarded samples and zero browser errors. All `217` atlas projections remained visible; wheel-anchor error stayed zero; forced-stall and context-loss recovery both preserved the camera and returned to Canvas 2× with `0.0159`-cell footprint error.

## Current phase-composed material-optics follow-up

- Optical family now describes physical presentation while the independent trait byte preserves semantic identity. Radioactive and life categories no longer force their gas, liquid, or powder members through solid-only optics.
- `AMTR` and `WARP` use sooty volumetric gas optics; `CAUS` uses clean gas optics. `DEUT` uses aqueous depth, while `BIZR`, `GLOW`, `VIRS`, `EXOT`, and `ISOZ` use viscous-liquid transmission. `BVBR`, `PLUT`, `POLO`, and `URAN` use metallic grains; `SING` uses sooty grains; `SEED` and `YEST` use ordinary rough-grain topology.
- Solid `ISZS`/`VIBR` retain radioactive body optics, radioactive energy carriers retain their dedicated core renderer, and Wood/Plant/VINE remain organic solids. Every remapped nuclear material still carries `RenderTrait.Radioactive`; Seed/Yeast and all virus phases still carry `RenderTrait.Organic`.
- Reaction families are now phase-continuous: liquid/gas/solid BIZR and VIRS products receive liquid/gas/solid optical response without losing their exact native identities. YEST and its DYST product both use granular topology.
- Classification remains build-time lookup work. No optics enum, texture, field, sampler, shader branch, pass, target, upload, persistent byte, or output-scale allocation was added; shared lookup allocation remains exactly `3,584` bytes.
- Focused packed-lookup and native-projection tests pass. Fresh Canvas and WebGL real-browser atlases keep all `217/217` materials visible with zero browser errors, and the canonical fit-view WebGL scene was visually inspected.
- Post-remap true 8× remains exact at `4896×3072`. Eight GPU-fence samples completed at `3497.7/3615.2/3631.9 ms` median/p90/max with zero discarded samples; all 217 atlas identities remained visible, powder support and square Grains mode remained exact, wheel anchoring stayed zero, and forced-stall/context-loss recovery retained the camera with `0.0159`-cell footprint error.

## Current identity-aware botanical morphology follow-up

- Wood, Plant, VINE, SEED, and YEST now receive deterministic identity-specific RGB morphology in both presenters. Wood favours warm axial grain and growth rings; Plant uses broad green leaf veins; VINE uses narrow strands/nodes; SEED uses husk facets; YEST uses restrained warm colony speckle.
- Canvas applies one allocation-free helper before solid body lighting or powder bulk optics, so the morphology participates in existing depth rather than widening a silhouette. WebGL reuses the already-live organic `fibre`/`pores` and granular `grain`/`grainFacet` signals; it adds no wave, texture sample, field, pass, target, upload, or persistent state.
- The generic Organic/Fibrous trait tint is suppressed only for those five botanicals after their dedicated morphology is applied. Virus phases and FIGH/STKM/STKM2 retain the generic trait response byte-for-byte; LIFE presets remain outside this tranche.
- Native simulation remains authoritative. The existing seed-growth test still proves watered SEED produces more than 50 Wood/Plant cells after 900 upstream TPT steps. Phase, ctype, temperature, pressure, velocity, OPS state, ownership, reconstruction, alpha, authored holes, thin stems, and Grains-mode topology are untouched.
- Unit gates require five distinct deterministic bounded Canvas-helper responses (maximum 12 bytes/channel), exact alpha preservation, and an exact non-botanical no-op. Trait-isolation tests cover all five botanicals, all three virus phases, and the three actor projections while proving that non-organic role traits remain active. The paired solid-depth browser gate retains Wood/Plant family response while the surface, hole, unlike seam, and one-cell stroke controls remain exact zero; both 217-material browser atlases pass with zero errors. Fresh Canvas and WebGL fit-view captures were visually inspected.
- The full renderer profile remains allocation-stable at `12,051,464` combined bytes. Botanical work is once per authoritative Canvas cell and branch-local WebGL arithmetic, independent of presentation scale.
- The post-botanical true-8× gate passes at requested/effective `8/8` with one `4896×3072` WebGL target, all `217/217` material projections visible, zero browser errors, and exact zero wheel-anchor error. Eight retained GPU-fence samples completed at `3608.8/3615.6/3619.9 ms` median/p90/max. Forced-stall and context-loss recovery both retained the camera and returned to bounded Canvas 2× with `0.0159`-cell footprint error.

## Current semantic mechanism graphics follow-up

- Emitter, sink, channel, and force traits now use broad stable 24-cell mechanism glyphs instead of narrow backend-divergent animated stripes. Emitters carry a warm core and outward ring, sinks a cool inward core/ring, channels diagonal rails and nodes, and force materials paired cyan rings. Composite roles such as CONV and FRAY retain all of their meanings without being promoted to emissive matter.
- Canvas owns the same bounded role vocabulary in one allocation-free RGB helper. WebGL replaces the former role `sin`/`pow` decals with branch-local `fract`, distance, and `smoothstep` arithmetic. No field, texture lookup, sampler, upload, pass, framebuffer target, persistent allocation, alpha mutation, or output-scale resource was added.
- WebGL role and semantic trait styling now explicitly rejects `surfaceOnly` reconstruction. Nearby authoritative material can still stabilize an ordinary contour, but its emitter/sink/channel/force/organic/radioactive/carrier metadata can no longer leak into a reconstructed cavity or unsupported fringe.
- The dedicated default-on audit toggle captures flat→styled→flat role frames in the canonical fit-view scene. It first pins exact CONV/CLNE/PCLN/DTEC/PRTI/ACEL identities and zero walls, then measures emitter core/annulus/background, channel node/rail/off-rail at a matched sink-ring radius, and force inner/outer rings against the gap. Paired normalized spatial signatures, warm/cool response, an exact DTEC no-op, byte-stable repeated-off frames, identical composed support, and zero browser errors all pass. Canvas/WebGL RGB RMS respectively measures `5.87/4.36` CONV, `2.57/2.57` CLNE, `4.30/3.12` PCLN, `8.32/6.21` PRTI, and `7.15/5.44` ACEL.
- The Forces toolbox filter now follows the same exported native-behavior role classifier as rendering. It includes cross-category force materials such as GRVT, SING, BHOL/NBHL/NWHL/WHOL, GPMP, and PUMP, while leaving non-force FRME and channel-only PIPE discoverable through their ordinary groups/search rather than mislabelling them.
- Full unit/native validation passes all 66 files / 436 tests, including native seed growth, save/load, projections, role toggle isolation, shader source guards, force-category completeness, and catalog membership. Production build and the 19-file static asset closure pass. Shared render-field allocation remains exactly `12,051,464` bytes; the pathological all-world Canvas emitter diagnostic is `57.18/58.02/58.29 ms` median/p90/max.
- True 8× remains exact at requested/effective `8/8` and `4896×3072`. After moving radial setup out of the channel-only path, eight retained GPU-fence frames completed at `3602.2/3806.0/3917.5 ms` median/p90/max with zero discarded samples and zero browser errors; all `217/217` materials remained visible, wheel anchoring stayed exact, and forced-stall/context-loss fallback retained the camera with `0.0159`-cell footprint error. The dedicated spatial A/B gate is paired at the normal 2× presentation scale; the 8× gate independently proves the enabled final shader, atlas coverage, and recovery path.

## Repository and deployment snapshot

- Repository: `/home/harry/projects/aniFor_codex`
- Branch: `main_codex`
- Current material checkpoint: LIFE/cellular, sensor/device, unusual powder/solid, exact liquid/gas, energy/radioactive, growing-organic, porous-SPNG, VIRS/VRSG/VRSS, WAX/MWAX, DRIC/NICE/QRTZ/RIME crystalline identity, PSTE/PSTS plus RSST/RSSS paste/resist continuity, authoritative VIBR/BVBR charge/countdown/alternate state, and authoritative DEUT concentration graphics are release-complete locally. The next material sequence is configured-source target identity and botanical lifecycle state, followed by broader exact-family coverage and composed-scene optics; PHOT spectrum waits for an independent co-located energy projection.
- Manual Actions run `29959575256` restored the C++ compiler and project-local Emscripten caches, built and tested in `2m11s`, deployed in `12s`, and passed the separate revision/runtime-asset verifier in `7s` for paste/resist checkpoint `9e0e5fa`. The successful-build-only ccache save correctly skipped because the exact primary cache key already existed.
- Local GitHub CLI authentication is valid. Recheck `gh auth status` before the next manual deployment, and do not confuse a successful artifact build with a live deployment.
- Current live Pages URL: `https://harryzhou2000.github.io/aniFor/`
- Live `revision.txt` is `9e0e5fa59cd497b654273c3d8a6041e720a1bac1`; an independent local verifier confirmed the exact revision, all 19 recursive assets, and WASM MIME on its first attempt.

## Committed/live history through `8ae8765`

- Pinned official TPT 100.0 native engine, single-threaded 612×384 WebAssembly.
- 170 stable ordinary projected material IDs and all 170 particle brushes in the catalog, with 165 enabled and five gravity-dependent entries explicitly disabled.
- Steam, Salt Water, Gas, Snow, and Plasma are bidirectionally projected, renderable, directly paintable, and still produced by native phase changes/reactions.
- Ten true native TPT wall-grid tools with separate ABI, physics, rendering, dirty tracking, and save/load preservation.
- Searchable nested catalog, filters, favorites, recents, hazards/limitations, pressure/temperature HUD, and explicit disabled semantic tools.
- Pixi/WebGL semantic-field renderer with independent particle/wall fields, volumetric gas/liquid/emission fields, material-family styles, 30 Hz render cap, bounded dirty chunks, and Canvas2D fallback.
- Two-times backing resolution: 612×384 logical world to 1224×768 backing, independent of DPR and input math.
- Stable desktop viewport aspect and validated desktop pointer/wheel/middle-pan mapping.
- Automated Chrome integration coverage for actual Canvas/Pixi bounds through `screenToWorld`, pointer events, exact radius-zero painted cells, cursor-anchored wheel zoom, middle pan, repeated desktop resizes, and mobile one-/two-touch gestures. The same audit can retain a populated render-lab screenshot before clearing its diagnostic world.
- Manual `build` / `build-and-deploy` workflow; `main_codex` pushes do not auto-build; project-local Emscripten/Meson; successful-build-only `ccache` persistence.
- Native Air, Vacuum, Wind, Heat, and Cool tools with typed point/vector dispatch, wall-aware air processing, safe validation, residual-air isolation, and OPS preservation of pending Wind.

## Committed checkpoint details

### Native save files

- `PowderToyBackend.saveFile()` returns the engine's raw `GameSave::Serialise()` bytes; modern output begins with `OPS1`.
- `PowderToyBackend.loadFile()` passes raw bytes through the native parser and refreshes all particle/wall dirty state.
- **Save / share** sends a real file to the system share sheet when file sharing is supported, otherwise downloads it.
- Native output uses `.cps`, matching TPT's desktop save browser. `.cps` and `.stm` input is accepted; native TPT also recognizes legacy `PSv` and `fuC` signatures.
- Non-native fallback engines use a distinct `.anifortpt` text wrapper and are never presented as TPT-compatible.
- Import is limited to 32 MiB. Old AniforTPT hash links are still readable for migration, but the UI no longer creates huge URL/clipboard payloads.
- The user-provided save `GetSave.util?ID=257313` was downloaded only to `/tmp` for validation: 20,599-byte `OPS1`, loaded as 83,767 occupied cells, and reserialized successfully as `OPS1`.

### Desktop/mobile layout and input

- Desktop toolbox width is now 260–340 CSS px and has a 430 px minimum usable height; short/scaled pages scroll instead of collapsing the search/library to zero.
- Actions are a 2×2 grid for Pause, Save/share, Open file, and Clear.
- Portrait layout uses a scrollable page, visible compact toolbox heading, non-collapsing palette, explicit Draw/Eraser buttons, and a square interaction panel.
- At minimum zoom the full 612×384 field is uniformly contained and centered in the square mobile panel; vertical space is letterboxed, never stretched or cropped.
- One touch is a continuous brush. A tap paints once, but initial paint is deferred so an immediate second touch cannot leave a stray dot.
- Two touches pan and pinch without painting. Dropping back to one finger rebases without a connecting stroke.
- Desktop middle drag remains pan and right drag remains erase.

### Pages/runtime hardening

- Canvas mounts synchronously so `Game.start()` can expose controls and start native TPT without waiting for the Pixi module, GPU startup, or shader compilation.
- WebGL may promote the same viewport for up to ten seconds. The known-good Canvas remains mounted until the candidate has seeded its semantic fields and completed a first render; a failed or timed-out candidate is destroyed without blanking the viewport.
- `scripts/verify-static-assets.mjs` recursively checks HTML references, nested JS imports, runtime WASM URLs, file existence, and non-empty output.
- `scripts/verify-live-pages.mjs` performs the same closure check against the deployed URL with retry/cache-busting and validates WASM MIME.
- A separate least-privilege verification job checks out the verifier and runs it after `actions/deploy-pages`; repository code does not execute with Pages write or OIDC permissions.
- The pre-tranche live `edfcf94` deployment passes the closure verifier for all 20 referenced resources. A fresh live trace promoted from Canvas to WebGL in 3.090 seconds with no missing asset, shader, runtime, or network error; its app/Pixi hashes differ from the newer local renderer output.

### Native projection cleanup

- The five native phase-product material IDs map in both directions in `tpt_adapter.cpp` and are exposed as ordinary brushes as well as reaction outputs.
- Native tests project all 170 IDs and verify Steam as an actual reaction product.
- The published WASM artifact was rebuilt locally.

## Native simulation-tool checkpoint (`088adba`)

- Air, Vacuum, Wind, Heat, and Cool are now enabled as true simulation tools with stable project-owned ABI IDs rather than particle aliases.
- Point and raw-vector dispatch are separated. Wind point samples explicitly no-op, so selecting Wind cannot paint the previously selected material; the un-interpolated drag segment is applied once while ordinary brush tools retain continuous grid interpolation.
- Air/Vacuum apply TPT's exact ±0.05 pressure delta per brush pixel. Heat/Cool apply ±2 K to ordinary particles and ±0.1 K to PUMP/GPMP, with upstream pressure/temperature clamps.
- Wind clears inactive particle-authored coarse velocity at the start of a new gesture epoch, writes the authored `vx`/`vy`, enables `AIR_ON` for exactly one `BeforeSim` pass, and returns to `AIR_VELOCITYOFF` before particle advection. This preserves diffusion, pressure coupling, clamping, and air-blocker semantics without globally reactivating unrelated residual air or reintroducing the earlier long-term water ejection.
- Wall mutation now refreshes the corresponding native `bmap_blockair` cell immediately, so a newly authored blocker is effective for the next Wind update.
- A pending, unstepped Wind vector round-trips through ordinary OPS velocity maps plus the optional namespaced `aniforTptWindPending` Boolean. Stock TPT ignores the unknown field; AniforTPT restores the one-frame intent without misclassifying ordinary imported-save velocity.
- Native validation rejects invalid IDs, coordinates, radii over 64, and oversized vectors. Integer vector arguments prevent NaN/Infinity from contaminating the air arrays.
- That historical simulation-tool checkpoint deliberately left signs and configured-source targeting disabled and distinct; configured sources were enabled later through their dedicated semantic tranche.

## Current local graphics and responsive UI tranche

- The compact one-third-linear-resolution emission plane now receives a default-on RGB-only crown/pocket plus directional key/fill treatment. Canvas applies it in both normal 12 Hz rebuild and fallback-resync paths, preserves every authoritative alpha/support byte, and adds no buffer. WebGL reuses the four cardinal aura samples already needed by its analytic normal and adds no texture read, pass, target, upload, or output-scale resource.
- Canvas Energy cores no longer index compact emission bytes with a full-world RGBA offset. A shared allocation-free clamped bilinear alpha sampler now maps any 612×384 world cell, including the far bottom-right cell, into the 204×128 field with finite support.
- The Canvas reshape measures `0.22/0.27/0.54 ms` median/p90/max with zero additional bytes. The paired Canvas/WebGL visual gate passes all prior visual controls and the new deterministic aura comparison with zero browser errors.
- True 8× remains exact at `4896×3072`; completed-frame timing is `2945.2/2963.6/2975.4 ms` median/p90/max, the new Energy aura is `0.74` RGB RMS with a six-byte peak, wheel-anchor error is exactly zero, all 216 atlas identities remain visible, and context-loss recovery preserves the camera.
- A focused `--desktop-input-only` browser route now proves the 2× camera contract without replaying the full visual atlas: three exact off-centre cells, a 25-cell continuous left stroke, anchored wheel (`0/0.00001` cell Canvas/WebGL), exact `42×27` middle pan, post-transform semantic/framebuffer paint, zero breakpoint-resize anchor drift, and live DPR+page-scale repaint. Paired mobile cold loads still pass one-touch brush, two-touch pan/pinch, retained-finger drawing, eraser, and responsive camera round trips.

- Smooth powder now treats only proven deep, stable, authoritative bulk as a coherent material body: Canvas blends cell-scale colour variation toward canonical albedo and both backends add bounded hue-preserving macro slope relief from the existing powder field. Local and Grains are exact bypasses; shallow/unstable/trait/emissive matter, thin columns, ridges, branches, authored holes, seams, alpha, and support remain unchanged.
- The full 612×384 Canvas deep-Sand helper measures `7.44/7.54 ms` median/p90 including a `1.22 ms` loop baseline, adds no persistent bytes, and runs once per world cell rather than per supersampled output pixel.
- True WebGL 8× remains enabled and verified: requested/effective scale `8`, exact `4896×3072` backing, all `2316/2316` Local and Smooth powder-column cells retained, all ten deep holes empty, exact `8×8` zoomed Grains square, zero browser errors, and deterministic context-loss recovery to Canvas 2× with `0.0159`-cell footprint error while preserving the camera.
- The interaction audit now paints and blank-differences a real off-centre framebuffer landmark after wheel zoom plus middle pan. Canvas/WebGL peak errors are `0.0620/0.4662` cell; zoomed-resize anchor errors are `0.00681/0.03681` cell. This closes the former state-only proof gap for the upper-left-anchored cursor/render mismatch.
- Current validation: 387/387 tests, production TypeScript/Vite build, 19-file static asset closure, paired Canvas/WebGL visual captures, focused desktop and mobile interaction audits, and the dedicated true-8×/context-loss audit all pass with zero browser errors.

- Dense WebGL energy chunks use the existing emission-field density only as a gate for calming carrier micro-modulation and normalizing semantic-shape opacity. The field cannot manufacture a body without semantic shape support. Measured Fire/Plasma/ELEC/PHOT/GRVT microcontrast fell by roughly 6–24% while hue, macro relief, sparse aura ownership, and clipping gates remained intact.
- Canvas and WebGL gas now receive directional warm/cool scatter from the already existing emission field. Canvas preserves atmosphere alpha byte-for-byte and selects among the four emission neighbours it already reads; desktop WebGL takes at most one outward-normal emission sample and compact/mobile takes none. No field, pass, persistent buffer, or simulation state was added.
- The deterministic gas atlas has compact Fire/GRVT source marks beside opposite cloud flanks. Exact lit/unlit composed probes require isolated warm-red and green-cyan rim response with zero pinned channels in both backends.
- Canonical visual sampling waits for three identical frames separated by at least one 12 Hz field interval, then repeats against a same-geometry blank audit. Coverage and colour metrics count only pixels exceeding a per-region threshold derived from the stable blank-frame noise, so opaque page background no longer counts as material.
- The real-browser mobile gate cold-loads both Canvas2D and WebGL after enabling DPR-2 portrait/touch emulation. Both prove 1.431× two-finger zoom, exactly 22 CSS-pixel pan, sub-0.001-cell anchor drift, zero stray paint, exact tap and 25-cell continuous-stroke semantics, working Eraser/Draw buttons, final-filter reach, nested library-to-page scroll chaining, and a composed footprint within half a cell.
- Latest local field-light profile: baseline atmosphere relief `1.17 ms` p90 and worst-case full nonzero atmosphere-plus-emission lighting `3.80 ms` p90 over the 306×192 plane. Combined shared-field allocation remains exactly `8,173,320` bytes.

- Canvas gas now passes through an allocation-free directional relief stage at half resolution. It copies atmosphere alpha exactly, preserves RGB channel ordering, and adds density depth without expanding the gas footprint. The Canvas atmosphere blur is tightened from 0.9× to 0.55× output scale.
- Dense WebGL gas blends semantic particle color toward the shared atmosphere mixture, removing the raw orange/cyan dot island while retaining the intentional sparse control row.
- WebGL liquids now recombine their existing broad-sheen and caustic-wave signals into centred, optics-specific macro relief inside proven dense field support. This adds no sample, wave, field, pass, or alpha/support change. The paired browser gate bounds WebGL/Canvas macro depth to `0.65–2.0` and mean exposure to `0.65–1.6`; the accepted Water/Oil/Acid/Lava ratios are `1.91/1.00/0.80/0.89` for macro depth and `1.39/1.55/0.84/0.80` for exposure, with zero clipping.
- Desktop tool filters retain a constant 40 px track and expose a thin horizontal scrollbar; `Recent` is reachable at every constrained desktop width. Desktop toolbox tracks now reserve space for the palette and actions, with a compact short-height rule and shell scrolling rather than card overlap.
- Mobile uses a 230–300 px catalog, inner vertical/horizontal scrolling with document overscroll chaining, compact actions, and 24 px toolbox touch whitespace. The HUD is 132 px wide with smaller labels and a truncated backend row; the touch hint moved to the lower-left so overlap is zero.
- Viewport fitting is animation-frame coalesced across frame observation, window resize, visual-viewport resize, and compact-media changes. This fixed a reproduced stale 1280-wide viewport after resizing to 1024×600.

## Committed profile-aware surface-lighting tranche (`8c00ad0`)

- WebGL reuses the existing emission texture as coloured scene light. Reconstructed contour density, diffuse relief, specular response, and the canonical material profile determine the response instead of applying one flat tint to every surface.
- Rigid and device surfaces respond more sharply, organic/field surfaces more broadly, and radioactive surfaces retain a restrained response. Gas and liquid volume response remains bounded and emissive cores avoid double-lighting.
- Canvas samples the same one-third-resolution emission field with clamp-to-edge bilinear coordinates for exposed solid/field contours. It uses a screen blend that preserves texture and alpha; an empty field or an enclosed interior remains byte-identical.
- The broad Canvas aura now renders behind opaque matter. Empty space retains the smooth falloff while matter receives contour lighting rather than a milky screen-space overlay.
- The deterministic render lab adds equal-height warm and cool source strips around the profile matrix, with a lower-light centre comparison.
- No new field, texture, scheduler stage, or persistent allocation was added.

## Committed/live phase-aware energy-core tranche (`a64dde9`)

- WebGL now gives occupied energy a dedicated luminous-volume branch before gas/liquid/generic matter. Fire and Plasma use warm flowing detail; ELEC, PHOT, NEUT, and other radioactive carriers use cooler scintillation without inheriting radioactive-solid striations.
- Exact semantic density, palette, temperature, and particle velocity remain authoritative at the core. The existing one-third-resolution emission field owns only the broader aura, so there is no new texture fetch, field, pass, scheduler stage, or persistent allocation.
- Canvas has an allocation-free matching energy style using two reusable three-channel scratch vectors and the existing sharp-plus-blurred fire plane. It derives heat from the exact packed temperature byte and GLSL smoothstep used by WebGL, including the zero/missing-temperature fallback. A deliberately pessimistic full-612×384 energy-only profile is included alongside the ordinary field profiles.
- Canvas scene light now includes exposed powder as well as solid/field matter and skips the exposure scan entirely when `EmissionField.hasLight` is false. This closes a WebGL/Canvas mismatch without adding storage.
- The deterministic atlas is now a five-column, six-row matrix covering granular, rigid, organic, radioactive-solid, device/field, and five side-by-side neutral/radioactive energy samples.
- `npm run audit:browser-input -- --<backend>-only --screenshot=<path>` captures the populated atlas and then continues through the real browser interaction gates.

## Static cross-phase role-trait tranche

- The previously unused alpha byte in the existing 256×1 style lookup now packs composable emitter, sink, channel, force-actuator, radioactive, organic, fibrous, and energy-carrier roles. The texture remains 1,024 bytes with nearest data sampling and no premultiplication.
- WebGL applies restrained role waves, portal/channel bands, force interference, cross-phase radioactive scintillation, organic fibres, and directed-carrier accents after phase shading. It changes RGB only on authoritative semantic cells, so reconstructed gas/liquid/empty-space volumes do not inherit a guessed role or wider silhouette.
- Canvas applies the same static roles allocation-free to the phase's existing semantic plane. Ordinary cells take one zero-mask branch; role cells reuse deterministic integer/hash patterns and preserve alpha exactly. Energy-phase carrier cores remain owned by the dedicated energy shader.
- The deterministic atlas now includes radioactive solid/liquid/gas/carrier samples, an emitter and paired portal channel, a force actuator, organic/fibrous variants, and neutral/radioactive energy cores while retaining its five-by-six matrix.
- No field, texture, upload, reconstruction pass, scheduler stage, or persistent allocation was added. Shared volume storage remains exactly 8,173,320 bytes.

## Canvas role-write performance checkpoint

- Canvas role accents are now applied to the renderer's existing three-channel float scratch before the one final pixel write. This removes the former second typed-pixel read, clamp, and write for every styled cell while preserving alpha ownership in the existing compositor.
- Five full-range integer clocks are updated once per frame and reused by every role cell. They add 20 persistent bytes, avoid per-cell time division, and preserve the established emitter, organic, channel, force, decay, and carrier animation cadence without the short repetition introduced by a packed-clock experiment.
- Ordinary non-emissive gas and liquid retain the direct pixel/composite fast path; only role-bearing or emissive fluids stage through the RGB scratch.
- The trait profiler now reports realistic masks, a synthetic all-bits mask, and a representative compositing path, with an observable checksum outside the timed region. On this machine a deliberately dense 612×384 semantic-role kernel still costs roughly 32–44 ms depending on the realistic mask, so mask arithmetic remains a known Canvas worst-case ceiling rather than a solved frame-budget item.
- The browser resize audit now waits for an actual size change that matches stable aspect-fitted viewport geometry instead of a fixed delay, preventing a stale WebGL resize sample from being accepted under load.

## Optical-depth gas/liquid tranche

- WebGL gas now uses density absorption rather than brightening dense interiors. The shared atmosphere mixture remains authoritative for colour, a bounded directional silver lining supplies volume, and display opacity is raised modestly without changing the reconstructed support footprint.
- WebGL liquid keeps reconstructed density as silhouette support but derives optical depth from semantic occupancy for occupied cells. Sparse droplets therefore remain translucent while dense pools gain saturated depth; reflective top/lower response comes from the already sampled local slope rather than absolute world height.
- Canvas atmosphere relief mirrors the absorption model while copying field alpha byte-for-byte. Its display opacity is normalized toward WebGL, the already-smoothed half-resolution atmosphere field is drawn without a second blur, and the exact semantic smoke plane uses only a restrained 0.2× blur.
- Canvas semantic liquids now use the same 143/209 sparse/dense source-alpha endpoints as WebGL. Filled-liquid shoreline alpha ramps continuously from zero, and the redundant nearest overlay is reduced from 0.34 to 0.18. This keeps the two-pixel backing crisp without turning reconstructed support into an opaque fringe.
- No texture, field, upload, reconstruction stage, or persistent allocation was added. The two presenters intentionally match edge/interior opacity endpoints rather than duplicating each other's implementation detail.

## Stacked tool-discovery geometry follow-up

- Desktop tool filters are now a fixed 68 px two-row stack instead of one clipped over-wide row. All ten filters fit at normal toolbox widths; constrained widths retain a thin horizontal fallback without hiding a second line.
- Mobile retains the compact 40 px horizontal filter rail and bounded catalog. The square 378×378 interaction panel remains first, followed immediately by the visible Material Lab heading and search/filter controls; the document has zero horizontal overflow and remains vertically scrollable to the Brush/actions card.
- The real-browser audit now measures the filter rail, every filter button, palette/actions separation, and document overflow. It fails if a filter escapes vertically, the Brush card overlaps the palette, or the page grows wider than the viewport.
- Captured evidence at 1024×600, 1440×900, and 390×844 shows 8–12 px palette/actions separation, a compact 132 px mobile HUD, and no viewport/input regression.

## Configured-source semantic tranche (`4077b23`, committed and live)

- The source catalog now contains five separate capability-gated tools for CLNE, BCLN, PCLN, PBCN, and CONV. The last selected element is retained as the target, and the search header shows the active `source → target` pair without adding another toolbox row.
- Point dispatch gives erasure and simulation tools priority, then calls `paintConfiguredSource`; it always returns before ordinary particle paint, including when a fallback backend lacks the capability.
- The native adapter validates stable IDs and bounds, creates only in an empty matter cell or reconfigures the same source type, delegates restrictions to upstream `CtypeDraw`, and rolls a new particle back when TPT rejects the target. Exact target inspection round-trips through the stable material mapping rather than returning a guessed phase projection.
- Configured targets are ordinary native `Particle::ctype` state. Raw OPS save/load preserves all five targets without a JavaScript side map or private file extension, and a native behavior test proves CLNE emits the selected target after stepping.
- The field indicator reports the exact target when probing a configured source. Fallback backends keep source tiles disabled; signs remain disabled pending a dedicated safe text editor and overlay.
- The real-browser gate can opt the paused render lab into native TPT with `simulation=native`. Its Canvas pass selected Water, selected configured CLNE, placed exactly one source at the requested world cell, and read back emitter 126 / target 2 while retaining the established resize, wheel-anchor, middle-pan, and mobile touch checks.

## LIFE and optical-response tranche (`c3bdfd2`, committed and pushed)

- All 24 upstream built-in LIFE presets are exposed as capability-gated semantic tools in native preset order. Stable projection IDs 171–194 encode `PT_LIFE` ctypes 0–23 for rendering only; they remain excluded from the ordinary `MATERIALS` brush catalog and generic `powder_set` path.
- `powder_set_life` validates active TPT bounds and preset range, creates only in empty matter cells, and never repurposes LIFE drawing as a configured-source shortcut. Erase retains priority, unsupported backends return without ordinary-particle fallback, and switching tool families clears LIFE state.
- Native tests project all 24 preset IDs, reject invalid/occupied placement atomically, preserve every preset through raw OPS save/load, and evolve a GOL B3/S23 blinker through one upstream generation.
- The renderer lookup now uses the formerly constant palette alpha byte for 12 optical-response classes: default, aqueous, oily, corrosive, molten, sooty gas, clean gas, rough granular, smooth rigid, organic, device, and radioactive. The existing style alpha remains the independent role-trait mask.
- WebGL reuses its existing palette sample to tune liquid transmission/gloss/caustics and gas absorption/scatter. Dense occupied gas converges 98% toward the reconstructed mixture, removing semantic colour islands while retaining sparse edge identity. Canvas consumes the same optics byte through an allocation-free RGB helper and preserves the existing alpha/silhouette owner.
- No texture, field, reconstruction stage, upload, scheduler pass, or persistent volume allocation was added. The local profile still reports exactly 8,173,320 combined field bytes.
- The browser audit now signature-checks and screenshots the deterministic render-lab backend, then navigates separately to native TPT for configured-source and LIFE UI placement. Both WebGL and Canvas expose 24 LIFE tiles and project GOL as ID 171.

## Solid optical-surface follow-up

- WebGL now consumes optics classes 7–11 directly for RGB-only surface response: rough granular facets, smooth rigid bevels, organic fibres, device traces, and radioactive scintillation. Optics selection takes precedence for solid texture while the canonical profile remains the fallback and continues to own field interference.
- Canvas routes the same five classes through its allocation-free three-channel scratch. A neutral-profile solid such as a LIFE projection now receives its smooth-rigid response from optics; the helper never writes the fourth/alpha channel.
- The implementation reuses the palette sample and existing shape gradient. It adds no texture fetch, field, upload, reconstruction stage, render pass, or persistent allocation, and leaves every alpha/silhouette expression unchanged.

## Cohesive solid-interior follow-up

- The deterministic six-row material matrix now directly covers neutral-profile GOL, PCLN, DTEC, URAN, and VIBR without expanding or overlapping the fixture. Existing emitter, sink, channel, force, carrier, organic, energy, and profile coverage remains asserted.
- Canvas closes one- and two-cell exact-solid cavities from an immutable eight-neighbour semantic scan. Four-cardinal enclosure remains supported; shallow cavities otherwise require at least five of eight matching neighbours, three cardinal supports, and zero different nonempty neighbours. Ordinary matching styled RGB is averaged without a brightness bias or cascading reconstructed pixels; trait-bearing solid candidates use canonical palette RGB so radioactive/organic role accents remain confined to semantic cells.
- WebGL reuses its existing eight semantic samples to enforce the same exact-material/foreign-neighbour gate and a restrained `0.30–0.60` support transition. An explicit interior-cell mask matches Canvas border behavior, native walls take priority before nearby-solid selection, role traits remain disabled on reconstructed empty cells, and mixed solids, liquids, gases, and deep/two-cardinal notches cannot be bridged.
- The denser Canvas reconstruction raises the pessimistic full-grid solid-surface pass from roughly 1.27 ms to 2.90 ms median on this machine, while combined field storage remains exactly 8,173,320 bytes and no runtime buffer, texture, upload, or pass is added.

## Render-backing scale-invariance follow-up (`72c7801`, committed and pushed)

- The real-browser gate now performs fresh paired 2× and 1× navigations under the same explicit 1280×720 CSS viewport instead of comparing geometry captured under different Chrome device-emulation states.
- Canvas2D and WebGL both retain the 612×384 logical CSS box and identical 889×557.8 transformed display rectangles while their backing changes only from 1224×768 to 612×384.
- At 1× both backends paint exactly three requested radius-zero landmark cells, keep the off-centre wheel anchor within 0.14 cell, and translate middle-pan by 42×27 CSS pixels. The paired passes report zero browser errors.

## Material-continuity follow-up

- Canvas and WebGL now close short one-cell-wide solid cracks only when two opposing immediate supports, four exact diagonal side-wall supports, and the same material two cells beyond the missing axis prove that the crack is internal. Sparse crosses, open notches, borders, foreign phases/materials, walls, semantic occupancy, and role traits remain protected.
- Accepted solid support is more opaque, reducing black perforations in the rigid/organic/device matrix without adding a field or pass. WebGL adds only two conditional distance-two samples for the ambiguous crack case; Canvas continues to read immutable semantics so fills cannot cascade.
- WebGL reuses its four existing liquid-density neighbours to promote optical depth inside locally supported pools. Isolated droplets remain sparse, while reconstructed holes and adjacent semantic cells no longer alternate as bright particle dots.
- Canvas filled-liquid holes inherit averaged RGB only from already-styled semantic neighbours of the uniquely supported species. Unlike-liquid ties remain transparent, non-liquid particles remain untouched, and alpha/silhouette ownership is unchanged.
- The full suite now contains 190 passing tests. The paired Canvas/WebGL browser gate compiles the runtime shader and reports zero browser errors with exact 1×/2× backing, painting, wheel, pan, resize, native source/LIFE, and mobile checks unchanged.
- Shared field allocation remains exactly 8,173,320 bytes. After preferring four cardinal styled-liquid donors and scanning diagonals only when no cardinal donor exists, the pessimistic full-grid Canvas profile measures solid reconstruction at 2.86 ms median and same-species liquid reconstruction at 3.18 ms median on this machine.
- CI now writes the built commit to `revision.txt` inside the Pages artifact and requires the live marker to equal `GITHUB_SHA` before checking recursive asset closure. A stale but internally complete deployment can no longer pass merely because the SHA was used as a cache-busting query.

## Energy-radiance and emissive-volume follow-up

- Dense WebGL energy cores now pass through a hue-preserving soft radiance knee blended by semantic core density. Sparse edges, alpha, velocity/temperature animation, the shared emission aura, field allocation, and scheduling remain unchanged.
- Canvas applies the same bounded soft knee before writing its nearly opaque semantic core. Its local energy glow is reduced to a sparkle because that plane is drawn once blurred and once crisp on top of the separate shared aura.
- Generic emissive gas and liquid now receive phase-bounded local accent alpha; opaque emissive surfaces keep their stronger accent. This removed CFLM's clipped white speckle without changing atmosphere support or species colour.
- The deterministic atlas now includes compact FOG and CFLM volumes beneath the mixed cloud row. Unit coverage asserts FOG, CFLM, Noble Gas, all five energy families, and allocation-free phase-specific Canvas emission gains.
- The browser audit captures the composed page and decodes it inside Chrome, avoiding `preserveDrawingBuffer`. It samples Fire, Plasma, ELEC, PHOT, and GRVT display regions and asserts visibility, at most 2% pinned-channel pixels, and stable family hue ordering in both Canvas2D and WebGL.
- The suite now contains 192 passing tests. Fresh paired browser evidence reports zero pinned pixels in all ten backend/family samples, zero browser errors, unchanged 1×/2× geometry, 0.145-cell wheel anchoring, exact 42×27 middle-pan, repeated resize recovery, and unchanged mobile/native semantic checks.

## Dense Canvas liquid-cohesion follow-up

- Canvas now applies a non-cascading RGB-only cross kernel after liquid pinhole reconstruction. It requires field alpha at least 224, liquid-plane alpha at least 176, four exact smooth-eligible species cardinals, and at least one matching diagonal. Dense canonical-species reconstructed pinholes may satisfy a cardinal, but shorelines, world borders, narrow streams, hard inclusions, and unlike-liquid boundaries cannot.
- Trait-bearing and emissive liquids bypass the cohesion pass. Every target alpha byte, semantic material byte, liquid-density byte, and separate glow plane remains unchanged; only strongly supported interior RGB is blended. Donors come from a persistent three-row pre-smoothing ring, so results are mirror-symmetric and cannot propagate with scan order.
- The ring costs 7,344 persistent bytes at width 612 and uses one persistent typed-array source view per world row, avoiding per-frame subarray allocation while retaining native row copies. Shared atmosphere/liquid/emission allocation remains exactly 8,173,320 bytes; the profiler's runtime-known Canvas presentation byte storage is 1,887,464 bytes, excluding JavaScript view-object bookkeeping.
- The profiler now includes a fully dense 612×384 Water pass and a full-height Water/Oil split. Latest isolated timings are 4.71 ms median / 5.12 ms p90 for the mixed fixture, 7.72 / 7.75 ms for dense Water, and 7.72 / 7.77 ms for the species boundary.
- The suite now contains 198 passing tests. Coverage proves reduced dense-interior variance, exact shoreline/narrow-stream/boundary preservation, dense-pinhole continuity, low-alpha and trait bypass, alpha/material/density immutability, and mirror symmetry.
- A fresh forced-Canvas browser capture retains 1224×768 backing, 1.59375 world aspect, exact landmark painting, 0.145-cell wheel anchoring, 42×27 CSS-pixel middle-pan, repeated resize recovery, 1.431× mobile pinch with zero stray cells, and zero browser errors. Visual review confirms calmer liquid interiors without widening sparse droplets or cross-family silhouettes.

## Verification completed for the LIFE/optics checkpoint

- `npm run typecheck`
- `npm test`: 40 files, 185 tests passed
- `npm run build`
- Static build closure: 20 referenced resources verified (including the explicit favicon)
- Current live Pages closure: 20 resources verified, including `stillroom_core.wasm` with the correct MIME
- Real TPT save-file load/reserialize check passed for the user-provided `OPS1` save
- Earlier desktop browser audit at DPR 1 and 2 proved 612×384 CSS/logical geometry, 1224×768 backing, exact left/center/right painting, continuous drag, middle pan, touch pan/pinch, and wheel anchoring within browser-event quantization.
- Final rebuilt mobile smoke at 390×844 DPR 2 booted direct native TPT with the Canvas2D compatibility renderer and 1224×768 backing. The 378×378 viewport contained a 378×237.176 canvas at aspect 1.59375012, with no crop or horizontal overflow.
- The mobile filter row now has a constant 40 px track with a visible thin scrollbar; filter buttons remain 28 px high. One-finger painting, two-finger pinch without stray paint, and explicit Eraser restoration passed with zero console, exception, or network failures.
- Fresh render-lab browser evidence at 1280×720 and `renderScale=2` passed for both forced Canvas and SwiftShader WebGL. In the final tree, the badge visibly transitioned from `Canvas 2D · starting WebGL` to `WebGL` as promotion completed in 6.029 seconds. The viewport retained a 1224×768 backing and 827×518.902 CSS canvas with no shader, console, runtime, HTTP, or network errors.
- The automated populated-atlas capture now asserts the deterministic fallback status, more than 40,000 fixture cells, and two fixed wall samples before screenshots. It then tests mapping separately and navigates to native TPT for semantic tools. Both forced Canvas and SwiftShader WebGL place configured CLNE as emitter 126 / target 2, reject `PCLN → PSCN`, expose all 24 LIFE presets, and place GOL as projection 171. The transform gate paints the exact three requested radius-zero cells, holds wheel-anchor drift to 0.145 cell, produces exact 42×27 CSS-pixel middle-pan movement, returns through `1024×600 → 1440×900 → 1024×600`, and reports zero browser errors. Canvas additionally retains a 378×378 mobile panel, 1.59375 field aspect, 1.431× pinch zoom, no stray pinch cells, and the exact one-touch target cell.
- The WebGL and Canvas screenshots show cohesive water/oil/acid/lava columns without black pinholes or cross-family bleeding, continuous mixed gas volumes, and preserved sparse control rows. Canvas deliberately remains softer and more internally speckled than WebGL.
- A retained real-browser interaction audit painted full 3×3 landmark grids before and after promotion. All 18 HUD-selected cells matched; footprint centroid error stayed below 1.5 CSS px, off-center wheel-anchor error was 0.035 CSS px, middle pan was within 0.013 px, and promotion produced zero canvas-rectangle or world-cell drift.
- A repeated production resize sequence `1280×720 → 1024×600 → 1440×900 → 1024×600` now refits on every transition. The 1024 viewport is 686×430.422 inside its 686.188×470 frame, aspect 1.593785, with subpixel containment and unchanged 1224×768 backing; no stale size, runtime, console, or network error remains.
- Fresh touch-emulated metrics at 390×844 and 360×640 show compact palette/toolbox sizes of 300/533 px and 230.39/463.39 px, a 132×37.78 HUD with zero touch-hint overlap, no viewport/palette/actions/footer overlap, reachable footer, exact square interaction panels, 1.59375 canvas aspect, symmetric 70.41/64.82 px letterboxing, and 1224×768 backing. With the catalog already at its 241 px inner-scroll maximum, one trusted swipe kept it at max and advanced document scrollY from 0 to 144, proving page-scroll chaining.
- Current WebGL/Canvas browser acceptance has zero shader/runtime/network errors. Dense WebGL gas is continuous without the prior raw-dot island; Canvas gas has clearer relief/species separation; liquid caps and columns show brighter rims, darker depth, and caustic variation while retaining crisp silhouettes and clean unlike-species seams.
- The current Canvas role-write checkpoint passes the same two-backend browser gate at 1224×768 backing. Both backends return exactly through `1024×600 → 1440×900 → 1024×600`; wheel-anchor drift is 0.145 cell, middle-pan is 42×27 CSS px, and the Canvas mobile gate retains a 378×378 panel, 1.431× pinch, zero stray cells, and zero browser errors.
- The optical-depth tranche passes that same real-browser gate with runtime GLSL compilation and zero browser errors. Retained WebGL/Canvas atlas captures show darker saturated gas cores with readable falloff, cohesive liquid columns with local reflective lips, preserved sparse control rows, and no unlike-species seam bleed.
- The solid-optics follow-up passes the full two-backend browser gate with runtime GLSL compilation and zero browser errors. Canvas and WebGL retain the 1224×768 backing, 1.59375 field aspect, exact landmark painting, 0.145-cell wheel anchoring, 42×27 CSS-pixel middle-pan, repeated resize geometry, 24 LIFE tools, and the mobile one-/two-touch checks. Retained atlases show differentiated solid families without widening their silhouettes.
- The cohesive-solid follow-up passes the same full browser gate with the six-row GOL/device/radioactive fixture, zero shader/runtime/network errors, and unchanged transform metrics. Retained WebGL and Canvas captures show dense solid blocks with fewer black perforations while mixed-material seams and the sparse powder controls remain open.
- The stacked tool-discovery gate reports exactly two desktop filter rows at 68 px, a 40 px mobile filter rail, 8/12/8 px palette-to-actions gaps through the repeated desktop resize sequence, and zero mobile horizontal overflow. The optional browser screenshot path now also retains a DPR-2 portrait capture for direct layout review.
- Latest warmed field profile at 612×384: atmosphere 7.21 ms median, species-aware liquid 11.40 ms, emission 3.18 ms, Canvas atmosphere relief 0.87 ms, solid reconstruction 1.27 ms, surface lighting 6.00 ms, and liquid reconstruction 1.67 ms. Shared volume storage remains 8,173,320 bytes; optical classes add no field or texture allocation.
- The current pessimistic Canvas energy profile shades all 235,008 cells as radioactive energy cores in 25.20 ms median / 26.47 ms p90 on the local machine with the three-channel soft radiance knee enabled. Ordinary scenes call it only for actual energy cells. It adds two reusable 3-float vectors and no field/texture allocation; shared volume storage remains exactly 8,173,320 bytes.
- Repeated surface-light stress profiles at 612×384 measured 5.76–11.20 ms median for the standalone dense-contour Canvas pass under varying local load; the latest p90/maximum were 12.08/12.44 ms. Shared field storage remains exactly 8,173,320 bytes; the diagnostic pass includes its own full-grid scan and reuses existing buffers.
- Fresh local Chrome at 1280×720 promoted the render lab to WebGL with the runtime GLSL compiled. A 1024×600 repeat retained the correct 1.59375 field aspect and backend badge; Chrome logged only Vite connect messages and no shader, WebGL, console, or runtime error.
- Forced Canvas at 1280×720 and a 390×844 DPR-2 portrait capture retained the 1224×768 backing, square mobile interaction panel with aspect-preserving letterbox, smooth empty-space aura, and crisp material seams. Warm/cool strips visibly reveal profile contours without uniformly whitening block interiors.
- Native semantic-tool coverage now proves exact scalar deltas, stable typed routing, no vector-to-particle fallthrough, no vector emission during pinch navigation, malformed ABI rejection, Wind response, `WL_BLOCKAIR` isolation, stable-water regression, and unstepped OPS Wind round-tripping.

The layout checkpoint `60b033b` and dense-solid relief checkpoint `97f5ced` were first deployed by run `29666585733`. The later gas-curvature, field-owned liquid-lighting, Canvas liquid-field-relief, solid-cavity opacity, field-lit gas/energy, WebGL liquid macro-relief, and mobile-control proofs culminated in deployed checkpoint `8ae8765`; run `29675483452` built that exact SHA and passed revision, runtime-asset-closure, and live browser validation.

## Current gas-curvature follow-up

- Canvas and WebGL reuse the four atmosphere alpha samples already required for density slope to derive signed local curvature. Convex cloud crowns receive bounded broad light and concave overlap pockets self-shadow; RGB changes uniformly, while every field alpha/support byte and species hue ordering remains unchanged.
- The change adds no field, texture, texture fetch, upload, pass, or persistent allocation. On the local 612×384 profile, Canvas atmosphere relief measured `0.95 ms` median / `1.33 ms` p90 after simplifying the signed response, versus the prior roughly `0.86 ms` median.
- The browser screenshot gate now samples Water, Oil, Smoke, Oxygen, and Noble Gas in addition to energy and solid families. Fresh WebGL and Canvas captures retained full dense-core coverage, bounded non-flat luma, zero pinned fluid channels, exact `1224×768` backing, stable repeated resize geometry, `0.06`-cell 2× wheel anchoring, exact `42×27` middle-pan, and zero browser errors. Canvas mobile retained its `378×378` viewport, `1.431×` pinch, and zero stray cells.

## Current field-owned liquid-lighting follow-up

- Canvas dense liquids no longer derive full-strength contour and local glint from raw semantic holes after the shared field has reconstructed a continuous body. Field centre alpha attenuates cell-neighbour contour noise, while only empty semantic air with low field alpha above qualifies as a top-surface highlight. Unlike materials remain visible seams and sparse droplets keep their exact contour.
- WebGL reuses its existing centre and four-cardinal liquid alpha samples to promote lighting depth and suppress semantic micro-normals only inside connected pools. Alpha/support, field RGB, texture-fetch count, scheduler work, and storage remain unchanged.
- Canvas Lava keeps its continuous body glow in the shared emission field and moves the twice-composited local light accent to the field-owned top surface. Its homogeneous column changed from fully pinned yellow (`255,246,44`, pinned fraction `1`) to unclipped warm orange (`157,104,35`, pinned fraction `0`) without changing material or alpha semantics.
- The browser gate now measures mean adjacent-pixel luma delta for homogeneous lower Water/Oil/Acid/Lava columns, with a ceiling of `4`, non-flat luma range, at least `90%` coverage, at most `15%` pinned pixels, and explicit family-hue assertions. Final Canvas values were `0.42/0.34/0.34/0.48`; the retained WebGL values were `1.24/0.85/0.61/0.39`.
- Shared field storage remains exactly `8,173,320` bytes and runtime-known Canvas scratch remains `1,887,464` bytes. The pessimistic all-235,008-cell liquid-light helper profile measured `6.51 ms` median / `6.63 ms` p90; ordinary dense interiors short-circuit the top-exposure field read because their semantic top is occupied.

## Current Canvas liquid-field-relief follow-up

- Canvas semantic liquids and reconstructed holes now share an allocation-free hue-preserving RGB relief sampled from the existing liquid field's centre and four cardinal alpha bytes. Upper-left slope, convex crowns, and concave pockets create coherent volume; centre/cardinal connectivity disables the effect for isolated droplets. No alpha, support, material, species RGB, trait, emission-plane, field, texture, pass, or scheduler ownership changed.
- The browser sampler now separates cell-frequency contrast from five-by-five low-pass macro contrast. Canvas Water/Oil/Acid/Lava columns retained micro-contrast below `0.5` while producing macro ranges around `12/7/8/11`; paired WebGL values were around `4/2/7/3`, and a broad ratio gate prevents either fallback flatness or excessive relief. A dedicated Canvas Water probe requires at least `12` macro levels at the upper-left field edge, at least twice its core range, while core adjacent contrast stays at or below `1`.
- Smoke, Oxygen, and Noble Gas now have explicit composed-output hue assertions in both backends: neutral warm-grey, ordered cool blue, and ordered violet respectively. This proves the documented hue invariant through the final compositor rather than only through scalar curvature math.
- Shared field storage remains exactly `8,173,320` bytes and runtime-known Canvas scratch remains `1,887,464` bytes. The final pessimistic all-235,008-cell contour/top/relief helper profile measured `9.71 ms` median / `11.42 ms` p90 after byte-space normalization and exact low-density/uniform-neighbour early exits; ordinary frames call relief only for actual liquid semantic cells plus supported reconstructed holes. This is an isolated helper bound, not yet an end-to-end dense-scene frame budget.

## Current solid-cavity opacity follow-up (`debde42`)

- The conservative exact-material eligibility proof is unchanged: zero different nonempty immediate neighbours plus four-cardinal enclosure or at least five of eight matches with three cardinal supports; the narrow two-cardinal crack case still requires all four matching diagonals and explicit same-material distance-two bounds. This remains presentation-only and cannot cascade through Canvas reconstruction.
- Once that proof accepts a cavity, Canvas maps support monotonically into the near-opaque `0.90–0.98` band. WebGL normalizes the same candidate only when `surfaceOnly` is set and reconstructed `density` is nonzero, so a nearby exact solid cannot make a rejected candidate visible. No semantic occupancy, field support, scheduler stage, texture, or pass changed.
- Powders, unlike- or mixed-material seams, native walls, world borders, sparse crosses, open notches, and unbounded cracks remain transparent. Trait-bearing accepted support uses canonical palette RGB without extending semantic role traits into the reconstructed cell.
- The composed browser gate now limits the relative dark-pit fraction to `0.08` in each of four solid-family interiors and separately requires the vertical and horizontal solid-matrix gaps to keep every RGB channel at or below `20` with luma range at or below `5`. Run these assertions in both Canvas and WebGL so stronger accepted-cavity opacity cannot silently bridge a separator.
- This checkpoint makes proven cavities join their material chunk instead of reading as black cell-sized pits. It deliberately does not claim that all solid cellularity is solved: ambiguous clusters and every conservatively rejected notch or seam remain visible, alongside intentional material relief and granular texture.

## Current dense Canvas timing follow-up (after `debde42`)

- The browser audit now includes an audit-only full Canvas presentation timer and deterministic full-grid Metal fixture. It warms 10 frames, retains 30 steady-state one-cell-toggle samples, excludes scheduled field-rebuild samples, and reports median/p90/maximum without a pass/fail threshold. The first local run measured `29.9 ms` median / `30.9 ms` p90 / `52.1 ms` maximum; the fresh paired-backend verification measured `27.5 ms` / `29.6 ms` / `30.3 ms`, with no rebuild samples retained in either run. This measures synchronous Canvas submission through final 2× composition; it is stronger evidence than the isolated `2.88 ms` median / `3.13 ms` p90 solid-reconstruction helper profile, but it is still host-specific telemetry rather than a proven cross-run budget.

## Current family-directed solid-mesostructure follow-up (after `f117761`)

- The Canvas semantic traversal now uses nested `y/x` loops with a monotonic index, computes the legacy grain hash only in the seven branches that consume it, reuses the loaded profile byte, and directly writes fully opaque generic solids. Those algebraically equivalent changes improved a same-host dense-Metal run from `27.5/29.6/30.3 ms` median/p90/max to `24.6/26.2/26.6 ms` before styling.
- Dense exact-material solid interiors now use one cubic-smoothed, module-static macro wave mirrored by an analytic GLSL slope. Family axes/strengths are rigid `(2,1)/7`, organic `(1,4)/6`, device `(4,0)/4.5`, and radioactive `(3,-2)/5.5`; granular profiles return zero. There is no second wave, field, texture, neighbour read, per-frame allocation, or frame-sized buffer.
- Canvas family-aware cohesion attenuates cell-frequency RGB only behind the existing four-cardinal exact-material and trait/emissive bypass gates. A uniform over-range highlight scale prevents saturated device colors from clipping a channel; the DTEC composed sample returned from `19.1%` pinned pixels in the first candidate capture to `0%` without losing its orange ordering. WebGL attenuates only its existing family micro-patterns in dense interiors and leaves alpha/cavity eligibility unchanged.
- The final paired browser gate passed with zero browser errors. Canvas Metal/Plant/PLUT/DTEC microcontrast measured `3.23/4.58/3.35/2.01`, with macro luma ranges `56/37/23/57`; dense Sand retained `7.28` microcontrast. The WebGL candidate capture measured `8.16/4.62/2.59/8.14` microcontrast and `27/19/7/20` macro ranges. Both separators, dark-pit bounds, clipping limits, viewport transforms, gestures, and mobile layout stayed green. Two forced-Canvas styled runs measured `27.3/29.2 ms` and `29.9/33.5 ms` median/p90. The spread confirms why this remains host-specific, nonblocking telemetry rather than a hard CI budget; the styling spends part of the reclaimed loop headroom without adding storage or a pass.
- The final isolated profile kept combined render-field storage at `8,173,320` bytes and runtime-known Canvas scratch at `1,887,464` bytes. The replaced one-wave worst-case helper measured `5.43 ms` median / `5.59 ms` p90, and solid cavity reconstruction measured `2.81 ms` / `3.00 ms`; no new frame-sized runtime buffer or pass was introduced.

## Current WebGL presentation timing follow-up (after `8ae8765`)

- The input-audit API can now request one composed WebGL presentation sample at a time. The presenter uses `EXT_disjoint_timer_query_webgl2` when available, retains only one pending query, rejects disjoint/invalid values, and deletes the query on completion, failure, teardown, or render error. If the extension is absent or fails, it reports an explicit `cpu-submission` source and clears any earlier GPU distribution before recording the fallback.
- The browser gate samples the warmed canonical render lab until it has 30 usable frames and reports source, discarded count, median, p90, and maximum without imposing a cross-machine threshold. The first SwiftShader run used real GPU queries and measured `109.49/123.57/134.96 ms` median/p90/maximum; a fresh full paired rerun measured `104.10/112.09/140.95 ms`. Both retained 30 usable samples and zero discarded. This is a software-GPU baseline, not a production-hardware budget.
- Instrumentation is enabled only under `inputAudit=1`. Normal render paths issue no query or timing calls and add only the disabled boolean branch. The WebGL-only browser gate passed all shader, visual, 1×/2× viewport, desktop/mobile gesture, catalog, configured-source, LIFE, and native-semantics checks with zero browser errors.
- TypeScript, all 43 test files / 220 tests, the 765-module production build with 20-file static closure, and the allocation/profile gate pass. Shared render-field storage remains `8,173,320` bytes. Latest isolated p90 values include atmosphere relief `1.17 ms`, atmosphere field lighting `3.58 ms`, liquid reconstruction `5.09 ms`, dense-liquid worst case `7.68 ms`, and field-owned liquid light worst case `8.78 ms`.

## Next visual acceptance direction (after `9c313db`)

- Reconstruct a continuous coverage/normal signal for compatible solid and same-species liquid chunks so diagonals, shallow arcs, droplets, pool crowns, and eroded solid outlines no longer expose a raw one-cell staircase at 2×. Coverage smoothing must remain local, phase/species-aware, area-bounded, and presentation-only: unlike materials may share phase occupancy at contact but their RGB selection cannot overlap or bleed; it also cannot occupy semantic empty cells for physics, fill deliberate separators, erase sparse powder/energy topology, or soften native walls into particles.
- Derive broad normals and optical depth from the same bounded support so the silhouette and lighting agree. Solids should receive family-aware key/fill/ambient response plus restrained roughness/specular and mesostructure variation. Liquids should receive depth-tinted transmission, Fresnel-like edge reflection, a coherent moving highlight/caustic response, and controlled transparency without flattening thin droplets or clipping Lava/emissive families.
- Prefer a local analytic coverage reconstruction in the existing presenter over a full-screen blur or generic postprocess. If Canvas cannot match the exact WebGL estimator cheaply, preserve the same invariants with a bounded preallocated scratch/contour pass and measure it separately. Do not add a mesh solely for visual fashion unless it proves better topology, memory, and update cost than the existing field textures.
- Extend the deterministic browser gate before accepting the look: measure diagonal/curved edge continuity and stair-step energy, silhouette area growth, unlike-species seam darkness, sparse-control retention, low-frequency interior light range, highlight clipping, and 1×/2× plus Canvas/WebGL parity. Retain screenshots for human review because numerical smoothness alone can still look waxy or blurred.

## Current visual tranche (after `9c313db`)

- WebGL solid and liquid boundaries now use monotone cubic Hermite weights and analytic derivatives over the existing four compatible-occupancy samples. The one-dimensional kernel has the same 0.5 integral as linear interpolation and adds no texture read/field/buffer/pass; that reference identity is covered by exhaustive binary-corner tests, while final raster area is checked separately in the composed browser fixture. Native walls, gas, energy, semantic occupancy, and unlike-liquid RGB selection stay outside this contour estimator.
- The shader now derives stronger key/fill diffuse light, broad specular response, Fresnel-like edge reflection, bounded environment tint, liquid depth-tinted transparency, and caustic variation from its existing slopes/support. A thirteenth `TranslucentRigid` optics class gives Glass, Ice, solid QRTZ, DRIC, NICE, and RIME reduced opacity with cool tint/reflection response in both WebGL and Canvas without changing physics or material selection. Legacy powder Quartz remains granular; this is presentation styling rather than physical refraction.
- Powder has a contact- and velocity-aware WebGL presentation. Sparse/moving particles use deterministic slightly offset analytic discs; compatible powder/solid support and low speed fade continuously into a Hermite heap contour. Unlike powders share categorical phase coverage at contact but exact material RGB remains exclusive, and ambiguous empty-side candidates are rejected rather than scan-order selected. A solid accepts only solid support, so gas, liquid, and moving powder cannot wobble its edge. The dense-Sand browser probe retains `15.12` mean adjacent-pixel microcontrast. A separate bounded Canvas powder plane or equivalent contour scratch remains required before claiming rounded-grain backend parity; do not blur the combined Canvas solid plane.
- The render lab now has an exact rounded Metal body, exact split Water/Oil capsule, curved unlike-material contact capsules, and isolated Water/Sand controls. The browser audit blank-differences the silhouettes, asserts one dominant component and bounded compactness, normalizes contact area into world-cell units, rejects signal reaching a padded outer ring, directly samples the Water/Oil seam, and explicitly gates Glass/Ice visibility, cool tint, macro relief, and clipping. Compactness remains a secondary fragmentation check; edge-distance/stair-energy and full backend contour parity remain queued proof.
- Boundary presentation now owns a one-byte-per-cell powder stability field. Supported powder must remain below native speed 3 for several renderer refreshes before it becomes a bulk surface, holds its state through speeds 3–10, and releases at speed 10, owner change, or lost powder/solid contact. Gas and liquid never contribute support, and solids still accept only solid coverage. Settled powder in both Canvas and WebGL uses a normalized separable 3×3 quadratic B-spline density; moving powder remains a deterministic round grain. The render lab includes an exact shallow Sand slope so future screenshots expose one-cell sawtooth regressions directly. Canvas retains its 2× contour surface and rerasterizes only dirty/stability/animated chunks; the warmed dense-Metal timer returned to `24.7/25.7/43.3 ms` median/p90/max after the initial uncached prototype measured 107.3 ms median. The final paired audit passed all Canvas/WebGL contour, contact, liquid-depth, input, mobile, and runtime-GLSL gates with zero browser errors; captures are `.artifacts/stable-boundaries-final-canvas2d.png` and `.artifacts/stable-boundaries-final-webgl.png`. Final SwiftShader WebGL timing was `137.92/152.34/190.31 ms` with 30 usable GPU queries and zero discarded.
- Fresh WebGL and forced-Canvas 2× browser audits passed runtime shader compilation, the new visual/contact probes, exact landmark painting, wheel anchoring, middle pan, repeated resize, 1× diagnostics, configured sources, all 24 LIFE presets, mobile draw/eraser and two-touch pan/pinch, and zero browser errors. The atlas now includes curved Sand/Salt and Metal/Glass contact capsules whose sides remain exclusive and whose body remains one connected component. Retained captures are `.artifacts/webgl-contact-fixtures.png` and `.artifacts/canvas-contact-fixtures.png`. The latest WebGL timer reported 30 usable SwiftShader GPU queries and zero discarded; `125.30/137.31/160.08 ms` median/p90/max is treated as diagnostic telemetry, not a regression threshold. Canvas dense Metal presentation measured `24.0/26.2/34.7 ms`.
- Commit `de2dcdf` checkpointed and pushed the first contact/optics tranche. Final review then removed powder Quartz from the translucent class, restored the conservative isolated-liquid promotion threshold, added isolated-particle and normalized contact-area/outer-ring browser controls, and corrected Canvas/Hermite and transmission/refraction claims. Commit `3d89a11` passed TypeScript, all 44 test files / 225 tests, the 765-module production build, 20-file asset closure, and the paired browser audit with zero errors. Manual cached run `29678840242` deployed that exact SHA and verified its live revision and runtime asset closure.

## Current complete-catalog/mobile-control tranche (after `3d89a11`)

- Steam, Salt Water, Gas, Snow, and Plasma are no longer hidden reaction-only projections. Native exhaustive paint/projection already covered IDs 1–170; all 170 ordinary projected particles now have catalog tiles, 165 are enabled, and only GRVT, GBMB, NBHL, NWHL, and GPMP remain explicitly disabled because Newtonian FFT gravity is absent. LIFE projections 171–194 remain correctly excluded from generic brushes and available through all 24 semantic preset tools.
- The Forces filter now returns Air/Vacuum/Wind together with all force-category elements; Life returns the five growth materials together with 24 automata; Radioactive has a direct filter for all 17 projected elements. Nested groups preserve category boundaries rather than flattening unlike semantic tools into particle buttons.
- The one shared Draw/Eraser group moved out of the below-fold actions card into a compact mobile-only quick bar above the catalog. It owns the existing callback and `aria-pressed` state without duplication. At initial `scrollY=0`, the paired browser gate proves the complete `374×48` bar and tool search fit at 390×844; a second 360×640 check proves the `344×48` bar and search remain visible. Eraser deletes the exact painted cell without scripted scrolling, Draw restores a continuous 25-cell one-touch stroke, two-finger pinch/pan leaves zero cells, and horizontal overflow remains zero.
- TypeScript, all 44 test files / 226 tests, the 765-module production build, and 20-file asset closure pass. The final paired Canvas/WebGL browser audit passes desktop filter geometry/overflow, short-window scroll reach, nested LIFE selection, all existing viewport/render checks, both mobile sizes, runtime GLSL compilation, and zero browser errors. Canvas dense-Metal diagnostic timing was `22.8/24.6/26.0 ms`; WebGL retained 30/30 GPU-query samples at `122.06/155.97/165.53 ms` median/p90/max. These remain host-specific telemetry.

## Current blockers and risks

- WebGL runtime GLSL is not compiled by TypeScript/Vite; preserve the fresh browser audit for every shader change.
- The post-deploy verifier proves network asset closure and MIME, but not shader execution or interaction by itself.
- Cached-HTML compatibility still relies on a small fixed set of historical JS/CSS aliases. The live revision marker now proves which artifact reached Pages, but the verifier does not compare every public content hash to the local artifact.
- The browser integration gate now automates transform/semantic placement and samples composed render-lab pixels through a decoded page screenshot, but public Pages browser execution remains distinct from the post-deploy asset-closure verifier.
- Signs and several special editing semantics remain future work; configured sources and all 24 built-in LIFE presets are implemented through distinct semantic boundaries.
- Pushes to `main_codex` intentionally do not build or deploy. Dispatch `ci.yml` manually with `operation=build-and-deploy`; the workflow restores the latest compatible ccache/Emscripten cache and saves a new primary ccache key only after a successful build.
- Newtonian FFT gravity is intentionally omitted from the headless build, so gravity-dependent tools/elements must remain disabled or limited.
- GPU partial texture upload, long-session allocation behavior, context loss, production-hardware timing, and stable cross-checkpoint performance budgets need further profiling; the current SwiftShader elapsed-time distribution is only a repeatable software-GPU baseline.
- Dense role-heavy Canvas scenes remain arithmetic-bound even after eliminating the duplicate pixel write; specialize common masks or move the fallback's semantic accents into a vectorized/field-level presentation path before claiming a 30 FPS worst-case budget.

## Current stable powder edge and supersampling follow-up

- The prior stable 3×3 powder B-spline was evaluated only inside semantic powder cells, so its shading was smooth but its outer silhouette remained a union of cell squares. Canvas and WebGL now permit one adjacent empty presentation cell only when the cardinal neighbourhood selects one exact stable powder owner without a competing solid/powder material. Alpha is the product of owner stability, `smoothstep(2.5, 4.0, compatibleSupport)`, and the existing quadratic heap density. This remains presentation-only; loose grains, moving grains, mixed Sand/Salt seams, solid contacts, liquid, gas, walls, and physics occupancy cannot claim the extension.
- Canvas contour scratch now accepts true 1×/2×/4×/8× sampling dimensions and keeps stable class-owned buffers. The public `renderScale` parser accepts `1`, `2`, `4`, and `8`; the canonical 612×384 backing sizes are 612×384, 1224×768, 2448×1536, and 4896×3072. The default remains 2×. Canvas 4×/8× evaluates new contour samples rather than upscaling the old 2× surface; WebGL passes the same value to Pixi resolution. Eight-times output is intentionally an expensive inspection mode, not a mobile/default recommendation.
- Canvas powder keeps a deterministic two-by-two facet frequency at every supersampling scale, so higher edge resolution does not flatten bulk grains or introduce 8× pixel-frequency glitter. The allocation-free quadratic hot loop no longer creates JavaScript weight arrays per powder subpixel.
- TypeScript, all 46 test files / 239 tests, the 768-module production build, and 20-file asset closure pass. Forced Canvas and WebGL browser audits separately passed the complete visual, input, resize, 1× diagnostic, catalog, LIFE, mobile, and runtime-GLSL gates with zero browser errors. Canvas dense-Metal presentation measured `24.5/25.7/25.8 ms`; WebGL retained 30 usable SwiftShader GPU queries and zero discarded at `141.86/156.55/179.77 ms`. Captures are `.artifacts/powder-supersampling-canvas.png` and `.artifacts/powder-supersampling-webgl.png`.
- That checkpoint still exposed terraces on a one-row-per-many-columns heap. The current uncommitted tranche replaces that limitation with the shared bounded slope field described below.

## Current slope-aware powder reconstruction

- Settled powder now feeds one shared full-resolution presentation field used by Canvas and WebGL. Two allocation-free horizontal radius-10 box passes form a triangular long-tangent estimate; a tight five-tap vertical pass preserves pile height. Packed RGBA stores density, signed x/y gradients, and local powder/solid support. Long blur input is stable powder only, while solids remain local support and walls are excluded.
- Both presenters blend the wide estimate only on top/slope-facing gradients, preserving the conservative local contour on vertical pile sides. Exact material ownership, mixed Sand/Salt rejection, one-cell maximum presentation growth, loose-grain discs, stability hysteresis, and semantic physics occupancy remain unchanged.
- The field owns exactly `3,055,104` preallocated bytes. The four reconstruction fields total `11,228,424` bytes; lookup tables bring `RenderFieldSet` to `11,232,008`. The WebGL source set now includes one 940,032-byte linear RGBA powder texture. It rebuilds only after relevant stable powder/solid/wall changes and is independently cadence-limited.
- The hot loops retain byte-identical output and the same allocation while reducing the canonical full rebuild from roughly `25.32/25.62 ms` median/p90 to `13.51/13.82 ms` in the paired local profile. Rolling three-column support, an unrolled fixed vertical pass, and cheaper classification remove about 46% without update-time allocations.
- Smooth mode now requires exact gravity depth before consuming the long field: two same-material cells below occupied powder or three below empty-side projection, plus lateral support. The deterministic 4× Clay/Concrete ridge-and-branch regression proves the shared field is byte-for-byte identical to Local mode over these fine structures. Grains/Local/Smooth controls expose fully discrete grains, short settled contours, and deep-heap slope reconstruction in both backends; Smooth remains the default.
- The deterministic unit fixture requires shallow-slope second-difference energy below 72% of the raw stepped surface while retaining mean height within 0.12 cell. Fresh Canvas and runtime-WebGL audits passed with zero browser errors; `.artifacts/slope-field-final-canvas.png`, `.artifacts/slope-field-final-webgl.png`, and the dedicated true-4× `.artifacts/slope-field-canvas-4x.png` retain visual evidence. At 4× the shallow tangent is materially smoother; 2× remains the balanced default and 8× remains inspection-only.
- `renderScale=1|2|4|8` remains real per-axis sampling. For the canonical world the requested backing sizes are 612×384, 1224×768, 2448×1536, and 4896×3072. Pixel/fragment work grows quadratically, and a single RGBA output target grows from 3.76 MiB at 2× to 15.04 MiB at 4× and 60.16 MiB at 8× before Pixi scratch targets. To prevent GPU watchdog timeouts, automatic/WebGL startup now caps a single target at 4,096 pixels per axis and 8,388,608 pixels total before allocating either fallback or Pixi output; canonical 8× therefore reports an effective 4× in the backend HUD, while explicit forced Canvas and sufficiently small WebGL worlds may still run true 8×.
- Final validation passes TypeScript, all 48 test files / 250 tests, the 770-module production build, and the 20-file static asset closure. Full forced-Canvas and WebGL browser audits pass the powder-style controls, exact input mapping, responsive layouts, runtime GLSL, and the real `renderScale=8` cap path with zero browser errors. Canvas dense-Metal presentation measured `24.6/27.9/42.4 ms`; WebGL retained 30 usable SwiftShader GPU queries with zero discarded at `122.83/133.29/138.32 ms`. Current captures are `.artifacts/powder-styles-detail-canvas.png`, `.artifacts/powder-styles-detail-webgl.png`, and their `-mobile` companions.

## Current liquid-contact optics and powder-style browser proof

- Union liquid alpha remains intentionally continuous across Water/Oil and other unlike-liquid contacts, but that previously left their exact RGB seam optically flat. Canvas now derives a dense-support-gated signed contact relief from canonical liquid-field RGB only after semantic neighbours prove an unlike liquid. WebGL reuses its four existing cardinal `vec4` samples for a species-contact normal plus a restrained meniscus multiplier. Neither backend adds a field, allocation, upload, texture fetch, pass, scheduler task, alpha change, RGB averaging, or semantic ownership change.
- The real browser gate now clicks Grains, Local, and Smooth through the actual accessible controls in both backends, requires exclusive state, distinct shallow-slope framebuffer signatures, less reconstructed area/macro relief in Grains than Smooth, and exact Smooth restoration. Four narrow Water/Oil probes additionally require full seam coverage, bounded response on both owned species, stable hue ordering, and no dark gap. Final Canvas response was `+12.48/+2.57` luma for Water/Oil; WebGL was `+5.45/-3.89`.
- The first naive Canvas prototype evaluated four RGB contrasts for every liquid cell and raised the pessimistic full-grid helper from about 9 ms to `36.82 ms` median. Moving the work behind the existing unlike-liquid semantic-neighbour condition restored the same helper to `8.61/8.79/8.82 ms` median/p90/max with unchanged output. Final dense-Metal Canvas presentation measured `23.8/24.8/26.6 ms`; WebGL retained 30 usable SwiftShader GPU queries with zero discarded at `131.12/143.38/201.61 ms`.
- TypeScript, all 48 test files / 252 tests, the 770-module production build, 20-file static asset closure, focused field tests, forced-Canvas browser audit, and runtime-WebGL browser audit pass with zero browser errors. Captures are `.artifacts/liquid-interface-canvas.png`, `.artifacts/liquid-interface-webgl.png`, and their mobile/configured-source/LIFE companions.

## Smooth-view powder correctness and field-shaped liquid light

- Smooth deep heaps now retain a 40% floor of the Local contour at every semantically occupied subpixel. This prevents the long slope field from erasing parts of Clay/Concrete columns or irregular bulk structures while leaving it free to redistribute the remaining coverage into a smoother top/slope boundary. The deterministic render lab replaces the densest upper-left powder band with deep Clay and Concrete columns containing asymmetric notches and bottom ledges; unit tests compare every Local-visible occupied subpixel, and six composed browser regions compare Local against Smooth in both backends.
- Grains is now an exact square-cell reference in Canvas and WebGL. It has no empty-side promotion, and the composed browser gate requires an isolated sample to be one dominant square component. Local and Smooth retain their analytic curved contours, so the three styles remain visibly and accessibly distinct.
- The split Water/Oil capsule now has an analytic composed-edge proof. Blank-differenced 20/50/80% threshold crossings are compared with its exact circular endcap, bounding RMS/max error, transition width, symmetry, and monotonicity. Final Canvas measured `0.292` RMS cells and `0.579` max; WebGL measured `0.437` RMS and `1.025` max.
- Exposed non-emissive liquids now reflect the existing coloured emission field with surface-shaped response. Canvas validates semantic empty sides against liquid-field alpha before bilinear sampling; WebGL reuses its existing emission sample and already computed lip/rim/Fresnel/normal signals. This adds no field, allocation, upload, pass, or WebGL texture fetch, leaves alpha/support/species unchanged, rejects dense pinholes, and prevents Lava from feeding back its own emission. Paired browser captures prove cool GRVT response on Water and warm Fire response on Acid in both backends.
- The deliberately pathological Canvas reflection profile, which assumes every full-grid liquid cell is exposed on all sides, measured `15.77/16.09/16.38 ms` median/p90/max. The production loop first requires an actually empty semantic cardinal, so ordinary dense pool cells avoid that helper and bilinear light path. Shared render-field allocation remains unchanged.
- Final local validation passes TypeScript, all 48 test files / 256 tests, the 770-module production build, and the 20-file static asset closure. Full forced-Canvas and runtime-WebGL browser audits pass visual sampling, analytic contours, powder columns/styles, exact cursor/continuous left-drag, wheel anchoring, middle pan, resize/backing geometry, 1× behavior, the WebGL 8× safety cap, short desktop layout, mobile single-touch brush plus two-touch pan/pinch, native sources/LIFE, and zero browser errors. Captures are `.artifacts/powder-columns-reflection-canvas.png`, `.artifacts/powder-columns-reflection-webgl.png`, and their mobile/configured-source/LIFE companions.

## Smooth-view semantic proof, translucent scene light, and true 8x

- The Clay/Concrete columns are now authored after neighbouring Dust/Salt bands, preventing the fixture itself from overwriting lower column sections. The composed browser gate samples every world-cell centre across both full column rectangles in Local and Smooth: all 2,256 occupied cells remain visible, all 54 authored notch cells are measured, and all 10 deep-hole samples remain empty in Canvas2D and WebGL. The shallow-slope comparison hashes the binary blank-differenced silhouette, not merely RGB shading.
- Grains remains an exact square-cell source in both renderers. The overview topology check is backed by a 5x viewport-zoom capture: Canvas resolves the isolated grain to 18x17 pixels at 98.7% rectangular fill; WebGL resolves it to 9x9 at 92.6% fill. Local and Smooth retain curved subcell contours.
- The split liquid capsule's composed edge is sampled at every screenshot row and compared to both its analytic circle and a raw cell-staircase reference. Canvas/WebGL RMS is 0.281/0.224 cell versus raw 0.735/0.749; tangent error also materially improves over raw.
- Dense exact-material `TranslucentRigid` interiors now receive bounded RGB-only coupling from the existing emission field. Fire warms Glass and ELEC adds a cool/neutral Ice response; a distance-matched opaque Metal control stays unchanged, and lit/unlit support is identical. This is not patterned-background refraction. Canvas excludes emissive, trait-bearing, thin, and edge cells; late WebGL promotion inherits the toggle. `EmissionField.mayLightWorldCell` reduces the localized-source full-Glass diagnostic to 2.71 ms median while retaining an honest 25.22 ms all-world/all-field ceiling. No WebGL pass, texture fetch, field, or alpha/support change was added.
- Canonical `renderScale=8` is true WebGL 8x again: 4896x3072 backing inside an 8,192-axis/16,777,216-pixel target budget. MSAA and extra high-quality diagonal/ring probes are disabled at 8x, while the temporary automatic Canvas fallback remains at most 4x to avoid duplicate 60 MiB startup surfaces. The dedicated SwiftShader browser proof reports requested/effective 8/8, unchanged CSS geometry, and zero errors. The normal full WebGL audit repeats it against a fresh 2x CSS-rectangle reference.
- Current local validation passes TypeScript, all 48 test files / 258 tests, the 770-module production build, and the 20-file static asset closure. The paired composed Canvas/WebGL proof and the full interaction/responsive/native-semantics audit pass with zero browser errors. The focused and full WebGL gates both prove true requested/effective 8x output at 4896x3072 with unchanged CSS geometry. Current captures are `.artifacts/smooth-view-true8-canvas2d.png`, `.artifacts/smooth-view-true8-webgl.png`, and their mobile/configured-source/LIFE companions.

## Current paste/resist phase-continuity checkpoint

- PSTE/PSTS share one 32-cell hydrated/pressed sediment grammar, while RSST/RSSS share one crossed resist/insulating-laminate grammar. Native phase changes retain the exact family topology; phase changes only its bounded RGB interpretation. Canvas owns one 12,288-byte module-static lookup and allocation-free per-cell composition. WebGL mirrors the same integer grammar with arithmetic only and adds no texture, sampler, uniform, field, pass, target, upload, persistent buffer, or output-scale resource.
- Generic liquid cohesion, optical depth, meniscus light, solid contour/depth, ownership, alpha, reconstruction, and physics remain authoritative. PSTS remains a real native but nonselectable render projection; it never crosses the ordinary brush ABI. The native regression now proves exact PSTE→PSTS→PSTE pressure thresholds, PSTE→BRCK heat conversion, PHOT/NEUT resist phase conversion, ELEC and completed-SPRK destruction, and RSST explosive products with localized exact counts.
- The deterministic four-card fixture contains congruent 144×104 phase bodies, 14,676 authoritative body cells per card, authored cavities and open chimneys, 85/145/133/200-cell phase structures, isolated controls, guarded blanks, exact phase-partner contacts, Metal controls, and phase-aligned motif probes. Flat→styled→flat preserves semantic, alpha, support, contacts, holes, and thin structures exactly.
- The dedicated paired 2× real-browser gate passes with zero errors. Canvas phase correlation is `0.81556` paste and `0.77265` resist; WebGL is `0.90446` and `0.97306`. All four materials have nonzero normal-fit response, phase-partner contacts remain visibly separated, backend response ratios remain `0.5235–0.8177`, normalized 4×4 profile distance is `0.00485–0.01155`, signed Canvas/WebGL chroma correlation is `0.76704–0.95678`, and repeated-off RGB is exact zero.
- Release validation passes all 93 test files / 597 tests, the 812-module production build, and 19-file static asset closure. The independent renderer-wide true-8× gate proves the enabled final shader, all 217 material projections, exact input, topology controls, and both recovery paths at requested/effective `8/8` and 4896×3072; eight completed GPU-fence frames are `4747.4/4790.7/4843.2 ms` median/p90/max. It retains exact zero wheel-anchor error, full Local/Smooth powder recall, square deep-zoom Grains, and camera/state-preserving forced-stall plus context-loss recovery to Canvas 2× with `0.0159`-cell footprint error. The four-card off→on→off topology proof remains the dedicated paired 2× gate; it is not claimed as a separate true-8× capture. No Chrome process remains.

## Next sequence

1. Make conductor-aware SPRK the active visible reaction-family slice. Preserve the sparked conductor's exact native owner and lifecycle so metal, semiconductor, switch, sensor, and other supported hosts do not collapse into one generic electric decal. Follow it with other coherent radioactive, channel/device, source/force, organic, and reaction-product families.
2. Continue broader exact-family coverage for palette-led and reaction-produced materials while deepening composed fit-view optics for packed powders/solids, liquids, gases, translucent matter, devices, organic matter, and radioactive/energy families. Prefer shared family grammar and phase continuity over isolated palette decals.
3. Judge every tranche at ordinary fit view as well as diagnostic zoom. Require coherent body readability, stable silhouettes and contacts, exact thin structures and authored holes, Canvas/WebGL parity, bounded allocation/profile evidence, exhaustive reaction-product visibility, and a true-8× safety run before checkpointing. Preserve viewport/input correctness as a regression invariant rather than reopening its architecture during visual work.

## Goal emphasis after the current major phase

- With the correctness, LIFE/cellular, botanical, SPNG, and focused virus-family phases complete, allocate the clear majority of development effort to material coverage and graphics. Infrastructure, viewport, input, CI, and deployment work is maintenance-only unless it blocks use, release validation, or visual evaluation.
- Expand native material identity in coherent families rather than accumulating palette-only exceptions. Prioritize devices and sensors, unusual solids and powders, reaction/phase products, radioactive and energy matter, growing/living materials, and the remaining liquid and gas subfamilies. Anything the native simulation can create must stay renderable even when it is not directly selectable.
- Judge visual work at ordinary fit view as well as diagnostic zoom: smooth but topology-safe silhouettes, stable unlike-material contacts, material-specific mesostructure, depth-aware colour and transparency, restrained reflection/refraction/emission, volumetric gas continuity, and readable isolated particles. Preserve exact semantic occupancy, authored holes and thin structures, square Grains mode, native walls, and species ownership.
- Prefer shared bounded fields and analytic presentation over full-frame blur or per-material passes. Each material tranche must include Canvas/WebGL parity, deterministic off/on/off visual proof, exhaustive atlas coverage, allocation/profile checks, and a true-8× safety run before checkpointing.

The next material-primary slice is wider exact coverage of palette-led catalog families and reaction products, followed by richer composed optics for packed powders/solids, liquids, gases, translucent matter, devices, organic matter, and radioactive/energy families. The completed LIFE/cellular, botanical, SPNG, gas/liquid, energy/radioactive, and virus systems are the reference architecture: exact semantic ownership, bounded RGB-only identity layered into shared depth/lighting, deterministic off/on/off topology proof, composed fit-view evaluation, and renderer-wide true-8× recovery evidence.

## Patterned native-wall refraction (`76fb75d`, committed and live)

- The deterministic render-lab backend now owns an independent TPT-shaped 4x4 wall plane, allowing particles and walls to coexist without granting that capability to the ordinary deterministic fallback. Patterned walls sit only inside eroded Glass/Ice/Metal fixture interiors, so the background cannot create support in matrix gaps or rounded-capsule corners.
- Canvas and WebGL implement zero-fetch semantic refraction for exact Glass and Ice. They move only the allocation-free procedural wall-pattern coordinate; wall ID, wall texture support, wall alpha, particle alpha, material ownership, cavities, and physics remain unchanged. Canvas fixes the prior Glass parity bug by source-over compositing translucent matter onto the existing wall. WebGL changes only its existing final wall-backdrop term. Glass uses one coherent clear-lens phase; Ice averages opposing stable facets. No texture, pass, upload, persistent buffer, or framebuffer backbuffer was added, preserving true-8x memory bounds.
- Refraction has a separate audit toggle from emission-field transmission. The browser captures off→on→off with all scene light unchanged, samples eroded patterned Glass/Ice interiors, and requires a bipolar low-bias response, bounded peak, clear/frosted magnitude distinction, exact repeated-off stability, matched opaque-Metal zero response, and identical straight/refracted support. The current paired visual-only gate passes with zero browser errors: Canvas/WebGL Glass RMS is `2.18/1.50` with `0.99/0.953` bipolar balance; Ice RMS is `1.54/1.13` with `0.837/0.822` balance; Metal and repeated-off response are exactly zero.
- The pathological full-612x384 Canvas Glass-over-wall helper profile measures `14.99/15.58/17.05 ms` median/p90/max including diagnostic pixel reset. Production runs it only for exact dense Glass/Ice cells with a coexisting wall and performs no allocation or field sampling.
- Local validation passes TypeScript, all 50 test files / 264 tests, the 772-module production build, the 20-file static asset closure, script syntax, and complete forced-Canvas and runtime-WebGL browser audits with zero browser errors. Both backends preserve exact straight/refracted support; Canvas retains exact cursor/zoom/pan/mobile semantics, and WebGL proves true requested/effective 8× at 4896×3072 with unchanged CSS geometry. The WebGL SwiftShader timer retained 30 usable samples and zero discarded at `139.54/159.21/185.37 ms`. Canonical captures are `.artifacts/patterned-refraction-canvas2d.png` and `.artifacts/patterned-refraction-webgl.png`, with mobile/configured-source/LIFE companions. Actions run `29693212583` built, deployed, and verified the exact checkpoint; the independent live closure check also passed all 20 resources on its first attempt.

## Exact-solid contact depth and prismatic caustics (`ae8dcdb` + `4ee5544`, committed and live)

- Unlike exact solids still share one smooth categorical support surface, but their internal contact is no longer a flat palette cut. The four WebGL occupancy samples now return compatible support plus a different-solid bit; the same Hermite derivative already used for the outer contour produces a signed contact scalar without another texture read. Canvas rejects uniform interiors once per world cell, then computes the matching bevel only near a real seam at each 2×/4×/8× contour sample. The effect changes RGB/normal response only and stays bounded, bipolar, and localized; alpha, material ownership, cavities, walls, and outer support are untouched.
- Exact dense Glass and Ice reuse the existing signed solid macro-relief for a nearly luminance-neutral spectral band. Glass keeps a stronger coherent split while Ice reverses and softens it. Opaque Metal is an exact no-op. There is no new pattern evaluation, field sample, texture, upload, pass, persistent byte, framebuffer target, or time term, so true 8× remains inside the existing single-target budget.
- The browser audit exposes an independent solid-contact toggle and captures flat→depth→flat while all other lighting/refraction remains fixed. It measures luma/RGB/chroma response around the authored wavy Metal/Glass seam and dense Glass/Ice, requires repeat stability and Canvas/WebGL magnitude parity, and compares blank-differenced support exactly. Fresh forced-Canvas, runtime-WebGL, and paired visual-only gates pass with zero browser errors; Metal response and repeated-off RGB are exactly zero, and both contact/prism support regions are unchanged. Retained A/B captures are `.artifacts/contact-depth-paired-{canvas2d,webgl}-{flat-contact,depth-contact}.png`.
- Local validation passes TypeScript, all 50 test files / 266 tests, the 772-module production build, 20-file static asset closure, paired visual A/B gates, and the complete Canvas/WebGL interaction-responsive-native audit with zero browser errors. Exact desktop stroke mapping, anchored wheel zoom, 42×27 CSS-pixel middle pan, resize round trips, mobile one-touch paint/two-touch pan-pinch, configured sources, and all LIFE presets remain intact. WebGL again proves requested/effective 8× with a 4896×3072 backing and unchanged 889×557.8 CSS canvas; its 30 usable SwiftShader GPU samples had zero discarded at `141.74/159.51/225.33 ms`. The profiler still reports exactly `8,173,320` shared field bytes and unchanged runtime Canvas scratch. Its pathological full-world caustic loop is `7.83 ms` median including RGB initialization; ordinary rendering additionally requires exact dense Glass/Ice. The all-world Glass-over-wall refraction diagnostic is `14.51/14.64/14.65 ms` median/p90/max. Canonical captures are `.artifacts/contact-depth-final-{canvas2d,webgl}.png` with mobile/configured-source/LIFE companions. Actions run `29694807401` restored all build caches, recorded 269/270 C++ cache hits, deployed exact revision `4ee554457c903be21c514c44ec08f09a3cf54ddc`, and passed both built-in and independent 20-resource live closure verification.

## Current analytic curvature, lens depth, and robust true 8×

- Canvas and WebGL derive signed solid-contour mean curvature from the four existing Hermite occupancy samples and analytic first/second derivatives. Only real non-emissive solid contours receive a bounded family gain; powders, straight edges, dense interiors, alpha, support, cavities, and ownership are unchanged. Rounded/notched Metal, Plant, and DTEC fixtures independently toggle the effect flat→curved→flat and retain exact support.
- Exact Glass and Ice now have a separate RGB-only lens shell using already-computed macro relief and edge light/Fresnel. A continuous asymmetric wall card reaches the translucent shoulders; Glass displacement follows the signed shape normal with an undisplaced optical centre, while Ice remains stably faceted. The matched opaque refraction control moved to the wall-backed Metal/Glass contact capsule so the wall-free Metal plate can measure curvature without fixture coupling.
- Canonical visual-only gates pass independently in forced Canvas and runtime WebGL with zero browser errors. Canvas/WebGL Metal convex response is `0.75/0.62` RMS, flat edges and dense cores are exactly zero, Glass lens response is nonzero, opaque Metal remains exactly zero, and every toggled support/world-area comparison is identical. Retained captures are `.artifacts/curvature-lens-canvas-latest.png` and `.artifacts/curvature-lens-webgl-latest.png`.
- `?renderScale=8` remains a real `4896×3072` WebGL target. The dedicated browser proof reports requested/effective `8/8`, identical 2×/8× CSS geometry, and zero browser errors. A cold 8× candidate now has a bounded 30-second promotion window while the ≤4× Canvas fallback remains visible; lower scales keep the 10-second deadline. No second 8× target, field, texture, upload, or render pass was added.
- Final local validation passes TypeScript, 50 test files / 271 tests, the 772-module production build, 20-file static asset closure, script syntax, allocation/profile diagnostics, independent and paired Canvas/WebGL visual gates, the complete desktop/mobile/native browser audit, and the isolated true-8× proof. Shared field storage remains exactly `8,173,320` bytes; the pessimistic all-world lens-shell loop measured `11.25/11.58/12.61 ms` median/p90/max and adds no production allocation. The browser gate retained exact three-point painting, a continuous 25-cell left drag, `0.06002`-cell 2× wheel anchoring, exact `42×27` middle pan, `0.03681`-cell zoomed resize anchoring, exact 1×/2×/8× CSS geometry, a `378×378` mobile panel with `1.431×` pinch plus 22 px pan and zero stray cells, configured source `126→2`, all 24 LIFE presets, and zero browser errors.
- Commit `4a58c4f` is pushed on `main_codex`. Manual cached run `29697265702` completed build in 1m36s, Pages deployment in 8s, and exact-revision verification in 7s. Both its verifier and an independent post-run invocation matched all 20 live resources on attempt one. Local Chrome cannot traverse the external Pages URL in this execution environment because its injected proxy type is unsupported, but the same browser passed the complete local runtime audit and Node fetched the full cache-busted live closure successfully; no Chrome or Vite process remains.

## Current coherent liquid lens and 8× safety

- Exact semantic non-emissive liquids now bend a coexisting native-wall pattern without sampling a framebuffer. Each optical family supplies one coherent stable body displacement; the existing phase-categorical outer slope adds bounded shore curvature. Water and Oil therefore remain visibly distinct without the earlier 32-cell time-independent ripple, whose repeated discrete pattern jumps read as sliding tiles.
- Canvas and WebGL both reject reconstructed empty support as a refraction owner because it cannot prove species, optics, or emissive state. Dense reconstructed support may stabilize a neighbouring semantic liquid's shore classification, but its own wall pattern stays straight. Unlike-liquid seams do not become outer slopes, while Lava/molten and all emissive liquid are exact no-ops. WebGL displacement is integer-quantized in world-cell space, so supersampling cannot change pattern phase inside one particle cell.
- The deterministic atlas now has independent Water/Oil calibration cards and a wall-backed Lava block with one reconstructed pinhole. The off→on→off browser sequence requires Water/Oil response, exact opaque-Metal and molten/pinhole zero controls, repeat stability, unchanged liquid support, and Canvas/WebGL magnitude parity.
- The path adds no texture, field, lookup allocation, upload, render pass, framebuffer copy, secondary target, time term, or alpha/support mutation. True WebGL 8× therefore retains its single `4896×3072` target and the temporary Canvas compatibility renderer remains capped at 4×. Canvas's pathological all-world wall-backed liquid helper is explicitly profiled against straight wall presentation; production additionally requires authoritative semantic liquid over a native wall.
- Current local validation passes TypeScript, all 50 test files / 273 tests, the 772-module production build, the 20-file runtime asset closure, script syntax, diff checks, the independent forced-Canvas visual gate, and the complete paired interaction/mobile/native audit with zero browser errors. The WebGL proof reports true requested/effective 8×, a `4896×3072` backing with unchanged `889×557.8` CSS geometry, 30 usable GPU queries with zero discarded at `155.17/172.68/190.27 ms`, exact `42×27` middle pan, and a `378×378` mobile panel with `1.431×` pinch plus 22 px pan and zero stray cells. Retained captures are `.artifacts/liquid-refraction-full-{canvas2d,webgl}.png` with mobile/configured-source/LIFE companions.
- Commit `c96dee8` is pushed on `main_codex`. Manual cached run `29699378042` completed build in 1m24s, Pages deployment in 12s, and exact-revision verification in 6s. The workflow verifier and an independent post-run invocation both matched all 20 live resources on attempt one. The successful primary ccache key already existed, so the save step correctly skipped; no Chrome or Vite process remains.

## Current atmosphere-primary gas and true-8× follow-up

- Canvas and WebGL now hand supported gas mass to the existing atmosphere field. Semantic Smoke/FOG/CFLM cells retain a restrained species accent, while dense clean/sooty optics, velocity detail, and emissive sparkle fade as continuous field ownership rises. Compact gas therefore reads as one translucent volume and sparse nearby carriers interpolate without filling deliberately authored gaps.
- Canvas uses one allocation-free bilinear atmosphere-alpha lookup per semantic gas world cell and a bounded local-emission alpha of 32 for emissive gas. WebGL adds only scalar gas-branch arithmetic and no texture fetch. The change introduces no texture, render target, field, upload, pass, persistent allocation, or supersampled-output loop. The final full-world Canvas gas-accent ceiling measured `13.39/13.55/13.82 ms` median/p90/max at 612×384 and is independent of render scale.
- The render lab now has deterministic pitch-four Smoke, FOG, and CFLM chains split by a 16-cell centre gap, plus compact FOG/CFLM bodies. Unit tests pin all authored carriers and gaps. The browser gate measures carrier/midpoint continuity, gap emptiness, compact connectivity, microcontrast, hue, clipping, and Canvas/WebGL exposure. Its reduced `--visual-only` result now includes all fields consumed by the paired comparator instead of silently skipping cross-backend assertions.
- Final strict paired visual validation passes with zero browser errors. Canvas warm gas-rim response is `5.16` red against WebGL `12.44`, within the established parity range; compact FOG stays neutral, compact CFLM stays blue and connected, and every sparse centre gap is empty in both backends. All 50 test files / 275 tests, TypeScript, the 772-module production build, 20-file static closure, script syntax, diff checks, and the allocation/profile diagnostic pass.
- True 8× remains enabled and robust: the focused WebGL browser proof reports requested/effective `8/8`, a `4896×3072` backing, unchanged `889×557.8` CSS geometry, and zero errors. No new 8× resource class exists; the temporary Canvas compatibility renderer remains bounded below the 60 MiB WebGL target. Two complete browser runs reached every per-backend visual, input, resize, mobile, native-source, LIFE, and true-8× assertion before the then-final paired gas-light calibration; the corrected strict paired visual run subsequently passed.

## Current family-aware solid scene-light follow-up

- Thick authoritative opaque solids now receive a bounded family-aware response from the existing coloured emission field. Exact-species optical depth protects the first layer and thin structures; the existing macro relief modulates broad reflection. Metal/rigid, organic, radioactive, and device bodies share the same scalar architecture but keep distinct response strengths and source chroma.
- Passive Organic, Radioactive, and Fibrous identity traits remain eligible. Active emitter, sink, channel, force, and carrier roles remain exact no-ops, as do powder, translucent rigid, walls, emissive matter, reconstructed support, and depth at or below one six-byte layer. RGB changes only; alpha, material ownership, support, fields, textures, passes, targets, uploads, and allocations are unchanged.
- The compact emission field uses a nine-tap binomial kernel at its established one-third resolution, expanding smooth world-space reach without a shader fetch or supersampled-output cost. Canvas also invalidates its existing supersampled contour cache when solid-field lighting changes; otherwise the cached opaque contour plane conceals the correctly relit base RGB.
- A dedicated deterministic browser fixture places thick Metal, Plant, VIBR, and DTEC blocks beside isolated warm/cool sources and keeps Sand, Glass, and CLNE as controls. The focused off→on→off gate passes with zero browser errors. Canvas/WebGL RGB RMS is `2.34/2.53` Metal, `1.57/1.39` organic, `1.87/1.43` radioactive, and `3.44/3.81` device; peaks are 4–9 bytes, every control and repeated-off sample is exactly zero, support/world area is identical, and backend ratios remain bounded.
- Canvas rejects world cells outside the emission field's localized bounds before evaluating body exposure or bilinear light. The production-shaped localized-source profile is `2.95/3.43/3.61 ms` median/p90/max; the deliberately pathological all-world/all-field ceiling is `72.04/81.36/90.88 ms`. Emission-field rebuild is `4.56/4.67/6.44 ms`, its allocation remains `1,357,824` bytes, and combined render-field allocation is `12,051,464` bytes.

## Current powder-family optics follow-up

- The palette's existing optics byte now separates mineral, crystalline, sooty, and metallic/reactive granular material. Sand, Dust, Clay, and Concrete retain the mineral response; Salt/Snow/Quartz/BGLA/FRZZ/SLCN receive a cool crystalline key and sparse glint; Gunpowder/Coal/BCOL become lower-reflectance sooty matter; Thermite/BREC/BRMT receive a warm metallic key with a cooler shadow. Radioactive and organic powder identities retain their existing semantic optics.
- Canvas and WebGL reuse canonical RGB, the existing powder density/gradient/support field, stability, exact-material bulk depth, and already-live per-cell facets. The new families change RGB only. No field, texture, sampler, upload, framebuffer target, render pass, or output-scale resource was added; the same palette lookup carries the expanded class. Combined render-field allocation remains exactly `12,051,464` bytes.
- WebGL powder topology now keys from physical powder phase (`family == 4`) rather than the granular toolbox profile. SEED, YEST, PLUT, URAN, BVBR, POLO, SING, DMG, GBMB, and other non-granular-profile powders therefore enter the same Grains/Local/Smooth silhouette and empty-side safety logic as ordinary mineral powders, while their optics remain family-specific.
- The focused powder off→on→off browser gate measures the existing Sand, Dust, Salt, Gunpowder, and Thermite atlas row. Both backends retain a bounded nonzero response, crystalline and metallic spectral direction, lower sooty reflectance, exact repeated-off frames, complete Clay/Concrete occupied-cell recall, zero deep-hole leakage, an exact isolated-Sand no-op, and identical five-tile composed support. The exhaustive material-atlas gate renders all 217 identities in Canvas and WebGL with exact 81-cell semantic ownership and zero browser errors.
- The deliberately pathological full-612×384 Canvas loop is `32.90/45.60/48.38 ms` median/p90/max with all four optics interleaved, versus `28.57/41.02/42.98 ms` for the preceding single-mineral worst case and a `1.26/1.31/1.36 ms` loop baseline. Production evaluates this only for stable, deep, supported powder cells and pays no supersampled-output loop.
- The dedicated true-8× browser proof passes at requested/effective `8/8` with a single `4896×3072` WebGL target, complete Local/Smooth notched-column recall, zero deep-hole leakage, an 8×8 fully filled zoomed Grains cell, all 217 material identities visible, successful forced-stall/context-loss fallback, and zero browser errors. SwiftShader's eight retained fence samples were diagnostic only (`3546.8/4081.5/4186.4 ms`) and had zero discarded queries.

## Current liquid-family meniscus follow-up

- Connected exposed liquids now use two stable Hermite-density optical zones in Canvas and WebGL: a bright family-coloured outer reflection and a deeper multiplicative absorption shoulder. The same analytic gradient owns both zones, so resting boundaries do not acquire time-varying sparkle. RGB changes only and remains clamped to an 18-byte incremental channel range; alpha, support, species ownership, physics, and dense cores are unchanged.
- The palette optics byte now has 19 stable classes. Water/Salt Water/Distilled Water/CBNW remain aqueous; Oil/Diesel/Nitro are oily/combustible; Acid/BASE/CAUS are corrosive; Lava alone is Molten. Liquid Nitrogen/LOXY/FRZW/RFGL are cryogenic, Mercury/LRBD are metallic, and Soap/GEL/MWAX/PSTE/RSST are viscous/film liquids. MWAX no longer inherits Lava's exact optical no-op.
- Cryogenic liquids receive cyan reflection and red-biased depth absorption, liquid metals receive the strongest near-neutral gloss with blue-gray absorption, and viscous liquids receive a broader pearlescent sheen with warm-biased absorption. Both presenters reuse the existing palette lookup, density/depth fields, gradients, sheen, and caustic signals. No texture, sampler, field, target, upload, render pass, output-scale allocation, or persistent byte was added.
- The focused off→on→off browser gate passes in Canvas and WebGL with distinct Water/Oil/Acid response, exact repeated-off frames, identical blank-differenced support, and exact no-ops for Lava, the authored Lava pinhole, dense Water core, an isolated Water cell, and the Water/Oil seam. Direct unit probes separately prove the outer reflected lip and inner spectral absorption for all six non-molten liquid families. The isolated-droplet WebGL gate now requires connected liquid support (`shape.w >= 1.5`), matching Canvas eligibility.
- All unit tests, the production build, and the 217-identity Canvas/WebGL atlas pass with zero browser errors and exact 81-cell semantic ownership. The true-8× gate passes requested/effective `8/8` on `4896×3072`, retains every powder/material invariant, and recovers to bounded 2× Canvas after forced stall and context loss. Its eight completed SwiftShader frames were `3463.5/3521.5/3529.1 ms` median/p90/max with zero discarded samples and zero browser errors.
- Combined render-field allocation remains `12,051,464` bytes. The deliberately pathological full-world Canvas contour fixture measured `100.65/104.43/110.59 ms` flat versus `170.75/179.07/216.12 ms` with the two-zone meniscus. This is an all-world 2× helper ceiling over repeating connected islands; production evaluates only dirty eligible contour chunks.

## Current typed-Lava ancestry checkpoint

- The native adapter now projects exact Lava `ctype` ancestry without changing native state. Bit 8 marks every authoritative Lava particle, while the low byte carries a public material ID only when it round-trips to the same upstream `PT_*`; generic or unrepresentable Lava therefore remains `0x0100`, and every non-Lava owner remains zero. The same exact-identity helper now serves configured-source projection instead of duplicating phase-fallback rejection.
- Real native tests heat QRTZ, METL, IRON, SALT, NSCN, and POLO through their official transitions, prove their exact typed Lava words, preserve them through OPS1, and cool them back to their official source materials. Generic Lava remains generic, Water stays state-less, and native `ctype` remains authoritative throughout. The rebuilt Wasm SHA-256 begins `9159a360017b0e1b`.
- Canvas and WebGL classify the exact projected origin into silicate, metallic, salt/mineral, electronic, or radioactive melt families and layer one bounded deterministic world-space spectral grammar over the existing molten body. The authentic origin set includes Sand/Ceramic/Quartz, Thermite/BRMT/HEAC, INWR and the semiconductor family, and PLUT/POLO/URAN. This is RGB-only arithmetic with an independent audit toggle: no texture read, field, sampler, upload, pass, target, persistent allocation, clock, alpha, support, species ownership, physics, or Lava-emission change was added.
- The deterministic six-card atlas covers generic Lava plus QRTZ, GOLD, SALT, SLCN, and POLO ancestry. It retains authored holes, an open notch, one-cell structures, isolated Lava, literal zero-state Lava, wrong-owner Sand, Water, cooled solids, and guarded blanks. The paired production-bundle gate passes with exact flat→styled→flat repetition and zero browser errors. Canvas/WebGL ancestry response ratios are `0.7821–0.9351`, profile distances `0.00694–0.01560`, and chroma cosines `0.89583–0.98164`; every untyped and protected control is byte-exact.
- Release validation passes all 110 test files / 687 tests after the final test correction, TypeScript, the 830-module production build, 19-file asset closure, the existing liquid-identity regression, and the complete renderer-wide true-8× gate. True 8× remains requested/effective `8/8` at `4896×3072`, with eight GPU-fence samples at `5388.8/5463.9/5560.6 ms` median/p90/max, full 217-identity atlas stress, exact deep-zoom input/topology checks, camera/state-preserving forced-stall and context-loss recovery, and zero browser errors. No Chrome process remains.

## Current native botanical-lifecycle checkpoint

- The native adapter now projects authoritative botanical state without changing upstream ownership. Exact SEED stores native absorbed water in bits 0–7 and its bounded germination `life` timer in bits 8–15; semantic SEED ownership makes a real dry/dormant zero word unambiguous. Exact PLNT retains native tree, phase, direction, and six inherited-colour bits verbatim in bits 0–11, classifies native water in bits 12–13, marks active growth in bit 14, and reserves bit 15 as the exact PLNT owner marker.
- Real native tests prove five-WATR hydration, soil-supported timer advancement, official SEED→PLNT growth, exact SEED and active tree PLNT OPS1 round trips, no-water/no-soil/bad-temperature controls, and authentic high-temperature/high-pressure SEED→MWAX. No JavaScript state machine or test-only native setter was added. The project-local Emscripten 6.0.3 rebuild produced Wasm SHA-256 `b05107d26c09ad1cc179d41b205124c56d2daac1c42d9cc6b69f1608589ec444`.
- Canvas and WebGL add a separate deterministic RGB-only lifecycle layer after ordinary botanical/body styling. SEED water cools and swells the husk while the native timer opens a germination seam and root cue. Tree-grown PLNT approaches the upstream eight-colour inherited canopy palette and receives phase/direction veins, hydration variation, and active growth tips. Dry SEED, presence-only PLNT, hydrated/active non-tree PLNT, wrong owners, controls, and absent state are exact no-ops. The implementation adds no neighbour sample, texture, field, pass, target, upload, allocation, clock, alpha, topology, or output-scale resource.
- The paired eight-card production-bundle gate preserves exact semantic/state words, authored holes and notches, one-cell structures, isolated owners, controls, and flat→styled→flat repetition with zero browser errors. Seed response progresses monotonically in Canvas `1.733→3.518→4.292` and WebGL `1.753→3.614→4.566` RGB RMS. Green/cyan/magenta canopy responses remain distinct with minimum pair distance `60.4679/51.8708`; paired magnitude ratios are `0.7908–1.1502` and chroma cosines `0.94817–0.99963`.
- Release validation passes all 112 test files / 699 tests, TypeScript, the 832-module production build, 19-file asset closure, native Wasm rebuild, and the complete renderer-wide true-8× gate. True 8× remains requested/effective `8/8` at `4896×3072`; eight GPU-fence samples are `5522.1/5555.7/5647.7 ms` median/p90/max with zero discarded samples. Full 217-identity atlas stress, Local/Smooth powder support, square deep-zoom Grains, anchored wheel and exact semantic/framebuffer click, forced-stall recovery, context-loss recovery to camera-preserving Canvas 2×, and zero browser errors all pass. No Chrome process remains.

## Current conductor-aware SPRK checkpoint

- The native adapter now projects exact authoritative SPRK presentation state without changing native particle ownership: the public, round-trippable sparked-host ID is held in bits `0–7`, native lifetime (`life`, clamped to `127`) in bits `8–14`, and bit `15` marks an exact SPRK owner. Unrepresentable hosts and every non-SPRK material are state-less. Native tests cover METL, PSCN, NSCN, GOLD, IRON, and WATR hosts, native `life 4→1`, OPS1 save/load, restoration, and the special WIRE path.
- Canvas2D and WebGL use the same bounded RGB-only host/lifetime grammar for metallic, semiconductor, thermal, electrode/device, and aqueous hosts. Unknown host state and WIRE are exact style no-ops; styling adds no clock, field, sampler, pass, target, output-scale resource, alpha/support/ownership change, or physics change. The UI exposes an independent audit toggle.
- The paired six-card production browser gate preserves bodies, holes, notches, thin lines, isolated particles, zero/present-but-unrepresentable state, wrong-owner, Water/Metal, and blank controls. Flat→styled→flat is exact and browser errors are zero. Canvas’ existing local fire composition limits the cue to restrained chroma; WebGL retains the richer host-family colour, with bounded paired amplitudes and chroma cosine at least `0.25`.
- Local release validation passes TypeScript, all `114` test files / `712` tests, the `834`-module production build, and 19-file asset closure. The full renderer-wide true-8× gate remains requested/effective `8/8` at `4896×3072`, with all 217 material identities, input/topology contracts, and both recovery routes passing; eight retained GPU-fence frames measured `5612.9/5643.3/5678.2 ms` median/p90/max with zero browser errors. No audit Chrome process remains.

## Active material-and-graphics goal after this checkpoint

- Typed Lava, authoritative botanical lifecycle, and conductor-aware SPRK close the current native-state foundation phase. From the next tranche onward, spend the clear majority of effort on visible material quality and composed scenes; native state work is only pursued where it makes the visual behavior truthful. Viewport/input, CI, deployment, and layout are regression-maintenance only unless they directly block use or a material release.
- The material menu now preserves the user's expanded category while a brush selection rebuilds its tiles; temporary search/filter expansion never overwrites the normal all-tools category state. This is a protected desktop and mobile UI contract alongside input mapping.
- SPRK is the last narrow native-state checkpoint before the effort shift. The following visual milestone is a composed material showcase at normal fit view covering a packed powder/earth pile, hard and translucent solids, a deep liquid body with an unlike-liquid seam, a sparse-to-dense gas volume, emissive energy, living growth, devices, and radioactive reaction products. Use it to direct improvements that are visible in ordinary play rather than only in diagnostic atlases.
- Within that showcase, prioritize three cross-material graphics systems: stable curved silhouettes that preserve one-cell detail, material-scale body structure and thickness, and scene-coupled light/contact response. Add exact native state only where it changes behavior or makes one of those visible systems materially more truthful.
- Expand exact native coverage in coherent behavior families: radioactive transformations, sources and forces, plants/growth, devices/sensors, reactive phase products, and the remaining unusual liquid/gas/powder/solid families. Preserve official reactions, phase changes, `ctype`/`life`/`tmp` state, OPS round trips, and renderability of nonselectable products.
- Deepen composed aesthetics at ordinary fit view: stable curved silhouettes that retain fine structures, family-specific mesostructure, optical thickness, directional light and contact grounding, bounded transparency/reflection/refraction, cohesive liquid bodies, volumetric gas, readable energy emission, and distinct isolated particles. Prefer shared fields and sample-free family arithmetic over per-material passes or full-frame blur.
- Every material tranche must keep exact semantic ownership, authored holes, thin structures, unlike-species contacts, native walls, square Grains, and Canvas/WebGL parity. Require deterministic off→on→off captures, relevant native/OPS proof, full-atlas visibility, production build closure, a real runtime-GLSL gate, and renderer-wide true-8× completion/recovery before checkpointing.

## Current normal-fit showcase and Canvas liquid-volume follow-up

- `?scene=showcase&renderScale=2` now provides a deterministic paused material
  composition using the ordinary field renderer. It deliberately contrasts
  with `render-lab`: the latter remains an exact sparse diagnostic atlas,
  while the showcase makes connected Water/Oil, packed granular/rigid bodies,
  gas volumes, botanical forms, energy, and device optics readable at a
  normal fit view. It uses the same in-memory no-autosave diagnostic backend.
- Canvas now reuses the existing WebGL broad-sheen/caustic coordinate grammar
  for dense, same-species liquid bodies. The new helper is world-anchored,
  bounded, RGB-only, allocation-free, and runs only after existing cohesive
  liquid support and exact semantic eligibility gates. Sparse droplets,
  reconstructed support, seams, traits, emissive liquids, Molten/Lava, alpha,
  material ownership, physics, and output-scale cost remain untouched.
- The Canvas fallback's Water body now carries broad reflected/shadowed bands
  instead of a flat uniform fill. Production captures are retained locally as
  ignored `.artifacts/showcase-canvas-volume-sheen.png` and
  `.artifacts/showcase-webgl-current.png`; no WebGL shader changed in this
  tranche. Current validation passes all `114` test files / `716` tests,
  TypeScript, and the 834-module static-closure production build. The exact
  current-bundle true-8× browser gate completed the 217-identity atlas,
  input/topology, configured-source/VIBR/DEUT state, forced-stall, and real
  context-loss paths with zero browser errors. It retained requested/effective
  `8/8`, a `4896×3072` backing, 8 GPU-fence samples at
  `5751.4/5831.5/5938.6 ms` median/p90/max, full Local/Smooth recall, and
  camera-preserving Canvas recovery. Next checkpoint: commit and push
  `main_codex`; deployment remains intentionally manual after GitHub login.

## Current Canvas normal-fit solid and liquid efficiency follow-up

- Thick SmoothRigid/rigid Canvas bodies now use a stronger but still bounded
  existing reflected-body range (`4.0` rather than `2.4`). The response uses
  only the precomputed signed relief and exact-species optical-depth byte; it
  stays RGB-only, retains the established ten-byte crown/pocket bound, and
  makes the normal-fit rigid body luma span exceed eleven bytes without
  changing alpha, contours, cavities, walls, semantic ownership, or physics.
- Canvas liquid macro relief keeps its broad reflection/caustic read while
  reducing hot-path trigonometric work from four evaluations to two coupled
  waves. It remains world-anchored and continuous, and the existing
  same-species cohesive-field/trait/emissive/wall gates still own eligibility.
  No new field, texture, sample, upload, pass, allocation, or output-scale
  work was added; WebGL's richer semantic shader remains unchanged.
- The normal-fit forced-Canvas capture is retained as ignored
  `.artifacts/showcase-canvas-solid-liquid-two-wave.png`. Current validation
  passes all `114` test files / `717` tests, TypeScript, and the 834-module
  production static closure. The exact current-bundle 8× gate completed in
  `539963 ms`, retained requested/effective `8/8` and `4896×3072`, completed
  eight GPU-fence frames at `5625.3/5763.6/5774.0 ms` median/p90/max, retained
  atlas/input/topology/native-state coverage plus forced-stall/context-loss
  Canvas recovery, and reported zero browser errors. Next checkpoint: review,
  commit, and push `main_codex`; manual Pages deployment still awaits GitHub
  login.

## Current dense unlike-liquid interface checkpoint

- Dense exact Water/Oil-style contacts now receive a shared, restrained
  family-coloured optical rim in Canvas2D and WebGL. It is driven only by the
  existing species-safe liquid RGB/alpha field and the already-computed
  cardinal interface slope: no material is averaged, no semantic cell is
  claimed, and no alpha, support, topology, ownership, physics, field,
  texture, sampler, target, pass, upload, allocation, or output-scale resource
  changes.
- The contact response is symmetric across either owner of the same boundary
  and capped at six Canvas RGB bytes per channel. It is enabled through the
  existing liquid-volume diagnostic toggle, is limited to dense ordinary
  liquid/liquid contact away from native walls and foreign solid/gas contact,
  and remains an exact no-op for sparse field support, zero contrast, traits,
  emissive liquids, Molten/Lava, reconstructed support, and ordinary
  liquid-air silhouettes. The pre-existing signed optical normal remains in
  place; the new rim prevents that normal from reading as a constantly changing
  dark seam.
- The focused helper probes prove the two directional signs produce the same
  rim, preserve alpha, stay within six RGB bytes across aqueous/oily/corrosive/
  cryogenic/metallic/viscous families, and retain every protected no-op.
  Local validation passes all `114` test files / `718` tests and the
  834-module production static-closure build.
- The exact current-bundle true-8× browser gate completed in `554799 ms` with
  requested/effective `8/8`, a `4896×3072` WebGL backing, eight completed
  GPU-fence frames at `5605.3/5657.5/5693.8 ms` median/p90/max, full
  217-identity atlas plus deep-zoom input/topology/native-state checks, and
  both forced-fence and real context-loss camera-preserving Canvas recovery.
  It reported zero browser errors and left no audit Chrome process. Next
  checkpoint: commit and push `main_codex`; Pages deployment remains manual
  pending GitHub login.

## Current stable tool-menu regression checkpoint

- Selecting an element now updates the selected tile in place instead of
  rebuilding the library. The user's scroll position and every category's
  disclosure state therefore remain intact: selecting an Electronics brush no
  longer jumps the panel back to or opens Powders.
- The production-browser native-semantic audit explicitly closes Powders,
  opens Electronics, scrolls the library, selects ARAY, and proves that the
  selected button, scroll offset, and both disclosure states are unchanged.
  This covers the desktop and mobile shared control path rather than only DOM
  unit behavior.
- The exact current-bundle 8× browser gate completed with zero browser errors
  after the new assertion, including atlas, deep-zoom, material/native-state,
  forced-fence, and real context-loss recovery checks. Its audit-owned Chrome
  session terminated cleanly. Next checkpoint: commit and push `main_codex`;
  Pages deployment remains manual pending GitHub login.

## Current gas forward-scatter shell checkpoint

- The shared low-density gas-volume chroma response now gives sparse billows a
  slightly stronger forward-scatter shell (`0.018`, previously `0.012`). This
  makes cloud fringes read as translucent volume at normal fit instead of a
  flat grey wash while keeping dense cores quiet. The response remains
  RGB-only, capped at the existing `0.060`, and uses the already available
  density, directional relief, and curvature—no alpha/support/topology,
  texture, sampler, field, pass, upload, allocation, or output-scale resource
  changes.
- Canvas2D and WebGL use the same shell equation. The focused helper test
  proves a visible sparse shell and an exact zero dense-core shell; existing
  hue, alpha-invariance, bounded-key/fill, and matter-control tests remain in
  place.
- The production-bundle true-8× WebGL gate completed in `529917 ms` with
  `4896×3072` backing, all atlas/deep-zoom/native-state stages, forced-fence
  and real context-loss camera-preserving Canvas recovery, and zero browser
  errors. The audit-owned Chrome session exited cleanly.
- GitHub login became available and manual run `30146876602` built and deployed
  this checkpoint. Its project-local Emscripten and ccache restores were hits;
  the compiler cache restored a prefix match, saved the new exact key only
  after the successful build, and reported `270/271` cacheable calls. Build,
  deploy, and CI live verification all passed. An independent live check then
  confirmed the exact full revision and all 19 runtime assets at Pages.

## Current Canvas sparse-liquid efficiency checkpoint

- Canvas liquid styling now computes its exact dense-body eligibility once per
  authoritative liquid cell and shares it with body optics, macro sheen, and
  volume chroma. Field-sparse droplets consequently skip the otherwise-unused
  animated macro-wave work; cohesive bodies retain the exact existing signal.
  Optical-depth styling still runs with a zero chroma response where required,
  so the change does not suppress established depth absorption.
- The optimization is presentation-preserving: the support scalar is the same
  module-static field-alpha/neighbour lookup already used by each helper, and
  all affected decisions remain RGB-only. It adds no fields, texture reads,
  uploads, passes, allocations, output-scale work, or WebGL changes; alpha,
  support, ownership, topology, physics, and native saves remain untouched.
- Focused coverage proves default and shared support produce byte-identical
  body/macro colours and identical chroma response, plus sparse/dense support
  controls. Local validation passes the focused `20`-test liquid suite, the
  complete `114`-file / `720`-test suite, TypeScript, and the 834-module
  production static-closure build.
- Manual workflow run `30147460442` then built, deployed, and verified this
  exact checkpoint. Both project-local Emscripten and ccache restored; saving
  the compiler cache correctly skipped because the exact successful cache key
  already existed. An independent live check confirmed revision
  `2c236ef7433bdeae24c4b5edd047f31533026958` and all `19` runtime assets at
  GitHub Pages.

## Current built-bundle visual-review checkpoint

- The browser audit now accepts `--production-bundle`, and the named
  `npm run audit:production-screenshot` command combines it with the focused
  screenshot path. It loads the already-built `dist` bundle directly instead
  of starting Vite, which keeps visual evidence independent of local
  dev-server navigation timing while retaining the same Canvas/WebGL semantic
  fixture and framebuffer assertions.
- Fresh 2× canonical captures completed in both WebGL and forced Canvas2D with
  zero browser errors. They confirmed field-composed gas volume, cohesive
  liquid bodies, smooth stable powder, material-family styling, Canvas
  fallback, and normalized Sand/Water suspension chroma while preserving the
  exact 612×384 fixture signature. The temporary audit Chrome process exited
  cleanly after the earlier dev-server navigation timeout.

## Current settled-powder body checkpoint

- Fully settled, exact-material Smooth powder now suppresses more of its
  interior cell/facet noise: Canvas converges its protected bulk albedo to
  roughly one-quarter residual variation, and WebGL reduces only the matching
  existing grain/facet amplitudes. This makes a dense pile read as a styled
  continuous material rather than a checkerboard of particles.
- The change is deliberately gated by the pre-existing stable exact-material,
  depth, lateral-support, trait, and emissive checks. It changes RGB only;
  silhouettes, alpha, semantic ownership, holes, fine columns, unlike seams,
  native walls, physics, and saves remain untouched. Local and the square
  Grains reference mode bypass the gate completely, as do loose/moving grains.
- Validation: the complete `114`-file / `720`-test suite, TypeScript, and the
  834-module production build pass. Fresh built-bundle WebGL and forced
  Canvas2D screenshot audits both report zero browser errors and preserve the
  canonical 612×384 fixture and Sand/Water phase contrast. The focused
  long-running paired powder-body audit should be run in a normal terminal
  before a release-scale 8× cycle; this tool environment cut its long Chrome
  session short, and the verified temporary audit profile was closed manually.

## Current normal-fit showcase review and aqueous-rim checkpoint

- `npm run audit:showcase-screenshot` now captures the paused, deterministic
  material showcase directly from the already-built bundle in forced Canvas2D
  or WebGL. It gives visual review one coherent scene (packed powder, connected
  Water/Oil, solids, gas, energy, plant, device, and radioactive matter) rather
  than requiring a sparse diagnostic atlas or a Vite server. The public
  showcase remains unchanged: only the opt-in audit query installs the frozen
  diagnostic clock.
- Fresh production captures showed that Canvas2D's field-proven exposed Water
  lip was too faint beside WebGL's existing Fresnel/top-lip response. Aqueous
  Canvas body optics now use a stronger blue-forward rim (`+9/+23/+31` RGB at
  maximum eligible exposure). It is still limited to a dense authoritative
  aqueous body with an actual field-proven empty surface; it adds no sampling,
  field, pass, allocation, alpha/support/ownership, topology, physics, or
  output-scale work. Sparse droplets, dense pinholes, unlike-liquid seams,
  Molten/Lava, and non-surface cores remain protected by the existing gates.
- Targeted helper and audit-query tests pass, as do fresh built-bundle Canvas2D
  and WebGL showcase captures with zero browser errors. Next checkpoint: run
  the complete suite, commit, and push; use the retained showcase command for
  subsequent composed-material art direction before selecting the next family.
- The full local suite then passed `114` files / `721` tests, with the
  834-module production build and 19-file static closure also clean. Commit
  `0ce9ae7` was pushed to `main_codex` and manual workflow run `30148564532`
  completed build, deploy, and Pages revision/asset verification successfully.
  Both the project-local Emscripten and ccache restores were hits; the compiler
  cache save correctly skipped its already-existing exact key. An independent
  live check confirmed that revision's complete 19-resource Pages closure.

## Current deep-rigid-core smoothing checkpoint

- Dense exact-species rigid interiors now turn down their remaining
  cell-frequency albedo progressively only after the existing phase-local
  solid optical-depth byte proves they are deeper than the first inner layer.
  Smooth rigid, organic, device, radioactive, and translucent families retain
  distinct bounded residual texture; granular matter remains an exact no-op.
- Canvas and WebGL use matching depth ramps with no new texture, field, pass,
  upload, allocation, or output-scale work. The effect is RGB-only and is
  downstream of the pre-existing exact-material/wall/hole/contact guards, so
  contours, one-cell structures, authored gaps, native walls, semantics,
  physics, and saves remain unchanged.
- Validation: focused Canvas/solid-depth/Pixi tests, the complete `114`-file
  / `722`-test suite, the 834-module production static-closure build, and
  forced Canvas2D plus WebGL normal-fit showcase captures all pass. The real
  true-8× browser gate reached reference-ready in `9488 ms` and fence-backed
  8× ready in `25145 ms` without browser errors.

## Current botanical canopy-volume checkpoint

- The protected viewport contract was audited again before this visual pass:
  focused `ViewTransform`, client-coordinate, input-controller, and
  browser-audit tests pass, and the complete desktop/mobile Canvas2D/WebGL
  browser interaction route completed without leaving a temporary Chrome
  profile. The existing 612×384 aspect-fit, client-CSS pointer mapping,
  anchored wheel/pinch, middle-drag pan, DPR/page-scale transition, and
  semantic-to-framebuffer footprint guarantees remain unchanged.
- Deep, exact PLNT interiors now reuse the existing phase-local solid optical
  depth and organic macro-relief to receive a bounded leaf-green crown/pocket
  body response. It is RGB-only and starts strictly beyond the first inner
  layer: native stems, leaf tips, branch gaps, seed products, walls, contacts,
  cavities, alpha/support, lifecycle state, growth simulation, and saves stay
  on their existing paths. Canvas and WebGL add only arithmetic—no sampler,
  field, target, upload, allocation, or output-scale work.
- Validation: the dedicated organic/plant Canvas+WebGL fixture, fresh built
  bundle Canvas/WebGL normal-fit captures, the full `114`-file / `723`-test
  suite, and the real true-8× gate all pass. The 8× gate reached reference
  readiness in `9326 ms` and fence-backed readiness in `25486 ms`; its one
  verified temporary `/tmp/anifor-input-*` Chrome profile was closed after the
  successful gate rather than affecting an ordinary browser session.

## Current stable catalog-navigation checkpoint

- Choosing an element no longer rebuilds the catalog: it updates only the
  selected state, so the active category, expanded groups, and library scroll
  position remain stable instead of jumping back to Powder. Filter controls
  now expose their full labels as native tooltips as well as accessible names.
- Desktop filter controls use a fixed 68px two-row scroll rail with four
  comfortably sized columns. Extra columns stay reachable through the visible
  horizontal rail instead of compressing all category labels; full labels also
  remain available through native tooltips. Mobile keeps a compact,
  snap-scrollable horizontal strip, preserving vertical room for the world and
  library.
- Validation: targeted Controls/catalog/input/browser-audit tests (`33`
  assertions), the complete desktop/mobile browser interaction audit, the
  834-module production build with its 19-file static closure, and the full
  `114`-file / `723`-test suite pass. They retain the protected 612×384 fit
  and client-CSS pointer contract.

## Current Canvas botanical-canopy parity checkpoint

- The existing deep-PLNT canopy-volume transform had already shipped in the
  WebGL semantic shader, but the Canvas call site had accidentally remained in
  the Wood branch, where the helper deliberately no-ops. It now runs directly
  after Canvas PLNT body optics, using the same exact-material interior,
  phase-local optical-depth, and organic macro-relief inputs as WebGL.
- This is RGB-only and starts beyond the protected first interior layer. Native
  plant/seed semantics, growth, lifecycle presentation state, alpha, support,
  silhouettes, branch gaps, contacts, walls, saves, and physics are unchanged.
  The Canvas showcase now visibly retains the restrained green crown/pocket
  volume already present in WebGL without smoothing or widening leaf edges.
- Validation: focused Canvas-botanical/solid/Pixi tests (`80` assertions), a
  fresh production build and 19-file closure, production Canvas and WebGL
  organic/plant browser audits with zero browser errors, and a refreshed Canvas
  normal-fit showcase capture pass. Both browser audits preserve authored
  cavities, open gaps, fine structures, Sand/Water contacts, and exact
  off→on→off repeats.
- The true 8× render-scale gate subsequently passed again at a 4896×3072
  backing, with reference readiness in `8791 ms` and the fence-backed true-8×
  frame in `24757 ms`. The gate also re-proved the fixed 68px/two-row desktop
  filter rail; its verified temporary Chrome profile was closed once the audit
  had completed.

## Current Canvas aqueous macro-sheen follow-up

- Side-by-side built-bundle showcase review found a real fallback parity gap:
  the Canvas Water pool retained its correct smooth body, glass boundary, Oil
  island, and semantic ownership, but its broad reflected band was too quiet
  next to the WebGL volume. Dense aqueous and cryogenic bodies now use the
  existing macro-sheen path at `0.160` strength rather than `0.095`.
- This is only a stronger RGB interpolation over the already computed,
  world-anchored two-wave signal. Existing dense field support, exact
  trait/emission/wall/unlike-liquid gates, and molten no-op remain authoritative;
  no alpha, silhouette, reconstruction, field, sample, texture, pass,
  allocation, output-scale cost, physics, or save state changes.
- The focused macro test now keeps an observable normal-fit aqueous reflected
  band while retaining its existing below-18-byte peak bound. The full 114-file
  / 724-test suite and 834-module static-closure production build pass. A fresh
  forced-Canvas production showcase capture reports zero browser errors and
  visibly preserves the pool's curved outline, Oil seam, glass boundary, and
  all non-liquid scene material while making its broad cyan volume easier to
  read at fit view.

## Current Canvas oil macro-sheen follow-up

- The adjacent Oil island remained intentionally darker than Water but too
  matte at fit view. Its existing dense-body macro sheen now uses `0.100`
  strength rather than `0.075`, remaining below the `0.160` aqueous/cryogenic
  response while making the warm reflected band legible.
- This reuses the exact existing world-anchored macro wave and dense-body
  support. The caller still excludes traits, emission, walls, and unlike-liquid
  contacts; alpha, coverage, species ownership, Water/Oil seams, liquid fields,
  physics, and saves are untouched. The new focused test pins a visible amber
  lift, a restrained shadow, alpha invariance, and the existing below-18-byte
  highlight bound.
- Validation before deployment: focused liquid/Pixi tests (100 assertions), a
  fresh 834-module/19-asset production build, and forced Canvas2D and WebGL
  showcase captures with zero browser errors.

## Current Canvas liquid identity hot-path checkpoint

- The normal eleven-material liquid-identity path now takes a direct indexed
  style route. Wax and the Paste/Resist family retain their separate exact
  motif and depth arithmetic, so their family-specific appearance is not
  folded into the common hot loop.
- This is a control-flow-only Canvas optimisation: it changes no fields,
  allocations, alpha, coverage, material ownership, topology, physics, save
  data, or WebGL output. The lightweight `profile:render-fields:quick` command
  was added for bounded local profiling when the full diagnostic profile would
  be inconvenient; on its synthetic eleven-material body fixture the measured
  identity-style median fell from roughly 40 ms to roughly 12 ms. Treat that
  as an environment-specific profiling signal rather than a frame-rate claim.
- Validation: focused liquid identity/wax/paste/light assertions (39), full
  114-file / 725-test suite, TypeScript production build with the 19-file
  static closure, and a forced Canvas2D production showcase capture with zero
  browser errors.

## Current Canvas curved liquid-band parity checkpoint

- Capture review showed that the Canvas Water body retained correct smooth
  coverage and depth, but its broad volume bands were largely vertical while
  WebGL already carried curved, crossed reflected and caustic phases. The
  Canvas macro scalar now mirrors those existing WebGL world-space phases:
  a two-axis reflected band plus a y-bent caustic. This gives cohesive liquid
  a more three-dimensional body read without trying to copy a shader result
  through a new image field or post-process.
- The result remains a bounded RGB-only scalar behind the existing exact
  species/cohesion, trait, emission, wall, seam, and Molten gates. Alpha,
  coverage, liquid ownership, reconstruction, interaction, physics, saves,
  fields, textures, buffers, passes, allocations, and output scale are
  unchanged. Sparse droplets remain on their semantic contour.
- Validation: focused liquid-light test now pins a continuous live y phase,
  typecheck, the complete 114-file / 725-test suite, a fresh 834-module /
  19-asset production build, and a forced Canvas2D production showcase capture
  with zero browser errors. The visual review confirms curved Water volume
  bands while preserving the showcase's gas, powder, solid, plant, and UI
  geometry.

## Current short-desktop catalog rail checkpoint

- A focused real-browser desktop input audit caught a genuine CSS regression:
  the two-row desktop filter grid had `overflow: hidden`, making category
  filters unreachable on a short desktop window. The protected 68px rail now
  exposes four 88px-minimum columns and scrolls horizontally for the remaining
  two-row columns. This replaces tiny, compressed labels with usable targets
  while keeping the rail's vertical size stable and avoiding overlap with the
  Brush/actions card.
- The change is presentation-only. It does not rebuild the catalog when a tool
  is chosen, so its active filter, expanded groups, library scroll position,
  selected tool, simulation state, and world canvas remain intact.
- Validation: production build/19-file static closure, Canvas desktop browser
  input audit with exact wheel-anchor error `0`, live DPR/page-scale anchored
  zoom error `0.0576` cells, continuous drag, middle pan, and both 1280x520
  and 1024x500 short-desktop rail/shell reachability; the catalog-selection
  browser audit also keeps the Electronics category and a `583.5` scroll
  position without replacing library children. A WebGL 2× layout gate also
  retains the 612×384 logical world at a 1224×768 backing with zero browser
  errors. The attempted broad audit was deliberately not counted because its
  outer harness ended before a result; its verified temporary Chrome profile
  was closed.

## Current Canvas cohesive-energy detail checkpoint

- Cross-backend review found that WebGL already calms cell-scale carrier detail
  inside emission-field-supported energy bodies, while Canvas applied the same
  scintillation at every density. Canvas now reuses the existing emission
  support scalar to blend only cohesive core RGB toward a low-frequency pulse.
  This makes dense energy read as one luminous volume rather than a collection
  of restless particles; sparse carriers retain their previous exact detail.
- The change is arithmetic-only and RGB-only: it adds no field, texture,
  sample, pass, buffer, scheduler, allocation, alpha/support/topology,
  semantic identity, glow, physics, or save-state change. It shares WebGL's
  existing dense-body presentation intent without modifying the shader.
- Validation: focused Canvas energy tests now prove reduced dense-core
  microvariation plus byte-identical glow/alpha and unchanged sparse behavior;
  TypeScript production build/19-asset closure, a forced Canvas2D production
  showcase capture with zero browser errors, and the full 114-file / 726-test
  suite pass. A broad visual gate was deliberately not claimed after its outer
  harness stopped before output; its verified temporary profile was closed.

## Current WebGL gas identity depth checkpoint

- Cross-backend review found that Canvas already gives each exact gas identity
  a small density-dependent body response after its shared atmosphere field is
  reconstructed, while WebGL used the same spatial motifs but retained a
  mostly universal dense-cloud response. WebGL now reuses the already decoded
  identity style and atmosphere density to add that matching bounded species
  depth: smoke, carbon dioxide, antimatter, and exhaust settle into restrained
  absorption; steam, oxygen, refrigerant, cold flame, and noble gas retain a
  recognisable dense-volume tint.
- This is an RGB-only arithmetic term within the existing WebGL identity
  branch. It creates no sampler, texture, field, pass, target, upload,
  allocation, time signal, alpha/support/silhouette change, physics, native
  save, or interaction change. Sparse semantic accents stay on the existing
  motif path until shared atmosphere density proves a coherent body.
- Validation: the focused Pixi presenter static-resource/alpha contract and
  TypeScript checks pass; the 834-module production build retained its
  19-asset closure; a real WebGL production showcase compiled with zero browser
  errors; and the true-8× browser gate reached its reference and promoted 8×
  presentation stages in 9.36 s and 25.05 s respectively.

## Current Canvas deep Smooth-powder cohesion checkpoint

- Cross-backend review found that Canvas retained 24–32% of cell-scale albedo
  variation throughout a settled Smooth-powder body, making the deepest Sand,
  Clay, and compact powders look visibly peppered compared with WebGL. Canvas
  now keeps the established shoulder response but ramps only dense, exact,
  stable Smooth interiors to 16% residual variation. Loose grains, Local and
  Grains modes, moving matter, fine columns, contacts, traits, emission, holes,
  support, alpha, topology, physics, and saves never enter this helper.
- The change is one bounded arithmetic blend using the existing powder-density
  byte after the prior bulk-depth gate. It adds no neighbour lookup, field,
  texture, buffer, pass, allocation, timer, output-scale cost, or semantic
  ownership decision. Existing family body lighting remains independent, so
  crystalline, sooty, metallic, and mineral powder retain their separate optics.
- Validation: focused unit coverage proves the unchanged 24% shoulder residual,
  exact 16% deep-core residual, and all previous confidence/no-op controls;
  TypeScript build and the 19-asset closure pass; a forced Canvas2D production
  showcase capture has zero browser errors and visually confirms a calmer packed
  material base. The paired powder-body browser gate was not counted because an
  outer harness ended it before it reported results; only its exact
  audit-owned Chrome profiles were terminated and they were confirmed gone.

## Current native-wall catalog coverage checkpoint

- A catalog-versus-native audit confirmed that ordinary material brushes,
  configured sources, LIFE presets, force/thermal tools, signs, radioactive
  elements, and botanical materials are already reachable through their proper
  semantic paths. It did find five valid native `bmap` wall types that the
  adapter accepts but the UI had omitted: Streamline, Absorb wall, Conductor,
  E-Hole, and Stasis wall. They are now exposed as Walls tools without ever
  treating a wall ID as a particle material ID.
- The stable catalog test pins the complete supported UI wall sequence (15
  types). Native-only Fan, Gravity wall, and destructive Erase All remain
  intentionally unavailable. This is catalog metadata only: particle/wall
  coexistence, wall save/load, renderer composition, and matter/tool dispatch
  are untouched.

## Current Pages deployment timeout checkpoint

- The `a6e86d0` static build, native tests, Pages artifact upload, and deployment
  creation all succeeded, but GitHub Pages held the service-side deployment in
  `updating_pages` until `actions/deploy-pages@v4` reached its default ten-minute
  timeout. That is an external promotion delay, not an artifact or runtime
  failure; the workflow log shows the expected revision was created before the
  polling timeout.
- The deploy action now retains its bounded retry behavior but waits up to 30
  minutes for that serialized Pages promotion. This keeps manual `build` versus
  `build-and-deploy` controls unchanged, does not alter the artifact, and avoids
  declaring a healthy release failed merely because GitHub Pages is slow. The
  next manual deploy must still be verified against the exact revision and
  19-asset live closure.

## Current Canvas empty-volume-plane checkpoint

- Canvas now tracks whether each broad volume/accent plane is actually visible:
  packed atmosphere support, compact emission support, semantic gas accents,
  and local particle emission. A truly inactive plane skips its offscreen
  transfer and full-output composite instead of drawing transparent pixels.
- Each plane is deliberately uploaded once on an active-to-inactive transition
  before it is skipped, so a stopped cloud or aura cannot leave stale pixels.
  Field cadence remains authoritative: the renderer uses the already rebuilt
  `AtmosphereField.hasVolume` and `EmissionField.hasLight`, rather than
  prematurely removing a still-valid scheduled field.
- This is a Canvas fallback-only scheduling improvement. It adds one scalar to
  the existing atmosphere field and four renderer booleans; it adds no image
  field, buffer, texture, simulation, support, alpha, topology, save, input,
  camera, or WebGL change. A settled solid-only view now proves zero invisible
  volume uploads and zero volume composites after any scheduled rebuild settles.
- Validation: focused field/style tests, complete 114-file / 730-test suite,
  production build, forced-Canvas solid-only browser assertion, and existing
  forced-Canvas gas/energy identity captures all pass with zero browser errors.

## Current native LIFE membrane/core checkpoint

- The 24 renderer-only LIFE projections retain their native `PT_LIFE` ctype
  identity and intentionally discrete live-cell topology, but their former
  stripe/node detail was applied before Canvas body optics and could be muted in
  a dense colony. Canvas now applies that exact-owner RGB motif after ordinary
  solid body optics, matching WebGL's composed ordering.
- Both presenters add the same static, world-anchored 16-cell micro-colony cue:
  a dim membrane around a tiny core, over the existing preset-specific
  stripe/node grammar. It is deliberately bounded to ten RGB bytes, has no time
  signal, neighbour read, texture, field, support, alpha, contour, allocation,
  physics, ctype, or save change, and never reconstructs a dead LIFE cell.
- Validation: focused Canvas/Pixi tests and production build, complete 114-file
  / 731-test suite, Canvas and WebGL 24-card LIFE atlas gates (including
  authored holes, isolated controls, blank controls, exact off repetition, and
  zero browser errors), plus true 4896×3072 8× promotion completion.

## Current native special-solid identity checkpoint

- The retained native LOLZ, LOVE, SPAWN, and SPAWN2 projections no longer fall
  through to generic solid styling. LOLZ carries a restrained face/ribbon
  lattice, LOVE a heart-quilt grammar, and the primary/secondary stickman
  anchors receive distinct warm/cool diamond beacons. All four remain native
  special-solid identities: no JavaScript actor state, synthetic glow, or
  semantic reinterpretation is introduced.
- The motifs are deterministic, world-anchored, and RGB-only. Canvas applies
  these four after dense-body optics so their sparse identity remains visible;
  WebGL layers equivalent arithmetic after its ordinary solid body path. No
  alpha/support/topology change, neighbour read, texture, field, pass, target,
  clock term, allocation, physics, or save-state change is involved.
- The existing unusual-solid fixture now covers eleven exact materials across a
  compact two-row 612×384 atlas, preserving each body’s authored cavity, open
  notch, one-cell spur, isolated particle, guarded blank, and Metal contact.
  Canvas and WebGL prove exact off→on→off return, unchanged backing support,
  distinct bounded responses, and shield-stage ordering. Local typecheck, the
  114-file / 731-test suite, production build with 19-asset closure, and the
  real paired unusual-solid browser gate pass with zero reported browser errors.

## Current PHOT spectrum/co-location checkpoint

- Native extraction now owns a separate 612×384 `Uint16` `photonStateField`.
  It reads `simulation->photons` independently of `pmap`, retaining a valid
  co-located PHOT while matter, walls, temperature, velocity, and the
  owner-multiplexed presentation state retain their existing ownership. Bit 15
  marks presence (including a valid black spectrum); the remaining nibbles are
  TPT's red/green/blue overlapping twelve-bit wavelength-band populations.
  The matching ABI export is listed in the tracked headless Emscripten patch,
  so a fresh project-local build exposes it rather than relying on a local
  generated-artifact accident.
- Canvas styles the spectrum into the final authoritative material colour
  before its phase surface is composed. WebGL uses an independent nearest
  texture and applies the equivalent RGB-only spectral core after ordinary
  matter and wall composition. Neither path changes alpha, occupancy, support,
  native walls, material identity, physics, raw `ctype`, or OPS saves.
- The additional WebGL sampler is guarded scene-wide and stays dormant on
  photon-free scenes. Its activity scan runs on initial/dynamic refresh rather
  than every material-dirty frame, preserving the ordinary and true-8× hot
  paths. A deterministic RenderLab plane plus native PHOT→RSST co-location test
  prove that a pmap owner and its photon state survive independently.
- Validation passes project-local TPT/WASM rebuild, TypeScript, all 116 test
  files / 737 tests, a real Canvas/WebGL shader browser gate, production build
  with 19-file static closure, and true 8× at `4896×3072` (`9433 ms`
  reference-ready, `23269 ms` eight-ready).
