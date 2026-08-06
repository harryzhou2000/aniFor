import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { RenderPhase, renderPhase } from '../renderer/render-profile';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  SOOTY_POWDER_BODY_VFX_AUDIT,
  prepareSootyPowderBodyVfxFixture,
  type SootyPowderBodyVfxBoundary,
  type SootyPowderBodyVfxPoint,
  type SootyPowderBodyVfxRect,
  type SootyPowderBodyVfxWallPattern,
} from './sooty-powder-body-vfx-audit';

const WIDTH = 612;
const HEIGHT = 384;

describe('sooty powder body VFX audit fixture', () => {
  it('pins exact Gunpowder 14 and BCOL 217 granular phases with named stable targets', () => {
    expect(Material.Gunpowder).toBe(14);
    expect(Material.BCOL).toBe(217);
    const info = (material: Material) => {
      const entry = ALL_MATERIALS.find(({ id }) => id === material);
      if (!entry) throw new Error(`missing material ${material}`);
      return entry;
    };
    expect(renderPhase(info(Material.Gunpowder))).toBe(RenderPhase.Powder);
    expect(renderPhase(info(Material.BCOL))).toBe(RenderPhase.Powder);
    expect(SOOTY_POWDER_BODY_VFX_AUDIT.targets.map(({ code, material, backing }) => [code, material, backing.kind]))
      .toEqual([['GUNP', Material.Gunpowder, 'air'], ['BCOL', Material.BCOL, 'native-wall-checker']]);
    const simulation = prepared();
    for (const entry of SOOTY_POWDER_BODY_VFX_AUDIT.targets) {
      for (const target of [entry.crown, entry.pocket, entry.core]) expectRect(simulation.cells(), target, entry.material);
    }
  });

  it('keeps broad body topology, fine topology, and authored moving target exact', () => {
    const simulation = prepared();
    const cells = simulation.cells();
    const velocity = simulation.velocity();
    for (const entry of SOOTY_POWDER_BODY_VFX_AUDIT.targets) {
      expectRectExcept(cells, entry.body, entry.material, [entry.authoredHole, entry.openChimney]);
      expectRect(cells, entry.authoredHole, Material.Empty);
      expectRect(cells, entry.openChimney, Material.Empty);
      expectRect(cells, entry.thinColumn, entry.material);
      expect(at(cells, entry.isolated)).toBe(entry.material);
      expectRect(cells, entry.unstable, entry.material);
      expectVelocityRect(velocity, entry.unstable, entry.unstable.velocityX, entry.unstable.velocityY);
      expectVelocityRect(velocity, entry.crown, 0, 0);
      expectVelocityRect(velocity, entry.pocket, 0, 0);
      expectVelocityRect(velocity, entry.core, 0, 0);
    }
  });

  it('keeps the exact granular, wet, contact, and blank controls semantic', () => {
    const simulation = prepared();
    const cells = simulation.cells();
    const fixture = SOOTY_POWDER_BODY_VFX_AUDIT;
    for (const entry of Object.values(fixture.materialControls)) expectRect(cells, entry, entry.material);
    expectBoundary(cells, fixture.wetSandWater);
    const wetSand = new Set(fixture.wetMixture.sandPoints.map(({ x, y }) => y * WIDTH + x));
    each(fixture.wetMixture.region, ({ x, y }) => {
      expect(cells[y * WIDTH + x]).toBe(wetSand.has(y * WIDTH + x) ? Material.Sand : Material.Water);
    });
    expect(wetSand.size).toBe(2_880);
    expect(at(cells, fixture.wetMixture.centre)).toBe(Material.Sand);
    for (const entry of Object.values(fixture.wetTargets)) {
      const powder = new Set(entry.powderPoints.map(({ x, y }) => y * WIDTH + x));
      each(entry.region, ({ x, y }) => {
        expect(cells[y * WIDTH + x]).toBe(powder.has(y * WIDTH + x) ? entry.material : Material.Water);
      });
      expect(powder.size).toBe(1_920);
      expect(at(cells, entry.centre)).toBe(entry.material);
    }
    for (const entry of Object.values(fixture.contacts)) expectBoundary(cells, entry);
    expectRect(cells, fixture.guardedBlank, Material.Empty);
  });

  it('preserves the aligned 3,072-cell native wall checker co-located with BCOL', () => {
    const simulation = prepared();
    const target = SOOTY_POWDER_BODY_VFX_AUDIT.targets[1];
    expect(target.backing.kind).toBe('native-wall-checker');
    if (target.backing.kind !== 'native-wall-checker') return;
    expectWallPattern(simulation.cells(), simulation.walls(), target.backing, target.material);
    expect(Array.from(simulation.walls()).filter(Boolean)).toHaveLength(3_072);
    expect(wallAt(simulation.walls(), target.backing.wallProbe)).toBe(SOOTY_POWDER_BODY_VFX_AUDIT.conductiveWall);
    expect(wallAt(simulation.walls(), target.backing.clearProbe)).toBe(0);
  });

  it('keeps independent fixture regions in bounds and deterministic after reset', () => {
    const fixture = SOOTY_POWDER_BODY_VFX_AUDIT;
    const world: SootyPowderBodyVfxRect = { x: 0, y: 0, width: WIDTH, height: HEIGHT };
    const independent: SootyPowderBodyVfxRect[] = [
      ...fixture.targets.map(({ body }) => body),
      ...fixture.targets.flatMap(({ thinColumn, isolated }) => [thinColumn, { ...isolated, width: 1, height: 1 }]),
      ...Object.values(fixture.materialControls), fixture.wetSandWater.target, fixture.wetSandWater.other,
      fixture.wetMixture.region,
      ...Object.values(fixture.wetTargets).map(({ region }) => region),
      ...Object.values(fixture.contacts).flatMap(({ target, other }) => [target, other]), fixture.guardedBlank,
    ];
    for (const rect of independent) expect(inside(rect, world)).toBe(true);
    for (let index = 0; index < independent.length; index++) {
      for (let other = index + 1; other < independent.length; other++) {
        expect(intersects(independent[index], independent[other])).toBe(false);
      }
    }
    for (const entry of fixture.targets) {
      for (const rect of [entry.crown, entry.pocket, entry.core, entry.authoredHole, entry.openChimney, entry.unstable]) {
        expect(inside(rect, entry.body)).toBe(true);
      }
      for (const stable of [entry.crown, entry.pocket, entry.core]) {
        expect(intersects(stable, entry.authoredHole)).toBe(false);
        expect(intersects(stable, entry.openChimney)).toBe(false);
        expect(intersects(stable, entry.unstable)).toBe(false);
      }
      if (entry.backing.kind === 'native-wall-checker') {
        expect(inside(entry.backing.region, entry.body)).toBe(true);
        expect(intersects(entry.unstable, entry.backing.region)).toBe(false);
      }
    }
    const first = prepared();
    const cells = first.cells().slice(); const walls = first.walls().slice(); const velocity = first.velocity().slice();
    first.cells().fill(Material.Fire); first.paintWall(4, 4, 2, 0); first.setFixtureVelocityRect(0, 0, 8, 8, 127, 127);
    prepareSootyPowderBodyVfxFixture(first);
    expect(firstDifference(first.cells(), cells)).toBe(-1);
    expect(firstDifference(first.walls(), walls)).toBe(-1);
    expect(firstDifference(first.velocity(), velocity)).toBe(-1);
    expect(() => prepareSootyPowderBodyVfxFixture(new RenderLabBackend(32, 32))).toThrow('requires 612x384');
    expect(() => prepareSootyPowderBodyVfxFixture(new DeterministicBackend(WIDTH, HEIGHT)))
      .toThrow('requires a canonical RenderLab wall and velocity plane');
  });
});

function prepared(): RenderLabBackend {
  const simulation = new RenderLabBackend(WIDTH, HEIGHT);
  prepareSootyPowderBodyVfxFixture(simulation);
  return simulation;
}
function at(cells: Uint8Array, point: SootyPowderBodyVfxPoint): Material { return cells[point.y * WIDTH + point.x] as Material; }
function wallAt(walls: Uint8Array, point: SootyPowderBodyVfxPoint): number { return walls[point.y * WIDTH + point.x]; }
function expectRect(cells: Uint8Array, rect: SootyPowderBodyVfxRect, material: Material): void { each(rect, (point) => expect(at(cells, point)).toBe(material)); }
function expectRectExcept(cells: Uint8Array, rect: SootyPowderBodyVfxRect, material: Material, exceptions: readonly SootyPowderBodyVfxRect[]): void {
  each(rect, (point) => { if (!exceptions.some((entry) => contains(entry, point))) expect(at(cells, point)).toBe(material); });
}
function expectVelocityRect(velocity: Int8Array, rect: SootyPowderBodyVfxRect, x: number, y: number): void {
  each(rect, (point) => { const offset = (point.y * WIDTH + point.x) * 2; expect(velocity[offset]).toBe(x); expect(velocity[offset + 1]).toBe(y); });
}
function expectBoundary(cells: Uint8Array, entry: SootyPowderBodyVfxBoundary): void {
  expectRect(cells, entry.target, entry.targetMaterial); expectRect(cells, entry.other, entry.otherMaterial);
  expect(entry.target.x + entry.target.width).toBe(entry.other.x);
  expect(at(cells, entry.targetProbe)).toBe(entry.targetMaterial); expect(at(cells, entry.otherProbe)).toBe(entry.otherMaterial);
}
function expectWallPattern(cells: Uint8Array, walls: Uint8Array, pattern: SootyPowderBodyVfxWallPattern, material: Material): void {
  each(pattern.region, ({ x, y }) => {
    const blockX = Math.floor((x - pattern.region.x) / pattern.blockSize);
    const blockY = Math.floor((y - pattern.region.y) / pattern.blockSize);
    expect(at(cells, { x, y })).toBe(material);
    expect(walls[y * WIDTH + x]).toBe((blockX + blockY) % 2 === pattern.occupiedParity ? SOOTY_POWDER_BODY_VFX_AUDIT.conductiveWall : 0);
  });
}
function each(rect: SootyPowderBodyVfxRect, action: (point: SootyPowderBodyVfxPoint) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) for (let x = rect.x; x < rect.x + rect.width; x++) action({ x, y });
}
function contains(rect: SootyPowderBodyVfxRect, point: SootyPowderBodyVfxPoint): boolean { return point.x >= rect.x && point.x < rect.x + rect.width && point.y >= rect.y && point.y < rect.y + rect.height; }
function inside(rect: SootyPowderBodyVfxRect, container: SootyPowderBodyVfxRect): boolean {
  return rect.x >= container.x && rect.y >= container.y && rect.x + rect.width <= container.x + container.width && rect.y + rect.height <= container.y + container.height;
}
function intersects(left: SootyPowderBodyVfxRect, right: SootyPowderBodyVfxRect): boolean { return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y; }
function firstDifference(left: Uint8Array | Int8Array, right: Uint8Array | Int8Array): number { for (let index = 0; index < left.length; index++) if (left[index] !== right[index]) return index; return -1; }
