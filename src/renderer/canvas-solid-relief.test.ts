import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { canvasSolidRelief } from './canvas-solid-relief';
import { RenderOptics } from './render-optics';
import { RenderProfile } from './render-profile';

describe('Canvas solid relief', () => {
  it('is deterministic, bounded, and varies gradually across a material chunk', () => {
    const first = canvasSolidRelief(12, 9, Material.Metal, RenderProfile.Rigid, RenderOptics.SmoothRigid);
    const adjacent = canvasSolidRelief(13, 9, Material.Metal, RenderProfile.Rigid, RenderOptics.SmoothRigid);
    const distant = canvasSolidRelief(36, 25, Material.Metal, RenderProfile.Rigid, RenderOptics.SmoothRigid);
    expect(canvasSolidRelief(12, 9, Material.Metal, RenderProfile.Rigid, RenderOptics.SmoothRigid)).toBe(first);
    expect(Math.abs(first)).toBeLessThanOrEqual(8.5);
    expect(Math.abs(adjacent - first)).toBeLessThan(1.5);
    expect(distant).not.toBe(first);
  });

  it('gives polished rigid matter more relief than device surfaces', () => {
    const rigid = canvasSolidRelief(12, 9, Material.Metal, RenderProfile.Rigid, RenderOptics.SmoothRigid);
    const device = canvasSolidRelief(12, 9, Material.Metal, RenderProfile.Device, RenderOptics.Device);
    expect(Math.abs(rigid)).toBeGreaterThan(Math.abs(device));
  });
});
