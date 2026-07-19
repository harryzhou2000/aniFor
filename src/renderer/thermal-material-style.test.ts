import { describe, expect, it } from 'vitest';
import { ROOM_TEMPERATURE_DECIKELVIN } from '../shared/temperature';
import { RenderOptics } from './render-optics';
import { Material } from '../shared/materials';
import { RenderPhase } from './render-profile';
import {
  receivesThermalMaterialStyle, thermalMaterialDelta, thermalOpticsGain,
} from './thermal-material-style';

describe('thermal material styling', () => {
  it('keeps missing and ambient temperature exact RGB no-ops', () => {
    const output = new Float32Array([99, 99, 99]);
    thermalMaterialDelta(output, undefined, RenderOptics.SmoothRigid);
    expect([...output]).toEqual([0, 0, 0]);
    thermalMaterialDelta(output, ROOM_TEMPERATURE_DECIKELVIN, RenderOptics.SmoothRigid);
    expect([...output]).toEqual([0, 0, 0]);
  });

  it('uses opposed bounded cool and warm chroma without touching support state', () => {
    const cold = new Float32Array(3);
    const hot = new Float32Array(3);
    thermalMaterialDelta(cold, 1200, RenderOptics.SmoothRigid);
    thermalMaterialDelta(hot, 18_000, RenderOptics.SmoothRigid);
    expect(cold[2]).toBeGreaterThan(cold[0] + 12);
    expect(hot[0]).toBeGreaterThan(hot[2] + 30);
    expect(Math.max(...cold.map(Math.abs), ...hot.map(Math.abs))).toBeLessThanOrEqual(26);
  });

  it('gives polished/device surfaces more response than diffuse grains', () => {
    expect(thermalOpticsGain(RenderOptics.Device))
      .toBeGreaterThan(thermalOpticsGain(RenderOptics.SmoothRigid));
    expect(thermalOpticsGain(RenderOptics.SmoothRigid))
      .toBeGreaterThan(thermalOpticsGain(RenderOptics.RoughGranular));
  });

  it('excludes walls, volumetric phases, emission, fields, and role-bearing matter', () => {
    expect(receivesThermalMaterialStyle(RenderPhase.Solid, Material.Metal, false, 0)).toBe(true);
    expect(receivesThermalMaterialStyle(RenderPhase.Powder, Material.Sand, false, 0)).toBe(true);
    expect(receivesThermalMaterialStyle(RenderPhase.Solid, Material.Wall, false, 0)).toBe(false);
    expect(receivesThermalMaterialStyle(RenderPhase.Gas, Material.Smoke, false, 0)).toBe(false);
    expect(receivesThermalMaterialStyle(RenderPhase.Liquid, Material.Water, false, 0)).toBe(false);
    expect(receivesThermalMaterialStyle(RenderPhase.Energy, Material.PHOT, false, 0)).toBe(false);
    expect(receivesThermalMaterialStyle(RenderPhase.Field, Material.GRVT, false, 0)).toBe(false);
    expect(receivesThermalMaterialStyle(RenderPhase.Solid, Material.Metal, true, 0)).toBe(false);
    expect(receivesThermalMaterialStyle(RenderPhase.Solid, Material.Metal, false, 1)).toBe(false);
  });
});
