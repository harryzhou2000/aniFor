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
 * Gives exact propagated Smoke a broad, low-frequency soot fold after E04 has
 * established its connected atmosphere-owned body. This child selector never
 * recreates the gas body on its own; it only admits bounded RGB arithmetic in
 * normal WebGL, while Canvas and the compact true-8x path keep their existing
 * semantic presentation.
 */
export function resolveSmokeSoftnessVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveGasBodyVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('smokeSoftnessVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  return true;
}

/**
 * E33 deepens only the connected exact-Smoke body after E27 has established
 * its soft soot fold. This child cannot revive E04/E27 and remains separately
 * switchable for billow-depth, topology, and recovery audits.
 */
export function resolveSmokeBillowDepthVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveSmokeSoftnessVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('smokeBillowDepthVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  return true;
}

/**
 * Re-composes only exact Noble Gas billows after E04 has established the
 * connected, atmosphere-owned gas body. The child selector may refine that
 * species' volume cues, but it cannot recreate E04 when the parent gas-body
 * experiment or containing HDR look is disabled. True 8x remains excluded by
 * the parent's normal-detail presenter gate.
 */
export function resolveNobleGasBillowVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveGasBodyVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('nobleGasBillowVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  return true;
}

/**
 * Controls the accepted independently measurable exact-Hydrogen volume
 * response. Hydrogen remains a strict child of the
 * stable gas body: an explicit selector can enable or disable the child, but
 * it cannot recreate E04 when the parent or non-Classic HDR look is inactive.
 * Focused input fixtures default the new child off until they opt in, so older
 * gas audits keep their calibrated selector sets unchanged.
 */
export function resolveHydrogenBodyVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveGasBodyVfxEnabled(look, search)) return false;
  const parameters = new URLSearchParams(search);
  const requested = parameters.get('hydrogenBodyVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  if (parameters.get('inputAudit') === '1') return false;
  return true;
}

/**
 * E44 controls the independently measurable exact-Carbon-Dioxide volume response.
 * Carbon Dioxide remains a strict child of the stable gas body: an explicit
 * selector can enable or disable the child, but it cannot recreate E04 when
 * the parent or non-Classic HDR look is inactive. Focused input fixtures
 * default the new child off until they opt in, so older gas audits keep their
 * calibrated selector sets unchanged.
 */
export function resolveCarbonDioxideBodyVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveGasBodyVfxEnabled(look, search)) return false;
  const parameters = new URLSearchParams(search);
  const requested = parameters.get('carbonDioxideBodyVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  if (parameters.get('inputAudit') === '1') return false;
  return true;
}

/**
 * E57 controls the independently measurable exact-FOG connected-core response.
 * It remains a strict child of E04 and defaults off in generic input fixtures,
 * keeping every older gas audit's selector set and calibrated framebuffer
 * unchanged until the focused FOG fixture opts in.
 */
export function resolveFogCoreDiffuseVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveGasBodyVfxEnabled(look, search)) return false;
  const parameters = new URLSearchParams(search);
  const requested = parameters.get('fogCoreDiffuseVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  if (parameters.get('inputAudit') === '1') return false;
  return true;
}

/**
 * E31 adds a broad prismatic interior lobe only after E25 has established the
 * exact Noble Gas billow. It cannot revive E04/E25, and remains independently
 * switchable so its bipolar volume response can be measured without changing
 * the accepted parent card.
 */
export function resolveNobleGasPrismVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveNobleGasBillowVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('nobleGasPrismVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
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
 * Keeps the exact Metal/Water contact response independently measurable only
 * after both its opaque-solid body and liquid-side meniscus parents are live.
 * An explicit child override cannot recreate either ownership proof.
 */
export function resolveMetalWaterContactVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveSolidBodyVfxEnabled(look, search)
    || !resolveLiquidSolidMeniscusVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('metalWaterContactVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  return true;
}

/**
 * E56 refines only the already-proven Metal-side Water contact. It cannot
 * recreate E37 ownership, and focused input audits keep it frozen unless they
 * explicitly request the child selector.
 */
export function resolveWaterMetalTransmissionVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveMetalWaterContactVfxEnabled(look, search)) return false;
  const parameters = new URLSearchParams(search);
  const requested = parameters.get('waterMetalTransmissionVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  if (parameters.get('inputAudit') === '1') return false;
  return true;
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
 * E29 restores smooth mineral-scale variation only after E23 has removed the
 * inherited polished ROCK lobe. The normal WebGL shader owns the exact owner,
 * geological-style, depth, contact, and topology proof; this child selector
 * cannot revive E23, E17, or their containing HDR look.
 */
export function resolveRockMesostructureVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveRockRoughnessVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('rockMesostructureVfx');
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
 * Adds material-scale bark plates and leaf clusters only after E20 has proven
 * an exact, ordinary Wood/PLNT body. The child selector cannot recreate the
 * parent body when E20 or its containing HDR look is disabled.
 */
export function resolveBotanicalMesostructureVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveBotanicalBodyVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('botanicalMesostructureVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  return true;
}

/**
 * E30 breaks exact-Wood bark relief into bounded plates and fissures after E26
 * has established the botanical body mesostructure. It is independent of the
 * E28 pigment finish, but cannot revive either of its structural parents.
 */
export function resolveWoodBarkReliefVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveBotanicalMesostructureVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('woodBarkReliefVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  return true;
}

/**
 * E28 adds a restrained Wood/PLNT pigment response only after E26 has proven
 * the parent mesostructure path. The shader keeps exact owner/contact/topology
 * eligibility; this selector cannot revive either parent when it is disabled.
 */
export function resolveBotanicalPigmentVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveBotanicalMesostructureVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('botanicalPigmentVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  return true;
}

/**
 * E35 combines E28's exact-Wood heartwood pigment with E30's interrupted bark
 * plates. Both parents must remain live: this child cannot recreate pigment or
 * structural relief when either independently measurable layer is disabled.
 */
export function resolveWoodTanninVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveBotanicalPigmentVfxEnabled(look, search)
    || !resolveWoodBarkReliefVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('woodTanninVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  return true;
}

/**
 * E32 gives exact PLNT a bounded leaf-lamina and vein response only after E28
 * has established its body pigment. The child cannot revive E20/E26/E28 and
 * remains independently switchable for exact lifecycle/topology audits.
 */
export function resolvePlantLaminaVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveBotanicalPigmentVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('plantLaminaVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  return true;
}

/**
 * E34 turns E32's exact zero-state PLNT lamina into a coherent signed lobe
 * contour. The child cannot revive any earlier botanical body layer and stays
 * independently switchable for fit-view, lifecycle, topology, and 8x audits.
 */
export function resolvePlantLobeDepthVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolvePlantLaminaVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('plantLobeDepthVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  return true;
}

/**
 * E36 recomposes exact PLNT canopy masses only after E34 has established the
 * zero-state lobe-depth parent. This child cannot revive any earlier botanical
 * body layer and remains independently switchable for topology and 8x audits.
 */
export function resolvePlantCanopyMassVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolvePlantLobeDepthVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('plantCanopyMassVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  return true;
}

/**
 * The evidence-backed continuous-tissue experiment styles exact PLNT canopy
 * masses only after E36 has established the canopy-mass parent. This child
 * cannot revive any earlier botanical layer and remains independently
 * switchable for focused topology and fit-view audits. Normal WebGL selection
 * is enforced by the presenter.
 */
export function resolvePlantCanopyTissueVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolvePlantCanopyMassVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('plantCanopyTissueVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  return true;
}

/**
 * E55 refines only E53's proven continuous PLNT canopy tissue into a bounded
 * interlock-volume response. This strict child cannot revive any botanical
 * parent, and focused input audits remain frozen until they request it.
 */
export function resolvePlantCanopyInterlockVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolvePlantCanopyTissueVfxEnabled(look, search)) return false;
  const parameters = new URLSearchParams(search);
  const requested = parameters.get('plantCanopyInterlockVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  if (parameters.get('inputAudit') === '1') return false;
  return true;
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
 * Adds a final exact-Oil volume finish only after the Oil body recomposition
 * has established its connected, same-species ownership. The child selector
 * remains independently measurable, but cannot revive an inactive Oil-body
 * parent or the underlying liquid-body baseline.
 */
export function resolveOilVolumeFinishVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveOilBodyVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('oilVolumeFinishVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  return true;
}

/**
 * Re-composes only the exact native Acid body after E03 has established a
 * connected, same-species liquid volume. The child remains independently
 * measurable, but cannot recreate the liquid-body baseline when its parent or
 * containing HDR look is disabled.
 */
export function resolveAcidBodyVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveLiquidBodyVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('acidBodyVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  return true;
}

/**
 * E46 recomposes only exact native Soap after E03 has proved a connected,
 * same-species viscous liquid body. The child cannot revive its parent. Older
 * input-audit fixtures keep their frozen selector matrices until they opt in.
 */
export function resolveSoapBodyVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveLiquidBodyVfxEnabled(look, search)) return false;
  const parameters = new URLSearchParams(search);
  const requested = parameters.get('soapBodyVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  if (parameters.get('inputAudit') === '1') return false;
  return true;
}

/**
 * Gives exact native DEUT a trait-aware connected-liquid body without
 * weakening E03's deliberately trait-free eligibility. This is a sibling of
 * E03 inside a non-Classic HDR look: an explicit selector can isolate E41
 * while broad volume styling is off, and `liquidBodyVfx=0` remains an
 * independent E03-only comparison control. Without an override it follows the
 * broad volume preset like the other first-level material-body experiments.
 */
export function resolveDeutBodyVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (look === 'classic') return false;
  const parameters = new URLSearchParams(search);
  const requested = parameters.get('deutBodyVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  // Focused browser fixtures predate E41 and construct their own isolated
  // query strings. Keep those audits unchanged unless they explicitly opt in;
  // ordinary realistic/neon play still inherits the broad volume preset.
  if (parameters.get('inputAudit') === '1') return false;
  return resolveVolumeVfxEnabled(look, search);
}

/**
 * Reserves an independently measurable exact ISZS/VIBR solid-body response
 * without widening the phase-permissive radioactive identity layer. It is a
 * strict child of E17's solid-body proof: an explicit child request cannot
 * revive the response while `solidBodyVfx=0`, and older focused fixtures stay
 * unchanged until they explicitly opt in.
 */
export function resolveRadioactiveSolidBodyVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveSolidBodyVfxEnabled(look, search)) return false;
  const parameters = new URLSearchParams(search);
  const requested = parameters.get('radioactiveSolidBodyVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  if (parameters.get('inputAudit') === '1') return false;
  return resolveVolumeVfxEnabled(look, search);
}

/**
 * E47 adds an exact-ISZS crystalline-decay finish only after E43 has proved
 * the radioactive Solid body. The child cannot revive E43, and focused input
 * fixtures remain frozen until they explicitly request this selector.
 */
export function resolveIszsCrystallineVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveRadioactiveSolidBodyVfxEnabled(look, search)) return false;
  const parameters = new URLSearchParams(search);
  const requested = parameters.get('iszsCrystallineVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  if (parameters.get('inputAudit') === '1') return false;
  return true;
}

/**
 * E54 refines only the exact VIBR conductive macro body after E43 has proved
 * the radioactive Solid parent. It is intentionally a sibling of E47: neither
 * child can revive E43/E17, and focused input fixtures remain isolated until
 * they explicitly request the child selector.
 */
export function resolveVibrMacroReliefVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolveRadioactiveSolidBodyVfxEnabled(look, search)) return false;
  const parameters = new URLSearchParams(search);
  const requested = parameters.get('vibrMacroReliefVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  if (parameters.get('inputAudit') === '1') return false;
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
 * Re-composes only exact native Gunpowder and BCOL after E05 has established
 * a dry, settled Smooth powder body. The independently measurable child can
 * never resurrect that parent when the broad powder-body experiment is off.
 */
export function resolveSootyPowderBodyVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolvePowderBodyVfxEnabled(look, search)) return false;
  const requested = new URLSearchParams(search).get('sootyPowderBodyVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  return true;
}

/**
 * E45 re-composes only exact native Thermite after E05 has proved a dry,
 * settled Smooth powder body. The child cannot revive its parent. Existing
 * input-audit scenes default it off until they opt in so their frozen selector
 * matrices and framebuffer envelopes remain unchanged.
 */
export function resolveThermiteBodyVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolvePowderBodyVfxEnabled(look, search)) return false;
  const parameters = new URLSearchParams(search);
  const requested = parameters.get('thermiteBodyVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  if (parameters.get('inputAudit') === '1') return false;
  return true;
}

/**
 * E48 re-composes only exact native Snow after E05 has proved a dry, settled
 * Smooth powder body. The child cannot revive its parent. Existing input-audit
 * scenes default it off until they explicitly opt in, preserving their frozen
 * selector and framebuffer contracts.
 */
export function resolveSnowpackBodyVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolvePowderBodyVfxEnabled(look, search)) return false;
  const parameters = new URLSearchParams(search);
  const requested = parameters.get('snowpackBodyVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  if (parameters.get('inputAudit') === '1') return false;
  return true;
}

/**
 * E49 re-composes only exact native powder Quartz after E05 has proved a dry,
 * settled Smooth body. Native PQRT tmp2 crystal brightness remains a later,
 * independent state layer, and this child cannot revive its E05 parent.
 */
export function resolveQuartzMesostructureVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolvePowderBodyVfxEnabled(look, search)) return false;
  const parameters = new URLSearchParams(search);
  const requested = parameters.get('quartzMesostructureVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  if (parameters.get('inputAudit') === '1') return false;
  return true;
}

/**
 * E50 re-composes only exact native C4/PLEX after E05 has proved a dry,
 * settled Smooth body. The existing explosive-powder signature remains a
 * later identity layer and this child cannot revive its E05 parent.
 */
export function resolveC4BodyVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolvePowderBodyVfxEnabled(look, search)) return false;
  const parameters = new URLSearchParams(search);
  const requested = parameters.get('c4BodyVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  if (parameters.get('inputAudit') === '1') return false;
  return true;
}

/**
 * E52 re-composes only exact native BGLA after E05 has proved a dry,
 * settled Smooth body. This child cannot revive its powder-body/volume parent,
 * and input-audit scenes retain their frozen selector contracts until they
 * explicitly opt in.
 */
export function resolveBglaBodyVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (!resolvePowderBodyVfxEnabled(look, search)) return false;
  const parameters = new URLSearchParams(search);
  const requested = parameters.get('bglaBodyVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  if (parameters.get('inputAudit') === '1') return false;
  return true;
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
