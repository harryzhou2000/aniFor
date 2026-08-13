import { describe, expect, it, vi } from 'vitest';
import { MATERIAL_SHOWCASE_SCENE_AUTHORING } from '../shared/material-showcase-atlas-catalog.js';
import { prepareMaterialShowcaseAtlas, type MaterialShowcasePlotter } from './material-showcase-atlas-authoring';

const plotter = (): MaterialShowcasePlotter => ({
  roundedRect: vi.fn(), eraseRect: vi.fn(), slope: vi.fn(), splitCapsule: vi.fn(),
  rect: vi.fn(), ellipse: vi.fn(), curvaturePlate: vi.fn(),
});

describe('material showcase atlas authoring', () => {
  it('validates and dispatches the frozen ordered scene commands', () => {
    const plot = plotter();
    prepareMaterialShowcaseAtlas(plot, MATERIAL_SHOWCASE_SCENE_AUTHORING.commands);
    expect(plot.roundedRect).toHaveBeenCalledWith(52, 196, 48, 28, 10, 38);
    expect(plot.ellipse).toHaveBeenCalledWith(427, 82, 82, 43, 39, 0.92, 823, 0.34);
    expect(plot.curvaturePlate).toHaveBeenCalledWith(510, 226, 54, 58, 14, 164);
    expect(Object.isFrozen(MATERIAL_SHOWCASE_SCENE_AUTHORING.commands)).toBe(true);
  });

  it('rejects empty, unknown, and malformed command streams', () => {
    expect(() => prepareMaterialShowcaseAtlas(plotter(), [])).toThrow('authoring is malformed');
    expect(() => prepareMaterialShowcaseAtlas(plotter(), [
      { kind: 'callback' },
    ])).toThrow('Unknown material showcase command');
    expect(() => prepareMaterialShowcaseAtlas(plotter(), [
      { kind: 'rect', x: 1 },
    ])).toThrow('invalid y');
  });
});
