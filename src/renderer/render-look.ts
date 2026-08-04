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
