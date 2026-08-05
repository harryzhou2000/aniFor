import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  CERAMIC_GLAZE_VFX_AUDIT, prepareCeramicGlazeVfxFixture,
  type CeramicGlazeVfxPoint, type CeramicGlazeVfxRect,
} from './ceramic-glaze-vfx-audit';

describe('ceramic glaze VFX audit fixture', () => {
  it('pins exact broad Brick and Ceramic cards with named body probes and authored void topology', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    expect(CERAMIC_GLAZE_VFX_AUDIT.cards.map(({ code, material }) => ({ code, material }))).toEqual([
      { code: 'BRCK', material: Material.Brick },
      { code: 'CRMC', material: Material.Ceramic },
    ]);
    for (const entry of CERAMIC_GLAZE_VFX_AUDIT.cards) {
      expectBodyWithVoids(cells, simulation.width, entry.body, entry.authoredHole, entry.openNotch, entry.material);
      expectRect(cells, simulation.width, entry.core, entry.material);
      expectRect(cells, simulation.width, entry.crown, entry.material);
      expectRect(cells, simulation.width, entry.pocket, entry.material);
      expectRect(cells, simulation.width, entry.authoredHole, Material.Empty);
      expectRect(cells, simulation.width, entry.openNotch, Material.Empty);
    }
  });

  it('keeps fine, wall, separated contacts, unlike seams, blank, and non-target controls exact', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    const walls = simulation.walls();
    for (const entry of CERAMIC_GLAZE_VFX_AUDIT.cards) {
      expectRect(cells, simulation.width, entry.thinLine, entry.material);
      expect(at(cells, simulation.width, entry.isolated)).toBe(entry.material);
      expectRect(cells, simulation.width, entry.wallCoexistence, entry.material);
      expectRect(walls, simulation.width, entry.wallCoexistence, CERAMIC_GLAZE_VFX_AUDIT.conductiveWall);
      expectRect(cells, simulation.width, entry.waterContact.solid, entry.material);
      expectRect(cells, simulation.width, entry.waterContact.water, Material.Water);
      expect(entry.waterContact.solid.x + entry.waterContact.solid.width).toBe(entry.waterContact.water.x);
      expectRect(cells, simulation.width, entry.unlikeSolid.owner, entry.material);
      expectRect(cells, simulation.width, entry.unlikeSolid.metal, Material.Metal);
      expect(entry.unlikeSolid.owner.x + entry.unlikeSolid.owner.width).toBe(entry.unlikeSolid.metal.x);
      expectRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
      expectRect(cells, simulation.width, entry.controls.sand, Material.Sand);
      expectRect(cells, simulation.width, entry.controls.glass, Material.Glass);
      expectRect(cells, simulation.width, entry.controls.metal, Material.Metal);
    }
  });

  it('keeps cards and every independent control inside the 612x384 world without accidental overlap', () => {
    const independent: CeramicGlazeVfxRect[] = [];
    for (const entry of CERAMIC_GLAZE_VFX_AUDIT.cards) {
      independent.push(
        entry.thinLine, entry.wallCoexistence,
        entry.waterContact.solid, entry.waterContact.water,
        entry.unlikeSolid.owner, entry.unlikeSolid.metal,
        entry.guardedBlank, ...Object.values(entry.controls),
      );
      expectInWorld(entry.card);
      for (const probe of [entry.core, entry.crown, entry.pocket]) {
        expect(inside(probe, entry.body)).toBe(true);
        expect(intersects(probe, entry.authoredHole)).toBe(false);
        expect(intersects(probe, entry.openNotch)).toBe(false);
      }
      expect(entry.wallCoexistence.x % 4).toBe(0);
      expect(entry.wallCoexistence.y % 4).toBe(0);
    }
    for (const region of independent) expectInWorld(region);
    for (let index = 0; index < independent.length; index++) {
      for (let other = index + 1; other < independent.length; other++) {
        expect(intersects(independent[index], independent[other])).toBe(false);
      }
    }
    expect(intersects(CERAMIC_GLAZE_VFX_AUDIT.cards[0].card, CERAMIC_GLAZE_VFX_AUDIT.cards[1].card)).toBe(false);
  });

  it('resets both semantic and native wall planes deterministically and rejects unsupported backends', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells().slice();
    const walls = simulation.walls().slice();
    simulation.paint(2, 2, Material.Fire, 0);
    simulation.paintWall(2, 2, 2, 0);
    prepareCeramicGlazeVfxFixture(simulation);
    expect(simulation.cells()).toEqual(cells);
    expect(simulation.walls()).toEqual(walls);

    expect(() => prepareCeramicGlazeVfxFixture(new DeterministicBackend(612, 384)))
      .toThrow('RenderLab native wall plane');
    expect(() => prepareCeramicGlazeVfxFixture(new RenderLabBackend(32, 32))).toThrow('612x384');
  });
});

function preparedFixture(): RenderLabBackend {
  const simulation = new RenderLabBackend();
  prepareCeramicGlazeVfxFixture(simulation);
  return simulation;
}

function at(bytes: Uint8Array, width: number, point: CeramicGlazeVfxPoint): number {
  return bytes[point.y * width + point.x];
}

function expectRect(cells: Uint8Array, width: number, rect: CeramicGlazeVfxRect, material: number): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) expect(cells[y * width + x]).toBe(material);
  }
}

function expectBodyWithVoids(
  cells: Uint8Array, width: number, body: CeramicGlazeVfxRect,
  hole: CeramicGlazeVfxRect, notch: CeramicGlazeVfxRect, material: number,
): void {
  for (let y = body.y; y < body.y + body.height; y++) {
    for (let x = body.x; x < body.x + body.width; x++) {
      const voidCell = contains(hole, x, y) || contains(notch, x, y);
      expect(cells[y * width + x]).toBe(voidCell ? Material.Empty : material);
    }
  }
}

function expectInWorld(rect: CeramicGlazeVfxRect): void {
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(612);
  expect(rect.y + rect.height).toBeLessThanOrEqual(384);
}

function inside(inner: CeramicGlazeVfxRect, outer: CeramicGlazeVfxRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function intersects(left: CeramicGlazeVfxRect, right: CeramicGlazeVfxRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

function contains(rect: CeramicGlazeVfxRect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}
