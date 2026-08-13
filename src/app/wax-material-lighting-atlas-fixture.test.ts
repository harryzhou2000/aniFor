import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { WAX_MATERIAL_LIGHTING_ATLAS_CATALOG } from '../shared/wax-material-lighting-atlas-catalog.js';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { prepareWaxGraphicsAuditFixture } from './wax-graphics-audit';
import { prepareWaxMaterialLightingAtlasFixture } from './wax-material-lighting-atlas-fixture';

const AUTHORING = WAX_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases[0];

describe('Wax material-lighting atlas fixture', () => {
  it('declares bounded warm-emitter inspection controls for both phase cards', () => {
    expect(AUTHORING.descriptor.inspectionRegions.filter(({ name }) => (
      name.endsWith('-warm-emitter')
    ))).toEqual([
      { name: 'wax-warm-emitter', role: 'control', x: 248, y: 260, width: 20, height: 20 },
      { name: 'mwax-warm-emitter', role: 'control', x: 552, y: 260, width: 20, height: 20 },
    ]);
  });

  it('adds only declared Fire readiness controls to the legacy paired-phase fixture', () => {
    const legacy = new DeterministicBackend(AUTHORING.world.width, AUTHORING.world.height);
    const materialLighting = new DeterministicBackend(AUTHORING.world.width, AUTHORING.world.height);
    prepareWaxGraphicsAuditFixture(legacy);
    prepareWaxMaterialLightingAtlasFixture(materialLighting);

    const expectedEmitterCells = new Set<number>();
    for (const { warmEmitter } of AUTHORING.descriptor.cards) {
      for (let y = warmEmitter.y; y < warmEmitter.y + warmEmitter.height; y++) {
        for (let x = warmEmitter.x; x < warmEmitter.x + warmEmitter.width; x++) {
          const offset = y * materialLighting.width + x;
          expectedEmitterCells.add(offset);
          expect(legacy.cells()[offset]).toBe(Material.Empty);
          expect(materialLighting.cells()[offset]).toBe(Material.Fire);
        }
      }
    }
    for (let offset = 0; offset < legacy.cells().length; offset++) {
      if (!expectedEmitterCells.has(offset)) expect(materialLighting.cells()[offset]).toBe(legacy.cells()[offset]);
    }
  });

  it('retains the legacy WAX/MWAX preparer without the capture-only emitters', () => {
    const legacy = new DeterministicBackend(AUTHORING.world.width, AUTHORING.world.height);
    prepareWaxGraphicsAuditFixture(legacy);
    for (const { warmEmitter } of AUTHORING.descriptor.cards) {
      for (let y = warmEmitter.y; y < warmEmitter.y + warmEmitter.height; y++) {
        for (let x = warmEmitter.x; x < warmEmitter.x + warmEmitter.width; x++) {
          expect(legacy.cells()[y * legacy.width + x]).toBe(Material.Empty);
        }
      }
    }
  });
});
