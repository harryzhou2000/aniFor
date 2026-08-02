import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  FRAY_FORCE_GRAPHICS_AUDIT, prepareFrayForceGraphicsAuditFixture,
} from './fray-force-graphics-audit';

describe('FRAY force graphics audit fixture', () => {
  it('pins the exact native force-emitter owner and owner-local probes', () => {
    const fixture = FRAY_FORCE_GRAPHICS_AUDIT;
    expect(fixture.material).toBe(Material.FRAY);
    expect(fixture.code).toBe('FRAY');
    expect(fixture.throatProbe.width).toBe(16);
    expect(fixture.axisProbe.width).toBe(16);
    expect(fixture.backgroundProbe.width).toBe(16);
    expect(fixture.authoredHole).toMatchObject({ width: 8, height: 8 });
  });

  it('direct-fills only FRAY ownership while preserving topology, wall, contacts, and ARAY control', () => {
    const backend = new RenderLabBackend();
    prepareFrayForceGraphicsAuditFixture(backend);
    const fixture = FRAY_FORCE_GRAPHICS_AUDIT;
    const at = (point: { x: number; y: number }) => backend.cells()[point.y * backend.width + point.x];
    expect(at(fixture.throatProbe)).toBe(Material.FRAY);
    expect(at(fixture.authoredHole)).toBe(Material.Empty);
    expect(at(fixture.openChannel)).toBe(Material.Empty);
    expect(at(fixture.thinRail)).toBe(Material.FRAY);
    expect(at(fixture.isolated)).toBe(Material.FRAY);
    expect(at(fixture.wallCoexistence)).toBe(Material.FRAY);
    expect(backend.walls()[fixture.wallCoexistence.y * backend.width + fixture.wallCoexistence.x])
      .toBe(fixture.conductiveWall);
    expect(at(fixture.contacts.fray)).toBe(Material.FRAY);
    expect(at(fixture.contacts.water)).toBe(Material.Water);
    expect(at(fixture.contacts.metal)).toBe(Material.Metal);
    expect(at(fixture.wrongOwner)).toBe(Material.ARAY);
    expect(at(fixture.guardedBlank)).toBe(Material.Empty);
  });
});
