import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  LIQUID_SOLID_MENISCUS_VFX_AUDIT, prepareLiquidSolidMeniscusVfxFixture,
  type LiquidSolidMeniscusVfxPoint, type LiquidSolidMeniscusVfxRect,
} from './liquid-solid-meniscus-vfx-audit';

describe('liquid-solid meniscus VFX audit fixture', () => {
  it('authors each Water/Metal, Oil/Glass, and Acid/Brick contact in horizontal and vertical orientations', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    expect(LIQUID_SOLID_MENISCUS_VFX_AUDIT.cards).toHaveLength(6);
    for (const card of LIQUID_SOLID_MENISCUS_VFX_AUDIT.cards) {
      expectRect(cells, simulation.width, card.liquid, card.liquidMaterial);
      expectRect(cells, simulation.width, card.solid, card.solidMaterial);
      expectRect(cells, simulation.width, card.airMeniscus, card.liquidMaterial);
      expect(at(cells, simulation.width, card.liquidContactProbe)).toBe(card.liquidMaterial);
      expect(at(cells, simulation.width, card.solidContactProbe)).toBe(card.solidMaterial);
      expect(at(cells, simulation.width, card.deepCoreProbe)).toBe(card.liquidMaterial);
      expect(intersects(card.liquid, card.solid)).toBe(false);
      expect(card.orientation === 'horizontal'
        ? card.liquidContactProbe.y + 1 === card.solidContactProbe.y
        : card.liquidContactProbe.x + 1 === card.solidContactProbe.x).toBe(true);
    }
    expect(LIQUID_SOLID_MENISCUS_VFX_AUDIT.cards.map((card) => card.orientation)).toEqual([
      'horizontal', 'horizontal', 'horizontal', 'vertical', 'vertical', 'vertical',
    ]);
  });

  it('keeps every seam, wall, incompatible phase, thin topology, owner, and blank control exact', () => {
    const simulation = preparedFixture();
    const fixture = LIQUID_SOLID_MENISCUS_VFX_AUDIT;
    const cells = simulation.cells();
    expectRect(cells, simulation.width, fixture.unlikeLiquidSeam.left, Material.Water);
    expectRect(cells, simulation.width, fixture.unlikeLiquidSeam.right, Material.Oil);
    expect(at(cells, simulation.width, fixture.unlikeLiquidSeam.leftProbe)).toBe(Material.Water);
    expect(at(cells, simulation.width, fixture.unlikeLiquidSeam.rightProbe)).toBe(Material.Oil);
    expectRect(cells, simulation.width, fixture.nativeWall.liquid, Material.Water);
    expect(at(simulation.walls(), simulation.width, fixture.nativeWall.wallAnchor)).toBe(fixture.conductiveWall);
    expectRect(cells, simulation.width, fixture.lava, Material.Lava);
    expectRect(cells, simulation.width, fixture.powderContact.liquid, Material.Water);
    expectRect(cells, simulation.width, fixture.powderContact.powder, Material.Sand);
    expect(at(cells, simulation.width, fixture.powderContact.liquidProbe)).toBe(Material.Water);
    expectRect(cells, simulation.width, fixture.gasContact.liquid, Material.Water);
    expectRect(cells, simulation.width, fixture.gasContact.gas, Material.Smoke);
    expect(at(cells, simulation.width, fixture.gasContact.liquidProbe)).toBe(Material.Water);
    expectRect(cells, simulation.width, fixture.strand, Material.Water);
    expectRect(cells, simulation.width, fixture.droplet, Material.Water);
    expectRect(cells, simulation.width, fixture.perforatedLiquid.body, Material.Water, [
      fixture.perforatedLiquid.authoredHole, fixture.perforatedLiquid.openChannel,
    ]);
    expectRect(cells, simulation.width, fixture.perforatedLiquid.authoredHole, Material.Empty);
    expectRect(cells, simulation.width, fixture.perforatedLiquid.openChannel, Material.Empty);
    expectRect(cells, simulation.width, fixture.ownerControls.traitLike, Material.Water);
    expectRect(cells, simulation.width, fixture.ownerControls.traitLike.owner, Material.CLNE);
    expect(at(cells, simulation.width, fixture.ownerControls.traitLike.liquidProbe)).toBe(Material.Water);
    expectRect(cells, simulation.width, fixture.ownerControls.emissive, Material.Water);
    expectRect(cells, simulation.width, fixture.ownerControls.emissive.owner, Material.Fire);
    expect(at(cells, simulation.width, fixture.ownerControls.emissive.liquidProbe)).toBe(Material.Water);
    expectRect(cells, simulation.width, fixture.mixedTripleContact.liquid, Material.Water);
    expectRect(cells, simulation.width, fixture.mixedTripleContact.solid, Material.Metal);
    expectRect(cells, simulation.width, fixture.mixedTripleContact.foreign, Material.Smoke);
    expect(at(cells, simulation.width, fixture.mixedTripleContact.liquidProbe)).toBe(Material.Water);
    expectRect(cells, simulation.width, fixture.oilMetalControl.liquid, Material.Oil);
    expectRect(cells, simulation.width, fixture.oilMetalControl.solid, Material.Metal);
    expect(at(cells, simulation.width, fixture.oilMetalControl.liquidContactProbe)).toBe(Material.Oil);
    expect(at(cells, simulation.width, fixture.oilMetalControl.solidContactProbe)).toBe(Material.Metal);
    expect(fixture.oilMetalControl.liquidContactProbe.x + 1)
      .toBe(fixture.oilMetalControl.solidContactProbe.x);
    expect(fixture.oilMetalControl.liquidContactProbe.y)
      .toBe(fixture.oilMetalControl.solidContactProbe.y);
    expect(intersects(fixture.oilMetalControl.liquid, fixture.oilMetalControl.solid)).toBe(false);
    expectRect(cells, simulation.width, fixture.guardedBlank, Material.Empty);
    expect(fixture.guardedBlank.width).toBeGreaterThan(0);
    expect(fixture.guardedBlank.height).toBeGreaterThan(0);
  });

  it('keeps every authored top-level region non-overlapping and inside the 612x384 world', () => {
    const fixture = LIQUID_SOLID_MENISCUS_VFX_AUDIT;
    const regions: LiquidSolidMeniscusVfxRect[] = [
      ...fixture.cards.flatMap((card) => [card.liquid, card.solid, card.airMeniscus]),
      fixture.unlikeLiquidSeam.left, fixture.unlikeLiquidSeam.right, fixture.nativeWall.liquid, fixture.lava,
      fixture.powderContact.liquid, fixture.powderContact.powder, fixture.gasContact.liquid, fixture.gasContact.gas,
      fixture.strand, fixture.droplet, fixture.perforatedLiquid.body,
      fixture.ownerControls.traitLike, fixture.ownerControls.traitLike.owner,
      fixture.ownerControls.emissive, fixture.ownerControls.emissive.owner, fixture.guardedBlank,
      fixture.mixedTripleContact.liquid, fixture.mixedTripleContact.solid, fixture.mixedTripleContact.foreign,
      fixture.oilMetalControl.liquid, fixture.oilMetalControl.solid,
    ];
    for (const region of regions) {
      expect(region.x).toBeGreaterThanOrEqual(0);
      expect(region.y).toBeGreaterThanOrEqual(0);
      expect(region.x + region.width).toBeLessThanOrEqual(612);
      expect(region.y + region.height).toBeLessThanOrEqual(384);
    }
    for (let index = 0; index < regions.length; index++) {
      for (let other = index + 1; other < regions.length; other++) {
        expect(intersects(regions[index], regions[other])).toBe(false);
      }
    }
  });

  it('resets cells and walls deterministically and rejects unsupported or wrong-sized backends', () => {
    const simulation = new RenderLabBackend();
    prepareLiquidSolidMeniscusVfxFixture(simulation);
    const cells = simulation.cells().slice();
    const walls = simulation.walls().slice();
    simulation.paint(2, 2, Material.Fire, 0);
    simulation.paintWall(2, 2, 2, 0);
    prepareLiquidSolidMeniscusVfxFixture(simulation);
    expect(simulation.cells()).toEqual(cells);
    expect(simulation.walls()).toEqual(walls);
    expect(() => prepareLiquidSolidMeniscusVfxFixture(new DeterministicBackend(612, 384)))
      .toThrow('RenderLab wall plane');
    expect(() => prepareLiquidSolidMeniscusVfxFixture(new RenderLabBackend(32, 32))).toThrow('612x384');
  });
});

function preparedFixture(): RenderLabBackend {
  const simulation = new RenderLabBackend();
  prepareLiquidSolidMeniscusVfxFixture(simulation);
  return simulation;
}

function at(bytes: Uint8Array, width: number, point: LiquidSolidMeniscusVfxPoint): number {
  return bytes[point.y * width + point.x];
}

function expectRect(
  cells: Uint8Array, width: number, rect: LiquidSolidMeniscusVfxRect, material: Material,
  holes: readonly LiquidSolidMeniscusVfxRect[] = [],
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      if (holes.some((hole) => x >= hole.x && x < hole.x + hole.width && y >= hole.y && y < hole.y + hole.height)) continue;
      expect(cells[y * width + x]).toBe(material);
    }
  }
}

function intersects(left: LiquidSolidMeniscusVfxRect, right: LiquidSolidMeniscusVfxRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}
