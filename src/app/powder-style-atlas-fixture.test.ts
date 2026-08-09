import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  POWDER_STYLE_ATLAS,
  POWDER_STYLE_ATLAS_CONDUCTIVE_WALL,
  POWDER_STYLE_ATLAS_WORLD,
  preparePowderStyleAtlasFixture,
} from './powder-style-atlas-fixture';

const materialAt = (backend: RenderLabBackend, x: number, y: number): Material => (
  backend.cells()[y * backend.width + x] as Material
);

describe('powder style atlas fixture', () => {
  it('direct-fills the paused style controls with preserved fine topology', () => {
    const backend = new RenderLabBackend();
    preparePowderStyleAtlasFixture(backend);

    expect(materialAt(backend, POWDER_STYLE_ATLAS.bulk.sandProbe.x, POWDER_STYLE_ATLAS.bulk.sandProbe.y)).toBe(Material.Sand);
    expect(materialAt(backend, POWDER_STYLE_ATLAS.bulk.clayProbe.x, POWDER_STYLE_ATLAS.bulk.clayProbe.y)).toBe(Material.Clay);
    expect(materialAt(backend, POWDER_STYLE_ATLAS.fine.concreteProbe.x, POWDER_STYLE_ATLAS.fine.concreteProbe.y)).toBe(Material.Concrete);
    for (let y = POWDER_STYLE_ATLAS.fine.authoredHole.y; y < POWDER_STYLE_ATLAS.fine.authoredHole.y + 7; y++) {
      for (let x = POWDER_STYLE_ATLAS.fine.authoredHole.x; x < POWDER_STYLE_ATLAS.fine.authoredHole.x + 7; x++) {
        expect(materialAt(backend, x, y)).toBe(Material.Empty);
      }
    }
    expect(materialAt(backend, POWDER_STYLE_ATLAS.fine.clayStem.x, POWDER_STYLE_ATLAS.fine.clayStem.y + 20)).toBe(Material.Clay);
    expect(materialAt(backend, POWDER_STYLE_ATLAS.fine.clayLedge.x + 20, POWDER_STYLE_ATLAS.fine.clayLedge.y)).toBe(Material.Clay);
    expect(materialAt(backend, POWDER_STYLE_ATLAS.blankProbe.x, POWDER_STYLE_ATLAS.blankProbe.y)).toBe(Material.Empty);
  });

  it('keeps grains, wet contact, and wall coexistence semantically explicit', () => {
    const backend = new RenderLabBackend();
    preparePowderStyleAtlasFixture(backend);

    expect(materialAt(backend, POWDER_STYLE_ATLAS.grains.sand.x, POWDER_STYLE_ATLAS.grains.sand.y)).toBe(Material.Sand);
    expect(materialAt(backend, POWDER_STYLE_ATLAS.grains.clay.x, POWDER_STYLE_ATLAS.grains.clay.y)).toBe(Material.Clay);
    for (const point of POWDER_STYLE_ATLAS.grains.concreteDiagonal) expect(materialAt(backend, point.x, point.y)).toBe(Material.Concrete);
    for (const point of POWDER_STYLE_ATLAS.unstableControl) expect(materialAt(backend, point.x, point.y)).toBe(Material.Sand);
    expect(materialAt(backend, POWDER_STYLE_ATLAS.wetContact.powderProbe.x, POWDER_STYLE_ATLAS.wetContact.powderProbe.y)).toBe(Material.Clay);
    expect(materialAt(backend, POWDER_STYLE_ATLAS.wetContact.waterProbe.x, POWDER_STYLE_ATLAS.wetContact.waterProbe.y)).toBe(Material.Water);
    expect(materialAt(backend, POWDER_STYLE_ATLAS.wallProbe.x, POWDER_STYLE_ATLAS.wallProbe.y)).toBe(Material.Concrete);
    expect(backend.walls()[POWDER_STYLE_ATLAS.wallProbe.y * backend.width + POWDER_STYLE_ATLAS.wallProbe.x])
      .toBe(POWDER_STYLE_ATLAS_CONDUCTIVE_WALL);
  });

  it('rejects incompatible fixture backends before mutating them', () => {
    expect(() => preparePowderStyleAtlasFixture(new DeterministicBackend(612, 384)))
      .toThrow('native wall plane');
    expect(() => preparePowderStyleAtlasFixture(new RenderLabBackend(160, 100)))
      .toThrow(`${POWDER_STYLE_ATLAS_WORLD.width}x${POWDER_STYLE_ATLAS_WORLD.height}`);
  });
});
