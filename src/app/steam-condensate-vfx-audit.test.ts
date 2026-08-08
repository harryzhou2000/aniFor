import { describe, expect, it } from 'vitest';
import { RenderFieldSet } from '../renderer/render-field-set';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  prepareSteamCondensateVfxFixture,
  STEAM_CONDENSATE_VFX_AUDIT,
  type SteamCondensateVfxPoint,
  type SteamCondensateVfxRect,
} from './steam-condensate-vfx-audit';

describe('Steam condensate VFX audit fixture', () => {
  it('authors the paused exact WTRV style-2 volume with core, crown, pocket, shoulders, and open topology', () => {
    const simulation = preparedFixture();
    const { target } = STEAM_CONDENSATE_VFX_AUDIT;
    expect(target).toMatchObject({ material: Material.Steam, code: 'WTRV', atmosphereStyle: 2 });
    for (const region of [target.broad, target.core, target.crown, target.pocket, ...target.shoulders]) {
      expectRect(simulation.cells(), simulation.width, region, Material.Steam);
    }
    expectRect(simulation.cells(), simulation.width, target.authoredVoid, Material.Empty);
    expectRect(simulation.cells(), simulation.width, target.openChannel, Material.Empty);
    expectRoundedBodyExceptCutouts(simulation.cells(), simulation.width, target);
  });

  it('freezes exact material counts and all gas, wisp, contact, wall, and blank controls', () => {
    const simulation = preparedFixture();
    const fixture = STEAM_CONDENSATE_VFX_AUDIT;
    expect(materialCounts(simulation.cells())).toEqual(fixture.materialCounts);
    expect(fixture.protectedGases.map(({ material, atmosphereStyle }) => [material, atmosphereStyle])).toEqual([
      [Material.Smoke, 1], [Material.Gas, 3], [Material.Oxygen, 4], [Material.Hydrogen, 5],
      [Material.CarbonDioxide, 6], [Material.NobleGas, 7], [Material.FOG, 10], [Material.CFLM, 12],
      [Material.BOYL, 8], [Material.CAUS, 9], [Material.RFRG, 11], [Material.AMTR, 13],
      [Material.WARP, 14], [Material.BIZRG, 15], [Material.MORT, 16], [Material.VRSG, 17],
    ]);
    for (const control of fixture.protectedGases) {
      expectRect(simulation.cells(), simulation.width, control.body, control.material);
      expect(at(simulation.cells(), simulation.width, control.probe)).toBe(control.material);
    }
    for (const carrier of fixture.sparseWisps.carriers) expect(at(simulation.cells(), simulation.width, carrier)).toBe(Material.Steam);
    expect(at(simulation.cells(), simulation.width, fixture.sparseWisps.midpoint)).toBe(Material.Empty);
    expect(at(simulation.cells(), simulation.width, fixture.sparseWisps.gap)).toBe(Material.Empty);
    expectRect(simulation.cells(), simulation.width, fixture.sparseWisps.thin, Material.Steam);
    expect(at(simulation.cells(), simulation.width, fixture.sparseWisps.isolated)).toBe(Material.Steam);
    assertBoundary(simulation, fixture.gasSeam.steam, fixture.gasSeam.foreignGas, fixture.gasSeam.steamProbe, fixture.gasSeam.foreignProbe, Material.Steam, Material.FOG);
    assertBoundary(simulation, fixture.waterContact.steam, fixture.waterContact.water, fixture.waterContact.steamProbe, fixture.waterContact.waterProbe, Material.Steam, Material.Water);
    assertBoundary(simulation, fixture.metalContact.steam, fixture.metalContact.metal, fixture.metalContact.steamProbe, fixture.metalContact.metalProbe, Material.Steam, Material.Metal);
    expectRect(simulation.cells(), simulation.width, fixture.nativeWall.steam, Material.Steam);
    expect(at(simulation.walls(), simulation.width, fixture.nativeWall.wallAnchor)).toBe(fixture.conductiveWall);
    expectRect(simulation.cells(), simulation.width, fixture.guardedBlank, Material.Empty);
  });

  it('propagates only style 2 into dense Steam targets and keeps every sibling identity exact', () => {
    const simulation = preparedFixture();
    const fields = new RenderFieldSet(simulation.width, simulation.height, ALL_MATERIALS);
    fields.atmosphere.update(simulation.cells(), simulation.walls());
    const fixture = STEAM_CONDENSATE_VFX_AUDIT;
    for (const point of [centre(fixture.target.broad), centre(fixture.target.core), centre(fixture.target.crown),
      centre(fixture.target.pocket), ...fixture.target.shoulders.map(centre)]) {
      const atmosphere = atmosphereAt(fields, point);
      expect(atmosphere.style).toBe(2);
      expect(atmosphere.alpha).toBe(255);
    }
    for (const control of fixture.protectedGases) {
      expect(atmosphereAt(fields, control.probe).style, control.code).toBe(control.atmosphereStyle);
    }
    expect(atmosphereAt(fields, fixture.gasSeam.steamProbe).style).toBe(2);
    expect(atmosphereAt(fields, fixture.gasSeam.foreignProbe).style).toBe(10);
    expect(atmosphereAt(fields, centre(fixture.target.authoredVoid)).style).not.toBe(2);
    expect(atmosphereAt(fields, centre(fixture.target.openChannel)).style).not.toBe(2);
    expect(atmosphereAt(fields, fixture.nativeWall.wallAnchor).style).not.toBe(2);
    expect(atmosphereAt(fields, centre(fixture.guardedBlank)).style).not.toBe(2);
  });

  it('keeps every named external region disjoint and every frozen region in bounds', () => {
    const fixture = STEAM_CONDENSATE_VFX_AUDIT;
    const external = [fixture.target.body, ...fixture.protectedGases.map(({ body }) => body),
      fixture.gasSeam.steam, fixture.gasSeam.foreignGas, fixture.waterContact.steam, fixture.waterContact.water,
      fixture.metalContact.steam, fixture.metalContact.metal, fixture.nativeWall.steam, fixture.guardedBlank,
      ...fixture.sparseWisps.carriers.map(pointRect), fixture.sparseWisps.thin, pointRect(fixture.sparseWisps.isolated)];
    assertDisjointAndInBounds(external, fixture.world);
    const internal = [fixture.target.broad, fixture.target.core, fixture.target.crown, fixture.target.pocket,
      ...fixture.target.shoulders,
      fixture.target.authoredVoid, fixture.target.openChannel];
    for (const region of internal) expect(contains(fixture.target.body, region)).toBe(true);
    assertDisjointAndInBounds(internal, fixture.world);
  });

  it('resets byte-deterministically and rejects unsupported backends or canonical geometry', () => {
    const simulation = new RenderLabBackend();
    prepareSteamCondensateVfxFixture(simulation);
    const cells = simulation.cells().slice();
    const walls = simulation.walls().slice();
    simulation.paint(2, 2, Material.Fire, 0);
    simulation.paintWall(2, 2, 2, 0);
    prepareSteamCondensateVfxFixture(simulation);
    expect(simulation.cells()).toEqual(cells);
    expect(simulation.walls()).toEqual(walls);
    expect(() => prepareSteamCondensateVfxFixture(new DeterministicBackend(612, 384))).toThrow('RenderLab wall plane');
    expect(() => prepareSteamCondensateVfxFixture(new RenderLabBackend(32, 32))).toThrow('612x384');
  });
});

function preparedFixture(): RenderLabBackend {
  const simulation = new RenderLabBackend();
  prepareSteamCondensateVfxFixture(simulation);
  return simulation;
}

function at(bytes: Uint8Array, width: number, point: SteamCondensateVfxPoint): number {
  return bytes[point.y * width + point.x];
}

function centre(rect: SteamCondensateVfxRect): SteamCondensateVfxPoint {
  return { x: Math.floor(rect.x + rect.width / 2), y: Math.floor(rect.y + rect.height / 2) };
}

function expectRect(cells: Uint8Array, width: number, rect: SteamCondensateVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) expect(cells[y * width + x]).toBe(material);
  }
}

function assertBoundary(
  simulation: RenderLabBackend,
  steam: SteamCondensateVfxRect,
  other: SteamCondensateVfxRect,
  steamProbe: SteamCondensateVfxPoint,
  otherProbe: SteamCondensateVfxPoint,
  steamMaterial: Material,
  otherMaterial: Material,
): void {
  expectRect(simulation.cells(), simulation.width, steam, steamMaterial);
  expectRect(simulation.cells(), simulation.width, other, otherMaterial);
  expect(at(simulation.cells(), simulation.width, steamProbe)).toBe(steamMaterial);
  expect(at(simulation.cells(), simulation.width, otherProbe)).toBe(otherMaterial);
}

function atmosphereAt(fields: RenderFieldSet, point: SteamCondensateVfxPoint): { alpha: number; style: number } {
  const x = Math.floor(point.x / 2);
  const y = Math.floor(point.y / 2);
  const offset = (y * fields.atmosphere.width + x) * 4;
  return { alpha: fields.atmosphere.bytes[offset + 3], style: fields.atmosphere.styleBytes[offset] };
}

function materialCounts(cells: Uint8Array): (typeof STEAM_CONDENSATE_VFX_AUDIT)['materialCounts'] {
  const count = (material: Material) => cells.reduce((total, value) => total + Number(value === material), 0);
  return {
    steam: count(Material.Steam), smoke: count(Material.Smoke), gas: count(Material.Gas),
    oxygen: count(Material.Oxygen), hydrogen: count(Material.Hydrogen), carbonDioxide: count(Material.CarbonDioxide),
    nobleGas: count(Material.NobleGas), boyl: count(Material.BOYL), caus: count(Material.CAUS),
    fog: count(Material.FOG), rfrg: count(Material.RFRG), cflm: count(Material.CFLM),
    amtr: count(Material.AMTR), warp: count(Material.WARP), bizrg: count(Material.BIZRG),
    mort: count(Material.MORT), vrsg: count(Material.VRSG),
    water: count(Material.Water), metal: count(Material.Metal),
  };
}

function pointRect(point: SteamCondensateVfxPoint): SteamCondensateVfxRect { return { ...point, width: 1, height: 1 }; }
function contains(outer: SteamCondensateVfxRect, inner: SteamCondensateVfxRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}
function intersects(left: SteamCondensateVfxRect, right: SteamCondensateVfxRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}
function assertDisjointAndInBounds(
  regions: readonly SteamCondensateVfxRect[],
  world: { readonly width: number; readonly height: number },
): void {
  for (const region of regions) {
    expect(region.x).toBeGreaterThanOrEqual(0); expect(region.y).toBeGreaterThanOrEqual(0);
    expect(region.width).toBeGreaterThan(0); expect(region.height).toBeGreaterThan(0);
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
  target: (typeof STEAM_CONDENSATE_VFX_AUDIT)['target'],
): void {
  const radiusX = target.body.width * 0.5;
  const radiusY = target.body.height * 0.5;
  const centreX = target.body.x + radiusX;
  const centreY = target.body.y + radiusY;
  for (let y = target.body.y; y < target.body.y + target.body.height; y++) {
    for (let x = target.body.x; x < target.body.x + target.body.width; x++) {
      const outside = Math.abs((x + 0.5 - centreX) / radiusX) ** 4 + Math.abs((y + 0.5 - centreY) / radiusY) ** 4 > 1;
      const cutout = containsPoint(target.authoredVoid, x, y) || containsPoint(target.openChannel, x, y);
      expect(cells[y * width + x]).toBe(outside || cutout ? Material.Empty : Material.Steam);
    }
  }
}

function containsPoint(rect: SteamCondensateVfxRect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}
