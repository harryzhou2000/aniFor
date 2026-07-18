import { describe, expect, it } from 'vitest';
import { forceCanvas2D } from './webgl-support';

describe('renderer diagnostics', () => {
  it('forces Canvas2D only for the explicit query override', () => {
    expect(forceCanvas2D('?renderer=canvas2d')).toBe(true);
    expect(forceCanvas2D('?renderer=webgl')).toBe(false);
    expect(forceCanvas2D('')).toBe(false);
  });
});
