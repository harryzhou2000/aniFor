# Render lab visual regression scene

The render lab is a deterministic, paused 612×384 material atlas for evaluating renderer changes without waiting for physics or reconstructing an ad-hoc brush scene.

Its temperature plane is static at room temperature (`2952` decikelvin) unless a fixture overrides it, so the paused atlas uploads temperature once rather than repainting a true-8× target at the dynamic-field cadence. Six isolated lower-strip blocks compare cold/ambient/hot Metal and Sand; wall-free ambient Glass and Ice plates isolate body optics, while hot Glass and cold Ice reuse native-wall cards to prove correct pre-composite translucent response. The browser gate captures thermal off→on→off, requires exact ambient and repeat no-ops, opposed bounded cold/hot chroma, unchanged blank-differenced support, and Canvas/WebGL magnitude parity. Ordinary thermal styling is RGB-only and excludes walls, gas, liquid, energy, field, emissive, and role-bearing matter.

## Open the scene

Start the development server and use:

```text
http://localhost:5173/?scene=render-lab&renderScale=2
http://localhost:5173/?scene=render-lab&renderScale=2&renderer=canvas2d
```

`scene=render-lab` selects an in-memory 612×384 backend only for this diagnostic route. It does not load native TPT, restore autosave, advance simulation, or write autosave. Normal URLs continue to use the native backend.

For an art-direction view that uses the same normal field renderer without the
atlas's deliberately sparse stress patterns, open the paused material showcase:

```text
http://localhost:5173/?scene=showcase&renderScale=2
http://localhost:5173/?scene=showcase&renderScale=2&renderer=canvas2d
```

`scene=showcase` stages connected Water/Oil, packed powders, rigid bodies,
volumetric gases, botanical forms, energy, and devices in one deterministic
composition. It has the same no-autosave/no-native-load guarantees as the
render lab, but is intended for judging cohesive material forms rather than
particle-level diagnostic coverage.

Screenshots created during local review belong in ignored `.artifacts/`, for example:

```text
.artifacts/render-lab-webgl.png
.artifacts/render-lab-canvas2d.png
.artifacts/showcase-canvas-volume-sheen.png
```

To capture that composed scene from the already-built bundle without relying on
Vite, run one backend at a time:

```sh
npm run build
npm run audit:showcase-screenshot -- --webgl-only --screenshot=.artifacts/showcase-webgl.png
npm run audit:showcase-screenshot -- --canvas-only --screenshot=.artifacts/showcase-canvas2d.png
```

The command opts into the existing diagnostic clock only for its paused capture,
so normal public showcase URLs retain their ordinary non-audit behavior.

## Completed-frame receipt audit

The renderer exposes an audit-only, versioned GPU completion receipt for one
exact full presentation. Normal WebGL inserts its non-blocking sync only after
the final HDR/default-framebuffer composite; true 8× attaches the ticket to its
existing sole render fence. A later presentation supersedes the older ticket,
and timeout, context loss, teardown, or fence failure fails it. This capability
does not replace Visual Lab's two stable semantic/field/framebuffer snapshots or
prove compositor screenshot handoff.

Run the production-bundle proof with:

```sh
npm run audit:webgl-completed-frame-receipt
npm run audit:webgl-completed-frame-receipt:8x
```

The gate accepts honest supersession while the paused fixture finishes finite
field hydration, then requires a completed successor, verifies that a newer
submission leaves the earlier ticket observably superseded, checks browser
errors, strictly disposes the renderer, and tears down its owned Chrome profile.

### Opt-in receipt-bound capture proof

Visual Lab keeps `execution-tuning-plan/v1` and its two matching snapshots as
the default. Normal 1×/2×/4× WebGL experiments may explicitly select
`--capture-proof=completed-frame-receipt`; this creates a separately
content-addressed `execution-tuning-plan/v2`. V2 retains exact driver dataset
selection, two RAFs, the semantic/authoritative-field/framebuffer evidence
planes, and screenshot-after-proof. It replaces only the second matching
snapshot: the runner requests a completed-frame receipt, takes one full snapshot,
then rereads the same ticket and submission before taking the screenshot.

A superseded ticket is never accepted. Finite field-refresh supersession may be
retried before the snapshot, but missing, failed, malformed, post-snapshot-
superseded, Canvas, or timeout paths fail closed. Candidate reports carry the
accepted completed receipt as diagnostic evidence; portable verification
requires exact schema/state and monotonically increasing tickets/submissions.
Receipt evidence never enters result, batch, recipe-set, baseline, or comparison
identities. True 8× retains its independent full release proof.

For a one-off production-bundle batch and portable verification:

```sh
npm run build
node scripts/visual-lab-batch.mjs \
  --recipe-set=visual-lab/recipe-sets/atmosphere.json \
  --bundle=dist/index.html \
  --output-dir=/tmp/anifor-receipt-proof \
  --gpu=swiftshader \
  --browser-host=shared \
  --capture-proof=completed-frame-receipt
node scripts/visual-lab-verify.mjs \
  --batch-root=/tmp/anifor-receipt-proof \
  --require-complete=1 \
  --require-recipe-set=1 \
  --require-browser-host-plan=1 \
  --require-execution-tuning-plan=1
```

For the fixed fresh/shared/shared/fresh release comparison, use a new empty
output directory:

```sh
npm run audit:visual-lab:receipt-proof-cohorts -- \
  --recipe-set=visual-lab/recipe-sets/atmosphere.json \
  --output-dir=/tmp/anifor-receipt-proof-cohorts \
  --gpu=swiftshader
```

This opt-in path publishes `performance-cohorts/v2` only after all four portable
packages pass and their result identities match. The default performance-cohort
command and summary remain v1 with strict two-snapshot tuning.

The real-browser audit first captures and signature-checks this deterministic
atlas, then clears it and exercises painting, wheel/pan, resizing, and mobile
touch. It navigates separately to the native backend for configured-source and
LIFE-preset smoke checks, so native `create_part` behavior cannot silently change
the canonical visual fixture:

```bash
mkdir -p .artifacts
npm run audit:browser-input -- --webgl-only --screenshot=.artifacts/render-lab-webgl.png
npm run audit:browser-input -- --canvas-only --screenshot=.artifacts/render-lab-canvas2d.png

# Capture the exact built bundle without starting Vite (useful for visual review).
npm run build
npm run audit:production-screenshot -- --webgl-only --screenshot=.artifacts/render-lab-webgl-production.png
npm run audit:production-screenshot -- --canvas-only --screenshot=.artifacts/render-lab-canvas2d-production.png
```

WebGL is the canonical visual release backend. By default, a full or focused
visual audit proves WebGL's material/optics result directly and runs Canvas as
the responsive semantic fallback (backend selection, geometry/toolbox,
canonical fixture, stable framebuffer, and browser errors). Add
`--require-canvas-visuals` when a deliberate Canvas optics capture and paired
Canvas/WebGL visual-parity comparison is needed. Input, mobile, layout,
paused-presentation, and native-semantic contracts remain strict on both
backends.

The desktop audit also makes a paired 2×/1× render-backing comparison at an identical 1280×720 CSS viewport. CSS canvas dimensions must remain identical while only the backing changes from 1224×768 to 612×384; each scale must independently pass the same three semantic landmarks, cursor-anchored wheel threshold, and 42×27 CSS-pixel middle-pan assertion.

In the same loaded scene, a second desktop proof changes DPR and browser page scale while the camera is already zoomed and panned. Responsive CSS geometry may reflow, so pan is compared after normalization by the fitted-canvas ratio. The gate then repeats anchored wheel zoom, paints exactly one semantic cell, finds the blank-differenced composed peak through visual-viewport screenshot coordinates, restores DPR/page scale, and rejects camera drift or browser errors in both Canvas and WebGL.

The mobile audit cold-loads each backend after enabling DPR-2 touch emulation. It proves an anchored two-finger pinch plus 22 CSS-pixel pan with no stray mark, an exact tap and 25-cell continuous one-finger stroke, the visible Eraser button followed by Draw restoration, horizontal reach of the final tool filter, and a real swipe that starts inside the nested tool library and chains to document scrolling at the library boundary.

For the native wall/particle composition fixture, use:

```text
http://localhost:5173/?scene=wall-lab&renderScale=2
http://localhost:5173/?scene=wall-lab&renderScale=2&renderer=canvas2d
```

Unlike `render-lab`, `wall-lab` deliberately loads the native TPT backend. It clears only its in-memory diagnostic world, remains paused, skips restore/autosave, and lays ten native wall types behind deterministic particle density gradients and mixtures. This catches accidental wall-as-particle encoding, missing wall uploads, texture-coordinate drift, and wall/particle compositing errors.

## Atlas layout

- Upper left: five sand-density bands plus dust and salt, followed by deep Clay and Concrete columns with asymmetric notches and bottom ledges. This shows exact square Grains, packed powder relief, whether smoothing turns grains into a flat slab, and whether Smooth loses locally visible sections of a non-pile structure.
- Upper middle: overlapping water, oil, and acid bodies, a rigid floor, a sparse liquid row, and an exact split Water/Oil capsule. This shows interior hole filling, liquid-to-liquid colour ownership, contact-meniscus response, specular response, and edge hardness.
- Upper right: overlapping Smoke, Oxygen, and Noble Gas density-falloff clouds, compact Fire and GRVT source marks grazing opposite outer flanks, deterministic pitch-four Smoke/FOG/CFLM chains with authored centre gaps, and compact FOG/CFLM volumes. This shows whether gas reads as a continuous volume between nearby carriers without filling deliberate gaps, whether different gas colours mix, whether directional field light reaches the facing rim without washing the dense core, whether generic soot remains distinct, and whether emissive gas bloom overwhelms its species colour.
- Lower left: sand entering dense water, with a deliberately mixed patch. This reveals phase-boundary bleeding and whether sparse liquid remains coherent.
- Lower middle: adjacent wavy columns of water, oil, acid, and lava. This makes over-blur across distinct liquids immediately visible.
- Lower right: a five-column, six-row profile matrix. Its rows cover granular matter; rigid surfaces plus neutral-profile GOL; organic/growing matter; powder-state PLUT/URAN, solid VIBR, and sink/carrier semantics; configured/powered/sensor/channel/force devices; then five rounded neutral/radioactive energy bodies. Deliberate sparse holes expose each ordinary family's reconstruction behavior without relying on phase overrides. Equal-height warm and cool source strips flank the matrix, while its centre column remains a lower-light comparison, so contour response, role legibility, energy-core treatment, and interior wash are visible in one frame.

## Review gates

For every shader or field-reconstruction change:

1. Capture WebGL at the same viewport size and `renderScale=2`. Capture forced Canvas2D and compare visual parity only with `--require-canvas-visuals` when that diagnostic is useful.
2. Confirm the canvas remains a 612×384 CSS/logical world with 1224×768 backing pixels.
3. Confirm the browser console contains no shader, WebGL, runtime, or network-asset failure related to the app.
4. Compare powder granularity, liquid interior continuity and hard boundary, gas halo/volume, material mixing, energy-core legibility, aura falloff, neighboring light tint, and emissive clipping. Warm/cool light should reveal exposed rigid, organic, radioactive, and device contours without turning their interiors into flat bright slabs. Enclosed and shallow exact-material cavities and short internally bounded one-cell cracks should close at near-opaque presentation strength, reducing cell-sized dark pits; open notches, silhouettes, walls, phase boundaries, every unlike-material seam, and both black separators in the solid profile matrix must remain visible.
5. Keep the previous WebGL crop until the new result has been visually reviewed.
6. When wall rendering changes, repeat the same checks with `scene=wall-lab` and confirm all ten wall patterns remain distinct behind particle mixtures.

The scene itself is a visual fixture. `npm run audit:browser-input` combines it
with real-browser pointer, wheel, pan, resize, backing-size, and exact semantic-placement checks. It also decodes a composed page screenshot in-browser and samples five dense energy tiles, four solid-family interiors, dense Water/Oil/Smoke/Oxygen/Noble Gas cores, and the four homogeneous lower liquid columns. The gate requires continuous fluid-core coverage, bounded non-flat luma range, visible solid relief, no meaningful 255-channel clipping, and stable family hue ordering in both backends. For Metal, Plant, solid VIBR, and DTEC it additionally compares Canvas and WebGL mean exposure, macro relief, micro detail, clipping, dark pits, support, and family hue ordering; Glass and Ice receive paired exposure, macro-depth, coverage, cool-transmission, and clipping checks. These comparisons prove the Canvas family-aware body response without permitting it to alter silhouettes. Every sampled family must keep its relative dark-pit fraction at or below `0.08`, while dedicated vertical and horizontal matrix-gap probes require negligible blank-differenced signal; a dark opaque page pixel is not a separator. Water/Oil/Acid/Lava additionally enforce bounded adjacent-pixel luma delta, a nonzero five-by-five low-pass macro range, a WebGL/Canvas macro-depth ratio of `0.65–2.0`, and a mean-exposure ratio of `0.65–1.6`; this rejects cell-frequency glitter, flat matte fill, or a backend-specific washout independently. Three Water probes require a coherent upper-left Canvas edge response without making its core granular. Screenshot sampling avoids enabling WebGL `preserveDrawingBuffer`, so the diagnostic does not weaken the production performance configuration.

`npm run audit:material-atlas` separately places every registered non-empty render identity in an isolated 9×9 block with an empty guard ring. It proves exact 81-cell semantic ownership first, then blank-differences the final composed Canvas and WebGL page captures so a palette entry, shader branch, or fallback draw-order omission cannot hide behind valid metadata. The current 217-identity catalog includes 171 ordinary brushes, 24 LIFE states, and 22 native-only projections; all 217 pass in both Canvas and WebGL with no browser errors, while the paired gate also rejects foreign or guard occupancy and bounds gross exposure and colour divergence. Native-only reaction products participate in this gate but remain nonselectable brushes.

Canvas and WebGL liquid contours reuse the supersampled Hermite derivative for a two-zone meniscus: a bright family-coloured reflected lip followed by a deeper multiplicative absorption shoulder. The palette distinguishes aqueous, oily/combustible, corrosive, cryogenic, metallic, viscous/film, and Molten liquid response. Lava alone is the Molten no-op; MWAX is viscous rather than molten. This changes RGB only for authoritative connected, exposed, same-species liquid and caps each incremental Canvas channel at 18 bytes. Alpha, coverage, ownership, and dense interiors remain exact; isolated droplets, reconstructed support, unlike-liquid contacts, traits, emissive liquids, Lava, and its authored pinhole are explicit no-ops. The focused off→on→off gate proves distinct Water/Oil/Acid response, byte-exact repetition, unchanged support, Canvas/WebGL parity, and all protected controls without adding a texture, field, allocation, fetch, upload, pass, target, or output-scale resource.

The same browser pass clicks Grains, Local, and Smooth in the real actions card, checks exclusive `aria-pressed` state, hashes both RGBA and the blank-differenced binary shallow-Sand silhouette for each mode, requires all three masks to differ, and returns to the original Smooth signature. Grains is the exact square-cell reference: the overview sample must remain one connected rectangular component, then a second capture at the viewport's maximum 5× zoom must produce a near-square, at least five-pixels-per-axis, highly filled box in both backends. The complete Clay and Concrete column rectangles are sampled at every world-cell centre in Local and Smooth. All `2,256` authored occupied cells must remain visible; all `54` authored notch cells are measured, and the `10` deep-hole samples must remain empty. Six narrow occupied probes remain as local contrast/coverage diagnostics. Four narrow probes straddle the exact Water/Oil capsule seam: both species must remain fully covered, each side must have a bounded optical response relative to its own interior, and neither side may become a dark separator. Canvas and WebGL may produce different response signs after their respective compositors, but both must retain exclusive hue ordering and a visible meniscus.

The curved-capsule gate checks more than area and compactness. It decodes the final composed, blank-differenced left Water endcap at every screenshot-pixel row, normalizes against a median interior plateau, locates 20%, 50%, and 80% signal crossings, and compares them with both the analytic capsule circle and the explicit raw cell-staircase reference. RMS/max distance, transition width, bilateral symmetry, monotonicity, and tangent error are bounded; observed RMS/tangent error must materially outperform raw. Current Canvas/WebGL RMS is `0.281/0.224` cell versus raw `0.735/0.749`. This catches a staircase or blurred halo that can retain approximately correct total area.

Canonical sampling waits for three byte-identical composed frames separated by at least one 12 Hz field interval, records the canvas rectangle with the frame, then cold-loads a blank audit at the same geometry and applies the same stability rule. The gate rejects any canonical/control/blank canvas-rectangle drift and uses the recorded canonical rectangle for sampling. Every navigation also carries and verifies a distinct audit-stage query before accepting the page API. Each region derives its signal threshold from the 99th percentile of the two stable blank frames plus a margin, and only pixels that differ from the blank beyond that threshold count as coverage or colour. The opaque page background therefore cannot satisfy a fluid-coverage assertion, and the matrix gaps are verified as absence of rendered signal rather than merely as dark page pixels.

Six small gas probes cover the warm and green-cyan rim, middle, and dense core. The audit captures the identical canonical scene once with gas-field lighting enabled and once with only that coupling disabled; the positive framebuffer difference must carry Fire red on the warm flank and GRVT green-cyan on the opposite flank, without channel clipping, and Canvas/WebGL response must remain within a `2.5×` ratio. This prevents source aura or Smoke/Noble Gas's intrinsic hue from satisfying the lighting gate. A separate paired capture disables only liquid-field lighting: cool GRVT and warm Fire strips must produce appropriately coloured positive framebuffer response on exposed Water and Acid rims while dense pinholes, liquid support, alpha, and species ownership remain unchanged. Emissive Lava cannot reflect its own emission. A third pair disables only translucent-field coupling. Fire must add a warm response wholly inside dense Glass, ELEC must add a cool/neutral response wholly inside dense Ice, and distance-matched opaque Metal must remain byte-stable; lit/unlit blank-differenced support and world area must match exactly. A separate off→on→off refraction sequence leaves all emission lighting enabled and changes only native-wall backdrop pattern coordinates. One continuous asymmetric wall card reaches the Glass/Ice material shoulders: Glass must redistribute it bipolarly with low mean bias, Ice must retain stable faceting, the repeated off image must reproduce exactly, the separately wall-backed Metal contact control must remain unchanged, and straight/refracted blank-differenced support must match. This distinguishes shape-driven scene redistribution from an additive tint, checker decal, or rim glow. Dense energy centres keep adjacent-pixel contrast at or below `8`; whole rounded bodies require five-by-five macro range at least `5`, total luma range at least `10`, and at least `0.92` of rendered signal in one dominant connected component. A dedicated relief off→on→off capture requires bounded bipolar RGB response across the complete five-body row, exact repetition, identical support/world area, and Canvas/WebGL magnitude parity. A high-signal-only read of the sparse PHOT row must retain quiet gaps. Together these checks permit soft aura and animated volume depth while rejecting raw speckle, flat rectangular cards, or a filled sparse core slab.

Compact FOG/CFLM probes additionally require at least 90% of signal in one connected component, bounded cell-frequency contrast, neutral FOG and blue-dominant CFLM hue, and Canvas/WebGL exposure/connectivity parity. Each sparse gas chain samples an authored carrier, the midpoint between carriers, and the centre gap: carrier/midpoint luminance must stay comparable while the gap remains empty. WebGL is the canonical visual release path: focused visual commands (including `--visual-only`) prove WebGL directly while Canvas proves its responsive semantic fallback. Add `--require-canvas-visuals` to any focused or full browser audit to run the diagnostic paired Canvas/WebGL optics assertions explicitly. The field profiler includes an allocation-free full-612×384 worst case for Canvas's per-gas-cell bilinear atmosphere lookup; it is world-cell work and therefore does not multiply with 2×/4×/8× presentation resolution.

In normal WebGL, the linear atmosphere field now also owns dense gas opacity,
not merely RGB mixture: an exact semantic gas accent fades to zero only once
field alpha proves a dense cloud. This removes residual cell-frequency outline
marks without changing `cloudAlpha`, field support, physics, or the alpha of
sparse carrier chains and authored gaps. It reuses the already-sampled
atmosphere alpha and adds no texture read, field, upload, pass, target, or
output-scale resource. `npm run audit:gas-identity` covers the 17-material
cloud/wisp/void/contact atlas in normal canonical WebGL.

Smooth deep heaps retain a 40% floor of the Local contour on every semantically occupied subpixel. The long tangent may still redistribute the remaining coverage at top- and slope-facing boundaries, but it cannot erase the interior of a Clay/Concrete column or notched pile. At a proven stable Smooth contour, the outer alpha transfer comes directly from the wide field and suppresses only edge-adjacent cell pigment; deep settled material retains its mineral/facet vocabulary. The normal WebGL compositor keeps a bounded world-anchored mineral lift through 1× and 2× backing resolution and tapers it away by 4×, so a curved pile does not become airbrushed at fit view; it changes RGB only and cannot create cell borders or alter coverage. The column fixture is authored after adjacent Dust/Salt bands so later layers cannot overwrite its lower sections. Grains deliberately bypasses both contour paths and renders exact square occupied cells; Local and Smooth retain analytic subcell contours.

Deep settled Smooth cells also receive an RGB-only bulk treatment. Canvas proves exact material support at one and two cells below plus same-row lateral contact before blending cell-scale colour variation toward canonical albedo; WebGL reuses its existing wide powder sample and bulk-depth result. Both derive a small signed macro relief from the packed field gradients while retaining bounded facets, and both bypass shallow, unstable, trait-bearing, and emissive matter. This neither widens nor removes support, so the full-cell Clay/Concrete recall, authored-notch, and maximum-zoom square-Grains gates remain authoritative. The full 612×384 Canvas deep-Sand profiler reports `10.23/10.43 ms` median/p90 without the chromatic body cue and `11.86/12.04 ms` with it, including a `1.23/1.26 ms` loop baseline. The new all-world ceiling is about `1.6 ms`; runtime scratch bytes remain unchanged and work is independent of 1×/2×/4×/8× output scale.

Smooth powder suspended in an ordinary aqueous liquid now gains a separate half-resolution visual body. The field keeps one exact RoughGranular powder owner and one exact aqueous owner, rejects unlike/non-aqueous/trait/emissive/wall contacts before its tight separable blur, and lets both phases converge on a shared wet-sediment RGB. Dense support uses one albedo with only bounded pre-existing relief/facet retention, removing the powder-darkened semantic checkerboard while sparse support retains visible grain structure. WebGL treats either a dense semantic body or dense shared-field support as sufficient for this late RGB convergence: alternating exact Sand/Water cells can otherwise look only half-dense despite already forming one settled field-owned volume. It stays aqueous-forward and preserves at most four RGB bytes of local relief; it still retains the compatible local coverage shoulder because the shared field is intentionally powder-authored, not a substitute for exact aqueous support. It never changes alpha, physics occupancy, walls, species, or authored boundaries; dry powder, Oil, Lava, Grains, and Local remain exact no-ops. At 612×384 its integer density/owner work planes plus the 512-byte material-class lookup use 588,032 persistent CPU bytes and refresh at a bounded 6 Hz. The canonical even 2×2 path branches once into wall-free or wall-aware build/validate/pack kernels; differential tests retain the generic odd-size implementation as a byte-exact oracle. The production all-zero-wall update measures `5.43/5.72 ms` median/p90. Canvas styles powder in its authoritative already-lit traversal, then handles semantic aqueous liquid and reconstructed Empty support in the existing post-reconstruction tile walk so liquid cohesion cannot be overwritten by reconstruction. WebGL adds a 235,008-byte linear texture, but samples it only while the scene-wide field is active and the fragment is eligible liquid or powder. Its direct true-8× mesh applies the same guarded late RGB blend from that already-bound source, so quality promotion retains the canonical wet-sediment body without a target, upload, pass, or alpha/support change. Promotion always hydrates the active uniform from current shared-field state, even when Canvas already performed the last rebuild. This conditional path is important at true 8× because dry scenes avoid an otherwise unconditional 15-million-fragment texture fetch. The composed browser gate samples both the gradient plume and dense authored Sand/Water mixture for connected coverage, bounded microcontrast, broad density relief, clipping, and normalized Sand/Water chroma convergence while reporting their intentionally alpha-sensitive raw RGB distance separately.

## Reconstruction budget

The exact semantic texture may update at the renderer's 30 Hz cap. The shared atmosphere, liquid, and emission reconstructions are separately capped at 12 Hz and, when several are due, are staggered so only one is rebuilt in a frame. Liquid RGB stores the uniquely supported species color and alpha stores density; an exact unlike-liquid tie remains transparent instead of choosing a scan-order donor. WebGL uploads the fields as linearly sampled textures. Canvas2D uses the same bytes for joined liquid silhouettes, mixed-colour gas, and colored emission, styles authoritative semantic cells, then reconstructs small exact-solid cavities from that presentation plane and immutable semantic neighbours. Both solid paths require zero different nonempty immediate neighbours and either four-cardinal enclosure or at least five of eight matches with three cardinal supports. A two-cardinal thin crack additionally qualifies only when all four exact diagonals form continuous side walls and the same material closes its missing axis two cells away. Commit `debde42` leaves these conservative eligibility predicates unchanged and normalizes only accepted support into a 0.90–0.98 display-opacity band. Canvas maps neighbour confidence monotonically within that band; WebGL may do so only when `surfaceOnly` identifies the candidate and reconstructed `density` is nonzero, because nearby exact material without proven shape support must remain transparent. Canvas averages matching styled neighbours without propagation for ordinary matter and uses canonical palette RGB for trait-bearing matter so semantic role accents remain on real cells; WebGL derives the same support gate and slope from its existing eight immediate samples, branches to only the applicable pair of distance-two crack samples, and suppresses traits on reconstructed support. Powders, unlike-material seams, native walls, world borders, sparse crosses, open notches, and unbounded cracks therefore remain excluded from solid-cavity filling. Gas RGB uses density absorption plus directional edge scatter; dense occupied gas converges almost fully to the atmosphere mixture so semantic particles do not remain as coloured islands. Both presenters preserve the reconstructed support footprint; the stronger accepted-cavity opacity reduces proven dark pits but does not claim to remove all cellularity from solids. Liquid reconstruction uses field density for silhouette support but semantic occupancy and local field support for optical depth, so isolated droplets remain translucent while connected pool cells and reconstructed holes retain saturated depth; local field slope supplies the reflective lip instead of absolute world height. Canvas reconstructs a hole from already-styled semantic neighbours of only the uniquely supported species, mirrors the opacity endpoints without a second atmosphere blur, and ramps filled shoreline alpha continuously from zero. It then reduces cell-scale RGB variance only inside high-alpha exact-species interiors: all four cardinal donors and one diagonal must be supported, dense reconstructed pinholes may act as cardinal donors, and alpha/silhouette bytes never enter the filter. Trait-bearing and emissive liquids bypass this pass so semantic accents remain legible. The three-row source ring prevents scan-order propagation. The palette lookup's fourth byte carries one of 19 optical-response classes. Volume paths consume aqueous, oily/combustible, corrosive, cryogenic, metallic, viscous/film, molten, and clean/sooty gas classes for RGB absorption, scatter, transmission, and gloss. Solid and powder paths consume mineral/crystalline/sooty/metallic granular, smooth rigid, translucent rigid, organic, device, and radioactive classes for bounded roughness, bevel, transmission/reflection, fibre, trace, and scintillation response; the canonical profile remains a fallback and continues to own field interference. Optical response is presentation-only; solid cavity support is a separate alpha decision, and the semantic grid remains unchanged. Empty reconstructed support deliberately receives the default optics class. The existing style lookup's fourth byte separately carries composable static role flags for emitters, sinks, channels, force actuators, radioactive matter, organic/fibrous matter, and energy carriers. Both presenters apply those flags only to authoritative semantic cells and change RGB without widening alpha; there is no extra texture, field, upload, or pass. The broad Canvas emission aura is composited behind opaque matter; when light exists, exposed solid, powder, and field contours sample that same low-resolution field with clamped bilinear coordinates and profile-specific response, changing RGB but never alpha or semantics. Both backends shade energy as a luminous semantic core plus the existing broader aura; Fire/Plasma use warm flowing detail while radioactive carriers use cool scintillation without inheriting solid-radioactive texture. A paused brush edit remains pending until its scheduled reconstruction is presented, so throttling cannot strand stale liquid, gas, or light volume.

The browser audit also has three forced-Canvas presentation probes. The dense probe fills the deterministic 612×384 world with Metal, warms ten one-cell-toggle frames, then records thirty steady-state submissions from field scheduling through the final 2× Canvas composition. A paired contour-stress probe fills the same world with repeating connected 2×2 Water islands separated by one-cell gaps. Ordinary liquid styling then invalidates all 240 32×32 contour chunks on every requested frame; the probe times another ten warmups and thirty complete presentations and reports its p90 divided by the same-process dense-Metal p90. Samples that rebuild atmosphere, liquid, or emission fields are reported separately and excluded from both distributions. The canonical-atmosphere probe toggles gas-field lighting for twenty samples and times the enabled refresh, including atmosphere re-shading, `putImageData`, and final 2× composition. The Node contour helper is deliberately narrower: it is useful for isolating analytic-raster cost and visual-path deltas, but it omits full-grid styling, reconstruction, browser uploads, and final composition, so its pathological duration is not a final-frame claim. The timer is enabled only by `inputAudit=1`; normal rendering has no timing calls. Treat median/p90/maximum and the paired ratio as diagnostic telemetry, not fixed CI thresholds, until repeated same-process measurements establish a host-stable regression budget.

The contour raster now converts each semantic cell's 3×3 categorical neighbourhood to one nine-bit mask and reuses 975 bytes of module-static axis geometry across 1×, 2×, 4×, and 8×. True-zero Empty cells leave the already-cleared chunk planes untouched; transparent nonzero RGB remains preserved. Complete pixels/coverage/ownership signatures pin byte-identical output for Grains, Local, and Smooth at all four scales. On the current host, the isolated all-240-chunk helper measures `94.74/96.14 ms` median/p90 with flat RGB and `136.92/143.73 ms` with meniscus shading. The full browser presentation measures dense Metal at `41.8/44.4 ms`, the connected-Water contour fixture at `125.6/127.2 ms`, and a same-process contour/dense p90 ratio of `2.86`; all thirty samples in each distribution were steady-state samples with no field rebuilds.

The WebGL half of the same browser audit requests thirty canonical composed-frame samples after shader warm-up. It uses `EXT_disjoint_timer_query_webgl2` when the driver exposes it, polls one pending query without blocking, discards disjoint or invalid results, and reports the timing source explicitly; unavailable or failed timer queries fall back to CPU submission timing and reset the distribution so unlike measurements cannot mix. Every query is deleted on completion, failure, presenter teardown, render error, or invalid context. The first SwiftShader 2× baseline produced 30 usable GPU-query samples with none discarded: `109.49 ms` median, `123.57 ms` p90, and `134.96 ms` maximum; a fresh full paired rerun measured `104.10/112.09/140.95 ms`, again with 30 usable and zero discarded. These software-GPU numbers are diagnostic and deliberately nonblocking. Normal rendering does not enable the timer or make query calls.

At the default 2× presentation scale, compatible solid and liquid contours use monotone cubic Hermite interpolation over local occupancy. Its one-dimensional weight has the same half-cell integral, which explains the symmetric local kernel but does not by itself prove final thresholded raster area. The composed gate therefore blank-differences exact curved fixtures, normalizes their visible area into world cells, rejects signal on a padded outer ring, and retains isolated Water/Sand controls. Solids and liquids use their analytic density slopes for key/fill diffuse light, broad specular response, Fresnel-like edge reflection, and bounded environment tint. A separate contour-local solid bevel keeps long straight boundaries from reading as flat cutouts: it reuses the Hermite first derivative, changes only RGB for authoritative trait-free non-emissive solids, and is exactly absent from powder, fluids, energy, walls, cavities, unlike seams, and dense cores. Its off→on→off composed probes cover Metal, Glass, and DTEC with byte-identical support; WebGL adds no sample or resource, while the full-world repeating-Metal Canvas helper measured `152.86/157.72 ms` median/p90 with the bevel disabled and `166.61/172.79 ms` enabled on the current host. Liquids add depth-dependent tinted transparency and caustic variation. Normal WebGL also gives exact dense, trait-free Acid a small Rec.709-neutral reactive core shift, reusing its existing field depth, Fresnel contour, sheen, and caustic values; shores, droplets, seams, walls, foreign contacts, and emissive owners stay on the generic path. Translucent-rigid Glass, Ice, solid QRTZ, DRIC, NICE, and RIME use reduced opacity plus cool internal/reflection tint and dense-body emission-field coupling. Canvas Glass now reuses its existing exact-species optical-depth byte for the same bounded deep-pane cool transmission/absorption cue after the first interior layer, without changing alpha, support, walls, or the separate refraction path. Exact Glass and Ice also refract a coexisting native-wall scene pattern without framebuffer sampling: the wall/material fields remain separate, only the analytic pattern coordinate moves, Glass bends a continuous asymmetric card in opposite directions at its signed shoulders, and Ice averages stable opposing facets. Canvas source-overs the unchanged material alpha onto that wall; normal WebGL reuses its final wall composite, while the direct 8× mesh restores the same separate-ID backdrop with one nearest wall sample only for active-wall empty or translucent fragments. No wall ID/shape/alpha, particle support/alpha, target, buffer, or upload changes. This deliberately avoids a 60.16 MiB second 8× color target; it is semantic-scene refraction of native walls, not arbitrary already-composited framebuffer refraction. Exact unlike-liquid RGB selection, wall separation, energy support, and semantic occupancy stay authoritative. Powder exposes three comparison styles in one mobile-friendly control. Grains forces every occupied powder cell to a square and forbids empty-side coverage. Local uses temporal stability and the short settled contour but ignores the long field. Smooth is the default and additionally feeds settled powder into a shared full-resolution slope field: two horizontal radius-10 box passes create a triangular long-tangent estimate, a tight five-tap vertical pass preserves pile height, and RGBA bytes carry density, signed gradients, and local solid/powder support. Canvas and WebGL blend this wide estimate only into top/slope-facing deep heaps: occupied powder needs two exact same-material cells below plus lateral support, and empty-side projection needs three. One- and two-cell Clay/Concrete ridges, branches, and ledges therefore retain the Local curved contour instead of being averaged away. One adjacent empty presentation cell may receive coverage only when cardinal neighbours select one exact stable powder owner without ambiguity and local support is sufficient. The result remains presentation-only: long blur input is stable powder only, solid support is local, walls are excluded, exact donor RGB is exclusive, and neither physics occupancy nor the one-cell growth bound changes. The deterministic field test measures lower shallow-slope second-difference energy without shifting mean height; 4×/8× unit gates require every occupied column subpixel to retain at least the documented Local floor, and Grains must fill one exact axis-aligned semantic square with no outside coverage. Unlike powders share categorical powder-phase coverage but keep exact exclusive RGB, and ambiguous empty-side contacts are rejected rather than chosen by scan order. Solid coverage accepts other solids but deliberately ignores gas, liquid, and powder support, so contact cannot wobble an otherwise unchanged solid outline. The render lab's exact shallow Sand slope plus curved Sand/Salt and Metal/Glass contact capsules exercise slope continuity, exclusive sides, one connected occupied body, and a non-straight internal seam. Canvas uses reusable chunk raster storage with a one-cell semantic halo. The Detail control and `renderScale=1|2|4|8` remain real per-axis sampling. Canonical WebGL 8× produces a true `4896×3072` root target inside the 8,192-axis/16,777,216-pixel budget. The semantic shader is a direct world-sized mesh rather than a Pixi Filter, avoiding a redundant source pass/target. Redundant MSAA and extra diagonal/ring probes are disabled, and the temporary compatibility Canvas is held to 2×; every fallback and contour backing is zeroed after promotion. That Canvas stays visible for a bounded 30-second cold warm-up instead of falsely failing at the ordinary 10-second deadline. The dedicated gate requires requested/effective 8×, zero browser errors, the same CSS rectangle as 2×, all four Detail options with 8× selected, preserved Local/Smooth Clay/Concrete support and holes, plus an exact 8×8 high-zoom Grains square. Unsupported/larger targets still downgrade through the budget or normal WebGL-error fallback. Output work grows quadratically, so 2× remains default and 4× remains the practical routine high-quality choice.

`npm run audit:material-atlas:8x` is the focused catalog companion to the exhaustive 8× release matrix. It starts one real 4896×3072 WebGL document, captures the blank presentation, prepares the full 217-identity atlas in that same document, fence-owns the rendered capture, and proves exact semantic ownership plus visible composed output for every projection. It retains the full gate's backing-scale and renderer contract while avoiding a redundant second cold 8× startup; it does not replace the broader phase, recovery, interaction, or effect-toggle release evidence.

`npm run audit:powder:8x` is the fail-fast companion for direct-mesh powder work. It uses the same production bundle, true 4896×3072 backing, completed GPU fences, canonical shallow Sand slope, and composed Grains/Local/Smooth captures as the exhaustive gate, but returns before the unrelated long effect-toggle and recovery matrix. Its 20/50/80% contour normalization uses the first connected interior plateau behind the analytic edge, so retained mineral facets deeper inside the pile cannot be mistaken for silhouette width. It checks bounded Smooth error and transition width, distinct square Grains geometry, and a minimum Smooth interior microcontrast; the exhaustive `npm run audit:8x -- --production-bundle` remains the final release authority.

Opaque solid contours now also receive a default-on coloured response from the shared emission field. Eligibility is deliberately narrow: only authoritative, trait-free, non-emissive `Solid` contour cells qualify. Powder, liquid, gas, energy, translucent rigid, native walls, dense cores, and reconstructed cavities are exact no-ops. The effect is an RGB-only screen blend with its directional addition capped at `0.12`; alpha, blank-differenced support, semantic ownership, cavity reconstruction, and physics remain invariant. Canvas computes one signed outward normal per eligible world cell and reuses the four values from its existing clamped bilinear emission sample, adding no allocation or render-scale-dependent work. Its full-world repeating-contour, varying-emission diagnostic measured `18.91/19.29 ms` median/p90 on the current host; localized runtime light still rejects unreachable cells before sampling. Desktop/high-quality WebGL takes at most one guarded outward emission fetch, while compact/mobile and true 8× reuse the centre emission sample with no additional fetch or resource. The browser audit records an independent off→on→off sequence around the profile matrix: the Fire-facing side of Metal must gain a bounded warm response, the ELEC-facing side must retain a bounded second-emitter response, the repeated off frame must be byte-stable, and dense Metal core plus Sand/powder controls must remain unchanged. It separately pins the Metal support footprint and bounds the paired Canvas/WebGL response ratio.

Liquid native-wall refraction extends that zero-framebuffer-copy contract to authoritative semantic non-emissive liquids. Water, Oil, Acid, and other non-molten families receive one coherent integer-cell lens displacement plus a bounded phase-categorical outer-slope displacement; unlike-liquid seams do not masquerade as outer shores. Reconstructed empty liquid support keeps a straight backdrop because its species/optics cannot be proven, although it may stabilize a semantic neighbour's shore classification. Lava/molten and emissive liquid are exact no-ops. The deterministic atlas includes independent Water/Oil cards plus a wall-backed Lava block with a reconstructed pinhole as a zero-response control. WebGL quantizes displacement in world-cell space, so one particle cell cannot change pattern phase between 1× and 8×. The path adds no lookup allocation, time-varying ripple, texture fetch, pass, target, upload, or alpha/support change.

Dense solid mesostructure stays inside the existing semantic traversal and fragment shader. A single cubic-smoothed triangular macro height is oriented by optical family—rigid `(2,1)`, organic `(1,4)`, device `(4,0)`, radioactive `(3,-2)`—with a matching analytic WebGL gradient. Granular profiles opt out so Sand and powder families keep their cell-scale texture. Canvas blends only proven four-cardinal exact-material interiors toward their canonical RGB by a family-specific amount, then applies the shared macro light; trait-bearing and emissive accents bypass that cohesion. Deep smooth-rigid/cellular interiors retain roughly one third of their authored static detail rather than collapsing into a uniform plastic swatch, while the depth proof still excludes every contour, hole, wall, seam, thin structure, trait, and emissive owner. For bright-canonical solids, over-range highlights are scaled uniformly instead of clipping one channel, preserving hue. WebGL attenuates its existing family micro-patterns only in the same dense interior and does not change alpha or cavity eligibility. The composed gate requires each Metal/Plant/VIBR/DTEC sample to retain macro luma range `>= 7` while keeping mean adjacent microcontrast `<= 9`; a separate dense-Sand sample must retain microcontrast `>= 3`. Existing dark-pit, clipping, separator, hue, and silhouette gates remain in force.

Family mesostructure must participate in body shading rather than being painted over the completed surface. Canvas naturally satisfies this ordering: `shadeCanvasMaterial` writes family RGB before `applyCanvasSolidBodyOptics` applies depth absorption, family reflection, relief, and lighting. Its radioactive branch reuses the already-computed stable cell noise beneath the sparse animated scintillation, so bulk isotope texture does not flicker as one decal. WebGL's late family block retains its branch-local waves to avoid register pressure at true 8×, but additive rigid/translucent bevel, organic fibre/pore, and device trace/node color is sourced from the already shaded `color` rather than raw `base`. Multiplicative pattern terms were already coupled. This is an arithmetic ordering correction: no texture, field, sample, waveform, pass, target, upload, or allocation is added. The focused solid-depth gate protects surfaces, holes, unlike seams, and thin strokes with exact zero response; the material-atlas gate compiles the real shader and requires all 217 projections to remain visible; the true-8× gate waits on eight completed GPU fences and then verifies both forced-stall and context-loss recovery.

The seven native Sensor bodies (DTEC through VSNS) additionally calm their repeated eight-cell circuit cadence only inside an exact deep solid core. Normal WebGL keeps full traces at contours, wires, shallow material, holes, and glyphs, while the proven interior receives a restrained sensor-tinted panel crown/pocket and grazing bezel reflection. This makes a thick DTEC body read as one instrument face rather than a tiled circuit sheet. The transform reuses the existing depth, relief, Fresnel, and environment values; it is RGB-only and adds no sample, state, resource, or physics decision. `--sensor-graphics-only --webgl-only` covers all seven cards, open notches, attached wires, isolated controls, and exact off→on→off restoration.

Optics and semantic identity are composable. The palette alpha byte describes how the current physical phase scatters, absorbs, or reflects light; the style alpha byte independently carries radioactive, organic, fibrous, source, sink, channel, force, and carrier roles. Radioactive powders therefore use metallic/sooty grain optics, radioactive liquids use aqueous or viscous transmission, and radioactive gases use sooty volume optics while retaining nuclear scintillation through `RenderTrait.Radioactive`. Seed and Yeast use rough-granular topology while retaining `RenderTrait.Organic`; solid VIBR/ISZS and Wood/Plant/VINE keep their solid family optics. This prevents a toolbox category from routing a gas, liquid, or powder through solid mesostructure. Packed-lookup tests assert both bytes together, native-projection tests cover BIZR and virus phase families, and the Canvas/WebGL material-atlas gate requires all 217 identities to remain visible.

Botanical identity is a bounded RGB layer inside existing material shading, never a geometry layer. Canvas applies deterministic Wood rings/axial grain, Plant veins, VINE strands, SEED husk facets, and YEST colony speckle before body depth or powder cohesion. WebGL reuses the organic `fibre`/`pores` and granular `grain`/`grainFacet` values already evaluated by the owning family branch. On dense PLNT bodies its cell-frequency fibre is deliberately only a quiet undertone: depth-proven canopy crown/pocket, leaf clusters, and waxy sheen own the visible form, avoiding repeated scanline bands at ordinary viewing distance. The later generic Organic/Fibrous role tint skips exactly these five IDs to avoid double styling; viruses and actor projections keep it. Tests require deterministic distinct responses capped at 12 bytes/channel, unchanged alpha, and an exact non-botanical no-op. The focused solid-depth scene protects exposed skin, holes, unlike seams, and thin strokes, while the native growth test keeps upstream SEED-to-Wood/Plant behavior authoritative.

Semantic mechanism roles have an independent default-on A/B gate. Canvas and WebGL render the existing Emitter, Sink, Channel, and Force bits as stable broad mechanism glyphs: warm emitter cores/rings, cool sink cores/rings, diagonal channel rails/nodes, and paired force rings. The toggle changes RGB only; DTEC is the neutral device control, repeated-off frames must be exact, and blank-differenced support must not change. WebGL's role block rejects `surfaceOnly` reconstruction so categorical metadata cannot leak into a cavity, and channel-only fragments skip radial setup. The gate pins the exact card identities/walls, samples emitter core/annulus/background, matches PRTI node/rail/off-rail probes at the same sink radius, samples force inner/outer rings and their gap, and compares normalized Canvas/WebGL spatial signatures. The canonical sample cards are CONV `(526,279)`, CLNE `(405,304)`, PCLN `(445,304)`, DTEC `(485,304)`, PRTI `(525,304)`, and ACEL `(565,304)`; run `npm run audit:browser-input -- --role-graphics-only` for canonical 2× WebGL evidence, add `--require-canvas-visuals` for paired diagnostics, and use `--scale-eight-only` for the independent enabled-shader 8× fence/atlas/recovery proof.

Canvas recovery now also retains the native body language of the ten transport/actuator owners (DMG, FRME, PIPE, PSTN, RPEL, GPMP, PPIP, PUMP, PVOD, and STOR) and twenty exact electronics owners (ARAY through LCRY, excluding semantic source/state projections). It uses the same world-anchored rail, lumen, ring, coil, bay, and node vocabulary as normal WebGL, but as bounded allocation-free CPU RGB arithmetic after common powder/solid body work and before traits, retained state, sources, and thermal overlays. Native walls, emission, alpha, semantic ownership, support, holes, channels, and physics remain outside the layer. Both default-on controls are shared with WebGL, so a Canvas context-loss recovery preserves the intended material read instead of collapsing those bodies to a generic device plate. `npm run audit:device-identities` runs the paused normal-detail Canvas/WebGL off→on→off atlas, proving exact source topology, bounded RGB response, distinct owner motifs, bounded composed coverage, and repeatable disabled presentation without substituting a true-8× capture.

The eight default-optics Field bodies now retain their identity at normal detail as well as true 8×: BHOL/NBHL/NWHL carry a dark aperture and coloured rim, VOID/WHOL a pressure ring, PRTI/PRTO directional portal apertures, and TRON a lime rail lattice. Canvas and WebGL use a shared default-on switch, static world-cell arithmetic, and the same ordering before later role/source overlays; no sampler, field, clock, alpha, support, ownership, wall, or physics decision is introduced. `npm run audit:field-profiles` stages all eight owners with bodies, holes, channels, thin rails, isolated cells, blank guards, and neutral force/device/role controls through a Canvas/WebGL flat→styled→flat check. `npm run audit:field-profiles:8x` separately proves the exact same switch and atlas on the true `4896×3072` direct mesh with completed presentation fences, without making a narrow Field change wait for the exhaustive unrelated 8× release matrix.

Large exact-species solids additionally receive a true two-dimensional surface-to-core thickness axis. An allocation-free forward/reverse Manhattan scan writes depth into the already allocated phase-local auxiliary byte, stopping at world/native-wall edges, holes, or a different material; Powder stability and Liquid column depth remain untouched. Owner changes clear stale depth immediately, while the full scan runs only after solid or wall edits at the bounded reconstruction cadence, independently of continuously moving powder. The first interior layer is protected, and the field changes RGB only, so isolated particles, one-cell wires, authored holes, unlike contacts, alpha, support, ownership, and physics remain exact. Rigid, organic, device, radioactive, and translucent families use separate restrained absorption vectors; traits are applied afterward. WebGL guards one sample of its existing `r8` texture and adds no resource, target, pass, allocation, or second upload. The focused `--solid-depth-only` audit measures Metal, Wood, Plant, DTEC, solid VIBR, and Glass; every surface/thin-line/hole/unlike-seam control plus off→on→off repetition must remain byte-exact, with blank-differenced support changing by less than `0.01%` in both backends.

Rounded/notched solid plates additionally derive signed mean curvature from the same four Hermite occupancy samples, including the analytic second derivative. Rigid, organic, device, radioactive, and translucent families receive small bounded RGB-only gains; granular/powder matter opts out. Straight edges, dense interiors, alpha, support, and material ownership remain unchanged. Canvas rejects non-contour world cells before supersampled evaluation so 8× does not evaluate curvature across a whole solid body. Exact Glass and Ice also receive a separate RGB-only lens shell from the already available macro relief plus edge light/Fresnel; Glass is clearer and more coherent, Ice is weaker and frosted, and Metal is an exact no-op. Independent flat→effect→flat captures require deterministic repetition, bounded curved-edge/lens response, zero flat/core/control response, and byte-identical blank-differenced support in both backends.

Liquid surface lighting follows shared-field support even though the existing semantic/reconstruction path still owns alpha. Canvas attenuates binary-neighbour contour noise as centre field alpha becomes cohesive and permits local surface glints only under empty semantic air with low field support above; unlike species remain hard RGB seams. Its connected semantic cells and reconstructed holes share a centre-plus-cardinal field-relief basis, combining a bounded upper-left slope with convex-crown and concave-pocket response. Authoritative semantic cells scale that basis by their optics class, while reconstructed empty support keeps the neutral default gain. At a proven unlike semantic-liquid contact only, canonical field RGB contrast adds a dense-support-gated signed interface relief; ordinary pool cells retain the alpha-only fast path. A centralized Canvas body-optics transform now consumes only the already-computed field alpha, exact neighbour density, signed relief, and top exposure. It applies family-specific RGB absorption and a continuous meniscus tint to Water, Oil, Acid, and generic liquids; sparse droplets are exact no-ops and Molten is deliberately restrained. The transform replaces their duplicated local fire-plane highlights while leaving reconstruction, refraction, shared emission reflection, alpha, and ownership untouched. Lava's continuous body glow stays in the broad emission field and retains its separate emissive surface path. WebGL reuses the already sampled centre and four cardinal liquid `vec4` values for both connected-pool normals and the species-contact meniscus, adding no texture fetch. Neither backend averages unlike liquid RGB or changes coverage.

Dense WebGL liquid bodies also reuse the shader's existing broad-sheen and caustic-wave values as a centred macro-relief term. The term is gated by proven liquid depth and scales RGB uniformly: aqueous optics favour a soft caustic, oily optics favour broad sheen, corrosive optics retain a sharper bounded response, and molten optics keep the weakest reflected modulation plus their existing body exposure. It adds no trigonometry, texture fetch, field, target, pass, alpha, or reconstruction support. The paired acceptance capture now bounds Water/Oil/Acid/Lava macro depth, mean exposure, micro detail, coverage, and pinned-channel clipping between Canvas and WebGL; all four families pass with complete sampled coverage and zero pinned channels.

Connected liquid volumes now receive a separate family-chromatic key/fill after the existing scalar body relief. Water uses a cool aqueous key, Oil a warm oily key, and Acid a sharper corrosive split; Lava/Molten, sparse droplets, unlike-liquid seams, traits, emissive matter, and foreign contacts are exact controls. The transform changes RGB only, preserves corrosive Rec.709 luminance, and reuses the existing field alpha, cardinal density, signed relief, and macro wave. Canvas adds no allocation or sample, while WebGL adds no texture read, field, target, pass, upload, output-scale resource, or expensive shader operation. The paired browser audit requires deterministic off→on→off repetition, less than 0.1% support drift, bounded Canvas/WebGL response ratio, and unchanged Metal, Lava, isolated-drop, and exact Water/Oil-seam probes. The dedicated true-8× audit repeats the same checks at an exact 4896×3072 backing; the accepted capture measured RGB RMS responses of 1.06/0.42/2.80 for Water/Oil/Acid, zero Lava and seam response, and no browser errors. The deliberately pessimistic all-612×384 Canvas Water profiler measured `11.24/11.37/11.40 ms` median/p90/max with flat chroma and `36.72/37.15/37.34 ms` with chroma on, while `combinedAllocatedBytes` remained `11,816,456`. Treat that roughly 25.5 ms delta as an all-world optimization ceiling, not free runtime work; ordinary scenes pay it only for eligible authoritative liquid cells.

Ordinary connected liquids also receive a separate large-scale surface-to-core optical-depth axis. The existing 12 Hz liquid refresh scans exact species top-to-bottom and writes directly into each presenter's caller-owned auxiliary byte: an exposed cell is zero, the same liquid below advances six byte levels per cell to saturation, and a different species or phase restarts the run. This shares the existing `r8` GPU source with phase-exclusive powder stability and adds no CPU field plane, GPU texture, target, pass, persistent allocation, or second auxiliary upload in a frame; WebGL adds one exact-liquid fetch from that existing texture, while Canvas reads the byte directly. A separate scalar isolates the RGB-only family absorption from existing meniscus and macro chroma. The focused paired gate measured deep Water/Oil/Acid at `2.13/3.84`, `1.55/2.51`, and `3.21/3.33` RGB RMS for Canvas/WebGL, versus smaller surface responses; peaks stayed at or below 14 bytes, repeated-off frames were exact, Lava and the isolated droplet remained byte-exact, unlike contact stayed bounded, and screenshot-derived support drift stayed below 0.1%. True 4896×3072 repeated the isolated gate at `4.05/2.47/3.43` RGB RMS with zero control response and no browser errors. Its eight-sample GPU-fence timing remained `3026.6/3093.3/3102.8 ms` median/p90/max, and both forced-stall and context-loss paths still recovered to the exact 1224×768 Canvas fallback with camera/input preserved. The full 612×384 exact-species scan measured `0.68/0.81/0.84 ms` median/p90/max on the current host; `LiquidDensityField` remains `3,760,392` bytes and combined render-field allocation remains `11,816,456` bytes.

The normal-WebGL liquid-depth audit also performs a separate Liquid Volume off→on→off capture for the exact dense Acid core. It proves a bounded chromatic deep-core response above the Acid surface while isolated droplets, unlike-liquid seams, and Lava stay byte-exact; semantic topology, alpha, and support are unchanged by construction and protected by the surrounding depth fixture. This directly exercises the existing Rec.709-neutral Acid body branch for exact material `13` rather than inferring it from the generic optical-depth control. Material `16` is SaltWater, not Acid.

E38 adds a separate normal-WebGL Oil Volume Finish capture at 1×/2×/4×. It is
a strict child of E22 and affects only exact Oil `8` with Oily optics in an
already-proven connected, deep, ordinary interior. The shader recombines the
existing broad sheen, caustic, macro-relief, reflected-environment, and depth
signals into broad amber crowns and cooler pockets; it changes RGB only and
adds no sample, field, pass, target, allocation, or animated carrier. The Oil
audit first reruns the frozen E22 parent with E38 disabled, then captures E38
off→on→off across both whole Oil bodies and their transition/mid/deep bands,
while preserving semantic topology, alpha/support, walls, depth, contacts,
foreign materials, and a byte-exact repeated-off frame. Canvas and compact
true 8× remain excluded controls; requested-on true 8× must report E38
inactive for `scale-8` and complete the exact 4896×3072 GPU fence.

E39 adds a separate normal-WebGL exact-Acid Reactive Body capture at
1×/2×/4×. It is a strict child of E03 and affects only authoritative Acid
`13` with Corrosive optics in an already-proven connected, deep, ordinary
interior. The shader reuses E03's broad sheen, caustic wave, macro relief,
reflected environment, liquid depth, and species slope to form a broad reactive
green crown with opposing violet absorption pockets. It changes RGB only and
adds no texture read, field, pass, target, allocation, upload, output-scale
resource, or animated carrier. The dedicated two-pane fixture exposes two
whole 264×176 Acid bodies and exact surface/first/shallow/transition/mid/deep
depth bands, plus holes, chimney, pinhole, sparse Acid, a 3,072-cell native-wall
checker, unlike seams, foreign contacts, and material controls. SaltWater `16`
and BASE are exact controls; never treat material `16` as Acid. The audit
captures off→on→off at 1×/2×/4×, freezes whole-body and bandwise response,
requires byte-identical raw owners and repeated-off presentation, names every
bounded compositor-neighbour footprint, and caps cross-scale drift. Canvas and
compact true 8× remain excluded controls; requested-on true 8× reports E39
inactive for `scale-8`, promotes exact 4896×3072 WebGL, and completes its GPU
fence. The frozen production-WebGL matrix completed it in `5.25 s` with zero
browser errors.

E40 adds a separate normal-WebGL exact GUNP/BCOL Sooty Powder Body capture at
1×/2×/4×. It is a strict child of E05 and reuses the existing settled dry
Smooth powder depth, stability, slope, macro/facet balance, and body gate for a
porous warm Gunpowder or cool Broken-Coal crown, an opposing absorptive pocket,
and a restrained distinct core. The response changes RGB only and adds no
sample, texture, field, pass, target, upload, allocation, clock, alpha/support,
silhouette, owner, topology, state, or physics decision. The fixture includes
two broad exact-owner bodies, holes, open chimneys, thin columns, isolated
grains, full moving rectangles, a 3,072-cell BCOL native-wall checker, eight
material controls, Sand/Water and target-owner contacts, guarded blank space,
and genuine aqueous Sand/GUNP/BCOL mixtures. Its gate captures off→on→off plus
Local/Grains references, scans complete velocity/stability regions, freezes
whole/crown/pocket/core response and material spectra, retains internal
microchroma, and caps named compositor footprints and 1×–4× drift. Canvas and
compact true 8× remain excluded; requested-on true 8× reports E40 inactive for
`scale-8`, promotes exact 4896×3072 WebGL, and completes its GPU fence.

E41 adds a separate normal-WebGL exact DEUT Concentration Body capture at
1×/2×/4×. DEUT is excluded from E03 because its Radioactive trait is
authoritative, so E41 is a sibling selector rather than a weakened liquid-body
guard. The shader requires exact material `100`, Aqueous optics, Radioactive
trait, connected deep ordinary Liquid, same-species support, no reconstruction,
wall, emission, molten state, or foreign/unlike contact. It decodes the full
existing native `Uint16` state from the wall texture's B/A bytes. State zero is
flat; ordinary concentration controls a restrained cobalt response and the
compressed contribution saturates at `6000`. Two matched deep blocks prove
that `17000` and `65535` therefore render equivalently. A static allocation-free
parabolic carrier based on 24×16 world periods and a 48-cell diagonal supplies
curved cyan crowns, absorptive pockets, and core depth. The periods divide the
fixture's 144×192 card stride, so every state samples identical geometry and no
liquid animation clock enters the experiment. E41 changes RGB only and adds no
sample, texture, field, pass, target, upload, allocation, alpha/support,
silhouette, owner, native state, or physics decision.

The focused gate prepares all seven native concentrations plus expanded
high-word bodies, exact holes/notches/fine structure, zero/wrong-owner/species/
wall/contact/blank controls, and waits on a real WebGL completion before every
backing read. It freezes per-state body/chroma/spatial ranges, positive crown
and opposing-pocket grammar, full-word saturation, exact raw controls and
off→on→off repetition. The accepted run observed a `.37` maximum
cross-scale target RMS spread against the frozen `.50` cap. Normal composed
contact shoulders remain bounded to 12 framebuffer bytes as post-filter
footprints while raw boundary pixels stay exact. The composed realistic-rank
audit passes with E41 active and full support/zero clipping for every material
family. Canvas and compact true 8× remain excluded; requested-on true 8× reports E41 inactive for
`scale-8`, preserves all semantic/state/liquid/depth/wall/support digests,
promotes exact 4896×3072 WebGL, and completed its shared-deadline GPU fence in
`5.2105 s` with zero browser errors.

The Canvas liquid-body profiler compares the former scalar relief loop with the new helper under the deliberately impossible ceiling where every one of the `235,008` world cells is dense, exposed Water. Production invokes the helper only for actual authoritative liquid cells, reuses the existing three-float RGB scratch and field values, and adds no runtime-known scratch bytes, sample, reconstruction, upload, pass, or render-scale-dependent work. Qualified body cells calculate the curved caustic phase once and reuse that scalar for both the broad reflected band and narrow caustic lobe, so the Canvas fallback retains the exact composed signal without repeating its two trigonometric terms per cell.

Dense exact-material solid interiors add restrained low-frequency RGB/normal relief without a new field, pass, or silhouette change. Gas relief uses signed local curvature from the same four cardinal atmosphere-alpha samples already required for slope: convex crowns catch bounded broad light and concave overlap pockets self-shadow. Canvas chooses the outward-facing one of its four existing emission neighbours for bounded coloured scatter. Desktop/high-quality WebGL takes one additional emission sample two low-resolution field texels along the reconstructed outward normal; compact/mobile width performs no additional directional fetch. Both fall with optical depth, preserve atmosphere alpha/support, and re-style Canvas after either atmosphere or emission rebuilds. No neighbouring gas RGB, new field, pass, persistent buffer, or semantic/support change is introduced.

Gas volumes additionally receive species-spectral scattering from that same signed atmosphere slope, curvature, and authoritative mixed RGB. Rec.709 luma and normalized source chroma continuously interpolate between a restrained neutral/sooty warm absorbing fill and hue-preserving forward scatter with complementary absorption for coloured gas; Oxygen therefore responds blue-forward while Noble Gas retains a violet red/blue split. A low bounded shell keeps the cue visible on exposed joined billows, while signed relief still owns pockets and dense overlap shading. The transform changes RGB only and remains capped below a 16-byte composed channel delta. Canvas applies it during the existing half-resolution atmosphere reshape with zero additional allocation. WebGL adds phase-gated arithmetic after the existing gas scene-light response—no sampler, texture fetch, field, target, pass, upload, trigonometry, vector-normalization call, or output-scale-dependent resource. The focused `--gas-chroma-only` browser gate captures flat→spectral→flat frames for Smoke, Oxygen, Noble Gas, and compact FOG, requires distinct signed family response vectors, exact Water/Metal controls, deterministic repetition, and bounded backend magnitude parity. The full gate additionally proves unchanged screenshot-derived gas support, while true 8× repeats bounded response, exact controls, and off→on→off determinism without relying on a near-zero signed subpixel probe for hue direction. The accepted exact 4896×3072 run completed eight GPU-fence samples at `2951.8/3015.0/3041.1 ms` median/p90/max, preserved anchored input and square-grain/topology gates, recovered both forced stall and context loss to the exact 1224×768 Canvas fallback, and reported zero browser errors. The current all-field Canvas profiler reports `1.09/1.09 ms` median/p90 with spectral chroma disabled and `2.39/2.41 ms` enabled, with `0` additional allocated bytes and unchanged `11,816,456` combined field bytes.

Unlike exact solid materials now retain the phase-continuous outer silhouette while receiving a signed optical contact bevel. WebGL's four existing occupancy samples return both compatible coverage and whether a compatible sample is a different exact solid; the already computed Hermite derivatives turn that second component into one directional contact scalar without another semantic/style texture read. Canvas evaluates the same categorical contact at each true contour subpixel, including 4×/8× inspection output. The scalar is bounded and bipolar, changes RGB/normal response only, and is never used for alpha, ownership, cavity support, or a separator. Exact dense Glass and Ice also reuse the existing signed solid-relief wave as a nearly luma-neutral prismatic band: Glass is coherent and stronger, Ice is opposed and softer. No new noise, trigonometry, field sample, texture, pass, upload, allocation, or time term is introduced. An audit-only off→on→off capture requires a repeat-stable flat image, localized Metal/Glass seam response, distinct Glass/Ice chroma, exact zero inside opaque Metal, Canvas/WebGL magnitude parity, and identical blank-differenced support.

Direct contacts between unlike phases receive a second, deliberately restrained grounding cue so a liquid resting against a vessel or a settled powder touching liquid/solid no longer reads as two flat cutouts. The bottom render-lab row contains exact 70×19 Water/Metal, Oil/Glass, and settled Sand/Water capsules with a straight authored contact at `x=393`, `473`, and `553`. Both backends derive a bipolar key/fill response from categorical contact density and the existing Hermite derivatives, capped at ±6 RGB bytes. The response never changes alpha, blank-differenced support, exact owner material, cavity reconstruction, or simulation state. Air menisci, unlike-liquid seams, dense cores, walls, traits, emissive matter, Grains, moving powder, and reconstructed empty support are controls and must remain byte-identical when the switch changes. WebGL adds no sample or resource; Canvas rejects non-contact world cells before evaluating subpixels and allocates no render-scale-sized storage. The browser audit captures off→on→off frames, requires deterministic repetition and localized response at all three contacts, and compares Canvas/WebGL magnitude without requiring identical rasterization.

Connected ordinary liquid shores now have a second, alpha-only cohesion step after the established liquid body lighting. The old categorical result remains the reference capture. The new path trims only an authoritative same-species liquid cell at a proven air-facing connected contour; it never borrows Empty ownership or widens into a neighbour. Isolated droplets, unlike-liquid seams, dense Water cores, Lava/Molten, foreign matter, walls, render traits, and emissive material are exact no-ops. A connected sparse strand is intentionally allowed a very small continuity response rather than being forced back into discrete beads. On the canonical fit-view fixture, WebGL reduced connected-liquid micro-contrast from `6.70` to `6.64` and macro-luma range from `103` to `101` with identical `14,071.08` world-area support and `0.999` dominant-component ratio. Its sparse-strand response covered `0.014` of the control at `1.76` RGB RMS and a 30-byte peak. Canvas reduced boundary pixels from `1,774` to `1,772`, raised compactness from `0.345` to `0.346`, and reduced macro-luma range from `103` to `102`; world area changed only from `14,426.59` to `14,425.43`, while its sparse-strand response covered `0.012` at `1.38` RGB RMS and a 43-byte peak. Both off→on→off reference frames repeat exactly and report zero change for the four exact controls.

The same contour-light control now adds a family-chromatic Fresnel shell to authoritative ordinary liquid-air fragments. Aqueous matter receives a cool cyan key, Oil an amber key with a restrained neutral shadow, and corrosive liquids a green key. Canvas evaluates the shared Hermite contour density and normal without allocation; WebGL reuses its existing semantic and liquid-field slopes. The effect is RGB-only, bounded, and excludes reconstructed support whose exact optics cannot be proven. Dense cores, Lava/Molten, alpha/support, semantic ownership, and native walls are unchanged. The focused paired browser gate measures Water/Oil/Acid off→on→off vectors, exact repeat stability, zero Lava response, at-most-one-byte dense-core response, unchanged blank-differenced support, and backend magnitude parity. The accepted run measured Canvas/WebGL RGB RMS of `0.02/0.08` for Water, `0.11/0.22` for Oil, and `0.15/0.34` for Acid, with zero browser errors. No texture, fetch, field, pass, upload, or scale-dependent allocation is added.

Dense solid bodies now replace the last neutral macro-height contribution with a depth-gated family-chromatic response. Positive relief receives a restrained screen-like crown in the existing rigid/organic/device/radioactive/translucent key colour; negative relief receives multiplicative spectral absorption using the existing family shadow vector. The exact-species optical-depth byte protects the exposed skin and thin structures, while the existing signed relief supplies a broad deterministic band without another noise function, sample, field, pass, target, upload, or allocation. Reconstructed cavity support is excluded from the WebGL branch and Canvas applies the helper only to authoritative semantic solid cells. The focused off→on→off gate covers Metal, Wood, Plant, DTEC-class devices, radioactive solids, and Glass: Canvas/WebGL RGB RMS spans `1.72–9.87` / `1.56–8.49`, the largest response is 25 bytes, support changes by less than 0.01%, and exposed-surface, thin-stroke, authored-hole, and unlike-material controls are exactly unchanged. The pathological all-world Canvas solid-body profile is `14.05/15.06/16.97 ms` median/p90/max including a `7.56/7.67/7.77 ms` loop baseline, with zero additional storage and no dependence on presentation scale.

Opaque solid bodies also respond to nearby coloured scene light rather than leaving the shared emission field visible only at their contour. Canvas and WebGL reuse the centre emission sample, exact-species optical-depth byte, family profile, and signed macro relief already available at the shading site. Passive Organic/Radioactive/Fibrous identity may participate; active emitter, sink, channel, force, and carrier roles remain excluded, along with powder, translucent rigid, walls, emissive matter, reconstructed support, and the first optical-depth layer. The one-third-resolution emission field uses a nine-tap binomial kernel for a broader smooth reach, but the shader adds no fetch, field, pass, target, upload, or output-scale allocation. Canvas rejects cells outside the emission field's localized bounds before body-light evaluation. The focused `--solid-field-only` fixture places thick Metal, Plant, VIBR, and DTEC beside isolated warm/cool sources and retains Sand, Glass, and CLNE controls. Canvas/WebGL RGB RMS is `2.34/2.53`, `1.57/1.39`, `1.87/1.43`, and `3.44/3.81`; response peaks stay within 4–9 bytes, all controls and repeated-off frames are exactly zero, and blank-differenced support is identical. The production-shaped localized-source Canvas profile is `2.95/3.43/3.61 ms` median/p90/max; the deliberately pathological all-world/all-field ceiling is `72.04/81.36/90.88 ms`. Emission-field rebuild is `4.56/4.67/6.44 ms`, and its storage remains `1,357,824` bytes. Canvas must invalidate its existing supersampled contour chunks when this toggle changes because that opaque cached plane samples the relit base RGB.

Solid contour depth now uses a family-chromatic key/fill shell instead of multiplying every RGB channel by one scalar. Smooth rigid and translucent surfaces receive a cool key, rough settled material a warm mineral key, organic material a green-biased fill, and devices/radioactive families retain their own restrained response. The shell reuses the existing analytic Hermite gradient and is capped at an 18-byte channel delta. Deep settled Smooth powder joins this path only where the exact local powder contour is below the dense-core threshold, the existing bulk-depth/stability gate proves a supported heap, and the shared wide field supplies a stable normal. Grains, Local, moving or shallow powder, projected empty support, isolated grains, dense Clay cores, authored column holes, native walls, traits, emissive matter, and unlike seams remain exact. The paired browser audit captures Metal/Glass/DTEC plus the top of the deterministic Clay column, pins the Clay core and isolated Sand grain to zero response, proves byte-identical support across the complete notched column, and enforces Canvas/WebGL magnitude parity. The shader adds arithmetic only: no texture read, field, pass, target, upload, buffer, or 8× resource.

Deep stable Smooth powder now also gets a coherent RGB-only mineral-volume cue after canonical cohesion and scalar macro relief. Existing wide density and support count distinguish a supported shoulder from a genuinely deep core; the raw directed slope supplies an upper-left warm key and opposing fill, while the core absorbs light. The isolated response is clamped to `[-0.080, 0.085]`, the composed contour/body response to `[-0.085, 0.090]`, and the incremental Canvas channel delta is unit-gated at 24 bytes. Exact-material depth, lateral support, stability, density, and support-count gates remain authoritative, so the effect cannot create, remove, or recolour a one-cell grain, shallow ledge, unsupported column, or authored hole. The independent off→on→off switch disables only this chromatic term. The focused paired browser gate measured Clay at `2.71/2.10` RGB RMS and Concrete at `0.70/0.57` for Canvas/WebGL, with respective chroma RMS of `1.19/0.90` and `0.17/0.18`, peaks no greater than 6 bytes, exact repeated-off frames, complete occupied-cell recall, zero deep-hole leakage, and byte-exact isolated-Sand and hole controls. On the current host, the pathological full-world Canvas profiler measured the established bulk helper at `9.74/10.87/11.80 ms` median/p90/max with body depth disabled and `12.03/12.34/12.47 ms` enabled; it remains allocation-free and adds no persistent bytes. WebGL reuses its already fetched powder field and bulk-depth result. Neither backend adds a sample, allocation, field, pass, target, upload, buffer, or output-scale-dependent resource.

The granular optics byte now subdivides that shared topology into mineral, crystalline, sooty, and metallic/reactive responses. Salt/Snow/Quartz/BGLA/FRZZ/SLCN use a cool key and sparse glint; Gunpowder/Coal/BCOL attenuate facets and reflection; Thermite/BREC/BRMT combine a warm key with cooler absorption; Sand/Dust/Clay/Concrete remain the mineral reference. The packed palette byte, powder field, stability, exact bulk gate, and facet inputs already existed, so the shader adds arithmetic but no sampler, field, texture, upload, pass, target, or output-scale resource. Physical powder phase, rather than `RenderProfile.Granular`, now owns WebGL powder topology; life/radioactive/force powders therefore receive correct Grains/Local/Smooth and projection safety without losing their visual profile. The focused paired off→on→off gate proves nonzero bounded response for the five-family atlas row, cool crystalline/metallic shadow direction, reduced sooty reflectance, exact repetition, unchanged row support, complete notched-column recall, zero deep-hole leakage, and isolated-Sand no-op. The 217-identity Canvas/WebGL atlas also passes with exact 81-cell ownership and zero browser errors. The all-world mixed-family Canvas ceiling is `32.90/45.60/48.38 ms` median/p90/max versus `28.57/41.02/42.98 ms` for the single-mineral worst case; render-field allocation remains `12,051,464` bytes.

The independent true-8× gate also compiles and runs this shader at requested/effective `8/8` on one `4896×3072` target. Local and Smooth retain every authored Clay/Concrete cell and all deep holes, zoomed Grains yields one fully filled 8×8 square, the embedded 217-material stress atlas remains complete, and forced fence-stall plus context-loss recovery return to the bounded 2× Canvas surface without camera or input loss. The run reports zero browser errors and no new 8× resource class.

At true 8× the direct compositor retains the exact static phase of the normal
Energy grammar for FIRE, PLSM, ELEC, GRVT, NEUT, PHOT, PROT, BRAY, and EMBR.
This preserves flame tongues, plasma cells, carrier rails, and detached embers
instead of reducing the nine native identities to a generic seeded hue. The
direct path deliberately removes clock motion only: the helper is RGB-only
arithmetic over already-live material/world coordinates, adds no texture fetch,
field, pass, output-scale resource, alpha/support/ownership change, or physics
decision. The energy/radioactive atlas proves all nine identities remain
distinct and bounded through a flat→styled→flat sequence while retaining their
semantic topology and sparse PHOT controls.

Native typed Lava now retains its `ctype` ancestry on the canonical direct WebGL path as well. True 8× reads the already shared packed B/A state word only for exact non-emissive Lava, rejects a co-located native wall, and applies a bounded RGB-only silicate/metal/mineral/electronic/radioactive motif; untyped Lava is exact-flat. It adds no field, sampler class, pass, target, upload, alpha, support, or physics decision. The completed-fence `4896×3072` gate stages the six native states plus authored holes, notches, thin/isolated structure, untyped, wrong-owner, Water, cooled-solid, and blank controls; it requires flat→styled→flat semantic stability, distinct typed responses, exact protected controls, and then restores the DEUT/VIBR state fixture before forced-stall and context-loss recovery. The latest complete run reported eight GPU-fence samples at `1711.4/1764.7/1875.2 ms` median/p90/max with zero browser errors.

The direct true-8× compositor now also preserves native SPRK host and lifetime styling. Its exact owner reads the already packed B/A word alongside the other native state owners: the high bit is presence, the low byte is the host ID, and the remaining high-byte bits are the bounded life counter. A static host-family carrier/junction tint then changes RGB only; it does not alter alpha, support, ownership, wall composition, native state, physics, or add a sampler, field, pass, target, upload, or allocation. The real `4896×3072` gate stages all six retained host/life families, verifies semantic/presentation-state identity through flat→styled→flat captures, requires distinct bounded responses, and holds absent state, unrepresentable host, wrong owner, Water, Metal, and blank controls exact before the normal forced-stall/context-loss recovery sequence.

The canonical direct mesh now also renders the native POLO lifecycle at true 8×. It decodes only the exact owner from the same packed B/A word: emissions, cooldown, proton dose, and its bit-eleven presence flag produce a bounded static radioactive carrier/ring/capture grammar. The change is RGB-only and does not alter alpha, support, ownership, wall composition, native state, physics, or introduce a sampler, field, pass, target, upload, or allocation. The `4896×3072` release fixture proves ready, cooling, mid-dose, near-transmutation, and spent states through flat→styled→flat semantic snapshots and distinct bounded framebuffer responses; zero state, wrong owner, PLUT, PROT, NEUT, and blank controls remain exact before the normal forced-stall/context-loss recovery sequence.

The canonical direct mesh also restores native SPNG hydration at true 8×. Its exact owner reuses that same packed B/A word: bit six retains authoritative presence, bits zero through five retain `life` hydration, and dry SPNG remains an exact visual no-op. Wet states receive the existing static pore, rim, and wet-glint grammar as bounded RGB-only arithmetic—no additional sampler, field, pass, target, upload, allocation, alpha/support/ownership change, or physics decision. The completed-fence `4896×3072` fixture stages dry/low/mid/high/saturated hydration through flat→styled→flat captures, requires distinct monotonic wet responses, and keeps zero state, Sand, Water, Steam, Salt, and blank controls exact before normal forced-stall/context-loss recovery.

Native GEL now projects its authoritative TPT `tmp` hydration through the same owner-multiplexed state word: exact GEL stores `0..100` in low bits `0..6`, where zero is the valid dry no-op. Canvas and WebGL retain the native orange-to-blue progression with only bounded RGB pore/vein/body variation; they do not change alpha, support, liquid species, holes, thin structures, walls, physics, or renderer resources. The paired normal-detail audit holds exact `0/10/35/70/100` owner states, verifies dry/zero/Water/SPNG/BASE/blank controls and flat→styled→flat topology, and measures a monotonic orange-to-blue response. The true `4896×3072` direct compositor shares the SPNG/GEL packed-state read and repeats that exact fixture after a completed GPU fence before the normal fallback-recovery checks.

PQRT (Quartz powder) and QRTZ (its native solid product) now also project their upstream `tmp2` crystal seed through the same state word: exact owners retain only `0..10` in low bits `0..3`. The seed is not a hydration or lifetime proxy: zero is a valid dark native state and five is the neutral point. Both Canvas and WebGL apply the bounded RGB response derived from upstream `(tmp2 - 5) * 16` after common body optics, without changing semantic coverage, alpha, support, native walls, or the one packed-state fetch used by the true-8× compositor. Native/OPS tests cover both owners and keep the seed separate from typed-Lava ancestry.

FILT now preserves its native wavelength identity instead of reading as a generic dark rigid cell. The shared packed state carries an exact FILT presence marker, the three overlapping 12-bit wavelength-band populations from native `ctype`, and visual `life` through four. A nonzero `ctype` directly reconstructs the upstream `624/(R+G+B+1)` spectrum; the all-zero sentinel derives the same five-bit spectrum from temperature. Both renderers keep coverage and alpha semantic, using the native blend-life only as a bounded RGB reveal. Normal and direct true-8× WebGL reuse their packed-state fetch and semantic temperature byte; no material field, sampler, target, or post-process was added. The 8× audit verifies the composed screenshot, rather than relying on post-composite `readPixels` from the intentionally discardable production target.

LCRY's native `tmp2` charge is likewise an RGB-only direct-WebGL state layer: its exact owner, packed presence bit, charge order, semantic occupancy, and alpha remain unchanged while the visible charge ramps from dark through the neutral gray reference to the bright state. The true-8× gate measures that progression and the off→on→off controls from completed composed screenshots. It intentionally does not inspect `readPixels` after composition, because the production target is discardable and can validly return cleared bytes after an otherwise correct presented frame.

PIPE and PPIP now expose their retained native transport state without duplicating it in JavaScript. The low state byte is the public carried `ctype` identity when one round-trips, bit 8 retains the fact that even an unknown payload is loaded, bits 9–10 preserve TPT routing colour, and bit 11 is PPIP's native pause state. Both renderers use a quiet, static RGB transport cue after the device body: compact liquid/gas-or-energy/granular/rigid families for known cargo, neutral for unknown cargo, route colour for an empty carrier, and a restrained paused PPIP shift. Coverage, alpha, walls, physics, native `ctype/tmp`, and OPS serialization remain authoritative. A direct-backend test matures each native pipe through its BRCK/init lifecycle, forces actual Water ingestion through upstream `Element_PIPE_transfer_part_to_pipe`, and checks the resulting projection plus OPS1 persistence. WebGL normal detail and the direct true-8× mesh reuse their existing packed B/A state read, adding no palette lookup or rendering resource. `npm run audit:pipe-state` covers the paused state atlas across Canvas and WebGL; `npm run audit:pipe-state:8x` runs the same exact-owner, payload/route/pause, topology, RGB-only, and repeated-flat checks on the fenced direct 4896×3072 path.

SWCH now exposes its true native conduction threshold: the state word is present only for the exact owner, and its on bit follows TPT's `life >= 10` graphics rule. The renderer layers a bounded static emerald cue over an on switch only; off and decaying switches, absent words, wrong owners, and wall-backed controls remain unchanged. A direct backend test drives the official PSCN-on and NSCN-off spark paths and verifies OPS1 restoration. Normal WebGL plus `npm run audit:swch-state:8x` test off/decay/on cards, topology controls, RGB-only off→on→off recovery, and the fence-settled true 4896×3072 compositor without adding a renderer resource.

STOR exposes its native retained particle without a second storage model: `TYP(tmp)` is projected as an exact public payload ID when possible, bit 8 records even an unknown retained payload, and bit 9 tracks native post-release `life > 0` cooldown. Canvas and WebGL use the existing packed state fetch to add only a bounded RGB reservoir cue, keeping unloaded STOR, foreign words, walls, alpha, support, and topology unchanged. The direct backend test proves real Water capture, OPS1 round trip, and PSCN/SPRK release. `npm run audit:stor-state` and `npm run audit:stor-state:8x` cover loaded/unloaded/unknown/cooldown cards, topology controls, RGB-only restoration, and a fence-settled true 4896×3072 WebGL presentation.

DLAY now projects its authentic native countdown rather than an inferred timer: bit 15 identifies the exact owner and the remaining bits carry native `life`. Canvas and WebGL normalize that fixed snapshot against the already available temperature to make idle, armed, mid-countdown, and near-expiry delays readable without changing time, support, alpha, or physics. The direct backend test drives a real PSCN spark through native arming, preserves a mid-countdown OPS1 save, and proves the native NSCN release on expiry. `npm run audit:dlay-state` and `npm run audit:dlay-state:8x` cover all countdown cards, holes/notches/thin/isolated controls, wrong/absent/wall controls, RGB-only off→on→off, and fence-settled 4896×3072 output.

WIFI now projects its native temperature channel and current broadcast latch: bits 0–6 contain the upstream channel (`0..100`), bit 7 is `wireless[channel][0]`, and bit 15 is the exact owner marker. It is not a JavaScript approximation of nearby sparks. Canvas and WebGL add a bounded RGB spectral rail for the channel and a brighter activity core while retaining native transmission, `tmp`, temperature, opacity, support, walls, and OPS behavior. The direct backend test drives PSCN through a transmitter to a distant same-channel NSCN receiver, verifies channel restoration after OPS1 load, and observes the broadcast bit clear. `npm run audit:wifi-state` and `npm run audit:wifi-state:8x` test all inactive/active channel 0/3/25/100 cards, protected holes/notches/thin/isolated/foreign/wall controls, RGB-only off→on→off, and the fenced direct 4896×3072 path.

Smooth powder now has a separate settled-body mesostrata layer for Sand, Stone, Clay, and Concrete. It uses only the existing stable deep-body density/support/slope information to suggest subdued strata and compaction, so a formed pile reads as a material body without replacing grain detail. Stone uses a cooler mineral bedding than Sand's warm compression, preventing a broad settled Stone body from reading as a cell-noisy field; Canvas gives a broad, flat Stone core a stronger but still capped bedding floor so fallback fit view does not reduce it to a uniform grey plane. Every Canvas mineral channel remains bounded to eight bytes. The transform is RGB-only and deliberately absent from Local, square Grains, moving or shallow powder, thin/single structures, holes, walls, wet suspension/contact, traits, and emission. Canvas, normal WebGL, and the compact direct 8× path share this constraint. `npm run audit:powder-mesostrata` and `npm run audit:powder-mesostrata:8x` prove distinct settled-body responses, exact off→on→off recovery, protected topology/modes/contacts, and fenced 4896×3072 presentation.

Coal and ROCK now have a separate deep geological-body treatment. Coal retains
its granular silhouette while a depth-proven core gets subdued cleavage and
rare warm inclusions; ROCK receives quiet strata and cool mineral veins. The
owner-local effect runs only for thick, exact, wall-free, trait-free,
non-emissive Solid cells after common body lighting, using the existing
phase-local optical-depth byte and relief scalar. It is RGB-only and does not
change coverage, alpha, holes, thin or isolated structures, liquid contacts,
native-wall composition, physics, or renderer resources. The paused two-card
fixture covers both owners plus those protected controls. Run
`npm run audit:geological-solid` for normal WebGL and
`npm run audit:geological-solid:8x` for the fenced direct 4896×3072 path.

Normal 1×–4× WebGL additionally applies an exact ROCK-only matte correction over
the accepted E17 opaque-body relief. `rockRoughnessVfx` is subordinate to
`solidBodyVfx`: it reduces ROCK's inherited micro-glint, broad gloss,
environment/Fresnel reflection, and positive cool E17 key while preserving the
absorptive pocket and geological strata/veins. Metal and every other
SmoothRigid owner remain unchanged. The dedicated geometry-matched fixture
pins exact depth bands, authored voids, fine ROCK, native-wall coexistence,
material controls, and ROCK contacts through
`npm run audit:vfx:rock-roughness`. Its accepted shallow/transition/mid/deep
RGB RMS ranges are `0.82…0.87`, `2.39…2.40`, `1.84…1.85`, and `4.33…4.35`;
all protected controls remain exact. Canvas and true 8× deliberately retain
their established paths.

E24 is an independently measurable exact-Water body recomposition selected by
`?waterBodyVfx=0|1`. It is strictly subordinate to E03
(`?liquidBodyVfx=0|1`): an explicit E24 request cannot recreate the parent body
layer when E03 or its containing non-Classic HDR look is inactive. Normal WebGL
1×–4× is the only implementation path. Eligibility begins beyond E03's
byte-30 hand-off and requires authoritative ordinary Water, connected
same-species liquid support, `shape.w > 2.5`, deep liquid/neighbor support, a
flat species field, and no surface-only, halo, reconstructed, wall, trait,
emissive, molten, foreign-contact, or unlike-contact ownership. It recombines
the already-live broad sheen, caustic wave, macro relief, reflected environment,
Fresnel, liquid depth, and exact vertical optical depth into a centred crown,
pocket, and narrow caustic filament while damping Water's inherited bright
stripe carrier. The change is RGB-only arithmetic: it adds no sample, sampler,
texture, field, resource, pass, target, upload, allocation, clock, output-scale
input, alpha/support/silhouette/ownership/topology change, or physics decision.

The E24 fixture keeps both panes' surface/first/shallow bands, authored holes,
open chimneys, reconstructable pinholes, thin strand, droplet, isolated Water,
native-wall checker, Salt Water, Distilled Water, DEUT, Oil, Acid, Lava,
Water/Salt-Water and Water/Oil seams, Water/Glass, Water/Metal, Water/Sand and
Water/Smoke contacts, and guarded blank exact in semantic and raw output.
Because E24 precedes the accepted HDR composite, only these named neighboring
filter footprints have bounded composed peaks: `OPEN_POOLPinhole≤1`,
`WALL_CONTROLSurface≤1`, `WALL_CONTROLFirstLayer≤1`,
`WALL_CONTROLShallow≤1`, `WALL_CONTROLChimney≤1`,
`WALL_CONTROLPinhole≤5`, `NativeWallOccupied≤1`, `NativeWallClear≤1`,
`waterSaltWaterWater≤4`, `waterGlassWater≤1`, `waterMetalWater≤5`,
`waterSandWater≤3`, and `waterSmokeWater≤3` bytes; the thin strand,
Water/Oil seam, and every other composed control remain exact. Run
`npm run audit:vfx:water-body` for the 1×/2×/4× off→on→off matrix and the
requested-on true-8× exclusion. The latter must report E24/HDR inactive with
reason `scale-8`, no bloom backing, completed GPU work, and exact
`4896×3072` WebGL output.

E25 is an independently measurable exact-Noble-Gas pearlescent-billow card,
selected by `?nobleGasBillowVfx=0|1` and strictly subordinate to E04
(`?gasBodyVfx=0|1`). It uses propagated atmosphere style `7`, so continuous
reconstructed Noble volume—not merely semantic carrier cells—receives the same
bounded violet/cyan key and complementary absorption. Normal WebGL 1×–4× is the
only implementation path. It reuses the existing connected gas-body support,
static billow, directional relief, curvature, density, crown, pocket, and four-
cardinal mean. No sample, sampler, texture, field, target, pass, upload,
resource, allocation, clock, output-scale input, alpha/support/silhouette/
ownership/topology/state, or physics decision is added. A fully dense Noble
core keeps an attenuated response because the production showcase's atmosphere
alpha is 255 throughout that body.

The dedicated fixture protects Smoke, Oxygen, Hydrogen, FOG, CFLM, both sparse
Noble carriers, their midpoint/gap/isolated probes, authored void/channel,
Noble/FOG seam, Water/Metal contacts, a native wall, and blank. Run
`npm run audit:vfx:noble-gas-billow` for the 1×/2×/4× off→on→off matrix plus
the requested-on true-8× exclusion. Frozen core/crown/pocket RGB RMS is
`2.43…2.44`, `3.00`, and `0.81…0.83`; signed polarity is approximately
`+2.54`, `+3.27…+3.29`, and `−0.76…−0.74`. Repeated-off frames, semantic and
sampled atmosphere style/density, alpha/support, and wall state remain exact.
Authored void/channel composed footprints and the Noble side of the Noble/FOG
seam are bounded to one byte; foreign FOG and every other raw/control probe are
exact.
The true-8× tail must prove actual WebGL promotion and exact `4896×3072`, while
E04/E15/E25/HDR report inactive with reason `scale-8`; a separate
post-promotion GPU fence must complete and report its timing source.

E26 is an independently measurable exact-Wood/PLNT mesostructure card, selected
by `?botanicalMesostructureVfx=0|1` and strictly subordinate to E20's body
eligibility. Normal WebGL 1×–4× is its only path. Exact ordinary Wood `9`
(`traits == 96`) and PLNT `10` (`traits == 32`) reuse only `botanicalDepth`,
`botanicalMacro`, `botanicalCluster`, and existing `barkBody`/`knot` evidence:
PLNT receives smooth 6.5-cell lobe/vein contours and near-luminance-neutral
chlorophyll/young-growth pigment, while Wood receives irregular longitudinal
bark plates/fissures and warm/umber pigment. It adds no noise, sample, texture,
field, pass, resource, time, alpha/support/state/topology, or physics decision.

The focused `npm run audit:vfx:botanical-mesostructure` gate runs 1×/2×/4×
off→on→off and protects sparse/thin owners, holes/notches, walls, contacts,
VINE/Wax/Metal, Canvas, compact true 8×, and inherited cyan/magenta lifecycle
state. The final canonical 2× result is Wood micro/chroma/macro
`1.50`/`.69`/`21` and Plant `1.51`/`.93`/`28`, with support recall/component
count `1` and dark/clipped fractions `0`; Organic improves `2.463 → 33.569`
(Wood `33.569`, Plant `48.031`). The family averages micro `1.505`, chroma
`.81`, and macro `24.5`. The historical v3 survey then labelled Smoke softness
`4.546`; v4 corrects that lower-bounded microcontrast error, and E27 below owns
the remaining visible matte-body refinement. The accepted full matrix keeps all 30 protected controls exact at
1×/2×/4×, repeats the disabled framebuffer byte-for-byte, and preserves 1,568
native-wall cells plus the 3,840-cell lifecycle plane. Its requested-on 8× tail
observes exact 4896×3072 WebGL promotion, E20/E26/HDR exclusion with reason
`scale-8`, and a real `5607.1 ms` GPU fence with zero browser errors.

E27 is the exact-Smoke soft-volume card selected with
`?smokeSoftnessVfx=0|1`, strictly under E04 and limited to normal WebGL
1×–4×. Exact propagated atmosphere style `1` reuses E04's existing third
static carrier, composite billow, directional relief, curvature, density,
crown, and pocket to add a broad warm-neutral crown and absorptive soot fold.
It adds no noise, new wave, sample, texture, field, pass, allocation, clock,
alpha/support/topology, or physics decision. Semantic gas does not populate the
ordinary semantic-contact outputs, so those are not E27 guards: foreign gas
style remains exact, while the exact-Smoke side of an unlike-gas seam may keep
a bounded composed response. Foreign FOG remains raw-RGBA exact; only its named
immediate HDR seam footprint may change one composed byte. Authored void/channel semantics, alpha, and
support remain exact; only their already-supported atmosphere edge may receive
the bounded RGB fold. Canonical 2× moves Smoke luma deviation `1.88 → 2.22`,
macro range `8 → 10`, luma range `12 → 14`, and quality `45.542 → 66.914`,
while microcontrast stays `0.39`, support recall/component count stay `1`, and
clipping stays zero. Run `npm run audit:vfx:smoke-softness` for the isolated
off→on→off matrix and requested-on true-8× exclusion. The accepted focused run
passes at 1×/2×/4× with byte-exact repeated-off frames and zero browser errors;
its true-8× tail promotes exact 4896×3072 WebGL and signals a real GPU fence in
`3444.1 ms` while E27 and normal HDR remain excluded for `scale-8`.

E28 is the exact-Wood/PLNT pigment/body-depth card selected with
`?botanicalPigmentVfx=0|1`, strictly under both E20 body recomposition and E26
mesostructure and limited to normal WebGL 1×–4×. Its resolver defaults on only
when both parents are active, and the shader locally ANDs the E26 and E28
selectors. Exact ordinary Wood `9` (`traits == 96`) and PLNT `10`
(`traits == 32`) reuse only the already-live `botanicalDepth`,
`botanicalMacro`, `botanicalCluster`, `leafPigment`, and `barkPlate` values for
bounded warm/umber bark depth and chlorophyll/young-growth leaf volume. It adds
no noise, sample, sampler, texture, field, pass, resource, target, upload,
allocation, clock, alpha/support/topology/lifecycle state, or physics decision.
E26's focused gate pins E28 off explicitly, preserving the earlier E26 matrix
as an isolated measurement.

Run `npm run audit:vfx:botanical-pigment` for E28's 1×/2×/4× off→on→off
matrix and requested-on true-8× exclusion. The accepted focused gate keeps all
30 named controls exact, repeats the disabled framebuffer byte-for-byte, and
preserves semantic, alpha/support, auxiliary, 1,568-cell native-wall, and
3,840-cell lifecycle planes with bounded cross-scale frequency retention. The
true-8× tail promotes exact 4896×3072 WebGL while E20/E26/E28/HDR are inactive
for reason `scale-8`, then signals a real GPU fence in `3113.6 ms` with zero
browser errors.

E29 is the accepted visual exact-ROCK mesostructure card, constrained to normal
WebGL 1×–4× and strictly subordinate to E17 solid-body relief and E23 ROCK
roughness. It runs only for authoritative ROCK `78` with ordinary SmoothRigid
`profile == 2`, a deep stable connected body proof, and no wall, trait,
emission, reconstruction, foreign contact, or unlike contact. A single
3.5-cell smooth value-noise facet and masked, warped, interrupted lamina add
RGB-only depth; the earlier continuous-striped tune was rejected. There is no
new sample, texture, field, pass, target, allocation, clock, alpha, support,
topology, or physics decision, and Canvas plus compact true 8× remain on their
established paths. The canonical 2× composed capture raises ROCK quality
`45.685 → 90.2`, micro `.43 → 1.06`, and macro `21 → 30`, with luma SD `6.58`,
range `36`, exact support/component, and zero dark, clipped, and browser-error
counts. `npm run audit:vfx:rock-mesostructure` passed its frozen 1×/2×/4×
matrix at exact 612×384, 1224×768, and 2448×1536 backings. Off→on→off frames
restore with repeat peak zero; semantic, alpha, support, walls, depth, and raw
state are unchanged across four depth targets and all 30 unique controls.
Meso/cell frequency ranges are `1.7989–2.1292`/`1.6378–1.8512`, downsample
retention is `.9605–.9654`, and transition/mid/deep RGB RMS is `3.56–3.99`
with 12–14-byte peaks and zero browser errors. Requested-on true 8× retains
exact 4896×3072 while E17/E23/E29/HDR are inactive for `scale-8`, bloom is
absent, and the GPU fence completes in `5397.6 ms` within the shared deadline.
The full composed production matrix also passed with zero errors,
`crossScaleVerified=true`, and `fullScaleMatrix=true`. ROCK quality/micro/macro
is `88.235`/`1.00`/`30` at 1×, `90.2`/`1.06`/`30` at 2×, and
`90.81`/`1.08`/`30` at 4×. Every scale retains support recall and dominant
component `1`, zero dark/clipped fractions, and luma range `35`/`36`/`36`.

E30 is the accepted exact-Wood interrupted-bark card for normal WebGL 1×–4×.
`woodBarkReliefVfx=0|1` is subordinate to E26 mesostructure but intentionally
independent of E28 pigment. It inherits E20's exact Wood `9`, ordinary
`traits == 96`, depth/interior/contact/wall/emission proof and recombines only
the already-live `botanicalCluster`, `botanicalMacro`, `barkWarp`, and signed
`barkPlate` evidence. This breaks the former continuous dark rails into
irregular plates and fissure gaps without a new procedural carrier. A rejected
five-cell y-periodic sine raised the fit-view score but could form horizontal
scanlines; the source test now forbids position, sine, and new noise inside
E30. The accepted branch is RGB-only and adds no sample, sampler, texture,
field, resource, pass, target, upload, allocation, clock, alpha, support,
silhouette, ownership, topology, state, or physics decision. Canvas and compact
true 8× retain their existing botanical presentation.

`npm run audit:vfx:wood-bark-relief` runs the isolated E20+E26, E28-off,
E30-off→on→off matrix at 1×/2×/4×. Two deep Wood bodies respond while both
broad PLNT bodies, both inherited-colour lifecycle canopies, and all 30 earlier
topology/contact/wall/foreign-owner controls remain exact; repeated-off peak is
zero. Target RGB/chroma/spatial RMS spans `7.77–9.68`/`1.68–2.09`/
`6.603–8.407`, response peak is 32 bytes, and response microcontrast is
`1.92–2.35`. Meso/cell RMS spans `3.7535–4.4430`/`3.8513–5.1776`, downsample
retention is `.9667–.9765`, and longitudinal gradient ratio `2.3334–2.5150`
explicitly rejects horizontal banding. Requested-on true 8× promotes exact
4896×3072 WebGL with E20/E26/E28/E30/HDR inactive for `scale-8`, no bloom, and
a real GPU fence in about `5.69 s`, with zero browser errors.
The composed production matrix is `crossScaleVerified=true` and
`fullScaleMatrix=true`: Wood quality/micro/chroma/macro is
`71.833`/`1.97`/`1.29`/`26` at 1×,
`80.251`/`2.25`/`1.42`/`26` at 2×, and
`83.247`/`2.37`/`1.47`/`26` at 4×. Semantic hash `595518258`, 104,027 occupied
cells, support/component `1`, zero dark/clipped fractions, and zero browser
errors remain exact.

E31 is the accepted exact-Noble Gas prismatic-interior card for normal WebGL
1×–4×. `nobleGasPrismVfx=0|1` is subordinate to E25 billow depth and E04
atmosphere ownership. It requires exact propagated atmosphere style `7` and
recombines only the already-live broad `gasVfxBillow` and `gasVfxWaveC`
evidence into a restrained bipolar pearlescent fold. The branch is RGB-only
and adds no wave, sample, sampler, texture, field, resource, pass, target,
upload, allocation, clock, output-scale, alpha, support, silhouette,
ownership, topology, state, or physics decision. Canvas and compact true 8×
retain their existing gas presentation.

`npm run audit:vfx:noble-gas-prism` runs E31 off→on→off at 1×/2×/4× while
pinning unrelated optional VFX off. Its exact Noble Gas key, pocket, and broad
inner-body targets respond; semantic, atmosphere, wall, alpha/support,
geometry, raw controls, authored voids/channels, seams, sparse carriers, and
foreign species remain frozen, and the disabled framebuffer repeats
byte-for-byte. Key/pocket/broad RGB RMS is about
`7.04`/`.87`/`5.59`, target peak is `9`, and the broad spatial response is
stable across scale. Requested-on true 8× promotes exact 4896×3072 WebGL with
E04/E25/E31/HDR inactive for `scale-8` and signals a real GPU fence with zero
browser errors. The composed production matrix is `crossScaleVerified=true`
and `fullScaleMatrix=true`: Noble quality becomes
`95.351`/`95.463`/`95.463` at 1×/2×/4×, luma deviation is
`3.51`/`3.52`/`3.52`, support/component remain `1`, and dark/clipped fractions
remain zero.

E32 is the accepted exact-PLNT lamina-detail card for normal WebGL 1×–4×.
`plantLaminaVfx=0|1` is a strict child of E28 pigment/body depth, E26
mesostructure, and E20 body recomposition. It requires authoritative PLNT `10`
inside the inherited ordinary body proof and a packed native lifecycle word
that is either exact zero or the presence-only `0x8000` marker. Hydration,
growth, direction, phase, and inherited-colour payloads remain protected
controls. The eligible branch combines the existing leaf body, pigment, vein,
and boundary evidence with one deterministic world-anchored 2.8-cell
procedural value-noise octave. It changes RGB only and adds no texture or field
sample, sampler, GPU resource, upload, pass, target, persistent allocation,
clock, alpha/support, silhouette, ownership, topology, lifecycle state, or
physics decision. Canvas and compact true 8× retain their previous paths.

`npm run audit:vfx:plant-lamina` runs E32 off→on→off at 1×/2×/4× while
pinning unrelated optional VFX off. Both exact eligible PLNT bodies respond;
34 topology/contact/wall/foreign-owner and lifecycle controls remain exact,
and the disabled framebuffer repeats with peak zero. Requested-on true 8×
promotes exact 4896×3072 WebGL while E20/E26/E28/E32/HDR remain inactive for
`scale-8`; observed GPU fences complete in roughly `5.2–5.8 s` with zero
browser errors. The accepted canonical 2× composed candidate raises PLNT
quality `56.122 → 78.733`; microcontrast/chroma/macro become
`1.93`/`1.75`/`36`, luma SD/range becomes `7.99`/`42`, support recall and
dominant component remain `1`, and clipping remains zero. The final production
matrix is `crossScaleVerified=true` and `fullScaleMatrix=true`, with HDR and
E32 active at all three scales, identical semantic hash `595518258`, and zero
browser errors. At 1×/2×/4×, PLNT quality is
`69.928`/`78.733`/`82.641`, support recall is `1`/`1`/`1`, coverage is
`.971`/`.971`/`.971`, luma SD is `7.90`/`7.99`/`8.06`, microcontrast is
`1.70`/`1.93`/`2.07`, chroma is `1.66`/`1.75`/`1.77`, and macro range is
`36`/`36`/`36`. Dark and clipped fractions are zero throughout.

HEAC, PTNM, and RSSS now receive a second exact-owner deep rigid-body layer:
the rapid heat conductor has restrained warm channel lamellae, Platinum uses
cool catalytic planes with sparse active sites, and solidified resist gains a
low-frequency fused-film volume beneath its existing native surface grammar.
Canvas and WebGL use only the already available same-material optical-depth
byte and solid relief. The result is static, RGB-only, bounded to 12 bytes per
channel, and cannot affect alpha, support, particles, physics, walls, authored
holes, thin/isolated owners, or the direct Water seam. The paused three-card
fixture tests exact owner semantics, flat→styled→flat repetition, protected
controls, and the true `4896×3072` direct path via
`npm run audit:thermal-catalytic-rigid` and
`npm run audit:thermal-catalytic-rigid:8x`.

Native pressure-reactive GOO now has a distinct soft solid-body read without
inventing a JavaScript pressure state: only a currently authoritative,
depth-proven GOO core receives a restrained compression/bubble RGB cue from
the existing solid depth and relief inputs. Surfaces, fine structures,
authored holes/open notches, native walls, Water/Metal contacts, alpha,
semantic support, reactions, and the native pressure-disappearance behaviour
remain untouched. `npm run audit:goo-solid` proves the exact-owner
flat→styled→flat response and protected controls; `npm run audit:goo-solid:8x`
uses the equivalent true-`4896×3072` direct-mesh gate.

The native Force Emitter (`FRAY`) now has an exact-owner cyan nozzle/rail
grammar in Canvas, normal WebGL, and the direct true-8× mesh. It is static
world-cell RGB arithmetic, deliberately separate from FRAY's native
temperature-driven push/pull polarity: no JavaScript force state, direction,
clock, sampler, field, pass, or output-scale allocation is added. The paused
fixture covers body texture, authored hole/open channel, thin rail, isolated
owner, co-located native wall, Water/Metal contacts, ARAY wrong-owner control,
and blank space; `npm run audit:fray-force` verifies flat→styled→flat,
bounded RGB-only response, and protected topology. The equivalent
`npm run audit:fray-force:8x` route exercises the direct mesh once an
8×-capable browser completes its first fenced frame.

GBMB now has a separate exact-owner deep-blue containment-body grammar for
Canvas, normal WebGL, and the direct true-8× mesh. This makes its powder body
read as a distinctive material without asserting a force direction or any
gravity state: native Newtonian gravity is unavailable in this build and the
renderer does not fabricate it. The bounded world-anchored RGB arithmetic adds
no state, clock, field, sampler, pass, or output-scale resource. Its fixture
protects authored voids, thin/isolated powder, co-located walls, Water/Metal
contacts, and the neighbouring force powder DMG as the strict wrong-owner
control. Use `npm run audit:gbmb-force` for the normal WebGL flat→styled→flat
gate; `npm run audit:gbmb-force:8x` uses the equivalent fenced direct path.

Distilled Water and Diesel now share their aqueous/oily volume fields with
their close relatives while retaining separate exact-owner RGB identity:
Distilled Water adds quiet clean-water threads, and Diesel adds darker warm
hydrocarbon ribbons. Canvas uses compact arithmetic instead of enlarging the
bounded liquid motif atlas; WebGL reuses the already-live liquid density,
depth, slope, and identity branch without a texture read or a new pass. The
dedicated atlas protects cavities, chimneys, strands, isolated drops, native
walls, Metal contacts, and the exact Distilled↔Water and Diesel↔Oil seams.
Run `npm run audit:distilled-diesel-liquid` or
`npm run audit:distilled-diesel-liquid:8x` for the normal/true-8× checks.

The direct true-8× compositor now also restores native-wall refraction for exact translucent Glass and Ice. It moves only the already-generated analytic wall pattern beneath a partially transparent owner: Glass uses a coherent boundary shift and Ice uses a stable two-facet shift. The wall ID/support still comes from the same nearest texel, and no alpha, semantic support, material ownership, field, texture sample, pass, target, upload, or output-scale resource changes. The completed-fence gate captures flat→refracted→flat Glass/Ice against wall patterns, retains opaque Metal as an exact control, and repeats the full forced-stall/context-loss recovery sequence. The accepted run stayed at `1797.3/1837.7/1943.0 ms` GPU-fence median/p90/max with zero browser errors.

After true-8× promotion, completion normally polls its single GPU fence through
`requestAnimationFrame`; an independent fence-bound 30-second watchdog now
backs that poll. If a backgrounded or wedged browser stops delivering animation
frames while the promoted fence remains unsignalled, the watchdog releases the
exact same fence and invokes the existing camera-preserving Canvas recovery.
It is cleared on normal fence release and is deliberately not armed during the
first-frame candidate, which already shares the one promotion deadline with
the temporary Canvas fallback.

The true-8× direct mesh now also consumes the shared Surface contour control for opaque rigid bodies and supported Smooth powder. It derives a small family-coloured key/fill from the already-live four exact owner samples and their analytic slope: Smooth powder needs at least two local owner samples, while Grains, Local, traits, emissive matter, and an isolated Sand cell are exact no-ops. This is RGB-only and leaves alpha, support, material ownership, physics, authored holes, native-wall composition, and every resource budget untouched. Its completed-fence gate captures Metal and a settled Sand slope flat→lit→flat, verifies bounded response and byte-repeatability, and keeps the isolated grain unchanged.

The canonical true-8× mesh now gives ordinary connected Water, Oil, and Acid the same Surface-control treatment. It preserves the exact semantic Hermite density before the liquid volume field replaces working density, then combines the four already-live species-aware liquid samples with that semantic edge to locate a bounded air-facing shell. The deferred family-coloured key/fill is RGB-only and is applied only after the existing packed native-wall read proves the cell wall-free; Lava, isolated droplets, unlike-liquid seams, traits, emission, and wall contacts remain exact controls. This adds no sampler, field, pass, target, upload, allocation, alpha/support/ownership decision, or physics change. The completed-fence 4896×3072 browser gate captures Water/Oil/Acid flat→lit→flat with semantic snapshots and family-chroma checks, while repeating the protected controls byte-exactly before the normal forced-stall/context-loss recovery sequence.

Canvas uses its existing full-resolution species-aware liquid field inside the reusable supersampled contour chunks; WebGL reuses the liquid centre/four-cardinal samples and exact contact markers already live in the shader. No backend adds a texture fetch, render-scale-sized field, pass, target, upload, or persistent allocation. The deliberately pathological full-world Canvas profiler repeats connected 2×2 Water islands at every eligible location: categorical contour presentation measured `162.21/164.55/173.90 ms` median/p90/max and cohesion measured `189.58/191.60/192.44 ms` on the current host. This is an all-world ceiling, not a runtime-frame promise; production evaluates only eligible liquid contour cells. Reusable contour scratch remains `33,824` bytes, the shared geometry lookup remains `11,855` bytes, runtime-known Canvas scratch remains `1,887,464` bytes, and combined render-field allocation remains `11,816,456` bytes.

The direct true-8× WebGL mesh applies the same conservative connected liquid-air silhouette decision after its compact body shading. It retains the four exact semantic-neighbour probes and four already-live species-aware liquid samples, carries only a clamped `<=1` alpha scale to final composition, and reuses the existing packed native-wall read whenever a wall plane is active. The trim therefore cannot add liquid support, alter RGB/species/physics, or occur on a co-located wall, an isolated droplet, a sparse strand beyond its bounded continuity response, an unlike-liquid seam, a foreign solid/gas contact, Lava, trait-bearing material, or emissive liquid. The completed-fence true-8× gate captures off→on→off at `4896×3072`, requires a visible small unidirectional connected-shore response, exact semantic stability and repeated-off pixels, then independently bounds the sparse strand and every protected control. It introduces no sampler, field, target, pass, upload, or output-scale resource.

Canvas fuses compatibility/contact classification into one 3×3 halo traversal and caches exact tone values for the sixteen categorical four-corner patterns. The shared 1×/2×/4×/8× lookup is 11,855 bytes in total (10,880 bytes added over the pre-existing axis geometry), while reusable contour scratch remains 33,824 bytes and no world-sized allocation is added. On the current host, the deliberately pathological alternating full-height Water/Metal-column profiler measured `330.50/339.07 ms` median/p90 with grounding disabled and `434.45/446.90 ms` enabled. The added all-world ceiling fell about 46% from the first implementation; production only evaluates actual eligible mixed-phase contour cells. WebGL remains sample- and resource-neutral.

Dense energy radiance passes through a hue-preserving soft knee before final composition, retaining flow detail instead of clipping into flat neon slabs. Canvas treats its twice-drawn local light plane as a restrained sparkle, gives volumetric emissive gas/liquid less local opacity than opaque surfaces, and leaves the shared EmissionField responsible for the broad aura. These changes add no field, texture, pass, scheduler work, or persistent allocation.

The broad Energy aura now receives a separate default-on volumetric key/fill treatment. Canvas applies bounded hue-preserving RGB relief directly to the existing compact one-third-linear-resolution `EmissionField` surface at its 12 Hz rebuild cadence, copying every alpha byte exactly and allocating no additional buffer. WebGL derives the same crown/pocket and directional cue from its already-fetched centre and four cardinal emission samples, so the change adds no texture read, pass, target, upload, or 8×-scaled resource. The Canvas semantic Energy core also uses the shared clamped world-cell-to-field bilinear alpha mapping; this fixes the former full-resolution-offset lookup that could make isolated cores outside the compact field's first rows read as black/NaN. The paired render-lab gate captures flat→volume→flat over the five Energy families, bounds response and repetition, retains each canonical hue and the sparse PHOT gaps, and repeats the effect at true 4896×3072 before context-loss recovery. The current-host Canvas reshape costs `0.22/0.27/0.54 ms` median/p90/max over its 204×128 field with zero additional bytes. The accepted true-8× WebGL capture measures `0.74` RGB RMS, a six-byte peak, bipolar crown/pocket response, and byte-exact off→on→off repetition; its completed 15-million-fragment frames remain `2.95/2.96/2.98 s` median/p90/max under SwiftShader.

LIGH and THDR now have an exact electric-discharge identity outside the ordinary Energy-family path. LIGH uses a cool white-blue trunk/branch/node field; THDR uses a warmer fork/shock field. The arithmetic is static in world-cell space and RGB-only across Canvas, normal WebGL, and the true-8× direct mesh, so it introduces no texture fetch, field, clock, alpha/support change, powder-topology decision, or native-state interpretation. `npm run audit:electric-discharge` builds the production bundle and runs a paired Canvas/WebGL flat→styled→flat atlas containing dense bodies, authored holes and open channels, thin branches, isolated cells, Metal/Water contacts, and a THDR column with an authored powder gap. Canvas is allowed a quieter response through its local emissive compositor; WebGL remains the canonical radiance path.

Dense exact energy bodies also receive a hue-preserving radiance multiplier capped at `0.90–1.10`. WebGL reuses the semantic normal, edge density, and the low-frequency flow value already computed by the shader; it adds no texture probe. Canvas uses four exact cardinal neighbours for an interior, two for a body edge, and otherwise leaves sparse carriers on their established path. Core/glow alpha, support, topology, emission-field bytes, and the sparse PHOT gaps remain unchanged. The five matrix energy fixtures are fully occupied rounded bodies rather than noisy 90%-filled rectangles, so the composed gate separates smooth centre quality from whole-body macro relief instead of rewarding random holes.

When the normal WebGL emission field proves a dense Energy body, its carrier-detail multiplier now converges fully to the existing broad flow/pulse variation. This removes residual cell-by-cell shimmer from a continuous core without changing alpha, semantic ownership, sparse carriers, field support, or resource cost. `npm run audit:energy-radioactive:webgl` builds the production bundle and checks this canonical path directly; the existing paired command remains available for the Canvas fallback diagnostic.

The profiler measures the same full-`612×384` energy-core workload with relief disabled and enabled. The latest same-process p90 pair is `25.58/28.10 ms`, a `2.52 ms` all-world ceiling increase with no runtime-scratch or reconstruction-field allocation change. Ordinary scenes pay that helper only for actual Energy cells, and the work remains independent of 1×/2×/4×/8× output scale.

At the fixed 612×384 world size, the preallocated CPU volume-field buffers are 3,055,104 bytes for atmosphere, 3,760,392 bytes for liquid, and 1,357,824 bytes for emission: 8,173,320 bytes combined. The stable-powder slope field uses 3,290,112 bytes: its established RGBA output, byte seed, and two float work planes plus one 235,008-byte exterior-air plane. That plane is rebuilt by a cardinal flood from passable world-edge cells after the blur has finished, reusing the existing float blur scratch as its integer queue. Sealed one-cell and multi-cell powder cavities therefore remain authored holes, while an opened corridor becomes exterior; liquids, solids, fields, semantic/native walls, and powders block the flood, while Empty, Gas, and Energy remain passable. Canvas consumes the byte directly. WebGL packs it into the unused green channel of the already nearest-sampled wall texture, so it adds no GPU texture, fetch, pass, target, or output-scale-dependent allocation. The four reconstruction fields now use 11,463,432 bytes. The half-resolution suspension field adds 588,032 bytes and render lookups add 3,584 bytes, bringing `RenderFieldSet` to 12,055,048 bytes (`12,051,464` bytes for the five reconstruction fields alone). The latest canonical powder rebuild, including exact exterior connectivity, measures `16.51/30.67/32.54 ms` median/p90/max at its bounded 8 Hz cadence. Canvas dense-liquid cohesion adds one persistent three-row RGBA ring, exactly 7,344 bytes at width 612, plus one bounded typed-array source view per world row; native row copies create no per-frame subarray objects. The profiler reports 1,887,464 runtime-known Canvas presentation byte storage including the existing solid/liquid planes, small RGB/clock vectors, and this ring; JavaScript view-object bookkeeping is not included in byte-length totals. The semantic and independent native-wall RGBA staging buffers use 940,032 bytes each. WebGL source texture bytes are unchanged because exterior connectivity shares the wall texture. A single RGBA output target is 3,760,128 bytes at 2×, 15,040,512 bytes at 4×, and 60,162,048 bytes at 8×. At 8× the presenter runs directly on one mesh and does not ask Pixi's filter system for an otherwise-unused source target; one WebGL fence bounds the renderer to one in-flight frame and adds no colour target. The latest dedicated SwiftShader gate produced the exact 4896×3072 target, full 2316/2316 Local and Smooth occupied-cell recall, zero deep-hole leakage, an exact 8×8 zoomed Grains square, all 217 material projections, and camera-preserving 2× Canvas recovery after forced stall and context loss. Its eight completed audit frames measured `3541.4/3717.7/3982.8 ms` median/p90/max with zero discarded samples and zero browser errors. WebGL2 is required because bounded promotion and recovery depend on fences; synchronous first-frame compilation is charged against the original absolute promotion deadline rather than receiving a second timeout window. 1×–4× retain the established response. Driver/front/back storage remains implementation-owned and is not included.

The 8× direct-mesh path now keeps its semantic source texture non-premultiplied while using `Texture.WHITE` solely as a premultiplied blend-state marker. Pixi's `MeshPipe` otherwise selects `normal-npm` from the semantic texture and multiplies already-premultiplied translucent shader RGB by alpha a second time. Expensive diagonal and directional probes remain disabled, while a separate arithmetic-only analytic-lighting scalar preserves the desktop body-normal response. The visual scale matrix produces identical sampled Metal/Glass/Water/Oil RGB and world area at WebGL 1×/2×/4×/8×; Canvas 1×/2×/4× also retains invariant CSS geometry and support. The latest dedicated SwiftShader gate retained the exact 4896×3072 target, full 2316/2316 Local and Smooth occupied-cell recall, zero deep-hole leakage, exact isolated-grain/hole powder-depth controls, an exact 8×8 zoomed Grains square, all 216 material identities, exact sparse/unlike/Lava/Metal liquid-volume controls, and camera-preserving 2× Canvas recovery after forced context loss. Its eight audit fences measured completed-frame `2946.9/2975.0/3024.8 ms` median/p90/max with zero discarded samples; the earlier sub-millisecond CPU-submission result was not completion evidence.

Normal WebGL now gives only proven dense ordinary liquid and opaque solid interiors a final, hue-preserving ambient floor. It is capped at five framebuffer RGB bytes and uses already-computed liquid depth/cardinal/species support or solid interior/optical depth; shores, droplets, unlike seams, granular matter, thin structure, traits, emission, gas, energy, walls, and transparent matter remain exact. `npm run audit:dense-body-ambient` runs the default-on `setDenseBodyAmbientFill` control as a DPR-1 1×/2×/4× off→on→off matrix: deep Water and Metal brighten with stable bounded chroma while every protected control retains exact RGB/support/alpha, and the 2× route writes review captures. `npm run audit:dense-body-ambient:8x` proves exact `4896×3072` after a completed `gpu-fence` (about `5.27 s` on the accepted SwiftShader run), an inactive selector, byte-identical hydrated readbacks, and no public presentation refresh through four animation frames. Compact true 8× therefore remains visually and resource neutral rather than paying an invisible full-frame redraw.

Run the allocation check and a local timing sample with:

```bash
npm run profile:render-fields
```

For visual review, `npm run audit:showcase-screenshot` writes temporary Canvas
and WebGL captures under `/tmp`. It intentionally pins browser capture DPR to
1 for both backends while retaining `renderScale=2`, so PNG sharpness is not
confused with a backend-specific browser page DPR. The resulting files are
visual review evidence, not a pixel-parity gate: WebGL remains canonical and
Canvas preserves semantic fallback behavior within its bounded paired checks.

For a deterministic media-aware production survey, run:

```bash
npm run audit:vfx:composed-rank
# Optional independent retry while diagnosing one scale:
npm run build
node scripts/verify-browser-input.mjs --composed-rank-only --webgl-only \
  --production-bundle --render-look=realistic --capture-dpr=1 --render-scale=4
```

The composed route explicitly requests accepted E75
`plantCanopyLifecycleVfx=1`, E76 `waterMetalSeparationVfx=1`, and E77
`nobleGasCoreReliefVfx=1`, and proves all three live WebGL dataset states at
every captured scale; generic `inputAudit=1` would otherwise keep these
opt-in children off.
The current `organicPlant` showcase body intentionally carries zero lifecycle
payload, so the focused native lifecycle atlas remains the authority for E75's
actual two-tree response. Composed telemetry proves selector integration and
continues to grade the protected zero-state E71 body without inventing native
growth state in a product fixture.

E76's focused Water/Metal atlas toggles only its child over accepted E03/E14/
E17/E37/E56. Its bilateral off→on→off strips preserve semantic and alpha/support
bytes while measuring a cool Water response and opposing warm Metal return at
1×/2×/4×. The composed score is the acceptance authority for the stated fit-view
benefit: 1× Water/Metal rises from `87.058` to `88.756` with chromatic separation
`.6500→.7000`; 2×/4× remain `91.216/91.667`. Run the dedicated gate with
`npm run audit:vfx:water-metal-separation`; it also proves requested-on E76 is
inactive at exact true 8× and completes through `gpu-fence`.

E77 adds restrained exact-Noble dense-core relief as a strict E31/E25/E04
normal-WebGL child. Run:

```bash
npm run audit:vfx:noble-gas-core-relief

# Attribute the production-scene change explicitly:
npm run build
node scripts/verify-browser-input.mjs --composed-rank-only --webgl-only \
  --production-bundle --render-look=realistic --capture-dpr=1 \
  --noble-gas-core-relief-vfx=0
node scripts/verify-browser-input.mjs --composed-rank-only --webgl-only \
  --production-bundle --render-look=realistic --capture-dpr=1 \
  --noble-gas-core-relief-vfx=1
```

The focused gate freezes a smooth positive crown and negative pocket at
1×/2×/4×, exact off→on→off repetition, unchanged atmosphere/semantic/alpha/
wall state, and exact raw topology, isolated sibling-gas, sparse, and contact
controls. The named adjacent Noble/FOG seam permits only the measured HDR-
composed footprint (Noble peak `4`, foreign FOG peak `2` bytes). Its
calibrated crown RGB RMS is `2.06/2.08/2.07`; pocket RGB RMS is
`2.73/2.67/2.67`, with response microcontrast `.25–.33`. Requested-on true 8×
is deliberately excluded from the normal-detail shader, promotes at exact
`4896×3072`, and must signal the real GPU fence. The accepted composed A/B
raises Noble quality from `95.351/95.463/95.463` to `100/100/100`, increases
luma deviation from `3.51/3.52/3.52` to `4.11/4.11/4.12`, retains `.965`
coverage, and clips no pixels. If an isolated candidate looks darker but lowers
the composed score, reject it; the abandoned uniform-absorption version did
exactly that. The selector defaults off under generic `inputAudit=1` unless the
route explicitly requests it, so parent E25/E31 audits keep their frozen
reference frames.

The browser obtains regions and exact semantic expectations from the app-owned
`MATERIAL_SHOWCASE_AUDIT`; the driver must not maintain copied coordinates.
Version 3 fixes the scene at semantic hash `595518258`, 104,027 occupied cells,
the full 19-material histogram, and 14 named half-open probes. It also proves
that the radius-8 Metal capsule contains exactly 880 cells in its symmetric 18-row mask,
has no cells outside the mask, renders every semantic centre, and leaves its
three Water controls intact.

The `composed-media-rank/v4` result scores granular body, cohesive liquid,
diffuse gas, rigid body, organic body, emissive volume, and phase contact with
different cue envelopes. Required cues use a weighted harmonic mean, so one
missing cue cannot be hidden by an unrelated strong signal; each family is
ranked by its weakest required probe. A full run treats 2× as the canonical
reference and requires exact semantic and field-mask equality, stable CSS
geometry, minimum rendered-support recall, and bounded raw plus normalized
metric drift at 1×/2×/4×. Screenshot pixels are first differenced against a
same-page capture with only the world canvas hidden, then admitted through the
region's semantic, propagated gas-style, or shared-emission support mask. This
prevents the viewport background or a neighbouring gas from masquerading as a
rendered volume. Near-white clipping is measured separately from legitimate
single-channel material saturation. A requested single scale reports null
spread and `crossScaleVerified=false`; it is a local diagnostic reference, not
a replacement for the full matrix.

Version 4 changes only the diffuse-gas softness component from a lower-bounded
band to `fall(microContrast, 0.50, 1.25)`. Macro range and luma deviation already
reject flat gas; requiring minimum adjacent-pixel contrast rewarded stipple.
The app-owned showcase fixture remains semantic version 3, but v3 and v4
quality indices are not comparable. The frozen pre-E27 Smoke frame has
softness `1`, billow depth as its weakest cue, and v4 quality `45.542`.

The historical accepted production matrix through E32 is `crossScaleVerified=true` and
`fullScaleMatrix=true` at 1×/2×/4×, with HDR and E32 active, semantic hash
`595518258`, 104,027 occupied cells, and zero browser errors at every scale.
Preserve the preceding history: E29 first raised canonical ROCK from `45.685`
to `90.2`; E30 then raised the individual Wood probe from `50.781` to
`80.251` at 2×, with Wood quality/micro/chroma/macro
`71.833`/`1.97`/`1.29`/`26`, `80.251`/`2.25`/`1.42`/`26`, and
`83.247`/`2.37`/`1.47`/`26` at 1×/2×/4×. E31 raised Noble Gas from `52.710`
to `95.351`/`95.463`/`95.463` while the then-unchanged PLNT remained
`46.355`/`56.122`/`59.540`.

E32 now raises PLNT to `69.928`/`78.733`/`82.641` quality at 1×/2×/4×.
Support recall is `1` and coverage is `.971` at every scale; luma SD is
`7.90`/`7.99`/`8.06`, microcontrast is `1.70`/`1.93`/`2.07`, chroma is
`1.66`/`1.75`/`1.77`, and macro range remains `36`. Dark and clipped
fractions stay zero. The E32 canonical family order was Gas/Smoke
`66.914`, Organic/PLNT `78.733`, Contact `88.235`, Solid `90.2`, Liquid
`91.033`, Emission `98.475`, and Powder `100.000`. Wood's `80.251` remains an
individual historical E30 probe, not a family-rank entry.

E33 is the accepted exact-Smoke billow-depth card for normal WebGL 1×–4×.
`smokeBillowDepthVfx=0|1` is a strict child of E27 soft volume and E04
atmosphere ownership. It is limited to propagated atmosphere style `1` that
inherits E27's connected-body, cardinal-neighbour, wall, and non-emissive
Smoke proof. It reuses the accepted static fold/billow, directional relief,
connected-body support, cardinal-neighbour density, and atmosphere alpha for a
bounded RGB-only deep soot-volume response, adding no wave, noise, sample,
texture, field, resource, pass, target, upload, allocation, clock,
alpha/support, silhouette, ownership,
topology, state, or physics decision. Canvas and compact true 8× remain on
their established paths. Run `npm run audit:vfx:smoke-billow-depth` for the
isolated 1×/2×/4× off→on→off matrix. Deep/crown/pocket and density mid/rim
targets respond; 18 controls, including the authored void/channel, stay exact
apart from two bounded SMKE/FOG interface footprints, and the disabled frame
repeats byte-for-byte. Requested-on true 8× promotes exact 4896×3072 WebGL
while E04/E15/E25/E27/E33/HDR are inactive for `scale-8`; its GPU fence is
about `5.2 s` with zero browser errors.

The final production rerun is `crossScaleVerified=true` and
`fullScaleMatrix=true`, with E33/HDR active at 1×/2×/4×, semantic hash
`595518258`, support recall `1`, coverage `.647`, and zero dark/clipped
fractions or browser errors. Smoke quality is `100` at every scale; luma SD is
`4.12`, microcontrast `.43`/`.46`/`.48`, chroma `.55`/`.57`/`.58`, macro range
`18`, and luma range `20`/`21`/`21`. The canonical family order is now
Organic/PLNT `78.733`, Contact `88.235`, Solid `90.2`, Liquid `91.033`, Gas
`95.463`, Emission `98.475`, and Powder `100.000`. E27's `66.914`
remains the historical accepted soft-volume baseline, and Wood's `80.251`
remains an individual E30 probe rather than a family-rank entry.

E34 is the accepted exact-PLNT lobe-depth card for normal WebGL 1×–4×.
`plantLobeDepthVfx=0|1` is a strict child of E20 body recomposition, E26
mesostructure, E28 pigment, and E32 lamina. It therefore reaches only E32's
authoritative ordinary zero-state or presence-only PLNT `10` proof. The shader
reuses its already-live lamina body, lobe, vein, boundary, pigment, and
environment evidence for a bounded signed crown/pocket/vein-depth response:
the goal is to quiet E32's closed fine-loop read at fit view, not add another
cell-scale pattern. The response is RGB-only and adds no noise call, sample,
sampler, texture, field, resource, pass, target, upload, allocation, clock,
alpha/support, silhouette, ownership, lifecycle, topology, state, or physics
decision. Canvas and compact true 8× retain E32.

Run `npm run audit:vfx:plant-lobe-depth` for the isolated E20+E26+E28+E32
off→on→off matrix. Two exact PLNT bodies must retain semantic/depth state;
34 Wood, lifecycle, topology, contact, wall, and foreign-owner controls plus
the raw controls remain exact, and disabled frames repeat byte-for-byte. The
frozen per-target gate requires bipolar response and frequency evidence rather
than a whole-body tint: PLNTLeft is `1.10–1.21` RGB RMS with a 7-byte peak,
and PLNTRight is `1.47–1.62` with a 9-byte peak, each with target-specific
coverage, signed, meso/cell, and cross-scale limits. Requested-on true 8×
promotes exact 4896×3072 WebGL while E20/E26/E28/E32/E34/HDR report inactive
for `scale-8`, with no bloom and a completed GPU fence.

The final composed rerun remains `crossScaleVerified=true` and
`fullScaleMatrix=true`, with semantic hash `595518258`, exact PLNT support
recall `1`, coverage `.971`, and zero dark/clipped fractions or browser errors.
E34 raises PLNT quality from E32's `69.928`/`78.733`/`82.641` to
`74.414`/`82.892`/`86.238` at 1×/2×/4×. At canonical 2× it improves
`78.733 → 82.892`: mesostructure `.465 → .535`, pigment `.8333 → .8600`,
macro range `36 → 40`, and luma SD/range `7.99/42 → 8.72/49`. Wood `80.251`
is consequently the organic family floor and has pigment variation as its
weakest cue. The next measured card should be E35, a bounded exact-Wood
pigment/volume finish over the existing E20/E26/E28/E30 proof—not another
generic PLNT or gas layer.

Timing output is diagnostic rather than a cross-machine pass/fail threshold. It includes baseline Canvas atmosphere relief and the same full plane under a nonzero cardinal-gradient emission field, Canvas surface-lighting, deliberately pessimistic full-612×384 energy-core and trait-core passes, a fully dense Water cohesion pass, a full-height Water/Oil boundary pass, and an all-cells liquid-light gate in which every cell is pessimistically treated as a top-surface candidate and samples field relief. Dense translucent coupling is measured twice: an honest all-Glass/all-field ceiling and the ordinary single-localized-source path after `EmissionField.mayLightWorldCell` rejection. A separate pathological all-world Glass-over-wall refraction profile includes its diagnostic pixel reset; production admits only exact Glass/Ice cells that coexist with a wall, performs no allocation or field sample, and ordinary scenes touch a small fraction of that ceiling. Full-world caustic and lens-shell arithmetic diagnostics include repeated RGB scratch initialization that production already performs while styling. The latest lens-shell ceiling measured `11.25/11.58/12.61 ms` median/p90/max across all 235,008 world cells and adds zero runtime bytes; production additionally gates it to exact Glass/Ice and reuses the existing color scratch, relief, and contour response. Checksums are consumed sparsely outside the timed production-shaped loops and the solid-relief checksum remains independent. The atmosphere-light descriptor is module-scoped and reused, so the timed loop allocates no object or typed buffer. Trait profiling covers realistic masks, a synthetic all-bits mask, and a representative composite, and consumes representative output through a checksum outside the timed region so the JIT cannot discard the work without charging checksum arithmetic to production-like timings. Profiler-only storage is reported separately from runtime-known scratch and does not contribute to `combinedAllocatedBytes`.

Canvas also defers botanical classification until an Organic or Fibrous trait can
consume it, and virus classification until an Organic trait can consume it.
Radioactive/carrier/force cells therefore avoid two irrelevant material-family
tests in the semantic trait loop; the trait checksum remains unchanged and the
change adds no allocation, field, sampling, clock, or presentation-state work.

Canvas applies semantic role accents to its existing three-float RGB scratch before the final clamp/composite instead of rereading and rewriting a typed pixel afterward. Five reusable full-range animation clocks add 20 persistent bytes and preserve the established role-pattern cadence. Ordinary non-emissive fluids keep their direct pixel fast path; scenes only pay trait arithmetic for cells whose packed role byte is nonzero. Unit tests enforce the allocation ceilings and scheduling rate; the browser render lab remains the visual and runtime-GLSL gate.

## Typed presentation capture drivers

Presentation controls that sit before HDR use the generic visual-capture driver
boundary rather than pretending to be shader domains. The established Visual
Lab v1 contract remains the closed Liquid/Gas/Emission normal-HDR registry. A
separate recursively frozen static contract names safe driver IDs, stable
variant labels, extension fixtures, unchanged six-field recipes, and bounded
evidence-plane IDs; one closed scripts-side registry owns the actual browser
calls and historical report labels. Static metadata never names an evidence
reader method. Capture samples every declared plane through the one fixed typed
`visualCaptureEvidenceAlpha(plane, x, y)` browser bridge, whose renderer-side
switch is exhaustive. The legacy named readers remain compatibility aliases,
and reports retain their historical `{readerMethod, plane}` order, but those
labels no longer have execution authority.

The first extension is `powder-style-atlas`. It directly fills a paused 612×384
world with overlapping Sand/Clay piles, a one-cell Clay stem and ledge, a
Concrete ridge with an authored 7×7 hole, isolated grains, Water contact,
native-wall coexistence, and blank controls. Its stable evidence names map to
`off=Smooth`, `a=Local`, and `b=Grains`. Powder remains HDR-unimplemented and
the driver adds no sampler, texture, field, pass, or target. It reads the
already allocated Powder-surface alpha plane, keeping semantics and field
support exact. Framebuffer alpha is explicitly style-owned but must remain
nonempty at fixed geometry, because Smooth and Grains deliberately make
different presentation-only silhouette decisions.

Same-page controls now use an app-owned, fixture-scoped registry. Preparation
marks the exact active fixture; the generic browser bridge accepts only that
fixture plus variant `0|1|2` and requires matching readback. The Powder driver
maps the numeric readback back to its stable Smooth/Local/Grains dataset and
report values. Unknown, unprepared, unsupported, mismatched, invalid, or
misapplied controls fail before evidence capture. Future material controls add
one typed registry descriptor without adding another browser method or branch
to the audit, batch, baseline, review, or CI layers. The migration intentionally
changes its private content-addressed execution/tuning plans, while built fresh
and shared captures under both stable-snapshot and completed-receipt proof retain
the exact established Powder result ID and all three PNG hashes.

Capture the canonical 2× recipe from a production bundle with:

```sh
npm run audit:visual-lab:powder-style
```

Or create the complete portable decision package with:

```sh
npm run build
npm run audit:visual-lab:review:capture -- \
  --candidates=powder-style-atlas \
  --output-dir=/tmp/anifor-powder-review
```

The report and review board identify the three real style selections while the
content-addressed result keeps the existing request and off/A/B hash fields.
