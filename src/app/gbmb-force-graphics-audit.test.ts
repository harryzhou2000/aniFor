import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  GBMB_FORCE_GRAPHICS_AUDIT, prepareGbmbForceGraphicsAuditFixture,
} from './gbmb-force-graphics-audit';

describe('GBMB force graphics audit fixture', () => {
  it('pins the exact native gravity-bomb owner without claiming unavailable gravity', () => {
    const fixture = GBMB_FORCE_GRAPHICS_AUDIT;
    expect(fixture.material).toBe(Material.GBMB);
    expect(fixture.code).toBe('GBMB');
    expect(fixture.coreProbe.width).toBe(16);
    expect(fixture.ringProbe.width).toBe(16);
    expect(fixture.backgroundProbe.width).toBe(16);
    expect(fixture.authoredHole).toMatchObject({ width: 8, height: 8 });
  });

  it('direct-fills GBMB semantics while preserving wall, contacts, topology, blank, and DMG control', () => {
    const backend = new RenderLabBackend();
    prepareGbmbForceGraphicsAuditFixture(backend);
    const fixture = GBMB_FORCE_GRAPHICS_AUDIT;
    const at = (point: { x: number; y: number }) => backend.cells()[point.y * backend.width + point.x];
    expect(at(fixture.coreProbe)).toBe(Material.GBMB);
    expect(at(fixture.authoredHole)).toBe(Material.Empty);
    expect(at(fixture.openChannel)).toBe(Material.Empty);
    expect(at(fixture.thinColumn)).toBe(Material.GBMB);
    expect(at(fixture.isolated)).toBe(Material.GBMB);
    expect(at(fixture.wallCoexistence)).toBe(Material.GBMB);
    expect(backend.walls()[fixture.wallCoexistence.y * backend.width + fixture.wallCoexistence.x])
      .toBe(fixture.conductiveWall);
    expect(at(fixture.contacts.gbmb)).toBe(Material.GBMB);
    expect(at(fixture.contacts.water)).toBe(Material.Water);
    expect(at(fixture.contacts.metal)).toBe(Material.Metal);
    expect(at(fixture.wrongOwner)).toBe(Material.DMG);
    expect(at(fixture.guardedBlank)).toBe(Material.Empty);
  });
});
