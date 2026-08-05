import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { RenderFieldSet } from '../renderer/render-field-set';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  NOBLE_GAS_BILLOW_VFX_AUDIT,
  prepareNobleGasBillowVfxFixture,
  type NobleGasBillowVfxPoint,
  type NobleGasBillowVfxRect,
} from './noble-gas-billow-vfx-audit';

describe('Noble Gas billow VFX audit fixture', () => {
  it('authors one exact NBLE calibration body with opposite broad billow probes', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    const { target } = NOBLE_GAS_BILLOW_VFX_AUDIT;

    expect(target.material).toBe(Material.NobleGas);
    expect(target.code).toBe('NOBL');
    expectRect(cells, simulation.width, target.deepCore, Material.NobleGas);
    for (const probe of target.billowProbes) {
      expectRect(cells, simulation.width, probe.region, Material.NobleGas);
      expect(probe.centre).toEqual(centre(probe.region));
    }
    expect(target.billowProbes[0].billow).toBeGreaterThanOrEqual(0.90);
    expect(target.billowProbes[1].billow).toBeLessThanOrEqual(-0.80);
    expectRect(cells, simulation.width, target.authoredVoid, Material.Empty);
    expectRect(cells, simulation.width, target.openChannel, Material.Empty);
    expectBodyExceptCutouts(cells, simulation.width, target);
  });

  it('keeps every sibling, sparse, seam, contact, wall, and blank control exact', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    const walls = simulation.walls();
    const fixture = NOBLE_GAS_BILLOW_VFX_AUDIT;

    expect(fixture.protectedGases.map(({ material }) => material)).toEqual([
      Material.Smoke, Material.Oxygen, Material.Hydrogen, Material.FOG, Material.CFLM,
    ]);
    for (const control of fixture.protectedGases) {
      expectRect(cells, simulation.width, control.body, control.material);
      expect(at(cells, simulation.width, control.probe)).toBe(control.material);
    }

    for (const carrier of fixture.sparse.carriers) {
      expect(at(cells, simulation.width, carrier)).toBe(Material.NobleGas);
    }
    expect(at(cells, simulation.width, fixture.sparse.midpoint)).toBe(Material.Empty);
    expect(at(cells, simulation.width, fixture.sparse.gap)).toBe(Material.Empty);
    expect(at(cells, simulation.width, fixture.sparse.isolated)).toBe(Material.NobleGas);

    expectRect(cells, simulation.width, fixture.gasSeam.gas, Material.NobleGas);
    expectRect(cells, simulation.width, fixture.gasSeam.foreignGas, Material.FOG);
    expect(at(cells, simulation.width, fixture.gasSeam.gasProbe)).toBe(Material.NobleGas);
    expect(at(cells, simulation.width, fixture.gasSeam.foreignProbe)).toBe(Material.FOG);
    expectRect(cells, simulation.width, fixture.waterContact.gas, Material.NobleGas);
    expectRect(cells, simulation.width, fixture.waterContact.water, Material.Water);
    expect(at(cells, simulation.width, fixture.waterContact.gasProbe)).toBe(Material.NobleGas);
    expect(at(cells, simulation.width, fixture.waterContact.waterProbe)).toBe(Material.Water);
    expectRect(cells, simulation.width, fixture.metalContact.gas, Material.NobleGas);
    expectRect(cells, simulation.width, fixture.metalContact.metal, Material.Metal);
    expect(at(cells, simulation.width, fixture.metalContact.gasProbe)).toBe(Material.NobleGas);
    expect(at(cells, simulation.width, fixture.metalContact.metalProbe)).toBe(Material.Metal);
    expectRect(cells, simulation.width, fixture.nativeWall.gas, Material.NobleGas);
    expect(at(walls, simulation.width, fixture.nativeWall.wallAnchor)).toBe(fixture.conductiveWall);
    expectRect(cells, simulation.width, fixture.guardedBlank, Material.Empty);
  });

  it('provides exact style-7 dense-body probes without promoting controls', () => {
    const simulation = preparedFixture();
    const fields = new RenderFieldSet(simulation.width, simulation.height, ALL_MATERIALS);
    fields.atmosphere.update(simulation.cells(), simulation.walls());
    const fixture = NOBLE_GAS_BILLOW_VFX_AUDIT;

    const core = atmosphereAt(fields, centre(fixture.target.deepCore));
    expect(core.style).toBe(7);
    expect(core.alpha).toBe(255);
    for (const probe of fixture.target.billowProbes) {
      const field = atmosphereAt(fields, probe.centre);
      expect(field.style, probe.code).toBe(7);
      expect(field.alpha, probe.code).toBe(255);
    }

    expect(atmosphereAt(fields, centre(fixture.target.authoredVoid)).style).not.toBe(7);
    expect(atmosphereAt(fields, centre(fixture.target.openChannel)).style).not.toBe(7);
    const expectedStyles = [1, 4, 5, 10, 12];
    fixture.protectedGases.forEach((control, index) => {
      expect(atmosphereAt(fields, control.probe).style, control.code).toBe(expectedStyles[index]);
    });
    expect(atmosphereAt(fields, fixture.gasSeam.gasProbe).style).toBe(7);
    expect(atmosphereAt(fields, fixture.gasSeam.foreignProbe).style).toBe(10);
    expect(atmosphereAt(fields, fixture.nativeWall.wallAnchor).style).not.toBe(7);
    expect(atmosphereAt(fields, centre(fixture.guardedBlank)).style).not.toBe(7);
    expect(atmosphereAt(fields, fixture.sparse.isolated).alpha)
      .toBeLessThan(atmosphereAt(fields, fixture.target.billowProbes[0].centre).alpha);
  });

  it('keeps external regions disjoint and every authored region inside the world', () => {
    const fixture = NOBLE_GAS_BILLOW_VFX_AUDIT;
    const externalRegions: NobleGasBillowVfxRect[] = [
      fixture.target.body,
      ...fixture.protectedGases.map(({ body }) => body),
      fixture.gasSeam.gas, fixture.gasSeam.foreignGas,
      fixture.waterContact.gas, fixture.waterContact.water,
      fixture.metalContact.gas, fixture.metalContact.metal,
      fixture.nativeWall.gas, fixture.guardedBlank,
      ...fixture.sparse.carriers.map(pointRect), pointRect(fixture.sparse.isolated),
    ];
    for (const region of externalRegions) expectInBounds(region, fixture.world);
    for (let index = 0; index < externalRegions.length; index++) {
      for (let other = index + 1; other < externalRegions.length; other++) {
        expect(intersects(externalRegions[index], externalRegions[other])).toBe(false);
      }
    }

    const internalRegions = [
      fixture.target.deepCore,
      ...fixture.target.billowProbes.map(({ region }) => region),
      fixture.target.authoredVoid,
      fixture.target.openChannel,
    ];
    for (const region of internalRegions) {
      expectInBounds(region, fixture.world);
      expect(contains(fixture.target.body, region)).toBe(true);
    }
    for (let index = 0; index < internalRegions.length; index++) {
      for (let other = index + 1; other < internalRegions.length; other++) {
        expect(intersects(internalRegions[index], internalRegions[other])).toBe(false);
      }
    }
    expectInBounds(pointRect(fixture.sparse.midpoint), fixture.world);
    expectInBounds(pointRect(fixture.sparse.gap), fixture.world);
  });

  it('resets deterministically and rejects unsupported backends and world sizes', () => {
    const simulation = new RenderLabBackend();
    prepareNobleGasBillowVfxFixture(simulation);
    const cells = simulation.cells().slice();
    const walls = simulation.walls().slice();
    simulation.paint(2, 2, Material.Fire, 0);
    simulation.paintWall(2, 2, 2, 0);
    prepareNobleGasBillowVfxFixture(simulation);
    expect(simulation.cells()).toEqual(cells);
    expect(simulation.walls()).toEqual(walls);

    expect(() => prepareNobleGasBillowVfxFixture(new DeterministicBackend(612, 384)))
      .toThrow('RenderLab wall plane');
    expect(() => prepareNobleGasBillowVfxFixture(new RenderLabBackend(32, 32)))
      .toThrow('612x384');
  });
});

function preparedFixture(): RenderLabBackend {
  const simulation = new RenderLabBackend();
  prepareNobleGasBillowVfxFixture(simulation);
  return simulation;
}

function at(bytes: Uint8Array, width: number, point: NobleGasBillowVfxPoint): number {
  return bytes[point.y * width + point.x];
}

function centre(rect: NobleGasBillowVfxRect): NobleGasBillowVfxPoint {
  return { x: Math.floor(rect.x + rect.width / 2), y: Math.floor(rect.y + rect.height / 2) };
}

function expectRect(
  cells: Uint8Array, width: number, rect: NobleGasBillowVfxRect, material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      expect(cells[y * width + x]).toBe(material);
    }
  }
}

function expectBodyExceptCutouts(
  cells: Uint8Array,
  width: number,
  target: NobleGasBillowVfxAuditSnapshotTarget,
): void {
  const radiusX = target.body.width * 0.5;
  const radiusY = target.body.height * 0.5;
  const centreX = target.body.x + radiusX;
  const centreY = target.body.y + radiusY;
  for (let y = target.body.y; y < target.body.y + target.body.height; y++) {
    for (let x = target.body.x; x < target.body.x + target.body.width; x++) {
      const normalizedX = Math.abs((x + 0.5 - centreX) / radiusX);
      const normalizedY = Math.abs((y + 0.5 - centreY) / radiusY);
      const outsideBody = normalizedX ** 4 + normalizedY ** 4 > 1;
      const empty = outsideBody || pointInside(target.authoredVoid, x, y)
        || pointInside(target.openChannel, x, y);
      expect(cells[y * width + x]).toBe(empty ? Material.Empty : Material.NobleGas);
    }
  }
}

type NobleGasBillowVfxAuditSnapshotTarget =
  (typeof NOBLE_GAS_BILLOW_VFX_AUDIT)['target'];

function atmosphereAt(
  fields: RenderFieldSet, point: NobleGasBillowVfxPoint,
): { alpha: number; style: number } {
  const x = Math.floor(point.x / 2);
  const y = Math.floor(point.y / 2);
  const offset = (y * fields.atmosphere.width + x) * 4;
  return {
    alpha: fields.atmosphere.bytes[offset + 3],
    style: fields.atmosphere.styleBytes[offset],
  };
}

function pointRect(point: NobleGasBillowVfxPoint): NobleGasBillowVfxRect {
  return { ...point, width: 1, height: 1 };
}

function pointInside(rect: NobleGasBillowVfxRect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

function contains(outer: NobleGasBillowVfxRect, inner: NobleGasBillowVfxRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function expectInBounds(
  rect: NobleGasBillowVfxRect,
  world: NobleGasBillowVfxAuditSnapshotWorld,
): void {
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.width).toBeGreaterThan(0);
  expect(rect.height).toBeGreaterThan(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(world.width);
  expect(rect.y + rect.height).toBeLessThanOrEqual(world.height);
}

type NobleGasBillowVfxAuditSnapshotWorld =
  (typeof NOBLE_GAS_BILLOW_VFX_AUDIT)['world'];

function intersects(left: NobleGasBillowVfxRect, right: NobleGasBillowVfxRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}
