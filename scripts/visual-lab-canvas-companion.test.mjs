import { describe, expect, it } from 'vitest';

import {
  buildCanvasCompanionUrl,
  groupCanvasCompanionRecipes,
} from './visual-lab-canvas-companion.mjs';
import { resolveVisualLabCaptureRecipe } from './visual-lab-recipes.mjs';

describe('Visual Lab Canvas companion', () => {
  it('coalesces identical fallback fixture/scale captures without losing candidate labels', () => {
    const groups = groupCanvasCompanionRecipes({
      recipes: [
        resolveVisualLabCaptureRecipe('gas-showcase'),
        resolveVisualLabCaptureRecipe('oxygen-showcase'),
      ],
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      recipe: { fixture: 'showcase', renderScale: 2 },
      candidates: ['gas-showcase', 'oxygen-showcase'],
    });
  });

  it('rejects recipe bytes that drift from the current catalog', () => {
    expect(() => groupCanvasCompanionRecipes({
      recipes: [{ ...resolveVisualLabCaptureRecipe('water-motion'), gain: 1.5 }],
    })).toThrow('not the current catalog record');
  });

  it('forces Canvas while removing every normal OFF/A/B selector', () => {
    const recipe = resolveVisualLabCaptureRecipe('water-motion');
    const { url } = buildCanvasCompanionUrl('https://example.test/app/', recipe);
    expect(url.searchParams.get('renderer')).toBe('canvas2d');
    expect(url.searchParams.get('scene')).toBe('showcase');
    expect(url.searchParams.get('renderScale')).toBe('2');
    for (const name of ['visualLab', 'visualVariant', 'visualTarget', 'visualGain']) {
      expect(url.searchParams.has(name)).toBe(false);
    }
  });
});
