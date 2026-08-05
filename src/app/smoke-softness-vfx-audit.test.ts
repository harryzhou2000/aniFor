import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { RenderFieldSet } from '../renderer/render-field-set';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  prepareSmokeSoftnessVfxFixture, SMOKE_SOFTNESS_VFX_AUDIT,
  type SmokeSoftnessVfxPoint, type SmokeSoftnessVfxRect,
} from './smoke-softness-vfx-audit';

describe('Smoke softness VFX audit fixture', () => {
  it('authors an exact style-1 Smoke body with opposite static billow probes', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    const { target } = SMOKE_SOFTNESS_VFX_AUDIT;
    expect(target.material).toBe(Material.Smoke);
    expect(target.code).toBe('SMKE');
    expectRect(cells, simulation.width, target.deepCore, Material.Smoke);
    for (const probe of target.billowProbes) {
      expectRect(cells, simulation.width, probe.region, Material.Smoke);
      expect(probe.centre).toEqual(centre(probe.region));
    }
    expect(target.billowProbes[0].billow).toBeGreaterThanOrEqual(0.90);
    expect(target.billowProbes[1].billow).toBeLessThanOrEqual(-0.80);
    expectRect(cells, simulation.width, target.authoredVoid, Material.Empty);
    expectRect(cells, simulation.width, target.openChannel, Material.Empty);
    expectRoundedBodyExceptCutouts(cells, simulation.width, target);
  });

  it('keeps deterministic exact-owner mid and rim sources separate from the broad body', () => {
    const simulation = preparedFixture();
    const fixture = SMOKE_SOFTNESS_VFX_AUDIT;
    expectRect(simulation.cells(), simulation.width, fixture.densityProfile.mid, Material.Smoke);
    expect(at(simulation.cells(), simulation.width, fixture.densityProfile.midProbe)).toBe(Material.Smoke);
    expect(at(simulation.cells(), simulation.width, fixture.densityProfile.rim)).toBe(Material.Smoke);
    expect(fixture.densityProfile.midProbe).toEqual({ x: 96, y: 330 });
    expect(fixture.densityProfile.rimProbe).toEqual({ x: 112, y: 330 });
  });

  it('keeps siblings, sparse controls, contacts, wall, and blank exact', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    const fixture = SMOKE_SOFTNESS_VFX_AUDIT;
    expect(fixture.protectedGases.map(({ material }) => material)).toEqual([
      Material.Oxygen, Material.Hydrogen, Material.FOG, Material.CFLM, Material.NobleGas,
    ]);
    for (const control of fixture.protectedGases) expectRect(cells, simulation.width, control.body, control.material);
    for (const carrier of fixture.sparse.carriers) expect(at(cells, simulation.width, carrier)).toBe(Material.Smoke);
    expect(at(cells, simulation.width, fixture.sparse.midpoint)).toBe(Material.Empty);
    expect(at(cells, simulation.width, fixture.sparse.gap)).toBe(Material.Empty);
    expect(at(cells, simulation.width, fixture.sparse.isolated)).toBe(Material.Smoke);
    expectRect(cells, simulation.width, fixture.gasSeam.gas, Material.Smoke);
    expectRect(cells, simulation.width, fixture.gasSeam.foreignGas, Material.FOG);
    expectRect(cells, simulation.width, fixture.waterContact.gas, Material.Smoke);
    expectRect(cells, simulation.width, fixture.waterContact.water, Material.Water);
    expectRect(cells, simulation.width, fixture.metalContact.gas, Material.Smoke);
    expectRect(cells, simulation.width, fixture.metalContact.metal, Material.Metal);
    expectRect(cells, simulation.width, fixture.nativeWall.gas, Material.Smoke);
    expect(at(simulation.walls(), simulation.width, fixture.nativeWall.wallAnchor)).toBe(fixture.conductiveWall);
    expectRect(cells, simulation.width, fixture.guardedBlank, Material.Empty);
  });

  it('propagates exact style-1 ownership with ordered dense, mid, and rim alpha', () => {
    const simulation = preparedFixture();
    const fields = new RenderFieldSet(simulation.width, simulation.height, ALL_MATERIALS);
    fields.atmosphere.update(simulation.cells(), simulation.walls());
    const fixture = SMOKE_SOFTNESS_VFX_AUDIT;
    const deep = atmosphereAt(fields, centre(fixture.target.deepCore));
    const mid = atmosphereAt(fields, fixture.densityProfile.midProbe);
    const rim = atmosphereAt(fields, fixture.densityProfile.rimProbe);
    expect(deep).toEqual({ alpha: 255, style: 1 });
    expect(mid.style).toBe(1);
    expect(rim.style).toBe(1);
    expect(mid.alpha).toBeGreaterThan(rim.alpha);
    expect(mid.alpha).toBeGreaterThan(0);
    expect(mid.alpha).toBeLessThan(255);
    expect(rim.alpha).toBeGreaterThan(0);
    expect(rim.alpha).toBeLessThan(mid.alpha);
    expect(atmosphereAt(fields, fixture.nativeWall.wallAnchor).style).not.toBe(1);
    expect(atmosphereAt(fields, fixture.gasSeam.gasProbe).style).toBe(1);
    expect(atmosphereAt(fields, fixture.gasSeam.foreignProbe).style).toBe(10);
  });

  it('resets deterministically and rejects unsupported backends and world sizes', () => {
    const simulation = new RenderLabBackend();
    prepareSmokeSoftnessVfxFixture(simulation);
    const cells = simulation.cells().slice();
    const walls = simulation.walls().slice();
    simulation.paint(2, 2, Material.Fire, 0);
    simulation.paintWall(2, 2, 2, 0);
    prepareSmokeSoftnessVfxFixture(simulation);
    expect(simulation.cells()).toEqual(cells);
    expect(simulation.walls()).toEqual(walls);
    expect(() => prepareSmokeSoftnessVfxFixture(new DeterministicBackend(612, 384)))
      .toThrow('RenderLab wall plane');
    expect(() => prepareSmokeSoftnessVfxFixture(new RenderLabBackend(32, 32))).toThrow('612x384');
  });
});

function preparedFixture(): RenderLabBackend {
  const simulation = new RenderLabBackend();
  prepareSmokeSoftnessVfxFixture(simulation);
  return simulation;
}

function at(bytes: Uint8Array, width: number, point: SmokeSoftnessVfxPoint): number {
  return bytes[point.y * width + point.x];
}

function centre(rect: SmokeSoftnessVfxRect): SmokeSoftnessVfxPoint {
  return { x: Math.floor(rect.x + rect.width / 2), y: Math.floor(rect.y + rect.height / 2) };
}

function expectRect(
  cells: Uint8Array, width: number, rect: SmokeSoftnessVfxRect, material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) expect(cells[y * width + x]).toBe(material);
  }
}

function expectRoundedBodyExceptCutouts(
  cells: Uint8Array, width: number, target: (typeof SMOKE_SOFTNESS_VFX_AUDIT)['target'],
): void {
  const radiusX = target.body.width * 0.5;
  const radiusY = target.body.height * 0.5;
  const centreX = target.body.x + radiusX;
  const centreY = target.body.y + radiusY;
  for (let y = target.body.y; y < target.body.y + target.body.height; y++) {
    for (let x = target.body.x; x < target.body.x + target.body.width; x++) {
      const normalizedX = Math.abs((x + 0.5 - centreX) / radiusX);
      const normalizedY = Math.abs((y + 0.5 - centreY) / radiusY);
      const outside = normalizedX ** 4 + normalizedY ** 4 > 1;
      const cutout = inside(target.authoredVoid, x, y) || inside(target.openChannel, x, y);
      expect(cells[y * width + x]).toBe(outside || cutout ? Material.Empty : Material.Smoke);
    }
  }
}

function atmosphereAt(fields: RenderFieldSet, point: SmokeSoftnessVfxPoint): { alpha: number; style: number } {
  const x = Math.floor(point.x / 2);
  const y = Math.floor(point.y / 2);
  const offset = (y * fields.atmosphere.width + x) * 4;
  return { alpha: fields.atmosphere.bytes[offset + 3], style: fields.atmosphere.styleBytes[offset] };
}

function inside(rect: SmokeSoftnessVfxRect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}
