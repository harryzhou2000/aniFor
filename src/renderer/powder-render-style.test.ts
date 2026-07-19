import { describe, expect, it } from 'vitest';
import { POWDER_RENDER_STYLES, powderRenderStyleValue } from './powder-render-style';

describe('powder render style', () => {
  it('keeps stable shader values for the three comparison modes', () => {
    expect(POWDER_RENDER_STYLES).toEqual(['grains', 'local', 'smooth']);
    expect(POWDER_RENDER_STYLES.map(powderRenderStyleValue)).toEqual([0, 1, 2]);
  });
});
