export type RenderLook = 'classic' | 'realistic' | 'neon-lab';

export const DEFAULT_RENDER_LOOK: RenderLook = 'classic';

/**
 * Selects an explicit visual experiment without changing simulation, camera,
 * or backing-scale semantics. Classic remains the comparison/control while
 * the HDR pipeline is being measured across real browsers.
 */
export function resolveRenderLook(
  search = globalThis.location?.search ?? '',
): RenderLook {
  const requested = new URLSearchParams(search).get('renderLook');
  if (requested === 'realistic' || requested === 'neon-lab' || requested === 'classic') {
    return requested;
  }
  return DEFAULT_RENDER_LOOK;
}

/**
 * Keeps the material-volume experiment independently measurable inside an HDR
 * preset. The query override is deliberately unable to enable it for Classic:
 * without the float scene target its bounded over-range highlights would be
 * clipped before the HDR composite can tone-map them.
 */
export function resolveVolumeVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (look === 'classic') return false;
  const requested = new URLSearchParams(search).get('volumeVfx');
  if (requested === '0' || requested === 'off') return false;
  if (requested === '1' || requested === 'on') return true;
  return true;
}

/**
 * Lets the liquid-body experiment be measured without also changing powder or
 * gas. In ordinary use it follows the broad volume switch, so existing
 * realistic/neon URLs retain one coherent preset; an explicit liquid override
 * is reserved for comparison captures and capability audits.
 */
export function resolveLiquidBodyVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (look === 'classic') return false;
  const requested = new URLSearchParams(search).get('liquidBodyVfx');
  if (requested === '0' || requested === 'off') return false;
  if (requested === '1' || requested === 'on') return true;
  return resolveVolumeVfxEnabled(look, search);
}

/**
 * Enables the HDR-composite liquid transport experiment only on top of E03's
 * connected liquid body. The composite consumes the same semantic/liquid
 * textures as the presenter, so an explicit override cannot bypass either the
 * non-Classic HDR look or the liquid-body eligibility baseline.
 */
export function resolveLiquidSurfaceVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveLiquidBodyVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('liquidSurfaceVfx');
  if (requested === '0' || requested === 'off') return false;
  if (requested === '1' || requested === 'on') return true;
  return true;
}

/**
 * Adds a narrow liquid-side optical response at exact ordinary Solid contact.
 * E14 reuses E03's connected-liquid body proof and the semantic contact probes
 * already consumed by the normal shader; an explicit override cannot bypass
 * either the non-Classic look or that liquid-body baseline.
 */
export function resolveLiquidSolidMeniscusVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveLiquidBodyVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('liquidSolidMeniscusVfx');
  if (requested === '0' || requested === 'off') return false;
  if (requested === '1' || requested === 'on') return true;
  return true;
}

/**
 * Keeps the gas-body experiment independently measurable without also
 * changing powder or liquid. Ordinary realistic/neon presets retain the broad
 * volume default; the explicit query is reserved for visual captures and
 * capability audits.
 */
export function resolveGasBodyVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (look === 'classic') return false;
  const requested = new URLSearchParams(search).get('gasBodyVfx');
  if (requested === '0' || requested === 'off') return false;
  if (requested === '1' || requested === 'on') return true;
  return resolveVolumeVfxEnabled(look, search);
}

/**
 * Adds a velocity-aware lighting cue on top of E04's stable field-owned gas
 * body. The experiment cannot be enabled without that base: atmosphere mass,
 * silhouette, and the static billow remain E04-owned while this selector only
 * admits a bounded RGB response to native particle velocity.
 */
export function resolveGasMotionVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveGasBodyVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('gasMotionVfx');
  if (requested === '0' || requested === 'off') return false;
  if (requested === '1' || requested === 'on') return true;
  return true;
}

/**
 * Adds a species-safe external-light response on top of E04's field-owned gas
 * body. Smoke and FOG remain atmosphere-owned; this selector admits only a
 * bounded normal-WebGL RGB key/fill from light data the gas branch already
 * samples. It cannot bypass the stable gas-body baseline.
 */
export function resolveGasLightVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveGasBodyVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('gasLightVfx');
  if (requested === '0' || requested === 'off') return false;
  if (requested === '1' || requested === 'on') return true;
  return true;
}

/**
 * Adds species-aware optical depth inside E04's already-connected gas body.
 * The normal WebGL presenter reuses its propagated atmosphere identity,
 * density, cardinal slope, and static billow basis; this selector therefore
 * changes RGB only and cannot enable itself without the stable gas baseline.
 */
export function resolveGasCoreDepthVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveGasBodyVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('gasCoreDepthVfx');
  if (requested === '0' || requested === 'off') return false;
  if (requested === '1' || requested === 'on') return true;
  return true;
}

/**
 * Gives a dense exact Plasma body a restrained contained core. The normal
 * WebGL presenter reuses its existing semantic core and emission-field support;
 * an explicit override keeps E16 independently measurable while ordinary HDR
 * looks continue to inherit the broad volume preset.
 */
export function resolvePlasmaCoreVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (look === 'classic') return false;
  const requested = new URLSearchParams(search).get('plasmaCoreVfx');
  if (requested === '0' || requested === 'off') return false;
  if (requested === '1' || requested === 'on') return true;
  return resolveVolumeVfxEnabled(look, search);
}

/**
 * Gives a genuinely thick opaque SmoothRigid body a restrained bevel, crown,
 * and pocket response. Normal WebGL reuses the existing exact-species solid
 * depth and analytic-light scalars; the independent selector keeps E17
 * measurable without extending Canvas or the compact true-8x shader.
 */
export function resolveSolidBodyVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (look === 'classic') return false;
  const requested = new URLSearchParams(search).get('solidBodyVfx');
  if (requested === '0' || requested === 'off') return false;
  if (requested === '1' || requested === 'on') return true;
  return resolveVolumeVfxEnabled(look, search);
}

/**
 * Rebalances only deep native ROCK after E17 has proved the opaque-body
 * topology. The correction is deliberately subordinate to solid-body VFX: it
 * may reduce ROCK's inherited SmoothRigid polish, but it cannot recreate E17
 * when that parent experiment or the containing HDR look is disabled.
 */
export function resolveRockRoughnessVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveSolidBodyVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('rockRoughnessVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  return true;
}

/**
 * Keeps the exact Platinum body experiment independently measurable while
 * retaining the same non-Classic preset policy as the broader volume studies.
 * The renderer decides its strict native-owner and topology eligibility.
 */
export function resolvePlatinumBodyVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (look === 'classic') return false;
  const requested = new URLSearchParams(search).get('platinumBodyVfx');
  if (requested === '0' || requested === 'off') return false;
  if (requested === '1' || requested === 'on') return true;
  return resolveVolumeVfxEnabled(look, search);
}

/**
 * Keeps the exact Ceramic glaze experiment independently measurable
 * while retaining the non-Classic preset policy of the broader volume study.
 * Normal WebGL owns the strict material, topology, and contact eligibility;
 * this selector only controls whether that bounded RGB finish may run.
 */
export function resolveCeramicGlazeVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (look === 'classic') return false;
  const requested = new URLSearchParams(search).get('ceramicGlazeVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  return resolveVolumeVfxEnabled(look, search);
}

/**
 * Re-composes broad exact Wood/PLNT bodies after the fit-view survey showed
 * their older diagonal relief carriers reading as bands rather than organic
 * volume. Normal WebGL owns the strict owner, thickness, contact, and topology
 * guards; this selector only admits the bounded RGB replacement.
 */
export function resolveBotanicalBodyVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (look === 'classic') return false;
  const requested = new URLSearchParams(search).get('botanicalBodyVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  return resolveVolumeVfxEnabled(look, search);
}

/**
 * Keeps the exact thick-Glass body-transmission experiment independently
 * measurable inside the broader volume study. Normal WebGL owns the strict
 * Glass owner, depth, contact, and topology guards; Canvas and compact true 8x
 * remain controls while this selector admits only its bounded RGB response.
 */
export function resolveGlassBodyVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (look === 'classic') return false;
  const requested = new URLSearchParams(search).get('glassBodyVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  return resolveVolumeVfxEnabled(look, search);
}

/**
 * Re-composes only the exact Oil body on top of E03's connected-liquid
 * baseline. The explicit selector keeps the experiment independently
 * measurable, but it cannot bypass the parent liquid-body ownership proof.
 */
export function resolveOilBodyVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveLiquidBodyVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('oilBodyVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  return true;
}

/**
 * Re-composes only the exact native Water body after E03 has established a
 * connected, same-species liquid volume. The child selector may replace
 * Water's inherited broad stripe carrier, but it cannot recreate E03 when the
 * parent liquid-body experiment or containing HDR look is disabled.
 */
export function resolveWaterBodyVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveLiquidBodyVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('waterBodyVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  return true;
}

/**
 * Keeps the settled-powder crown experiment independently measurable without
 * changing liquid or gas. Ordinary realistic/neon presets retain the broad
 * volume default; the explicit query is reserved for comparison captures and
 * capability audits.
 */
export function resolvePowderBodyVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (look === 'classic') return false;
  const requested = new URLSearchParams(search).get('powderBodyVfx');
  if (requested === '0' || requested === 'off') return false;
  if (requested === '1' || requested === 'on') return true;
  return resolveVolumeVfxEnabled(look, search);
}

/**
 * Keeps the settled powder/solid contact experiment independently measurable
 * without requiring the powder-body crown layer. Ordinary realistic/neon
 * presets retain the broad volume default; the explicit query is reserved for
 * comparison captures and capability audits.
 */
export function resolvePowderSolidContactVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (look === 'classic') return false;
  const requested = new URLSearchParams(search).get('powderSolidContactVfx');
  if (requested === '0' || requested === 'off') return false;
  if (requested === '1' || requested === 'on') return true;
  return resolveVolumeVfxEnabled(look, search);
}

/**
 * Keeps the exact Glass/Ice thin-edge transmission experiment independently
 * measurable from the older translucent lens shell and field transmission.
 * Ordinary realistic/neon presets retain the broad volume default; the
 * explicit query is reserved for comparison captures and capability audits.
 */
export function resolveTranslucentEdgeVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (look === 'classic') return false;
  const requested = new URLSearchParams(search).get('translucentEdgeVfx');
  if (requested === '0' || requested === 'off') return false;
  if (requested === '1' || requested === 'on') return true;
  return resolveVolumeVfxEnabled(look, search);
}

/**
 * Keeps the Wax/hydrated-PLNT subsurface experiment independently measurable
 * from the generic solid-depth and botanical lifecycle layers. Ordinary
 * realistic/neon presets retain the broad volume default; the explicit query
 * is reserved for comparison captures and capability audits.
 */
export function resolveOrganicSubsurfaceVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (look === 'classic') return false;
  const requested = new URLSearchParams(search).get('organicSubsurfaceVfx');
  if (requested === '0' || requested === 'off') return false;
  if (requested === '1' || requested === 'on') return true;
  return resolveVolumeVfxEnabled(look, search);
}

/**
 * Keeps the Sand/Clay/Concrete aqueous-suspension optics independently
 * measurable from the established shared wet-material albedo. The additional
 * family light/depth response belongs only to normal WebGL; Canvas and the
 * compact true-8x shader retain the existing cohesive suspension baseline.
 */
export function resolveWetSedimentVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (look === 'classic') return false;
  const requested = new URLSearchParams(search).get('wetSedimentVfx');
  if (requested === '0' || requested === 'off') return false;
  if (requested === '1' || requested === 'on') return true;
  return resolveVolumeVfxEnabled(look, search);
}

/**
 * Keeps the dry-powder local-light experiment independently measurable without
 * changing the established powder body-depth response. Ordinary realistic/neon
 * presets retain the broad volume default; the explicit query is reserved for
 * comparison captures and capability audits.
 */
export function resolvePowderLightVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (look === 'classic') return false;
  const requested = new URLSearchParams(search).get('powderLightVfx');
  if (requested === '0' || requested === 'off') return false;
  if (requested === '1' || requested === 'on') return true;
  return resolveVolumeVfxEnabled(look, search);
}
