## North star

Define the art target first: **physically-inspired stylized realism** — soft directional lighting, HDR emission, true fluid surfaces, depth through absorption and scatter. Every effect below serves that. I'd also lock in two reference presets early (e.g. "Realistic" and "Neon Lab") so aesthetic decisions stay coherent.

## Experiment ledger

The established presentation remains the `classic` control while experiments
are measured. Select a look with `?renderLook=classic|realistic|neon-lab`; this
does not alter simulation, camera, semantic ownership, or `renderScale`.

- **E01 — HDR chassis (active):** at 1×–4×, `realistic` and `neon-lab` require
  the actual Pixi WebGL2 context to prove float colour attachments, MRT limits,
  and a complete `RGBA16F` framebuffer. The semantic scene renders into one HDR
  target, bright regions feed a half-resolution threshold/blur chain, and an
  ACES-style shoulder composites without changing the established alpha plane.
  Exact temperature drives a blackbody core for Fire, Lava, Plasma, and
  incandescent ordinary matter. Unsupported devices drop to classic WebGL;
  Canvas remains the semantic fallback.
- **E02 — field-aware material volume (active):** the normal 1×–4× WebGL
  compositor reuses its already-live settled-powder surface, species-safe
  liquid depth/meniscus, and atmosphere curvature/scatter signals for a
  stronger HDR key/fill and bounded core absorption. It adds no texture read,
  field, blur, pass, target, clock, or alpha/support decision. Enablement is
  independently measurable with `?volumeVfx=0|1`; non-Classic looks default
  it on only while the HDR pipeline is active. Smooth stable dry powder,
  connected ordinary same-species liquid, and field-owned gas are eligible;
  Local/Grains, motion, authored holes, isolated particles/droplets, unlike
  seams, walls, traits, suspension, molten liquid, and foreign matter remain
  protected controls.
- **Protected 8× rung:** `renderScale=8` deliberately reports
  `hdrPipeline=inactive` / `scale-8` and retains the proven direct single-mesh
  4896×3072 path. The experiment must earn a bounded 8× design rather than
  allocating a 115 MiB full-resolution float target beside that path.
- **Current decision:** E01/E02 remain opt-in until their powder/liquid/gas
  scene metrics, hardware GPU timing, context-loss recovery, and mobile thermal
  behavior are measured. Retained fit-view review found E02 topology-safe but
  too subtle to promote as the visible overhaul: powder remains speckled,
  liquid bodies remain comparatively flat, and the already-cohesive gas field
  gains only a faint relief change. E02 is therefore a controlled
  body-lighting baseline, not the final fluid/gas result. Later experiments
  still need to earn stronger thickness/refraction, species-safe reflection,
  and richer cloud structure.
  Sub-1.0 material colour stays on the established response; tonemapping owns
  only real HDR highlights so powder texture and liquid body contrast are not
  washed out.

Run the two review presets with `npm run audit:vfx:realistic` and
`npm run audit:vfx:neon`. `npm run audit:vfx:hdr` is the objective 2× WebGL
gate: it reloads a paused fixture as classic → realistic → classic and checks
the hot-material RGB response, repeatability, semantic/staging topology, exact
geometry, active float pipeline, and browser errors. The browser gate also
accepts `--render-scale=1|2|4|8` for capability/degradation checks.

Run `npm run audit:vfx:volume` for E02. It reloads the paused composed material
lab as `volumeVfx=0 → 1 → 0` at 1×, 2×, and 4×, requires the real HDR pipeline,
and proves exact semantic/staging state plus raw presented alpha/support hashes.
The accepted response is spatial rather than a uniform grade: the current
fixture reaches 6 framebuffer bytes in settled Clay, 9 in connected liquids,
and 3 in gas while isolated Sand/Water, authored holes, Metal, and repeat
captures remain exact. The sub-cell Water/Oil page probe permits only two bytes
of filtered neighbouring-body RGB; its raw support remains exact.

**Next visual experiments:** first prototype a liquid-only readability tranche
using the existing species-safe field and vertical optical-depth byte: a
stronger bounded Beer–Lambert core plus an exposed-surface Fresnel response
should produce a clearly visible 3–8 framebuffer-byte core/surface separation
without changing alpha or support. Isolated droplets, Lava, walls, foreign
contacts, and exact unlike-liquid seams remain controls. Follow that with a
stable world-anchored multi-scale gas density treatment and a powder
crown/facet balance that increases bulk depth without damping the established
grain cadence. Each experiment keeps its own off/on/off switch and must pass
the same topology, contact, scale, and fallback controls before it can become a
preset default.

## Phase 1 — HDR pipeline & lighting core (biggest visual payoff)

**Goal:** everything downstream needs light and dynamic range; build the chassis first.

- **Move from single-pass to a small multi-pass pipeline.** Semantic field → material reconstruction pass (albedo + normals + thickness + emissive into an MRT or packed RGBA16F target) → lighting pass → bloom chain → tonemap composite. You're currently proudly single-target; this is the architectural pivot that unlocks everything else.
- **WebGL 2 baseline** (or Pixi v8's WebGPU renderer — see Phase 4). You need float render targets and MRT; WebGL1 will fight you.
- **Blackbody emission model:** replace ad-hoc heat tint with a proper temperature→blackbody ramp (Tanner Helland approximation) driving both color *and* HDR intensity. Lava, fire, heated metal become genuinely luminous rather than "warm-tinted."
- **Screen-space bloom:** threshold at HDR >1.0, downsampled mip chain (à la Call of Duty / Unity bloom), additive combine before ACES tonemapping. This alone transforms fire/plasma/ELEC.
- **2D deferred-ish lighting:** you already reconstruct contour normals — light them. Global key light + per-pixel normals → diffuse/specular. Then **local dynamic lights**: fire, plasma, explosions, LIGH emit point lights. Cap at ~16–32 active lights via a light grid/texture, fallback to emissive-only beyond that.

## Phase 2 — Fluid & gas realism

**Goal:** liquids read as one continuous body with a surface; gases read as volumetric media.

- **Screen-space fluid rendering** (Müller-style, the classic 2007 technique): liquid coverage → depth/thickness buffer → **curvature flow smoothing** for a real meniscus → reconstruct normals → **Fresnel reflection + refraction of the background/wall pattern behind** → specular glints. Your current per-species depth gradient is the seed of the thickness buffer.
- **Foam & spray:** whitecap tint where velocity divergence or surface agitation is high; tiny detached particles get spray sprites.
- **Gases as participating media:** extend your density/colour field with a **noise-animated volume** — FBM curl noise advected by the velocity field, modulated by density, lit by the dynamic lights (light shafts through smoke are extremely high-impact). Approximate with 2–3 octave noise at half res, upsampled.
- **Fire:** blackbody core + procedural licking edges (domain-warped FBM along the temperature gradient), ember streaks from velocity.

## Phase 3 — Material delicacy

**Goal:** each optical class gets a signature response instead of a shared treatment.

- **Per-class PBR-ish parameters** in your palette LUT: roughness, metallic, translucency, IOR. You already have the 13-class alpha byte — promote it to index a proper material parameter texture.
- **Subsurface approximation** for organic/ice/wax/translucent rigid: thickness map (you have solid depth scans!) → wrap lighting + transmitted color, so ice glows at thin edges.
- **Ambient occlusion:** cheap SSAO-analog from the occupancy field — darken creases and contact points between heaps, walls, and solids. Huge depth cue at trivial cost.
- **Powders:** grain sparkle at high zoom (per-cell hash jitter on albedo, already partially there), heap-scale slope shading with AO in valleys.
- **Caustics-lite** under water/oil bodies: animated light patterns on the floor beneath translucent liquid, driven by the same noise field as the surface.
- **Velocity-aware effects:** short motion-smear along velocity for fast powders/liquids, streak rendering for PHOT/ELEC/LIGH.

## Phase 4 — Tech-direction decisions

- **WebGPU via Pixi v8** is worth prototyping on a branch: compute shaders would let you do fluid smoothing, light accumulation, and noise advection in compute, with WebGL2 as the fallback path. Pixi 8's architecture supports both. If that's too much churn, WebGL2 + MRT + float targets gets you 90% there.
- **Half-res and temporal tricks:** bloom, AO, and volumetrics at half or quarter res; temporal accumulation/jitter for the volumetric noise to hide the low res.
- **LOD by zoom:** your 1×–8× renderScale tiers are natural LOD gates — enable expensive effects (per-grain detail, refraction) only at 4×+, keep 2× clean.
- **Keep the Canvas2D fallback honest:** define the "minimum viable look" (albedo + contour + simple tint) and gate everything else behind WebGL capability. You already have the degradation machinery — the new pipeline just adds more rungs.
- **Budget discipline:** you cap at 30 Hz with dirty-chunk uploads — good. Add a GPU-time governor: measure frame cost, shed bloom octaves → volumetric octaves → AO as needed. Mobile-first means thermal throttling is the real enemy.

## Suggested sequencing

1. HDR + bloom + tonemap (week 1–2) — immediate wow.
2. Normal lighting + blackbody emission — materials start feeling physical.
3. Screen-space liquid surface (curvature flow + Fresnel/refraction).
4. Dynamic local lights from emissive elements.
5. Volumetric gas/fire noise.
6. AO + SSS + per-class PBR polish.
7. WebGPU compute prototype in parallel once the effect set stabilizes.

Each phase ships independently and degrades gracefully, so you're never holding an unreleasable branch.
