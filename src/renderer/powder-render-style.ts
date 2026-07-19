export const POWDER_RENDER_STYLES = ['grains', 'local', 'smooth'] as const;
export type PowderRenderStyle = typeof POWDER_RENDER_STYLES[number];

export function powderRenderStyleValue(style: PowderRenderStyle): number {
  if (style === 'grains') return 0;
  if (style === 'local') return 1;
  return 2;
}
