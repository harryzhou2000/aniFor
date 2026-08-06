import { describe, expect, it } from 'vitest';
import { RenderFieldSet } from '../renderer/render-field-set';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  CARBON_DIOXIDE_BODY_VFX_AUDIT,
  carbonDioxideBodyVfxBillowAt,
  prepareCarbonDioxideBodyVfxFixture,
  type CarbonDioxideBodyVfxPoint,
  type CarbonDioxideBodyVfxRect,
} from './carbon-dioxide-body-vfx-audit';

describe('Carbon Dioxide body VFX audit fixture', () => {
  it('authors an exact CO2 style-6 body with opposite deterministic E04 billow probes', () => {
    const simulation = preparedFixture();
    const { target } = CARBON_DIOXIDE_BODY_VFX_AUDIT;
    expect(target.material).toBe(Material.CarbonDioxide);
    expect(target.code).toBe('CO2');
    expect(target.atmosphereStyle).toBe(6);
    expectRect(simulation.cells(), simulation.width, target.deepCore, Material.CarbonDioxide);
    for (const probe of target.billowProbes) {
      expectRect(simulation.cells(), simulation.width, probe.region, Material.CarbonDioxide);
      expect(probe.centre).toEqual(centre(probe.region));
      expect(probe.billow).toBe(carbonDioxideBodyVfxBillowAt(probe.centre));
    }
    expect(target.billowProbes[0].billow).toBeGreaterThanOrEqual(0.90);
    expect(target.billowProbes[1].billow).toBeLessThanOrEqual(-0.80);
    expectRect(simulation.cells(), simulation.width, target.authoredVoid, Material.Empty);
    expectRect(simulation.cells(), simulation.width, target.openChannel, Material.Empty);
    expectRoundedBodyExceptCutouts(simulation.cells(), simulation.width, target);
  });

  it('keeps sibling gases, sparse topology, seams, contacts, wall, and blank exact', () => {
    const simulation = preparedFixture();
    const fixture = CARBON_DIOXIDE_BODY_VFX_AUDIT;
    expect(fixture.protectedGases.map(({ material }) => material)).toEqual([
      Material.Smoke, Material.Oxygen, Material.NobleGas, Material.FOG, Material.CFLM,
      Material.Steam, Material.Hydrogen,
    ]);
    for (const control of fixture.protectedGases) {
      expectRect(simulation.cells(), simulation.width, control.body, control.material);
      expect(at(simulation.cells(), simulation.width, control.probe)).toBe(control.material);
    }
    for (const point of fixture.sparse.carriers) {
      expect(at(simulation.cells(), simulation.width, point)).toBe(Material.CarbonDioxide);
    }
    expect(at(simulation.cells(), simulation.width, fixture.sparse.midpoint)).toBe(Material.Empty);
    expect(at(simulation.cells(), simulation.width, fixture.sparse.gap)).toBe(Material.Empty);
    expect(at(simulation.cells(), simulation.width, fixture.sparse.isolated)).toBe(Material.CarbonDioxide);
    assertBoundary(simulation, fixture.gasSeam, Material.CarbonDioxide, Material.FOG);
    assertBoundary(simulation, fixture.waterContact, Material.CarbonDioxide, Material.Water);
    assertBoundary(simulation, fixture.metalContact, Material.CarbonDioxide, Material.Metal);
    expectRect(simulation.cells(), simulation.width, fixture.nativeWall.gas, Material.CarbonDioxide);
    expect(at(simulation.walls(), simulation.width, fixture.nativeWall.wallAnchor)).toBe(fixture.conductiveWall);
    expectRect(simulation.cells(), simulation.width, fixture.guardedBlank, Material.Empty);
  });

  it('propagates dense CO2 style 6 while all target siblings keep their own style and controls do not promote', () => {
    const simulation = preparedFixture();
    const fields = new RenderFieldSet(simulation.width, simulation.height, ALL_MATERIALS);
    fields.atmosphere.update(simulation.cells(), simulation.walls());
    const fixture = CARBON_DIOXIDE_BODY_VFX_AUDIT;
    const targetPoints = [
      centre(fixture.target.deepCore),
      ...fixture.target.billowProbes.map(({ centre: point }) => point),
    ];
    for (const point of targetPoints) {
      const atmosphere = atmosphereAt(fields, point);
      expect(atmosphere.style).toBe(6);
      expect(atmosphere.alpha).toBe(255);
    }
    for (const control of fixture.protectedGases) {
      expect(atmosphereAt(fields, control.probe).style, control.code).toBe(control.atmosphereStyle);
    }
    expect(atmosphereAt(fields, fixture.gasSeam.gasProbe).style).toBe(6);
    expect(atmosphereAt(fields, fixture.gasSeam.foreignProbe).style).toBe(10);
    expect(atmosphereAt(fields, centre(fixture.target.authoredVoid)).style).not.toBe(6);
    expect(atmosphereAt(fields, centre(fixture.target.openChannel)).style).not.toBe(6);
    expect(atmosphereAt(fields, fixture.nativeWall.wallAnchor).style).not.toBe(6);
    expect(atmosphereAt(fields, centre(fixture.guardedBlank)).style).not.toBe(6);
    expect(atmosphereAt(fields, fixture.sparse.isolated).alpha)
      .toBeLessThan(atmosphereAt(fields, fixture.target.billowProbes[0].centre).alpha);
  });

  it('keeps all external regions disjoint and every authored region in bounds', () => {
    const fixture = CARBON_DIOXIDE_BODY_VFX_AUDIT;
    const external = [
      fixture.target.body,
      ...fixture.protectedGases.map(({ body }) => body),
      fixture.gasSeam.gas,
      fixture.gasSeam.foreignGas,
      fixture.waterContact.gas,
      fixture.waterContact.water,
      fixture.metalContact.gas,
      fixture.metalContact.metal,
      fixture.nativeWall.gas,
      fixture.guardedBlank,
      ...fixture.sparse.carriers.map(pointRect),
      pointRect(fixture.sparse.isolated),
    ];
    assertDisjointAndInBounds(external, fixture.world);
    const internal = [
      fixture.target.deepCore,
      ...fixture.target.billowProbes.map(({ region }) => region),
      fixture.target.authoredVoid,
      fixture.target.openChannel,
    ];
    for (const region of internal) expect(contains(fixture.target.body, region)).toBe(true);
    assertDisjointAndInBounds(internal, fixture.world);
  });

  it('resets byte-deterministically and rejects unsupported backends or world geometry', () => {
    const simulation = new RenderLabBackend();
    prepareCarbonDioxideBodyVfxFixture(simulation);
    const cells = simulation.cells().slice();
    const walls = simulation.walls().slice();
    simulation.paint(2, 2, Material.Fire, 0);
    simulation.paintWall(2, 2, 2, 0);
    prepareCarbonDioxideBodyVfxFixture(simulation);
    expect(simulation.cells()).toEqual(cells);
    expect(simulation.walls()).toEqual(walls);
    expect(() => prepareCarbonDioxideBodyVfxFixture(new DeterministicBackend(612, 384)))
      .toThrow('RenderLab wall plane');
    expect(() => prepareCarbonDioxideBodyVfxFixture(new RenderLabBackend(32, 32)))
      .toThrow('612x384');
  });
});

function preparedFixture(): RenderLabBackend {
  const simulation = new RenderLabBackend();
  prepareCarbonDioxideBodyVfxFixture(simulation);
  return simulation;
}

function at(bytes: Uint8Array, width: number, point: CarbonDioxideBodyVfxPoint): number {
  return bytes[point.y * width + point.x];
}

function centre(rect: CarbonDioxideBodyVfxRect): CarbonDioxideBodyVfxPoint {
  return { x: Math.floor(rect.x + rect.width / 2), y: Math.floor(rect.y + rect.height / 2) };
}

function expectRect(
  cells: Uint8Array,
  width: number,
  rect: CarbonDioxideBodyVfxRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) expect(cells[y * width + x]).toBe(material);
  }
}

function assertBoundary(
  simulation: RenderLabBackend,
  boundary: {
    gas: CarbonDioxideBodyVfxRect;
    gasProbe: CarbonDioxideBodyVfxPoint;
    foreignProbe?: CarbonDioxideBodyVfxPoint;
    waterProbe?: CarbonDioxideBodyVfxPoint;
    metalProbe?: CarbonDioxideBodyVfxPoint;
    foreignGas?: CarbonDioxideBodyVfxRect;
    water?: CarbonDioxideBodyVfxRect;
    metal?: CarbonDioxideBodyVfxRect;
  },
  gas: Material,
  other: Material,
): void {
  expectRect(simulation.cells(), simulation.width, boundary.gas, gas);
  const otherRect = boundary.foreignGas ?? boundary.water ?? boundary.metal;
  const otherProbe = boundary.foreignProbe ?? boundary.waterProbe ?? boundary.metalProbe;
  if (!otherRect || !otherProbe) throw new Error('missing boundary control');
  expectRect(simulation.cells(), simulation.width, otherRect, other);
  expect(at(simulation.cells(), simulation.width, boundary.gasProbe)).toBe(gas);
  expect(at(simulation.cells(), simulation.width, otherProbe)).toBe(other);
}

function atmosphereAt(
  fields: RenderFieldSet,
  point: CarbonDioxideBodyVfxPoint,
): { alpha: number; style: number } {
  const x = Math.floor(point.x / 2);
  const y = Math.floor(point.y / 2);
  const offset = (y * fields.atmosphere.width + x) * 4;
  return { alpha: fields.atmosphere.bytes[offset + 3], style: fields.atmosphere.styleBytes[offset] };
}

function pointRect(point: CarbonDioxideBodyVfxPoint): CarbonDioxideBodyVfxRect {
  return { ...point, width: 1, height: 1 };
}

function contains(outer: CarbonDioxideBodyVfxRect, inner: CarbonDioxideBodyVfxRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function intersects(left: CarbonDioxideBodyVfxRect, right: CarbonDioxideBodyVfxRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

function assertDisjointAndInBounds(
  regions: readonly CarbonDioxideBodyVfxRect[],
  world: { readonly width: number; readonly height: number },
): void {
  for (const region of regions) {
    expect(region.x).toBeGreaterThanOrEqual(0);
    expect(region.y).toBeGreaterThanOrEqual(0);
    expect(region.width).toBeGreaterThan(0);
    expect(region.height).toBeGreaterThan(0);
    expect(region.x + region.width).toBeLessThanOrEqual(world.width);
    expect(region.y + region.height).toBeLessThanOrEqual(world.height);
  }
  for (let index = 0; index < regions.length; index++) {
    for (let other = index + 1; other < regions.length; other++) {
      expect(intersects(regions[index], regions[other])).toBe(false);
    }
  }
}

function expectRoundedBodyExceptCutouts(
  cells: Uint8Array,
  width: number,
  target: (typeof CARBON_DIOXIDE_BODY_VFX_AUDIT)['target'],
): void {
  const radiusX = target.body.width * 0.5;
  const radiusY = target.body.height * 0.5;
  const centreX = target.body.x + radiusX;
  const centreY = target.body.y + radiusY;
  for (let y = target.body.y; y < target.body.y + target.body.height; y++) {
    for (let x = target.body.x; x < target.body.x + target.body.width; x++) {
      const outside = Math.abs((x + 0.5 - centreX) / radiusX) ** 4
        + Math.abs((y + 0.5 - centreY) / radiusY) ** 4 > 1;
      const cutout = containsPoint(target.authoredVoid, x, y) || containsPoint(target.openChannel, x, y);
      expect(cells[y * width + x]).toBe(outside || cutout ? Material.Empty : Material.CarbonDioxide);
    }
  }
}

function containsPoint(rect: CarbonDioxideBodyVfxRect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}
