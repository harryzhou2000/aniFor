import type { RenderLook } from './render-look';

/**
 * Selects E82's normal-WebGL Ceramic blackbody body response.
 *
 * The renderer owns the exact native Ceramic, deep-body, HDR, topology, and
 * contact eligibility. This intentionally small resolver only supplies the
 * presentation preference: Styled looks default on, Classic and input-audit
 * captures retain their established image unless explicitly requested.
 */
export function resolveCeramicBlackbodyVfxEnabled(
  look: RenderLook,
  search = globalThis.location?.search ?? '',
): boolean {
  if (look === 'classic') return false;
  const parameters = new URLSearchParams(search);
  const requested = parameters.get('ceramicBlackbodyVfx');
  if (requested === '0' || requested === 'off' || requested === 'false') return false;
  if (requested === '1' || requested === 'on' || requested === 'true') return true;
  if (parameters.get('inputAudit') === '1') return false;
  return true;
}
