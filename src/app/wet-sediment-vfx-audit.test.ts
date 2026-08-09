import { describe, expect, it } from 'vitest';
import { Material, ALL_MATERIALS } from '../shared/materials';
import { RenderFieldSet } from '../renderer/render-field-set';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  WET_SEDIMENT_VFX_AUDIT, prepareWetSedimentVfxFixture,
  type WetSedimentVfxPoint,
} from './wet-sediment-vfx-audit';

describe('wet sediment VFX fixture', () => {
  it('keeps every positive and control region non-overlapping and even-aligned', () => {
    const regions = [
      ...WET_SEDIMENT_VFX_AUDIT.cards.flatMap((card) => [card.body, card.fineWater]),
      ...WET_SEDIMENT_VFX_AUDIT.dry.map(({ body }) => body),
      WET_SEDIMENT_VFX_AUDIT.movingWetSand.body,
      WET_SEDIMENT_VFX_AUDIT.oil.body,
      WET_SEDIMENT_VFX_AUDIT.lava.body,
      WET_SEDIMENT_VFX_AUDIT.unlikeAqueous.body,
      WET_SEDIMENT_VFX_AUDIT.foreignSalt.body,
      WET_SEDIMENT_VFX_AUDIT.nativeWall.body,
      WET_SEDIMENT_VFX_AUDIT.fineColumn.water,
      WET_SEDIMENT_VFX_AUDIT.isolated.water,
      WET_SEDIMENT_VFX_AUDIT.gap.body,
      WET_SEDIMENT_VFX_AUDIT.guardedBlank,
    ];
    for (const region of regions) {
      expect(region.x % 2).toBe(0);
      expect(region.y % 2).toBe(0);
      expect(region.width % 2).toBe(0);
      expect(region.height % 2).toBe(0);
    }
    for (let index = 0; index < regions.length; index++) {
      for (let other = index + 1; other < regions.length; other++) {
        expect(intersects(regions[index], regions[other])).toBe(false);
      }
    }
  });

  it('authors separated exact Water/Sand/Clay/Concrete bodies and protected topology', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();

    expect(WET_SEDIMENT_VFX_AUDIT.cards).toHaveLength(3);
    expect(new Set(WET_SEDIMENT_VFX_AUDIT.cards.map((card) => card.material))).toEqual(
      new Set([Material.Sand, Material.Clay, Material.Concrete]),
    );
    for (const card of WET_SEDIMENT_VFX_AUDIT.cards) {
      expect(at(cells, simulation.width, card.powderProbe)).toBe(card.material);
      expect(at(cells, simulation.width, card.waterProbe)).toBe(Material.Water);
      expect(at(cells, simulation.width, card.fieldProbe)).toBe(card.material);
      expectRect(cells, simulation.width, card.authoredHole, Material.Empty);
      expectRect(cells, simulation.width, card.openNotch, Material.Empty);
      expectRect(cells, simulation.width, card.fineColumn, card.material);
      expect(card.fieldProbe.x % 2).toBe(0);
      expect(card.fieldProbe.y % 2).toBe(0);
    }
    for (const dry of WET_SEDIMENT_VFX_AUDIT.dry) expect(at(cells, simulation.width, dry.probe)).toBe(dry.material);
    expect(at(cells, simulation.width, WET_SEDIMENT_VFX_AUDIT.gap.gapProbe)).toBe(Material.Empty);
    expect(at(cells, simulation.width, WET_SEDIMENT_VFX_AUDIT.isolated.point)).toBe(Material.Sand);
    expectRect(cells, simulation.width, WET_SEDIMENT_VFX_AUDIT.guardedBlank, Material.Empty);
  });

  it('pins fixture-only velocity and independent native-wall ownership', () => {
    const simulation = preparedFixture();
    const moving = WET_SEDIMENT_VFX_AUDIT.movingWetSand;
    const velocityOffset = (moving.powderProbe.y * simulation.width + moving.powderProbe.x) * 2;
    expect(simulation.velocity()[velocityOffset]).toBe(moving.velocity[0]);
    expect(simulation.velocity()[velocityOffset + 1]).toBe(moving.velocity[1]);
    const waterVelocityOffset = (moving.waterProbe.y * simulation.width + moving.waterProbe.x) * 2;
    expect(simulation.cells()[moving.waterProbe.y * simulation.width + moving.waterProbe.x])
      .toBe(Material.Water);
    expect(simulation.velocity()[waterVelocityOffset]).toBe(0);
    expect(simulation.velocity()[waterVelocityOffset + 1]).toBe(0);

    const wall = WET_SEDIMENT_VFX_AUDIT.nativeWall;
    expect(at(simulation.cells(), simulation.width, wall.fieldProbe)).toBe(Material.Sand);
    expect(at(simulation.walls(), simulation.width, wall.fieldProbe)).toBe(WET_SEDIMENT_VFX_AUDIT.conductiveWall);
    expect(at(simulation.walls(), simulation.width, WET_SEDIMENT_VFX_AUDIT.cards[0].fieldProbe)).toBe(0);
  });

  it('resets every authored plane deterministically', () => {
    const simulation = new RenderLabBackend();
    prepareWetSedimentVfxFixture(simulation);
    const firstCells = simulation.cells().slice();
    const firstWalls = simulation.walls().slice();
    const firstVelocity = simulation.velocity().slice();
    simulation.paint(2, 2, Material.Fire, 0);
    simulation.paintWall(2, 2, 2, 0);
    simulation.setFixtureVelocityRect(2, 2, 1, 1, -45, 19);
    prepareWetSedimentVfxFixture(simulation);
    expect(simulation.cells()).toEqual(firstCells);
    expect(simulation.walls()).toEqual(firstWalls);
    expect(simulation.velocity()).toEqual(firstVelocity);
  }, 15_000);

  it('builds exact positive owner bytes and rejects dry, foreign-liquid, and wall controls', () => {
    const simulation = preparedFixture();
    const fields = new RenderFieldSet(simulation.width, simulation.height, ALL_MATERIALS);
    fields.liquid.update(simulation.cells());
    fields.updateSuspension(simulation.cells(), simulation.walls());

    expect(fields.suspension.hasSuspension).toBe(true);
    for (const card of WET_SEDIMENT_VFX_AUDIT.cards) {
      const rgba = suspensionAt(fields, card.fieldProbe);
      const palette = card.material * 4;
      expect(rgba.slice(0, 3)).toEqual(Array.from(fields.lookups.paletteBytes.slice(palette, palette + 3)));
      expect(rgba[3]).toBeGreaterThan(0);
    }

    const moving = suspensionAt(fields, WET_SEDIMENT_VFX_AUDIT.movingWetSand.fieldProbe);
    expect(moving[3]).toBeGreaterThan(0);
    const foreign = suspensionAt(fields, WET_SEDIMENT_VFX_AUDIT.foreignSalt.fieldProbe);
    expect(foreign.slice(0, 3)).toEqual(Array.from(fields.lookups.paletteBytes.slice(Material.Salt * 4, Material.Salt * 4 + 3)));
    expect(foreign[3]).toBeGreaterThan(0);

    for (const dry of WET_SEDIMENT_VFX_AUDIT.dry) expect(suspensionAt(fields, dry.probe)).toEqual([0, 0, 0, 0]);
    expect(suspensionAt(fields, WET_SEDIMENT_VFX_AUDIT.oil.fieldProbe)).toEqual([0, 0, 0, 0]);
    expect(suspensionAt(fields, WET_SEDIMENT_VFX_AUDIT.lava.fieldProbe)).toEqual([0, 0, 0, 0]);
    expect(suspensionAt(fields, WET_SEDIMENT_VFX_AUDIT.unlikeAqueous.fieldProbe)).toEqual([0, 0, 0, 0]);
    expect(suspensionAt(fields, WET_SEDIMENT_VFX_AUDIT.nativeWall.fieldProbe)).toEqual([0, 0, 0, 0]);
    expect(suspensionAt(fields, { x: 384, y: 336 })).toEqual([0, 0, 0, 0]);
  });
});

function preparedFixture(): RenderLabBackend {
  const simulation = new RenderLabBackend();
  prepareWetSedimentVfxFixture(simulation);
  return simulation;
}

function at(bytes: Uint8Array, width: number, point: WetSedimentVfxPoint): number {
  return bytes[point.y * width + point.x];
}

function expectRect(bytes: Uint8Array, width: number, rect: { x: number; y: number; width: number; height: number }, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) expect(bytes[y * width + x]).toBe(material);
  }
}

function suspensionAt(
  fields: RenderFieldSet, point: WetSedimentVfxPoint,
): [number, number, number, number] {
  const x = Math.floor(point.x / 2);
  const y = Math.floor(point.y / 2);
  const offset = (y * fields.suspension.width + x) * 4;
  return [
    fields.suspension.bytes[offset], fields.suspension.bytes[offset + 1],
    fields.suspension.bytes[offset + 2], fields.suspension.bytes[offset + 3],
  ];
}

function intersects(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}
