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
