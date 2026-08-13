import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, LIFE_PRESETS, Material } from '../shared/materials';
import { renderPhase, renderProfile, RenderPhase } from './render-profile';
import {
  createRenderLookups, RenderFieldSet, SUSPENSION_FIELD_REFRESH_INTERVAL,
} from './render-field-set';
import { renderOptics, RenderOptics } from './render-optics';
import { renderTraits, RenderTrait } from './render-traits';

describe('shared render field set', () => {
  it('packs canonical phase, color, and emission lookups', () => {
    const lookup = createRenderLookups(ALL_MATERIALS);
    expect(lookup.liquidByMaterial[Material.Water]).toBe(1);
    expect(lookup.gasByMaterial[Material.Oxygen]).toBe(1);
    expect(lookup.gasIdentityStyleByMaterial[Material.Oxygen]).toBe(4);
    expect(lookup.gasIdentityStyleByMaterial[Material.Water]).toBe(0);
    expect(lookup.emissiveByMaterial[Material.PHOT]).toBe(1);
    expect(lookup.styleBytes[Material.Water * 4]).toBe(RenderPhase.Liquid);
    expect(lookup.paletteBytes[Material.Water * 4 + 3]).toBe(RenderOptics.Aqueous);
    expect(lookup.styleBytes[Material.PRTI * 4 + 3]).toBe(RenderTrait.Sink | RenderTrait.Channel);
    expect(Array.from(lookup.colorByMaterial.slice(Material.Acid * 3, Material.Acid * 3 + 3))).toEqual([0xd3, 0x5e, 0xe8]);
    expect(Array.from(lookup.styleBytes.slice(0, 4))).toEqual([0, 0, 0, 0]);
  });

  it('packs native state separately from material-family profile and traits', () => {
    const lookup = createRenderLookups(ALL_MATERIALS);
    for (const id of [
      Material.SEED, Material.YEST,
      Material.BVBR, Material.PLUT, Material.POLO, Material.SING, Material.URAN,
      Material.DMG, Material.GBMB, Material.BCOL,
    ]) expect(lookup.styleBytes[id * 4]).toBe(RenderPhase.Powder);
    for (const id of [
      Material.ACEL, Material.DCEL, Material.FRAY, Material.FRME, Material.PIPE,
      Material.PSTN, Material.RPEL,
      Material.BCLN, Material.BHOL, Material.CLNE, Material.CONV, Material.NBHL,
      Material.NWHL, Material.PRTI, Material.PRTO, Material.TRON, Material.VOID,
      Material.WHOL,
    ]) expect(lookup.styleBytes[id * 4]).toBe(RenderPhase.Solid);

    expect(lookup.styleBytes[Material.SEED * 4 + 1]).toBe(renderProfile('life'));
    expect(lookup.styleBytes[Material.PLUT * 4 + 1]).toBe(renderProfile('radioactive'));
    expect(lookup.styleBytes[Material.ACEL * 4 + 1]).toBe(renderProfile('force'));
    expect(lookup.styleBytes[Material.CLNE * 4 + 1]).toBe(renderProfile('special'));
    expect(lookup.styleBytes[Material.SEED * 4 + 3]).toBe(RenderTrait.Organic);
    expect(lookup.styleBytes[Material.PLUT * 4 + 3]).toBe(RenderTrait.Radioactive);
    expect(lookup.styleBytes[Material.CLNE * 4 + 3]).toBe(RenderTrait.Emitter);

    expect(lookup.paletteBytes[Material.SEED * 4 + 3]).toBe(RenderOptics.RoughGranular);
    expect(lookup.paletteBytes[Material.URAN * 4 + 3]).toBe(RenderOptics.MetallicGranular);
    expect(lookup.paletteBytes[Material.AMTR * 4 + 3]).toBe(RenderOptics.SootyGas);
    expect(lookup.paletteBytes[Material.DEUT * 4 + 3]).toBe(RenderOptics.Aqueous);
    for (const { material } of LIFE_PRESETS) {
      expect(lookup.paletteBytes[material * 4 + 3]).toBe(RenderOptics.Cellular);
    }
    expect(lookup.styleBytes[Material.AMTR * 4]).toBe(RenderPhase.Gas);
    expect(lookup.styleBytes[Material.DEUT * 4]).toBe(RenderPhase.Liquid);
    expect(lookup.styleBytes[Material.URAN * 4 + 1]).toBe(renderProfile('radioactive'));
    expect(lookup.styleBytes[Material.URAN * 4 + 3]).toBe(RenderTrait.Radioactive);
  });

  it('packs a complete render identity for every projected material', () => {
    const lookup = createRenderLookups(ALL_MATERIALS);
    expect(ALL_MATERIALS).toHaveLength(217);
    expect(new Set(ALL_MATERIALS.map(({ id }) => id)).size).toBe(217);
    for (const material of ALL_MATERIALS) {
      const palette = material.id * 4;
      const color = Number.parseInt(material.color.slice(1), 16);
      expect(Array.from(lookup.paletteBytes.slice(palette, palette + 4))).toEqual([
        color >>> 16, (color >>> 8) & 0xff, color & 0xff, renderOptics(material),
      ]);
      expect(lookup.styleBytes[palette]).toBe(renderPhase(material));
      expect(lookup.styleBytes[palette + 1]).toBe(renderProfile(material.category));
      expect(lookup.styleBytes[palette + 3]).toBe(renderTraits(material));
      expect(lookup.gasByMaterial[material.id]).toBe(Number(renderPhase(material) === RenderPhase.Gas));
      expect(Number(lookup.gasIdentityStyleByMaterial[material.id] > 0))
        .toBe(lookup.gasByMaterial[material.id]);
      expect(lookup.liquidByMaterial[material.id]).toBe(Number(renderPhase(material) === RenderPhase.Liquid));
      expect(lookup.emissiveByMaterial[material.id]).toBe(Number(
        material.emissive === true || renderPhase(material) === RenderPhase.Energy,
      ));
    }
  });

  it('stages atmosphere, liquid, and emission reconstruction over separate frames', () => {
    const width = 8;
    const height = 6;
    const materials = new Uint8Array(width * height);
    materials[1] = Material.Smoke;
    materials[2] = Material.Water;
    materials[3] = Material.PHOT;
    const fields = new RenderFieldSet(width, height, ALL_MATERIALS);
    expect(fields.updateNext(materials, 0)).toBe('atmosphere');
    expect(fields.updateNext(materials, 1)).toBe('liquid');
    expect(fields.updateNext(materials, 2)).toBe('emission');
    expect(fields.updateNext(materials, 3)).toBeUndefined();
    expect(fields.atmosphere.bytes.some(Boolean)).toBe(true);
    expect(fields.liquid.bytes[2 * 4 + 3]).toBeGreaterThan(0);
    expect(fields.emission.bytes.some(Boolean)).toBe(true);
  });

  it('tracks only activation-owned staggered work and propagates liquid ownership to suspension', () => {
    const materials = new Uint8Array(8 * 6);
    materials[2] = Material.Water;
    const fields = new RenderFieldSet(8, 6, ALL_MATERIALS);
    expect(fields.hasPendingRefresh).toBe(true);
    expect(fields.hasPendingRefreshFor(7)).toBe(false);

    fields.markDirty(Material.Empty, Material.Water, 2, 7);
    expect(fields.hasPendingRefreshFor(7)).toBe(true);
    expect(fields.updateNext(materials, 0)).toBe('atmosphere');
    expect(fields.hasPendingRefreshFor(7)).toBe(true);
    expect(fields.updateNext(materials, 1)).toBe('liquid');
    expect(fields.hasPendingRefreshFor(7)).toBe(true);
    fields.refreshSuspension(materials, 1);
    expect(fields.hasPendingRefreshFor(7)).toBe(false);
    expect(fields.hasPendingRefresh).toBe(true);
  });

  it('redirties only fields affected by a material transition', () => {
    const materials = new Uint8Array(16);
    const fields = new RenderFieldSet(4, 4, ALL_MATERIALS);
    fields.updateNext(materials, 0);
    fields.updateNext(materials, 1);
    fields.updateNext(materials, 2);
    fields.markDirty(Material.Empty, Material.Water);
    expect(fields.updateNext(materials, 100)).toBe('liquid');
    expect(fields.updateNext(materials, 101)).toBeUndefined();
  });

  it('redirties atmosphere identity when nearby non-gas contact changes', () => {
    const width = 20;
    const height = 20;
    const materials = new Uint8Array(width * height);
    for (let y = 8; y <= 11; y++) for (let x = 4; x <= 11; x++) {
      materials[y * width + x] = Material.Smoke;
    }
    const fields = new RenderFieldSet(width, height, ALL_MATERIALS);
    fields.updateNext(materials, 0);
    fields.updateNext(materials, 1);
    fields.updateNext(materials, 2);
    const contact = 10 * width + 12;
    materials[contact] = Material.Water;
    fields.markDirty(Material.Empty, Material.Water, contact);

    expect(fields.updateNext(materials, 100)).toBe('atmosphere');
    expect(fields.atmosphere.styleBytes[(5 * fields.atmosphere.width + 5) * 4]).toBe(0);
  });

  it('redirties atmosphere identity when a nearby native wall changes', () => {
    const width = 20;
    const height = 20;
    const materials = new Uint8Array(width * height);
    const walls = new Uint8Array(width * height);
    for (let y = 8; y <= 11; y++) for (let x = 4; x <= 11; x++) {
      materials[y * width + x] = Material.Smoke;
    }
    const fields = new RenderFieldSet(width, height, ALL_MATERIALS);
    fields.updateNext(materials, 0, walls);
    fields.updateNext(materials, 1, walls);
    fields.updateNext(materials, 2, walls);
    const contact = 10 * width + 12;
    walls[contact] = 1;
    fields.markAtmosphereBlockerDirty(contact);

    expect(fields.updateNext(materials, 100, walls)).toBe('atmosphere');
    expect(fields.atmosphere.styleBytes[(5 * fields.atmosphere.width + 5) * 4]).toBe(0);
    expect(fields.updateNext(materials, 101, walls)).toBe('liquid');
    expect(fields.updateNext(materials, 102, walls)).toBeUndefined();
  });

  it('hydrates opt-in long-range emission after Canvas produced clean shared fields', () => {
    const materials = new Uint8Array(16);
    materials[5] = Material.PHOT;
    const fields = new RenderFieldSet(4, 4, ALL_MATERIALS);
    fields.updateNext(materials, 0);
    fields.updateNext(materials, 1);
    fields.updateNext(materials, 2);
    expect(fields.updateNext(materials, 3)).toBeUndefined();

    fields.enableLongRangeEmissionTransport();
    expect(fields.emission.transportBytes?.some(Boolean)).toBe(false);
    expect(fields.updateNext(materials, 100)).toBe('emission');
    expect(fields.emission.transportBytes?.some(Boolean)).toBe(true);
  });

  it('redirties opt-in long-range emission when a native wall changes', () => {
    const materials = new Uint8Array(16);
    const walls = new Uint8Array(16);
    materials[5] = Material.PHOT;
    const fields = new RenderFieldSet(4, 4, ALL_MATERIALS);
    fields.enableLongRangeEmissionTransport();
    fields.updateNext(materials, 0, walls);
    fields.updateNext(materials, 1, walls);
    fields.updateNext(materials, 2, walls);

    walls[6] = 1;
    fields.markAtmosphereBlockerDirty(6);
    expect(fields.updateNext(materials, 100, walls)).toBe('liquid');
    expect(fields.updateNext(materials, 101, walls)).toBe('emission');
  });

  it('reuses the atmosphere cadence when only coherent gas motion changes', () => {
    const width = 8;
    const height = 8;
    const materials = new Uint8Array(width * height);
    const velocities = new Int8Array(width * height * 2);
    for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) {
      materials[y * width + x] = Material.Smoke;
    }
    const fields = new RenderFieldSet(width, height, ALL_MATERIALS);
    fields.updateNext(materials, 0, undefined, velocities);
    fields.updateNext(materials, 1, undefined, velocities);
    fields.updateNext(materials, 2, undefined, velocities);
    expect(fields.updateNext(materials, 3, undefined, velocities)).toBeUndefined();

    for (let index = 0; index < materials.length; index++) {
      if (materials[index] !== Material.Smoke) continue;
      velocities[index * 2] = 48;
    }
    fields.markAtmosphereMotionDirty();

    expect(fields.updateNext(materials, 100, undefined, velocities)).toBe('atmosphere');
    const offset = (2 * fields.atmosphere.width + 2) * 4;
    expect(Array.from(fields.atmosphere.styleBytes.slice(offset + 1, offset + 4)))
      .toEqual([176, 128, 255]);
    expect(fields.updateNext(materials, 101, undefined, velocities)).toBeUndefined();
  });

  it('reuses the bounded emission cadence for authoritative temperature refreshes', () => {
    const materials = new Uint8Array(16);
    const temperatures = new Uint16Array(16).fill(2_952);
    materials[5] = Material.Brick;
    const fields = new RenderFieldSet(4, 4, ALL_MATERIALS);
    fields.updateNext(materials, 0, undefined, undefined, temperatures);
    fields.updateNext(materials, 1, undefined, undefined, temperatures);
    fields.updateNext(materials, 2, undefined, undefined, temperatures);
    expect(fields.emission.hasLight).toBe(false);

    temperatures[5] = 23_040;
    fields.markThermalEmissionDirty();
    expect(fields.updateNext(materials, 80, undefined, undefined, temperatures)).toBeUndefined();
    expect(fields.updateNext(materials, 100, undefined, undefined, temperatures)).toBe('emission');
    expect(fields.emission.hasLight).toBe(true);
    expect(fields.updateNext(materials, 101, undefined, undefined, temperatures)).toBeUndefined();
  });

  it('does not schedule thermal emission work without an eligible material', () => {
    const materials = new Uint8Array(16);
    const temperatures = new Uint16Array(16).fill(23_040);
    materials[5] = Material.Water;
    const fields = new RenderFieldSet(4, 4, ALL_MATERIALS);
    fields.updateNext(materials, 0, undefined, undefined, temperatures);
    fields.updateNext(materials, 1, undefined, undefined, temperatures);
    fields.updateNext(materials, 2, undefined, undefined, temperatures);

    expect(fields.emission.hasThermalCandidate).toBe(false);
    fields.markThermalEmissionDirty();
    expect(fields.updateNext(materials, 100, undefined, undefined, temperatures)).toBeUndefined();
  });

  it('redirties emission when thermal-capable matter is added or removed', () => {
    const materials = new Uint8Array(16);
    const temperatures = new Uint16Array(16).fill(23_040);
    const fields = new RenderFieldSet(4, 4, ALL_MATERIALS);
    fields.updateNext(materials, 0, undefined, undefined, temperatures);
    fields.updateNext(materials, 1, undefined, undefined, temperatures);
    fields.updateNext(materials, 2, undefined, undefined, temperatures);

    materials[5] = Material.Brick;
    fields.markDirty(Material.Empty, Material.Brick, 5);
    expect(fields.updateNext(materials, 100, undefined, undefined, temperatures)).toBe('emission');
    expect(fields.emission.hasThermalCandidate).toBe(true);
    expect(fields.emission.hasLight).toBe(true);

    materials[5] = Material.Empty;
    fields.markDirty(Material.Brick, Material.Empty, 5);
    expect(fields.updateNext(materials, 200, undefined, undefined, temperatures)).toBe('emission');
    expect(fields.emission.hasThermalCandidate).toBe(false);
    expect(fields.emission.hasLight).toBe(false);
  });

  it('paces the soft suspension field independently at six hertz', () => {
    const materials = new Uint8Array(16);
    const fields = new RenderFieldSet(4, 4, ALL_MATERIALS);
    fields.updateNext(materials, 0);
    fields.updateNext(materials, 1);
    fields.updateNext(materials, 2);
    expect(fields.refreshSuspension(materials, 2)).toBe(false);
    fields.markDirty(Material.Empty, Material.Sand);
    expect(fields.refreshSuspension(materials, 2 + SUSPENSION_FIELD_REFRESH_INTERVAL - 1))
      .toBeUndefined();
    expect(fields.due(2 + SUSPENSION_FIELD_REFRESH_INTERVAL)).toBe(true);
    expect(fields.refreshSuspension(materials, 2 + SUSPENSION_FIELD_REFRESH_INTERVAL)).toBe(false);
  });

  it('invalidates suspension on a wall-only edit at its bounded cadence', () => {
    const width = 8;
    const height = 8;
    const materials = new Uint8Array(width * height).fill(Material.Water);
    const sandIndex = 3 * width + 3;
    const walls = new Uint8Array(width * height);
    materials[sandIndex] = Material.Sand;
    const fields = new RenderFieldSet(width, height, ALL_MATERIALS);

    // Establish the liquid source and the initial supported Sand/Water cluster.
    fields.updateNext(materials, 0, walls);
    fields.updateNext(materials, 1, walls);
    fields.updateNext(materials, 2, walls);
    expect(fields.refreshSuspension(materials, 2, walls)).toBe(true);
    expect(fields.suspension.hasSuspension).toBe(true);

    walls[sandIndex] = 1;
    fields.markAtmosphereBlockerDirty(sandIndex);
    expect(fields.refreshSuspension(
      materials, 2 + SUSPENSION_FIELD_REFRESH_INTERVAL - 1, walls,
    )).toBeUndefined();
    expect(fields.due(2 + SUSPENSION_FIELD_REFRESH_INTERVAL)).toBe(true);
    expect(fields.refreshSuspension(
      materials, 2 + SUSPENSION_FIELD_REFRESH_INTERVAL, walls,
    )).toBe(true);
    expect(fields.suspension.hasSuspension).toBe(false);
    expect(fields.suspension.bytes.some(Boolean)).toBe(false);

    walls[sandIndex] = 0;
    fields.markAtmosphereBlockerDirty(sandIndex);
    const restoreTime = 2 + SUSPENSION_FIELD_REFRESH_INTERVAL * 2;
    expect(fields.refreshSuspension(materials, restoreTime, walls)).toBe(true);
    expect(fields.suspension.hasSuspension).toBe(true);
  });

  it('keeps shared field memory bounded at the native world size', () => {
    const fields = new RenderFieldSet(612, 384, ALL_MATERIALS);
    const lookupBytes = fields.lookups.paletteBytes.byteLength
      + fields.lookups.styleBytes.byteLength
      + fields.lookups.gasByMaterial.byteLength
      + fields.lookups.gasIdentityStyleByMaterial.byteLength
      + fields.lookups.liquidByMaterial.byteLength
      + fields.lookups.emissiveByMaterial.byteLength
      + fields.lookups.colorByMaterial.byteLength;
    expect(lookupBytes).toBe(3_840);
    expect(fields.powderSurface.allocatedByteLength).toBe(3_290_112);
    expect(fields.suspension.allocatedByteLength).toBe(588_032);
    expect(fields.allocatedByteLength).toBe(12_584_144);
    expect(fields.allocatedByteLength).toBeLessThan(12_650_000);
  });
});
