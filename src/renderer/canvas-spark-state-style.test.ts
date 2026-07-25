import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { SPRK_PRESENTATION_STATE } from '../simulation/types';
import {
  applyCanvasSparkStateStyle,
  canvasSparkHostFamily,
  CanvasSparkHostFamily,
} from './canvas-spark-state-style';

const FAMILY_HOSTS = [
  [Material.Metal, CanvasSparkHostFamily.Metallic],
  [Material.PSCN, CanvasSparkHostFamily.Semiconductor],
  [Material.PTCT, CanvasSparkHostFamily.ThermalConductor],
  [Material.ETRD, CanvasSparkHostFamily.ElectrodeDevice],
  [Material.SaltWater, CanvasSparkHostFamily.Aqueous],
] as const;

function encodeSparkState(host: number, life: number, present = true): number {
  return (present ? SPRK_PRESENTATION_STATE.presentMask : 0)
    | (host & SPRK_PRESENTATION_STATE.hostMask)
    | ((Math.max(0, Math.min(SPRK_PRESENTATION_STATE.lifeMaximum, Math.round(life)))
      << SPRK_PRESENTATION_STATE.lifeShift) & SPRK_PRESENTATION_STATE.lifeMask);
}

function styled(
  host: number,
  life = 4,
  x = 23,
  y = 19,
  material: number = Material.SPRK,
  present = true,
): number[] {
  const output = new Float32Array([228, 224, 132, 173]);
  applyCanvasSparkStateStyle(
    output,
    material,
    encodeSparkState(host, life, present),
    x,
    y,
  );
  return Array.from(output);
}

describe('Canvas conductor-aware SPRK state style', () => {
  it('classifies coherent native host families and excludes WIRE', () => {
    for (const [host, family] of FAMILY_HOSTS) {
      expect(canvasSparkHostFamily(host)).toBe(family);
    }
    expect(canvasSparkHostFamily(Material.GOLD)).toBe(CanvasSparkHostFamily.Metallic);
    expect(canvasSparkHostFamily(Material.NSCN)).toBe(CanvasSparkHostFamily.Semiconductor);
    expect(canvasSparkHostFamily(Material.NTCT)).toBe(CanvasSparkHostFamily.ThermalConductor);
    expect(canvasSparkHostFamily(Material.SWCH)).toBe(CanvasSparkHostFamily.ElectrodeDevice);
    expect(canvasSparkHostFamily(Material.Water)).toBe(CanvasSparkHostFamily.Aqueous);
    expect(canvasSparkHostFamily(Material.WIRE)).toBe(CanvasSparkHostFamily.None);
    expect(canvasSparkHostFamily(Material.Empty)).toBe(CanvasSparkHostFamily.None);
    expect(canvasSparkHostFamily(255)).toBe(CanvasSparkHostFamily.None);
  });

  it('protects absent state, zero or unsupported hosts, and every wrong owner', () => {
    const baseline = [228, 224, 132, 173];
    expect(styled(Material.Metal, 4, 23, 19, Material.SPRK, false)).toEqual(baseline);
    expect(styled(Material.Empty)).toEqual(baseline);
    expect(styled(Material.WIRE)).toEqual(baseline);
    expect(styled(255)).toEqual(baseline);
    expect(styled(Material.Metal, 4, 23, 19, Material.Metal)).toEqual(baseline);
    expect(styled(Material.Metal, 4, 23, 19, Material.Water)).toEqual(baseline);
    expect(styled(Material.Metal, 4, 23, 19, Material.Empty)).toEqual(baseline);
  });

  it('gives the five supported host families distinct colour signatures', () => {
    const signatures = FAMILY_HOSTS.map(([host]) => styled(host).slice(0, 3).join(','));
    expect(new Set(signatures).size).toBe(FAMILY_HOSTS.length);

    const metallic = styled(Material.Metal);
    const semiconductor = styled(Material.PSCN);
    const thermal = styled(Material.PTCT);
    const device = styled(Material.ETRD);
    const aqueous = styled(Material.SaltWater);
    expect(metallic[2] - metallic[0]).toBeGreaterThan(semiconductor[2] - semiconductor[0]);
    expect(thermal[0]).toBeGreaterThan(228);
    expect(device[1]).toBeLessThan(metallic[1]);
    expect(aqueous[0]).toBeLessThan(semiconductor[0]);
  });

  it('retains a monotonic visible native lifecycle through terminal life zero', () => {
    const baseline = [228, 224, 132];
    const distance = (life: number): number => styled(Material.Metal, life)
      .slice(0, 3)
      .reduce((sum, value, channel) => sum + Math.abs(value - baseline[channel]), 0);

    expect(distance(0)).toBeGreaterThan(0);
    expect(distance(1)).toBeGreaterThan(distance(0));
    expect(distance(2)).toBeGreaterThan(distance(1));
    expect(distance(3)).toBeGreaterThan(distance(2));
    expect(distance(4)).toBeGreaterThan(distance(3));
    expect(distance(SPRK_PRESENTATION_STATE.lifeMaximum)).toBe(distance(4));
  });

  it('anchors its path to integer world cells and is independent of subcell scale', () => {
    expect(styled(Material.ETRD, 3, 10.01, 17.01))
      .toEqual(styled(Material.ETRD, 3, 10.99, 17.99));
    expect(styled(Material.ETRD, 3, -4.99, -8.99))
      .toEqual(styled(Material.ETRD, 3, -4.01, -8.01));
    expect(styled(Material.ETRD, 3, 10.01, 17.01))
      .not.toEqual(styled(Material.ETRD, 3, 11.01, 17.01));
  });

  it('keeps every signed channel response bounded and leaves alpha untouched', () => {
    const baseline = [228, 224, 132, 173];
    for (const [host] of FAMILY_HOSTS) {
      for (const life of [0, 1, 2, 3, 4, 32, SPRK_PRESENTATION_STATE.lifeMaximum]) {
        for (let y = -19; y <= 19; y += 3) {
          for (let x = -23; x <= 23; x += 4) {
            const result = styled(host, life, x, y);
            expect(result[3]).toBe(baseline[3]);
            for (let channel = 0; channel < 3; channel++) {
              expect(Math.abs(result[channel] - baseline[channel])).toBeLessThanOrEqual(30);
            }
          }
        }
      }
    }
  });
});
