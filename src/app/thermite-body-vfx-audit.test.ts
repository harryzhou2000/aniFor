import { describe, expect, it } from 'vitest';
import { RenderOptics, renderOptics } from '../renderer/render-optics';
import { RenderPhase, RenderProfile, renderPhase, renderProfile } from '../renderer/render-profile';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  THERMITE_BODY_VFX_AUDIT,
  prepareThermiteBodyVfxAuditFixture,
  type ThermiteBodyVfxBoundary,
  type ThermiteBodyVfxPoint,
  type ThermiteBodyVfxRect,
  type ThermiteBodyVfxWallPattern,
} from './thermite-body-vfx-audit';

const WIDTH = 612;
const HEIGHT = 384;

describe('Thermite body VFX audit fixture', () => {
  it('pins native Thermite 30 as the exact Smooth granular target', () => {
    expect(Material.Thermite).toBe(30);
    const material = ALL_MATERIALS.find(({ id }) => id === Material.Thermite);
    expect(material).toBeDefined();
    if (!material) return;
    expect(renderPhase(material)).toBe(RenderPhase.Powder);
    expect(renderProfile(material.category)).toBe(RenderProfile.Granular);
    expect(renderOptics(material)).toBe(RenderOptics.MetallicGranular);
    expect(THERMITE_BODY_VFX_AUDIT.target).toMatchObject({ code: 'THRM', material: 30 });
    expect(THERMITE_BODY_VFX_AUDIT.powderStyleMatrix).toEqual([
      { style: 'smooth', expectation: 'target' },
      { style: 'local', expectation: 'exact-no-op' },
      { style: 'grains', expectation: 'exact-no-op' },
    ]);

    const cells = prepared().cells();
    for (const region of [
      THERMITE_BODY_VFX_AUDIT.target.core,
      THERMITE_BODY_VFX_AUDIT.target.crown,
      THERMITE_BODY_VFX_AUDIT.target.pocket,
    ]) expectRect(cells, region, Material.Thermite);
  });

  it('preserves the settled broad body, authored openings, and fine topology', () => {
    const simulation = prepared();
    const cells = simulation.cells();
    const velocity = simulation.velocity();
    const { target, fineTopology } = THERMITE_BODY_VFX_AUDIT;

    expectRectExcept(cells, target.body, target.material, [target.authoredHole, target.openChannel]);
    expectRect(cells, target.authoredHole, Material.Empty);
    expectRect(cells, target.openChannel, Material.Empty);
    expect(target.openChannel.y).toBe(target.body.y);
    expectRect(cells, fineTopology.column, target.material);
    expect(fineTopology.column.width).toBe(1);
    expectRect(cells, fineTopology.line, target.material);
    expect(fineTopology.line.height).toBe(1);
    expect(at(cells, fineTopology.isolated)).toBe(target.material);

    for (const stable of [target.core, target.crown, target.pocket]) {
      expectVelocityRect(velocity, stable, 0, 0);
      expect(intersects(stable, target.authoredHole)).toBe(false);
      expect(intersects(stable, target.openChannel)).toBe(false);
      expect(intersects(stable, target.wallCoexistence.region)).toBe(false);
    }
  });

  it('keeps moving and aqueous Thermite controls exact and disjoint', () => {
    const simulation = prepared();
    const cells = simulation.cells();
    const velocity = simulation.velocity();
    const { movingControl, wetControl } = THERMITE_BODY_VFX_AUDIT;

    expectRect(cells, movingControl, Material.Thermite);
    expectVelocityRect(
      velocity, movingControl, movingControl.velocityX, movingControl.velocityY,
    );

    const thermite = new Set(wetControl.thermitePoints.map(({ x, y }) => y * WIDTH + x));
    each(wetControl.region, ({ x, y }) => {
      expect(cells[y * WIDTH + x]).toBe(
        thermite.has(y * WIDTH + x) ? Material.Thermite : Material.Water,
      );
    });
    expect(thermite.size).toBe(5_184);
    expect(at(cells, wetControl.thermiteProbe)).toBe(Material.Thermite);
    expect(at(cells, wetControl.waterProbe)).toBe(Material.Water);
    expectVelocityRect(velocity, wetControl.region, 0, 0);
  });

  it('preserves exact sibling powders, phase contacts, native walls, and blank space', () => {
    const simulation = prepared();
    const cells = simulation.cells();
    const fixture = THERMITE_BODY_VFX_AUDIT;

    expect(Object.values(fixture.siblingPowders).map(({ material }) => material)).toEqual([
      Material.Gunpowder, Material.BCOL, Material.Coal, Material.Sand,
      Material.BREC, Material.BRMT, Material.BVBR, Material.PLUT, Material.POLO, Material.URAN,
      Material.C4, Material.Salt, Material.SING, Material.LITH, Material.RBDM,
    ]);
    for (const [key, entry] of Object.entries(fixture.siblingPowders)) {
      expect(entry.width).toBeGreaterThanOrEqual(64);
      expect(entry.height).toBeGreaterThanOrEqual(
        key === 'lith' || key === 'rbdm' ? 24 : 48,
      );
      expectRect(cells, entry, entry.material);
    }
    for (const key of ['brec', 'brmt', 'bvbr', 'plut', 'polo', 'uran'] as const) {
      const entry = fixture.siblingPowders[key];
      const material = ALL_MATERIALS.find(({ id }) => id === entry.material);
      expect(material, key).toBeDefined();
      if (material) expect(renderOptics(material), key).toBe(RenderOptics.MetallicGranular);
    }
    for (const entry of Object.values(fixture.contacts)) expectBoundary(cells, entry);
    expectBoundary(cells, fixture.contacts.metal);
    expectBoundary(cells, fixture.contacts.water);

    const pattern = fixture.target.wallCoexistence;
    expectWallPattern(cells, simulation.walls(), pattern, Material.Thermite);
    expect(Array.from(simulation.walls()).filter(Boolean)).toHaveLength(2_048);
    expect(wallAt(simulation.walls(), pattern.wallProbe)).toBe(fixture.conductiveWall);
    expect(wallAt(simulation.walls(), pattern.clearProbe)).toBe(0);
    expectRect(cells, fixture.guardedBlank, Material.Empty);
  });

  it('keeps every independent region in bounds and resets deterministically', () => {
    const fixture = THERMITE_BODY_VFX_AUDIT;
    const world: ThermiteBodyVfxRect = { x: 0, y: 0, width: WIDTH, height: HEIGHT };
    const independent: ThermiteBodyVfxRect[] = [
      fixture.target.body,
      fixture.fineTopology.column,
      fixture.fineTopology.line,
      pointRect(fixture.fineTopology.isolated),
      fixture.movingControl,
      fixture.wetControl.region,
      ...Object.values(fixture.siblingPowders),
      ...Object.values(fixture.contacts).flatMap(({ thermite, other }) => [thermite, other]),
      fixture.guardedBlank,
    ];
    for (const rect of independent) expect(inside(rect, world)).toBe(true);
    for (let index = 0; index < independent.length; index++) {
      for (let other = index + 1; other < independent.length; other++) {
        expect(intersects(independent[index], independent[other])).toBe(false);
      }
    }
    for (const rect of [
      fixture.target.core,
      fixture.target.crown,
      fixture.target.pocket,
      fixture.target.authoredHole,
      fixture.target.openChannel,
      fixture.target.wallCoexistence.region,
    ]) expect(inside(rect, fixture.target.body)).toBe(true);

    const first = prepared();
    const cells = first.cells().slice();
    const walls = first.walls().slice();
    const velocity = first.velocity().slice();
    first.cells().fill(Material.Fire);
    first.paintWall(4, 4, 2, 0);
    first.setFixtureVelocityRect(0, 0, 8, 8, 127, 127);
    prepareThermiteBodyVfxAuditFixture(first);
    expect(firstDifference(first.cells(), cells)).toBe(-1);
    expect(firstDifference(first.walls(), walls)).toBe(-1);
    expect(firstDifference(first.velocity(), velocity)).toBe(-1);
    expect(() => prepareThermiteBodyVfxAuditFixture(new RenderLabBackend(32, 32)))
      .toThrow('requires 612x384');
    expect(() => prepareThermiteBodyVfxAuditFixture(new DeterministicBackend(WIDTH, HEIGHT)))
      .toThrow('requires a canonical RenderLab wall and velocity plane');
  });
});

function prepared(): RenderLabBackend {
  const simulation = new RenderLabBackend(WIDTH, HEIGHT);
  prepareThermiteBodyVfxAuditFixture(simulation);
  return simulation;
}

function at(cells: Uint8Array, point: ThermiteBodyVfxPoint): Material {
  return cells[point.y * WIDTH + point.x] as Material;
}

function wallAt(walls: Uint8Array, point: ThermiteBodyVfxPoint): number {
  return walls[point.y * WIDTH + point.x];
}

function expectRect(
  cells: Uint8Array, rect: ThermiteBodyVfxRect, material: Material,
): void {
  each(rect, (point) => expect(at(cells, point)).toBe(material));
}

function expectRectExcept(
  cells: Uint8Array, rect: ThermiteBodyVfxRect, material: Material,
  exceptions: readonly ThermiteBodyVfxRect[],
): void {
  each(rect, (point) => {
    if (!exceptions.some((entry) => contains(entry, point))) expect(at(cells, point)).toBe(material);
  });
}

function expectVelocityRect(
  velocity: Int8Array, rect: ThermiteBodyVfxRect, x: number, y: number,
): void {
  each(rect, (point) => {
    const offset = (point.y * WIDTH + point.x) * 2;
    expect(velocity[offset]).toBe(x);
    expect(velocity[offset + 1]).toBe(y);
  });
}

function expectBoundary(cells: Uint8Array, entry: ThermiteBodyVfxBoundary): void {
  expectRect(cells, entry.thermite, Material.Thermite);
  expectRect(cells, entry.other, entry.otherMaterial);
  expect(entry.thermite.x + entry.thermite.width).toBe(entry.other.x);
  expect(at(cells, entry.thermiteProbe)).toBe(Material.Thermite);
  expect(at(cells, entry.otherProbe)).toBe(entry.otherMaterial);
}

function expectWallPattern(
  cells: Uint8Array, walls: Uint8Array,
  pattern: ThermiteBodyVfxWallPattern, material: Material,
): void {
  each(pattern.region, ({ x, y }) => {
    const blockX = Math.floor((x - pattern.region.x) / pattern.blockSize);
    const blockY = Math.floor((y - pattern.region.y) / pattern.blockSize);
    expect(at(cells, { x, y })).toBe(material);
    expect(walls[y * WIDTH + x]).toBe(
      (blockX + blockY) % 2 === pattern.occupiedParity
        ? THERMITE_BODY_VFX_AUDIT.conductiveWall : 0,
    );
  });
}

function each(
  rect: ThermiteBodyVfxRect,
  action: (point: ThermiteBodyVfxPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) action({ x, y });
  }
}

function contains(rect: ThermiteBodyVfxRect, point: ThermiteBodyVfxPoint): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function inside(rect: ThermiteBodyVfxRect, container: ThermiteBodyVfxRect): boolean {
  return rect.x >= container.x && rect.y >= container.y
    && rect.x + rect.width <= container.x + container.width
    && rect.y + rect.height <= container.y + container.height;
}

function intersects(left: ThermiteBodyVfxRect, right: ThermiteBodyVfxRect): boolean {
  return left.x < right.x + right.width && left.x + left.width > right.x
    && left.y < right.y + right.height && left.y + left.height > right.y;
}

function pointRect(point: ThermiteBodyVfxPoint): ThermiteBodyVfxRect {
  return { ...point, width: 1, height: 1 };
}

function firstDifference(
  left: Uint8Array | Int8Array, right: Uint8Array | Int8Array,
): number {
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return index;
  }
  return -1;
}
