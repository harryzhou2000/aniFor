import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import { encodePlantLifecyclePresentationState } from './botanical-lifecycle-graphics-audit';
import {
  BOTANICAL_BODY_VFX_AUDIT, prepareBotanicalBodyVfxFixture,
  type BotanicalBodyVfxPoint, type BotanicalBodyVfxRect,
} from './botanical-body-vfx-audit';

describe('botanical body VFX audit fixture', () => {
  it('pins exact broad Wood and PLNT cards with named body probes and authored void topology', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    expect(Material.Wood).toBe(9);
    expect(Material.Plant).toBe(10);
    expect(BOTANICAL_BODY_VFX_AUDIT.cards.map(({ code, material }) => ({ code, material }))).toEqual([
      { code: 'WOOD', material: Material.Wood },
      { code: 'PLNT', material: Material.Plant },
    ]);

    for (const entry of BOTANICAL_BODY_VFX_AUDIT.cards) {
      expectBodyWithVoids(
        cells, simulation.width, entry.body, entry.authoredCavity, entry.openNotch, entry.material,
      );
      expectRect(cells, simulation.width, entry.core, entry.material);
      expectRect(cells, simulation.width, entry.crown, entry.material);
      expectRect(cells, simulation.width, entry.pocket, entry.material);
      expectRect(cells, simulation.width, entry.authoredCavity, Material.Empty);
      expectRect(cells, simulation.width, entry.openNotch, Material.Empty);
    }
  });

  it('keeps fine owners, walls, separated contacts, blanks, and non-target controls exact', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    const walls = simulation.walls();

    for (const entry of BOTANICAL_BODY_VFX_AUDIT.cards) {
      expect(entry.thinStem.width).toBe(1);
      expectRect(cells, simulation.width, entry.thinStem, entry.material);
      expect(at(cells, simulation.width, entry.isolated)).toBe(entry.material);
      for (const point of cardinalNeighbours(entry.isolated)) {
        expect(at(cells, simulation.width, point)).toBe(Material.Empty);
      }

      expectRect(cells, simulation.width, entry.wallCoexistence, entry.material);
      expectRect(walls, simulation.width, entry.wallCoexistence, BOTANICAL_BODY_VFX_AUDIT.conductiveWall);

      expectRect(cells, simulation.width, entry.waterContact.owner, entry.material);
      expectRect(cells, simulation.width, entry.waterContact.water, Material.Water);
      expect(entry.waterContact.owner.x + entry.waterContact.owner.width).toBe(entry.waterContact.water.x);
      expectRect(cells, simulation.width, entry.sandContact.owner, entry.material);
      expectRect(cells, simulation.width, entry.sandContact.sand, Material.Sand);
      expect(entry.sandContact.owner.x + entry.sandContact.owner.width).toBe(entry.sandContact.sand.x);

      const reciprocalOwner = entry.material === Material.Wood ? Material.Plant : Material.Wood;
      expectRect(cells, simulation.width, entry.unlikeContact.owner, entry.material);
      expectRect(cells, simulation.width, entry.unlikeContact.other, reciprocalOwner);
      expect(entry.unlikeContact.owner.x + entry.unlikeContact.owner.width)
        .toBe(entry.unlikeContact.other.x);
      expect(entry.unlikeContact.owner.y).toBe(entry.unlikeContact.other.y);
      expect(entry.unlikeContact.owner.height).toBe(entry.unlikeContact.other.height);

      expectRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
      expectRect(cells, simulation.width, entry.controls.vine, Material.VINE);
      expectRect(cells, simulation.width, entry.controls.wax, Material.Wax);
      expectRect(cells, simulation.width, entry.controls.metal, Material.Metal);
    }

    const expectedWallCells = BOTANICAL_BODY_VFX_AUDIT.cards.reduce(
      (sum, entry) => sum + entry.wallCoexistence.width * entry.wallCoexistence.height, 0,
    );
    expect(walls.reduce((count, wall) => count + Number(wall !== 0), 0)).toBe(expectedWallCells);
  });

  it('isolates cyan and magenta native lifecycle state from the zero-state PLNT calibration geometry', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    const state = simulation.presentationState();
    const expectedLifecycle = {
      cyan: encodePlantLifecyclePresentationState(true, 1, 6, 16, 2, true),
      magenta: encodePlantLifecyclePresentationState(true, 1, 6, 4, 2, true),
    } as const;

    expect(BOTANICAL_BODY_VFX_AUDIT.cards.map(({ lifecycleKey }) => lifecycleKey))
      .toEqual(['cyan', 'magenta']);
    expect(expectedLifecycle.cyan).not.toBe(expectedLifecycle.magenta);
    for (const entry of BOTANICAL_BODY_VFX_AUDIT.cards) {
      expect(entry.lifecycleState).toBe(expectedLifecycle[entry.lifecycleKey]);
      expectRect(cells, simulation.width, entry.lifecycleCanopy, Material.Plant);
      expectRect(state, simulation.width, entry.lifecycleCanopy, entry.lifecycleState);
      expect(inside(entry.lifecycleProbe, entry.lifecycleCanopy)).toBe(true);
      expectRect(cells, simulation.width, entry.lifecycleProbe, Material.Plant);
      expectRect(state, simulation.width, entry.lifecycleProbe, entry.lifecycleState);

      // Every established calibration/control region remains in the zero-state
      // baseline; only lifecycleCanopy may carry native PLNT state.
      for (const region of [
        entry.body, entry.thinStem, pointRect(entry.isolated), entry.wallCoexistence,
        entry.waterContact.owner, entry.waterContact.water,
        entry.sandContact.owner, entry.sandContact.sand,
        entry.unlikeContact.owner, entry.unlikeContact.other,
        entry.guardedBlank, ...Object.values(entry.controls),
      ]) expectRect(state, simulation.width, region, 0);
    }
    const expectedStateCells = BOTANICAL_BODY_VFX_AUDIT.cards.reduce(
      (sum, entry) => sum + entry.lifecycleCanopy.width * entry.lifecycleCanopy.height, 0,
    );
    expect(state.reduce((count, value) => count + Number(value !== 0), 0)).toBe(expectedStateCells);
  });

  it('keeps every card, probe, topology control, and contact disjoint and inside the fixed world', () => {
    const independent: BotanicalBodyVfxRect[] = [];
    for (const entry of BOTANICAL_BODY_VFX_AUDIT.cards) {
      const regions = [
        entry.body, entry.thinStem, pointRect(entry.isolated), entry.wallCoexistence,
        entry.waterContact.owner, entry.waterContact.water,
        entry.sandContact.owner, entry.sandContact.sand,
        entry.unlikeContact.owner, entry.unlikeContact.other,
        entry.lifecycleCanopy,
        entry.guardedBlank, ...Object.values(entry.controls),
      ];
      independent.push(...regions);

      expectInWorld(entry.card);
      for (const region of regions) {
        expectInWorld(region);
        expect(inside(region, entry.card)).toBe(true);
      }
      for (const region of regions.slice(1)) expect(intersects(entry.body, region)).toBe(false);
      for (const probe of [entry.core, entry.crown, entry.pocket]) {
        expect(inside(probe, entry.body)).toBe(true);
        expect(intersects(probe, entry.authoredCavity)).toBe(false);
        expect(intersects(probe, entry.openNotch)).toBe(false);
      }
      expect(inside(entry.lifecycleProbe, entry.lifecycleCanopy)).toBe(true);
      expect(intersects(entry.lifecycleCanopy, entry.body)).toBe(false);
      expect(entry.unlikeContact.owner.x + entry.unlikeContact.owner.width)
        .toBe(entry.unlikeContact.other.x);
      expect(entry.unlikeContact.owner.y).toBe(entry.unlikeContact.other.y);
      expect(entry.unlikeContact.owner.height).toBe(entry.unlikeContact.other.height);
      expect(inside(entry.authoredCavity, entry.body)).toBe(true);
      expect(inside(entry.openNotch, entry.body)).toBe(true);
      expect(entry.openNotch.width).toBe(1);
      expect(entry.openNotch.x + entry.openNotch.width).toBe(entry.body.x + entry.body.width);
      expect(entry.wallCoexistence.x % 4).toBe(0);
      expect(entry.wallCoexistence.y % 4).toBe(0);
      expect(entry.wallCoexistence.width % 4).toBe(0);
      expect(entry.wallCoexistence.height % 4).toBe(0);
    }

    // The broad body intentionally contains only its named probes and authored
    // voids; every independently rendered region remains disjoint from every
    // other independent region.
    const disjoint = independent.filter((region) => !BOTANICAL_BODY_VFX_AUDIT.cards.some(
      (entry) => region === entry.body,
    ));
    for (let index = 0; index < disjoint.length; index++) {
      for (let other = index + 1; other < disjoint.length; other++) {
        expect(intersects(disjoint[index], disjoint[other])).toBe(false);
      }
    }
    expect(intersects(BOTANICAL_BODY_VFX_AUDIT.cards[0].card, BOTANICAL_BODY_VFX_AUDIT.cards[1].card))
      .toBe(false);
  });

  it('direct-fills without particle brush calls', () => {
    const simulation = new BrushRejectingRenderLabBackend();
    expect(() => prepareBotanicalBodyVfxFixture(simulation)).not.toThrow();
    expect(simulation.brushCalls).toBe(0);
  });

  it('resets semantic, native wall, and paused state planes deterministically and rejects unsupported backends', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells().slice();
    const walls = simulation.walls().slice();
    const state = simulation.presentationState().slice();

    simulation.paint(2, 2, Material.Fire, 0);
    simulation.paintWall(2, 2, 2, 0);
    simulation.setFixturePresentationState(2, 2, 0xffff);
    prepareBotanicalBodyVfxFixture(simulation);
    expect(simulation.cells()).toEqual(cells);
    expect(simulation.walls()).toEqual(walls);
    expect(simulation.presentationState()).toEqual(state);
    const expectedStateCells = BOTANICAL_BODY_VFX_AUDIT.cards.reduce(
      (sum, entry) => sum + entry.lifecycleCanopy.width * entry.lifecycleCanopy.height, 0,
    );
    expect(simulation.presentationState().reduce(
      (count, value) => count + Number(value !== 0), 0,
    )).toBe(expectedStateCells);

    expect(() => prepareBotanicalBodyVfxFixture(new DeterministicBackend(612, 384)))
      .toThrow('native wall and state planes');
    expect(() => prepareBotanicalBodyVfxFixture(new WallOnlyBackend()))
      .toThrow('native wall and state planes');
    expect(() => prepareBotanicalBodyVfxFixture(new RenderLabBackend(32, 32))).toThrow('612x384');
  });
});

class BrushRejectingRenderLabBackend extends RenderLabBackend {
  brushCalls = 0;

  override paint(): void {
    this.brushCalls++;
    throw new Error('particle brush must not be used by a direct-fill fixture');
  }
}

class WallOnlyBackend extends DeterministicBackend {
  private readonly wallPlane = new Uint8Array(612 * 384);

  constructor() { super(612, 384); }

  walls(): Uint8Array { return this.wallPlane; }

  paintWall(x: number, y: number, wall: number): void {
    this.wallPlane[y * this.width + x] = wall;
  }
}

function preparedFixture(): RenderLabBackend {
  const simulation = new RenderLabBackend();
  prepareBotanicalBodyVfxFixture(simulation);
  return simulation;
}

function at(bytes: Uint8Array, width: number, point: BotanicalBodyVfxPoint): number {
  return bytes[point.y * width + point.x];
}

function expectRect(
  cells: Uint8Array | Uint16Array, width: number, rect: BotanicalBodyVfxRect, material: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) expect(cells[y * width + x]).toBe(material);
  }
}

function expectBodyWithVoids(
  cells: Uint8Array, width: number, body: BotanicalBodyVfxRect,
  cavity: BotanicalBodyVfxRect, notch: BotanicalBodyVfxRect, material: number,
): void {
  for (let y = body.y; y < body.y + body.height; y++) {
    for (let x = body.x; x < body.x + body.width; x++) {
      const voidCell = contains(cavity, x, y) || contains(notch, x, y);
      expect(cells[y * width + x]).toBe(voidCell ? Material.Empty : material);
    }
  }
}

function cardinalNeighbours(point: BotanicalBodyVfxPoint): BotanicalBodyVfxPoint[] {
  return [
    { x: point.x - 1, y: point.y }, { x: point.x + 1, y: point.y },
    { x: point.x, y: point.y - 1 }, { x: point.x, y: point.y + 1 },
  ];
}

function pointRect(point: BotanicalBodyVfxPoint): BotanicalBodyVfxRect {
  return { ...point, width: 1, height: 1 };
}

function expectInWorld(rect: BotanicalBodyVfxRect): void {
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(612);
  expect(rect.y + rect.height).toBeLessThanOrEqual(384);
}

function inside(inner: BotanicalBodyVfxRect, outer: BotanicalBodyVfxRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function intersects(left: BotanicalBodyVfxRect, right: BotanicalBodyVfxRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

function contains(rect: BotanicalBodyVfxRect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}
