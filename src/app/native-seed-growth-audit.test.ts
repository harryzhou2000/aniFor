import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import type { DirtyCell } from '../simulation/types';
import {
  NATIVE_SEED_GROWTH_BACKEND_NAME,
  NATIVE_SEED_GROWTH_REGIONS,
  NATIVE_SEED_GROWTH_TICKS,
  runNativeSeedGrowthAudit,
  type NativeSeedGrowthBackend,
  type NativeSeedGrowthPoint,
  type NativeSeedGrowthRect,
} from './native-seed-growth-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;

class NativeGrowthCapabilityStub implements NativeSeedGrowthBackend {
  readonly name = NATIVE_SEED_GROWTH_BACKEND_NAME;
  readonly width = WORLD_WIDTH;
  readonly height = WORLD_HEIGHT;
  readonly paintCalls: Array<{ x: number; y: number; material: Material; radius: number }> = [];
  stepCalls = 0;

  private readonly world = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT);
  private readonly dirty = new Set<number>();

  paint(x: number, y: number, material: Material, radius: number): void {
    this.paintCalls.push({ x, y, material, radius });
    const radiusSquared = radius * radius;
    for (let py = Math.max(0, y - radius); py <= Math.min(this.height - 1, y + radius); py++) {
      for (let px = Math.max(0, x - radius); px <= Math.min(this.width - 1, x + radius); px++) {
        if ((px - x) ** 2 + (py - y) ** 2 <= radiusSquared) this.set(px, py, material);
      }
    }
  }

  step(): void {
    this.stepCalls++;
    if (this.stepCalls !== NATIVE_SEED_GROWTH_TICKS) return;
    const seeds: NativeSeedGrowthPoint[] = [];
    for (let index = 0; index < this.world.length; index++) {
      if (this.world[index] === Material.SEED) {
        seeds.push({ x: index % this.width, y: Math.floor(index / this.width) });
      }
    }
    for (const seed of seeds) {
      if (this.get(seed.x, seed.y + 1) !== Material.Sand || !this.hasNearbyWater(seed)) continue;
      for (let y = seed.y - 18; y <= seed.y; y++) this.set(seed.x, y, Material.Wood);
      for (let y = seed.y - 21; y <= seed.y - 17; y++) {
        for (let x = seed.x - 2; x <= seed.x + 2; x++) this.set(x, y, Material.Plant);
      }
    }
  }

  cells(): Uint8Array { return this.world; }

  consumeDirtyCells(): readonly DirtyCell[] {
    const result = Array.from(this.dirty, (index) => ({
      index,
      material: this.world[index] as Material,
    }));
    this.dirty.clear();
    return result;
  }

  saveFile(): Uint8Array { return this.world.slice(); }

  loadFile(bytes: Uint8Array): void {
    if (bytes.length !== this.world.length) throw new Error('Corrupt stub save');
    this.world.set(bytes);
    for (let index = 0; index < this.world.length; index++) this.dirty.add(index);
  }

  private hasNearbyWater(seed: NativeSeedGrowthPoint): boolean {
    for (let y = seed.y - 20; y <= seed.y + 8; y++) {
      for (let x = seed.x - 40; x <= seed.x + 40; x++) {
        if (this.get(x, y) === Material.Water) return true;
      }
    }
    return false;
  }

  private get(x: number, y: number): Material {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return Material.Wall;
    return this.world[y * this.width + x] as Material;
  }

  private set(x: number, y: number, material: Material): void {
    const index = y * this.width + x;
    if (this.world[index] === material) return;
    this.world[index] = material;
    this.dirty.add(index);
  }
}

describe('native seed growth audit', () => {
  it('pins three widely separated planter geometries and their browser probes', () => {
    expect(NATIVE_SEED_GROWTH_TICKS).toBe(900);
    expect(NATIVE_SEED_GROWTH_REGIONS.map(({ id }) => id))
      .toEqual(['no-water', 'canonical', 'no-soil']);
    expect(NATIVE_SEED_GROWTH_REGIONS.map(({ initialSeeds }) => initialSeeds.length))
      .toEqual([5, 5, 5]);

    for (const [index, region] of NATIVE_SEED_GROWTH_REGIONS.entries()) {
      const offsetX = (index - 1) * 200;
      expect(region.bounds).toEqual({ x: 245 + offsetX, y: 80, width: 120, height: 174 });
      expect(region.foundation).toEqual({ x: 250 + offsetX, y: 250, width: 110, height: 4 });
      expect(region.substrateProbe).toEqual({ x: 260 + offsetX, y: 242, width: 90, height: 8 });
      expect(region.waterProbe).toEqual({ x: 270 + offsetX, y: 225, width: 25, height: 16 });
      expect(region.initialSeeds.map(({ x }) => x)).toEqual([
        305 + offsetX, 310 + offsetX, 315 + offsetX, 320 + offsetX, 325 + offsetX,
      ]);
      expect(region.initialSeeds.every(({ y }) => y === 241)).toBe(true);
      expect(rectInside(region.foundation, region.bounds)).toBe(true);
      expect(rectInside(region.canopyProbe, region.bounds)).toBe(true);
      expect(rectInside(region.seedProbe, region.bounds)).toBe(true);
      expect(rectInside(region.substrateProbe, region.bounds)).toBe(true);
      expect(rectInside(region.waterProbe, region.bounds)).toBe(true);
      expect(region.initialSeeds.every((point) => pointInside(point, region.bounds))).toBe(true);
      expect(region.soil === undefined).toBe(region.id === 'no-soil');
      expect(region.water === undefined).toBe(region.id === 'no-water');
    }
    expect(NATIVE_SEED_GROWTH_REGIONS[0].bounds.x + NATIVE_SEED_GROWTH_REGIONS[0].bounds.width)
      .toBeLessThan(NATIVE_SEED_GROWTH_REGIONS[1].bounds.x);
    expect(NATIVE_SEED_GROWTH_REGIONS[1].bounds.x + NATIVE_SEED_GROWTH_REGIONS[1].bounds.width)
      .toBeLessThan(NATIVE_SEED_GROWTH_REGIONS[2].bounds.x);
  });

  it('uses only the official surface and reports canonical growth with negative controls', () => {
    const simulation = new NativeGrowthCapabilityStub();
    const snapshot = runNativeSeedGrowthAudit(simulation);
    const canonical = snapshot.regions.find(({ id }) => id === 'canonical')!;
    const noWater = snapshot.regions.find(({ id }) => id === 'no-water')!;
    const noSoil = snapshot.regions.find(({ id }) => id === 'no-soil')!;

    expect(simulation.stepCalls).toBe(900);
    expect(simulation.paintCalls.every(({ radius }) => radius === 0)).toBe(true);
    expect(simulation.paintCalls).toHaveLength(
      3 * 110 * 4 + 2 * 90 * 8 + 2 * 25 * 16 + 3 * 5,
    );
    expect(snapshot).toMatchObject({
      width: 612,
      height: 384,
      ticks: 900,
      initialSeedCount: 15,
      unassignedGrowthCount: 0,
    });
    expect(snapshot.initialSeeds).toHaveLength(15);
    expect(snapshot.finalWoodCount).toBeGreaterThan(0);
    expect(snapshot.finalPlantCount).toBeGreaterThan(0);
    expect(snapshot.finalGrowthCount).toBe(snapshot.finalWoodCount + snapshot.finalPlantCount);
    expect(snapshot.dirtyGrownCount).toBe(snapshot.finalGrowthCount);
    expect(snapshot.finalGrowthBounds).toBeDefined();

    expect(canonical.finalWoodCount).toBeGreaterThan(50);
    expect(canonical.finalPlantCount).toBeGreaterThan(50);
    expect(canonical.finalGrowthCount).toBe(canonical.dirtyGrownCount);
    expect(canonical.finalGrowthBounds).toBeDefined();
    expect(canonical.probes.canopy.wood + canonical.probes.canopy.plant).toBeGreaterThan(50);
    expect(canonical.probes.substrate.sand).toBeGreaterThan(0);
    expect(canonical.probes.water.water).toBeGreaterThan(0);

    for (const control of [noWater, noSoil]) {
      expect(control.finalWoodCount).toBe(0);
      expect(control.finalPlantCount).toBe(0);
      expect(control.finalGrowthCount).toBe(0);
      expect(control.dirtyGrownCount).toBe(0);
      expect(control.finalGrowthBounds).toBeUndefined();
    }
    expect(noWater.probes.substrate.sand).toBe(90 * 8);
    expect(noWater.probes.water.water).toBe(0);
    expect(noSoil.probes.substrate.sand).toBe(0);
    expect(noSoil.probes.water.water).toBe(25 * 16);

    const rearmed = simulation.consumeDirtyCells();
    expect(rearmed).toHaveLength(WORLD_WIDTH * WORLD_HEIGHT);
    expect(rearmed.filter(({ material }) => material === Material.Wood || material === Material.Plant))
      .toHaveLength(snapshot.finalGrowthCount);
  });

  it('rejects fallback, wrong geometry, dirty worlds, and missing capabilities', () => {
    expect(() => runNativeSeedGrowthAudit(
      new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT) as unknown as NativeSeedGrowthBackend,
    ))
      .toThrow('requires the official PowderToyBackend');

    const wrongGeometry = new NativeGrowthCapabilityStub();
    Object.defineProperty(wrongGeometry, 'width', { value: 32 });
    expect(() => runNativeSeedGrowthAudit(wrongGeometry)).toThrow('requires 612x384');

    const dirtyWorld = new NativeGrowthCapabilityStub();
    dirtyWorld.paint(1, 1, Material.Sand, 0);
    expect(() => runNativeSeedGrowthAudit(dirtyWorld)).toThrow('requires a fresh empty world');

    const missingStep = new NativeGrowthCapabilityStub();
    Object.defineProperty(missingStep, 'step', { value: undefined });
    expect(() => runNativeSeedGrowthAudit(missingStep)).toThrow('requires PowderToyBackend.step()');
  });
});

function pointInside(point: NativeSeedGrowthPoint, rect: NativeSeedGrowthRect): boolean {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

function rectInside(inner: NativeSeedGrowthRect, outer: NativeSeedGrowthRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}
