# AniforTPT

A mobile-first particle playground backed by The Powder Toy. Its searchable, nested catalog exposes 171 ordinary projected particle brushes across powders, liquids, solids, gases, energy, explosives, special, radioactive, force, electronics, powered, sensors, and life, plus fifteen true native wall-grid brushes and all 24 built-in TPT LIFE automata. Fan and gravity walls remain discoverable but disabled because their directional/field configuration ABI is not exposed yet. Of the particle brushes, 166 are enabled in the current headless build and five gravity-dependent entries remain visible but explicitly disabled. Steam, Salt Water, Gas, Snow, Plasma, and Broken Coal (BCOL) retain their native identities both as ordinary brushes and when produced by native phase changes or reactions; 22 additional native-only products appear as disabled, searchable reference tiles with distinct render identities, rather than being offered as unsafe generic brushes. LIFE states remain semantic preset tools rather than generic particles. Air, Vacuum, Wind, Heat, and Cool are native simulation tools with their own pressure/vector/thermal operations. Six configured-source tools atomically place CLNE, BCLN, PCLN, PBCN, CONV, or CRAY with the selected element as its native `ctype` target. LIFE presets use their own native placement ABI, evolve under TPT's rules, and retain their preset through stock OPS save files. Priority filters keep force particles beside Air/Vacuum/Wind, plants beside LIFE presets, and expose radioactive matter directly. Native signs can be placed, edited, aligned, deleted, expanded with TPT placeholders such as `{p}` and `{temp}`, and round-trip through OPS files without occupying particle or wall cells. The interface also includes live pressure and particle-temperature inspection, an initially visible mobile Draw/Eraser bar, one-finger painting, two-finger pinch/pan navigation, favorites and recents, native save-file exchange, and local autosave.

## Run locally

```sh
npm install
npm run dev
```

Ordinary URLs use the `realistic` WebGL/HDR presentation when supported.
`?renderLook=classic` keeps the lean comparison look and
`?renderLook=neon-lab` selects the alternate styled preset. Canvas2D remains a
permissive semantic fallback, and true 8× keeps its resource-bounded direct
WebGL path instead of allocating the normal HDR target chain.

Production output is fully static:

```sh
npm run setup:emsdk # one-time, downloads pinned Emscripten 6.0.3 locally
npm run setup:build-tools # one-time, installs pinned Meson in .venv
npm run build:all   # WebAssembly -> tests -> typecheck/Vite production build
```

The SDK and its compiler caches live under the ignored `.toolchains/emsdk`
directory; no global emsdk activation is needed. Individual pipeline stages remain
available as `npm run build:wasm`, `npm run test`, and `npm run build`.

Deploy `dist/` to GitHub Pages, Cloudflare Pages, or Netlify. Vite uses relative asset paths, so subdirectory hosting works. `.github/workflows/ci.yml` verifies ordinary pushes and pull requests, while pushes to `main_codex` are intentionally manual. Run the **verify-static-game** workflow on `main_codex` and choose `build`, `build-and-deploy`, or `deploy-verified`. The first two perform a fresh verified build; `deploy-verified` additionally requires the run ID of a prior successful build of the exact same commit and republishes that validated artifact without compiling again. Successful runs upload a current-run static artifact, and both deployment modes publish through the GitHub Pages environment. C++ recompilation is accelerated by a project-local ccache directory restored from GitHub Actions cache and saved only after a successful build. In the repository settings, choose **GitHub Actions** as the Pages source.

## Fast Visual Lab review

Use the developer launcher for ordinary edit-to-review work. It builds once,
allocates a unique ignored evidence directory, captures the explicit selection,
generates current-only response evidence, and runs the portable verifier. It
does not compare with a historical baseline by default:

```sh
npm run visual-lab:review -- --candidate=water-motion
npm run visual-lab:review -- \
  --cohort=liquid-motion
npm run visual-lab:review -- \
  --cohort=powder-style
```

On Linux it defaults to SwiftShader, one shared browser host, and completed-frame
receipt proof. The command prints the retained evidence root before capture and
prints clickable `file://` links to the current experiment-response board and
raw contact sheet only after the complete package verifies. An
accepted/current review board or compact brief is shown only when an explicit
legacy `--baseline-root` reference was requested. The response board places
OFF/A/B together and
reports OFF→A, OFF→B, and A→B integer RGBA differences; it does not score,
threshold, rank, or promote them. It never clears an old review or opens a user
browser. Use `npm run visual-lab:review:reuse -- ...` when `dist/index.html` is
already current.

Hashes in a completed package protect its own files from tampering. They are
not a cross-revision visual requirement: changing pixels is reviewed by a human
or agent from the current board, while missing, unsafe, incomplete, or
incompatible evidence still fails verification. `accepted-v1`, comparison, and
promotion commands remain available only for an explicit legacy or ad-hoc
reference; they are not CI or deployment gates.

Author checked-in cohorts and generated static-contract declaration files with:

```sh
npm run visual-lab:authoring:check
npm run visual-lab:authoring:sync
```

## Visual Lab planning and capture

Inspect an immutable selected plan before a build exists, before opening Chrome,
and without writing the result tree:

```sh
npm run audit:visual-lab:plan -- \
  --candidates=gas-showcase,powder-style-atlas \
  --output-dir=/tmp/anifor-visual-review
```

Then build once and capture named experiments without rebuilding between them:

```sh
npm run build
npm run audit:visual-lab:capture -- --candidate=gas-showcase
npm run audit:visual-lab:capture -- --candidate=powder-style-atlas
```

For a portable cohort and static contact sheet, run:

```sh
npm run audit:visual-lab:batch:capture -- \
  --recipe-set=visual-lab/recipe-sets/atmosphere.json \
  --output-dir=/tmp/anifor-visual-review
node scripts/visual-lab-verify.mjs \
  --batch-root=/tmp/anifor-visual-review \
  --require-complete=1 --require-recipe-set=1 \
  --require-browser-host-plan=1 \
  --require-execution-tuning-plan=1 \
  --require-capture-geometry=1 \
  --require-experiment-response=1
```

For a larger normal-scale cohort on Linux, opt into sequential Chrome-host
reuse while retaining a fresh incognito context, target, document, simulation,
WebGL state, and browser-error collector per candidate:

```sh
npm run audit:visual-lab:batch:capture -- \
  --candidates=gas-showcase,powder-style-atlas \
  --browser-host=shared \
  --output-dir=/tmp/anifor-visual-review
```

The default remains `--browser-host=fresh`. True 8× and recovery audits always
remain fresh-browser-only.

The JSON plan resolves the recipe-set identity, fixture-owned driver, canonical
query, preparation kind, off/A/B selections and labels, expected browser
datasets, and disjoint relative artifact paths. Its ID excludes machine-local
bundle and output roots; those appear in a separate unhashed runtime envelope.
Base URLs may not carry a query or fragment: every render-affecting capture
parameter is plan-owned. The normal batch consumes the same immutable compiled
entries and binds each child to an opaque digest of its executable browser
authority, while the expressions themselves remain private and are never
printed in the plan.

This immutable-plan boundary is deployed at revision
`87e041a22f019e529b29cd61a5e9fb4611bef289` from source run `31308888264` and
deploy run `31309055166`. The current increment puts CDP
setup through strict renderer disposal in one page-scoped transaction, then
explicitly closes its target and tears down the host before publishing
`report.json`; nested CLI error causes are preserved. Its 14 bounded,
non-overlapping monotonic phases—from plan/preflight through target and host
teardown—are diagnostic only, excluded from frozen identities, and reject
impossible or over-300-second values. A real built Gas gate completed in about
29.978 seconds with no Chrome left behind. The opt-in shared-host layer keeps
that capture plan and all result/batch identities unchanged, adds a separate
content-addressed `browser-host-plan/v1`, and keeps each audit child as the hard
per-candidate timeout boundary. Shared reports are staged until their host
generation closes cleanly; any capture, backend, browser, health, target,
context, or teardown fault recycles the whole host. Fresh and shared targets
use one explicit 1280×600 CSS viewport. That fixed the browser metrics, but the
responsive application layout could still move and resize the canvas across
environments. A built Gas+Powder fresh/shared pair matched all six PNGs and both
result IDs byte-for-byte. Shared mode used one host for two fresh contexts with
no restart, reduced sampled candidate time from about 58.2 to 53.1 seconds, and
left no Chrome residue. True 8× and recovery remain fresh-browser-only.
The portable verifier's `--require-browser-host-plan=1` gate reconstructs and
checks the exact capture-plan/entry identities, GPU/base URL, and timing-derived
host mode. `--index-only=1` preserves that sidecar unchanged and does not invent
one for a legacy package.

### Hermetic Visual Lab capture geometry

The bounded success-evidence checkpoint is deployed at revision
`95cab0b4e3f885c1b956875322e9e9e2caa4866f` by Actions run `31331716229`.
Its build, deploy, exact 19-resource closure, hosted receipt-v2 Water smoke, and
portable verification passed, and the workflow uploaded the success-only
manifest as `anifortpt-live-visual-lab-evidence-1`. Comparing that retained
proof with local evidence isolated the remaining variance to the responsive
screenshot crop rather than semantic, field, framebuffer-alpha, backend, or
HDR state.

The current framework checkpoint therefore gives Visual Lab an audit-only
capture profile: a 1280×600 viewport at DPR 1 and visual scale 1, with the
canvas fixed at `(181,12)` and 918×576 CSS pixels. A normal 2× recipe still has
the ordinary 1224×768 backing. The profile activates only for
`inputAudit=1&auditStage=visual-lab&visualLabAudit=1`; normal responsive desktop
and mobile layout is unchanged. Reports carry this geometry proof through the
batch and portable verifier, and new release evidence requires it explicitly.
Two independent local SwiftShader captures matched byte-for-byte (OFF
`5d2a196…`, A `25f21ee…`, B `d262b25…`). The implementation is checkpointed at
`1cd23cc`; after the review adapter fix at `627ef50`, a fresh four-recipe release
review passed and the explicitly reviewed geometry migration produced accepted
baseline
`sha256:b78ac28395d454a13889b2124fa4364119463756407877ab801608a783eba1aa`.
Workflow run `31333870677` deployed exact revision `3f8a423`; its downloaded
four-recipe review matched all twelve accepted PNGs and all four result IDs,
while the retained live Water manifest matched the same hashes and exact
geometry proof after a 19-resource origin check. This reproducible local/hosted
loop is now the default route for reusable material experiments.

Accepted packages also carry an additive, content-addressed
`capture-provenance.json`. It binds the unchanged accepted-baseline ID and each
catalog-ordered result ID to the exact canonical capture-geometry proof recovered
from its reviewed source report. New acceptance/promotion operations require
those reports and matching PNG dimensions; portable release verification uses
`--require-baseline-capture-provenance=1`, while legacy packages remain readable
when that explicit gate is omitted.

Readiness and settle behavior is independently bound by
`execution-tuning-plan.json`. Its content-addressed entries come from one
exhaustive driver-capability registry and declare the startup variant, field
refresh, RAF counts, exact dataset acknowledgement, polling/timeouts, two
consecutive semantic/field/framebuffer digest snapshots, and screenshot-after-
proof rule. The generic audit child consumes those entries; reports carry their
plan/entry IDs, and `--require-execution-tuning-plan=1` reconstructs the same
capture plan and capabilities from a downloaded package. This sibling remains
host-agnostic and outside result, batch, baseline, comparison, and recipe-set
identities. Index-only aggregation preserves an existing tuning sidecar exactly
and leaves legacy absence explicit.

The first tuning-backed optimization keeps those proofs intact: Powder style
selection now has one WebGL presentation owner instead of submitting a second
full field frame, and framebuffer alpha uses the same historical digest through
a direct RGBA stride walk. In the local built SwiftShader pair, fresh/shared
captures retained identical PNG bytes and result IDs; Powder A+B fell from the
prior 6.46/5.79 seconds to 4.49/3.77 seconds, while the direct digest's isolated
2× CPU walk was byte-identical and about 5.9× faster.

Every new capture also emits optional `captureSubphases` diagnostics under the
separate `anifor.visual-lab.capture-subphase-timings/v1` schema. It measures the
readiness dataset wait and explicit refresh, then per OFF/A/B selection,
dataset acknowledgement, snapshot attempts, complete CDP readback/hash time,
screenshot time, and PNG write time. These bounded monotonic values are
validated and aggregated by batch and portable verification, but remain absent
from result IDs, `index.json`, recipe sets, execution plans, tuning plans,
baselines, and comparisons; legacy reports may omit them. A real built
SwiftShader Gas capture retained the accepted PNG/result hashes and attributed
its 33.2-second run chiefly to readiness (14.6-second dataset wait plus 3.7
seconds of readback/hash) and the OFF proof (5.7 seconds of readback/hash),
making the next optimization target explicit without weakening evidence.

Run the opt-in performance cohort outside CI with a new or empty output
directory:

```bash
npm run audit:visual-lab:performance-cohorts -- \
  --recipe-set=visual-lab/recipe-sets/atmosphere.json \
  --output-dir=/tmp/anifor-visual-lab-abba \
  --gpu=swiftshader
```

The runner fixes the host order to fresh/shared/shared/fresh, gives every cohort
its own evidence root, and portable-verifies each root before continuing. It
writes the bounded, path-free `performance-summary.json` only after all four
cohorts pass; partial cohort evidence remains available when a later run fails.
All four cohorts must retain identical accepted result identities, but names and
result IDs stay out of the aggregate summary. This command has no CI or
baseline-promotion authority.

The final two-candidate atmosphere ABBA gate completed all four portable roots.
Fresh cohorts took about 63.3s and 61.4s; shared cohorts took about 61.8s and
60.7s, each with one host, two assignments, and no restart. Treat those values
as directional local evidence. Readiness and OFF readback/proof still dominate,
so the next framework step is a renderer-owned completed-frame receipt—not a
weaker timer or animation-frame assumption.

Each recipe keeps the stable six fields `name/domain/target/fixture/gain/renderScale`.
The resolved fixture—not the material domain—selects its capture driver, so one
domain can host multiple independent controls. Add declarative driver, fixture,
and recipe data in `src/shared/visual-capture-static-contract.js`, and add the
driver's executable adapter in `scripts/visual-capture-drivers.mjs`; the module
fails at startup if the static and executable registries differ. Audit, batch,
baseline, review, and contact-sheet code consume the shared resolved request and
must not gain driver-name branches. Canonical review labels are `OFF/A/B` for
normal HDR and `Smooth/Local/Grains` for the Powder style driver.

## Save files

**Save / share** passes a real file to the system share sheet when file sharing is available, otherwise it downloads it. The native engine's serialized bytes use TPT's `.cps` extension: modern files begin with `OPS1` and can be opened by desktop TPT. **Open file** accepts those files as well as the legacy TPT formats that the pinned engine supports. This avoids expanding a full world into the URL or clipboard. Older AniforTPT hash links remain importable for backward compatibility, but the interface no longer generates them. If startup falls back to the compact compatibility engine, export uses a clearly separate `.anifortpt` format rather than claiming TPT compatibility. Files are capped at 32 MiB before parsing.

## Backend boundary

The shipped default is the official Powder Toy 100.0 simulation compiled directly to a single-threaded 612×384 WebAssembly module. `native/tpt/tpt_adapter.cpp` keeps upstream types and numeric element/wall/tool IDs behind a small C ABI and exposes material, native wall, pressure, particle-temperature, velocity, configured-source, LIFE-preset, and native-sign operations. The old compact C++ kernel and deterministic TypeScript backend remain startup fallbacks only.

The Emscripten SDK lives under ignored `.toolchains/emsdk`, Meson under ignored `.venv`, and the pinned upstream checkout/build under ignored `.cache`. `npm run build:wasm` fetches the recorded upstream revision, applies `patches/the-powder-toy-headless.patch`, builds the headless target, and publishes adjacent ES-module glue and WASM files to `public/wasm`.

Run `npm run fetch:tpt` to obtain the pinned official Powder Toy revision in the ignored `.cache` directory. See `docs/powder-toy-integration.md` for the headless extraction sequence and GPL distribution requirements.

## Rendering

Exact semantic non-emissive liquids can bend a coexisting native wall pattern as one coherent optics-specific lens plus a field-shaped boundary displacement. This moves only the analytic pattern coordinate—never the framebuffer—and leaves reconstructed holes, Lava/molten material, wall identity, alpha/support, and the single-target true-8× budget unchanged.

Gas presentation is atmosphere-primary rather than particle-primary. Nearby Smoke, FOG, CFLM, and other gas cells join through the shared density/colour field into translucent billows; exact semantic cells retain only a restrained species or emissive accent, so deliberate sparse gaps remain open instead of becoming either isolated dots or a solid slab. The mixed atmosphere RGB now drives a bounded spectral key/fill: neutral soot keeps a restrained warm absorbing core, while Oxygen, Noble Gas, and other coloured mixtures scatter their own hue around exposed billows instead of converging on one generic blue rim. Canvas2D bilinearly samples that existing field once per gas world cell, while WebGL reuses its existing atmosphere and emission samples. The effect changes RGB only, adds no render target, texture, upload, field reconstruction, or pass, and canonical `?renderScale=8` remains a true 4896×3072 single-target WebGL inspection mode.

At normal WebGL detail, connected exact Smoke also gains a deeper static soot-volume fold from the already-established billow and directional signals. It remains RGB-only, preserves sparse gaps and native simulation semantics, and leaves Canvas plus compact true 8× on their established gas presentation.

The toolbox's **Detail** row switches between true 1×, 2×, 4×, and 8× per-cell output (the same values accepted by `?renderScale=`). Changing it synchronously saves an ordinary world before the required reload. Before allocating, AniforTPT probes the device's renderbuffer, separate viewport axes, and texture limits and releases that temporary context. Capable devices retain true 8×; a 4096-wide viewport/renderbuffer selects true 4× immediately instead of waiting for a doomed 4896-wide allocation, while asymmetric 8192×4096 limits correctly retain the 4896×3072 target. Lower filter-based scales additionally fit `MAX_TEXTURE_SIZE`; direct-mesh 8× does not require a redundant full-size texture. The 8× path draws the semantic shader directly on one quad, batches startup options into its one initial scene render, uses only a 2× Canvas during cold WebGL startup, and releases all fallback contour storage only after a GPU fence proves the first 15-million-fragment frame completed. It keeps at most one such GPU frame in flight; updates received while that frame is pending coalesce into the newest state instead of queuing duplicate 8× work. A bounded promotion deadline retains Canvas if that first frame stalls. If a later fence stalls or the WebGL context is lost, AniforTPT destroys it first and reconstructs the bounded 2× Canvas from the unchanged simulation while preserving the camera. It is intended for high-quality captures; 2× remains the default and 4× the practical routine high-detail mode.

The active renderer uploads material ID, temperature, and velocity as one compact RGBA semantic field and native walls as an independent field instead of drawing simulation cells directly. A Pixi/WebGL shader reconstructs local occupancy into softened chunk boundaries, contour normals, cohesive liquid depth and highlights, volumetric gas motion, and emissive heat/energy, then composites wall patterns behind particles without conflating their IDs. Material colors, visual profiles, and a compact optical-response class come from lookup textures, so every projected reaction or LIFE product remains renderable without per-element shader branches. The palette alpha byte encodes 13 bounded classes with no additional texture, field, upload, or pass. Aqueous, oily, corrosive, molten, and clean/sooty gas classes tune volume absorption, scatter, tinted transparency, and gloss; rough granular, smooth rigid, translucent rigid, organic, device, and radioactive classes independently tune grain facets, bevels, glass/ice tint and reflection, fibres, traces, and scintillation. Dense solids close small exact-material cavities only when no foreign neighbour is present, producing more cohesive chunks without merging seams or changing the semantic grid. Monotone local WebGL coverage rounds compatible solid/liquid boundaries at the fixed 2× presentation scale without a full-frame blur. WebGL powders use contact support and velocity to blend soft round moving grains into a settled heap contour; unlike powders share phase coverage at contact while exact material colors remain exclusive, and gas/liquid/powder contact does not reshape a solid edge. In Smooth mode, proven deep stable powder additionally reduces cell-grid albedo noise toward its canonical material colour and receives bounded broad slope relief plus a coherent mineral-volume key/fill: supported shoulders catch an upper-left warm key while dense cores absorb light. This RGB-only treatment preserves fine columns, holes, seams, alpha, and semantic support; Local and square-cell Grains remain unchanged references. Upload work is coalesced in halo-aware 32-cell dirty chunks, rendering is capped at 30 Hz, and the default 612×384 logical world renders to a 1224×768 backing without putting DPR into world/input math. The shared liquid field carries both species color and density, so same-liquid pinholes join while water/oil/acid interfaces do not inherit an arbitrary neighbor's color. Canvas2D consumes the same liquid, atmosphere, emission, palette, optics, and family data. Its authoritative liquid cells now use that existing field support and relief for centralized family-aware body absorption and exposed meniscus light, replacing per-material point-like highlight planes without changing alpha, reconstructed holes, species seams, refraction, or lava emission. It also mirrors the species-safe solid cavity reconstruction and deterministic optics-driven granular/rigid/translucent/organic/radioactive/device styling, including broad family-aware absorption, reflection, and exposed-rim response for dense solid bodies. Both body responses change only RGB and add no field, buffer, neighbour scan, or pass. Canvas retains a separate bounded compatibility contour rather than claiming WebGL Hermite/round-grain parity. It remains the immediate compatibility presentation during cold Pixi startup. A ready WebGL presenter replaces it in place rather than losing the richer renderer to a short startup deadline. The viewport badge shows the active backend and, while Canvas is retained, whether WebGL is starting, forced, unavailable, timed out, or failed.

Smooth-powder coverage now uses one shared directional field signal and one shared density crossing in normal and true-8× WebGL. Normal detail retains its established broad settled-depth proof. The compact compositor reuses its already-bound stability byte to admit only the local field blend, while separately proven empty-cell exterior projection remains available because its own stability byte is necessarily zero. This prevents an unsettled particle, authored hole, or fine column from borrowing a nearby settled contour at 8× without adding a sample or changing Local, square Grains, semantic support, or the projected outer pile.

Realistic WebGL also applies one shared scale-safe body finish to already-proven powder, liquid, and gas volumes. The normal 1×–4× compositor and compact true-8× mesh inject the same GLSL helper, so their broad upper-left key, opposing fill, dense-core absorption, and pigment retention share one vocabulary even though HDR and bloom remain normal-scale only. Phase-specific fields still own density, contacts, alpha, topology, and material identity; the finish is RGB-only and adds no texture, field, upload, render target, or pass. Classic disables it through the existing product-volume switch.

The same shared source now adds a mesoscopic fluid-volume lobe for liquids and gases. Each compositor reuses its already-live centre density, cardinal mean, field-native curvature, depth, and slope: convex fluid shoulders receive a broad cool crown, while concave or deep pockets retain coloured absorption. Semantic particle density may prove visible support but cannot steer the curvature, so reconstructed gas fringes and liquid shores follow the authoritative atmosphere/liquid fields. The lobe changes RGB only and adds no sampler, uniform, field, upload, target, pass, material-ID branch, or 8×-scaled allocation; Classic disables it with the same existing volume switch.

At normal WebGL detail, ordinary exact-PLNT canopies also receive a bounded, static lamina grain with shallow yellow-green and teal vein relief inside their established body pigment. Native lifecycle colour and state, authored topology, alpha, and physics remain authoritative; Canvas and the compact true-8× path retain their established botanical presentation.

Connected Water, Oil, Acid, and other ordinary liquids now gain a real surface-to-core depth gradient. An allocation-free exact-species column scan writes a bounded optical-depth value into the renderer's existing phase-exclusive auxiliary byte: exposed cells remain clear, deeper cells absorb family-coloured light, a different liquid or other phase restarts the depth, and Lava remains emissive rather than artificially darkened. The effect changes RGB only—never alpha, support, physics, refraction, or species ownership—and adds no texture, field plane, target, pass, or persistent allocation. WebGL reuses the existing `r8` auxiliary texture with at most one already scheduled upload and one exact-liquid sample; Canvas reads the same caller-owned byte directly.

Thick exact-species solids now gain the matching two-dimensional surface-to-core treatment. A forward/reverse Manhattan scan measures distance from world edges, holes, native walls, and unlike-material contacts in the same phase-local auxiliary byte; Powder still owns stability and Liquid still owns column depth. The first interior layer is protected, so isolated cells, one-cell lines, small holes, and unlike seams remain unchanged while deep rigid, organic, device, radioactive, and translucent bodies receive distinct restrained absorption. The scan runs only after relevant solid or wall edits at the bounded reconstruction cadence, adds no full-resolution allocation, texture, target, or pass, and never affects coverage, alpha, ownership, physics, or fine structure.

Ordinary non-emissive solids and powders now use their real simulated temperature as a restrained RGB-only material response. Cold chunks shift toward blue, hot chunks toward warm/incandescent tones, room temperature is an exact dead-band no-op, and existing optics classes weight the response without changing alpha, contours, ownership, or emission. Canvas applies the same tint before source-over compositing, including translucent matter over independent native walls.

Dense Fire, Plasma, ELEC, PHOT, GRVT, and other energy carriers render as rounded luminous bodies with bounded chunk-scale radiance relief instead of flat cell-filled cards. WebGL reuses its existing semantic normal and low-frequency flow values; Canvas uses exact-material neighbour support plus the same presentation wave. The response is hue-preserving and capped at 10%, changes neither core/glow alpha nor support, leaves sparse carriers discrete, and adds no texture, reconstruction field, pass, or render-scale-dependent CPU work.
