# Visual overhaul progress

The design target remains [NEXT_STEP_RENDER.md](./NEXT_STEP_RENDER.md). That
roadmap is treated as immutable; implementation status and visual decisions are
recorded here instead.

## 2026-08-14 — volumetric gas and liquid thickness checkpoint

Status: visually favoured and ready to checkpoint.

### What changed

- Normal WebGL gas at 1× and 2× now uses two smooth world-space noise octaves,
  domain-warped by the existing broad wave field. Coherent native gas velocity
  advects the whole pattern, so cloud masses roll together instead of looking
  like moving particles or a stationary painted band.
- Gas density, species ownership, gaps, silhouette, and alpha remain owned by
  the atmosphere field. The new treatment changes interior light and colour,
  not simulation topology.
- The 4× path retains the established broad wave volume without procedural
  noise, and compact true 8× remains unchanged. This keeps the visible upgrade
  where it is affordable while a shared lower-resolution volume pass is built.
- Curvature-aware liquid transport now covers Water, Oil, and Acid rather than
  Water alone. Convex shoulders admit a restrained family-coloured transmission
  window; concave pockets receive wavelength-selective absorption. The result
  reads as changing optical thickness without changing support or boundaries.

### Visual decision

- Keep the gas change. In the production showcase, broad cloud interiors now
  have nested, organic volume masses. Paired moving frames show coherent drift
  with no cell grain or visible flicker.
- Keep the liquid change. The effect is deliberately quieter: Water crests gain
  a cool translucent lift and concave inlets recede, without halos, ringing, or
  over-darkening.
- Powder is currently the strongest of the three main material lanes. Its grain
  and bulk treatment was not disturbed in this checkpoint.

### Lightweight checks used

- A real production WebGL/HDR 2× showcase rendered successfully with no browser
  errors and was accepted by direct image inspection.
- Focused renderer checks pass (279 checks), and the production bundle builds
  with its complete runtime asset set.
- The legacy Water response envelope is now informational: its old numerical
  bounds reject the new chromatic pocket balance, but the retained images show
  the intended improvement without a topology defect.
- Headless SwiftShader still misses the full 4× showcase framebuffer deadline
  even when this checkpoint's procedural gas noise is completely disabled at
  4×. This points to the existing full-resolution compositor cost, not the new
  gas noise. Hardware WebGL 4× remains enabled; do not add visual gates around
  the software-renderer timeout.

### Next visual work

1. Move gas detail into a shared half-resolution volumetric field or pass so
   1×–4× can share the same richer pattern at bounded fragment cost.
2. Feed emissive-material lighting through that volume for illuminated smoke,
   coloured gas scatter, and restrained shafts.
3. Continue the liquid architecture toward a reusable thickness/surface pass,
   then add caustic projection beneath transmissive bodies.
4. Add broad valley/contact occlusion to powder heaps without blurring grains or
   fine authored structures.

Visual comparisons and interactive judgment are the acceptance mechanism while
this work is evolving. Exact PNG hashes and historical response envelopes are
not visual requirements.
