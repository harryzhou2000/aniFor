import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { renderPhase, renderProfile, RenderPhase, RenderProfile } from './render-profile';
import { renderOptics, RenderOptics } from './render-optics';
import { hasRenderTrait, renderTraits, RenderTrait } from './render-traits';
import {
  applyMaterialCandidateSurveyScene, applyMaterialShowcaseScene, applyRenderLabScene,
  materialCandidateSurveyRequested, materialShowcaseRequested,
  MATERIAL_CANDIDATE_SURVEY_AUDIT, MATERIAL_SHOWCASE_AUDIT,
  RENDER_LAB_AMBIENT_TEMPERATURE, RENDER_LAB_COLD_TEMPERATURE,
  RENDER_LAB_ENERGY_SAMPLES, RENDER_LAB_HOT_TEMPERATURE, RENDER_LAB_STYLE_SAMPLES,
  renderLabRequested,
} from './render-lab-scene';

describe('render lab scene', () => {
  it('is selected only by the explicit query', () => {
    expect(renderLabRequested('?scene=render-lab')).toBe(true);
    expect(renderLabRequested('?scene=other')).toBe(false);
    expect(renderLabRequested('')).toBe(false);
  });

  it('stages a deterministic normal-fit material showcase independently of the atlas', () => {
    const first = new RenderLabBackend(612, 384);
    const second = new RenderLabBackend(612, 384);
    applyMaterialShowcaseScene(first);
    applyMaterialShowcaseScene(second);

    expect(first.cells()).toEqual(second.cells());
    expect(first.walls()).toEqual(second.walls());
    expect(materialShowcaseRequested('?scene=showcase')).toBe(true);
    expect(materialShowcaseRequested('?scene=render-lab')).toBe(false);

    const counts = new Uint32Array(256);
    for (const material of first.cells()) counts[material]++;
    for (const material of [
      Material.ROCK, Material.Sand, Material.Clay, Material.Concrete,
      Material.Water, Material.Oil, Material.Glass, Material.Smoke,
      Material.Oxygen, Material.CarbonDioxide, Material.NobleGas,
      Material.Soap,
      Material.Wood, Material.Plant,
      Material.Metal, Material.DTEC, Material.URAN, Material.POLO,
      Material.ISZS, Material.VIBR,
    ]) expect(counts[material]).toBeGreaterThan(100);
    expect(MATERIAL_SHOWCASE_AUDIT.version).toBe(6);
    expect(MATERIAL_SHOWCASE_AUDIT.semantic.materialCounts.map(({ material }) => (
      [material, counts[material]]
    ))).toEqual(MATERIAL_SHOWCASE_AUDIT.semantic.materialCounts.map(({ material, count }) => (
      [material, count]
    )));
    expect(first.cells().length - counts[Material.Empty])
      .toBe(MATERIAL_SHOWCASE_AUDIT.semantic.occupied);
    expect(semanticHash(first.cells())).toBe(MATERIAL_SHOWCASE_AUDIT.semantic.hash);

    // The submerged rigid insert is deliberately exact: this catches draw-order
    // regressions where the later broad Water pool silently erases every Metal
    // cell while the rest of the showcase still appears plausible. The row
    // profile also prevents an overlarge radius from retaining the same count
    // through an asymmetric mask.
    const metal = MATERIAL_SHOWCASE_AUDIT.metalInsert;
    expect(counts[metal.material]).toBe(metal.expectedCells);
    expect(first.cells()[metal.coreProbe.y * 612 + metal.coreProbe.x]).toBe(metal.material);
    for (const point of metal.waterControls) {
      expect(first.cells()[point.y * 612 + point.x]).toBe(Material.Water);
    }
    expect(Array.from({ length: metal.rect.height }, (_, offsetY) => {
      let rowCount = 0;
      for (let x = metal.rect.x; x < metal.rect.x + metal.rect.width; x++) {
        rowCount += Number(first.cells()[(metal.rect.y + offsetY) * 612 + x] === metal.material);
      }
      return rowCount;
    })).toEqual(metal.rowCounts);
    let outsideMetal = 0;
    for (let y = 0; y < 384; y++) for (let x = 0; x < 612; x++) {
      const inside = x >= metal.rect.x && x < metal.rect.x + metal.rect.width
        && y >= metal.rect.y && y < metal.rect.y + metal.rect.height;
      outsideMetal += Number(!inside && first.cells()[y * 612 + x] === metal.material);
    }
    expect(outsideMetal).toBe(0);
    for (const region of MATERIAL_SHOWCASE_AUDIT.regions) {
      let matching = 0;
      for (let y = Math.floor(region.y - region.radiusY);
        y < Math.ceil(region.y + region.radiusY); y++) {
        for (let x = Math.floor(region.x - region.radiusX);
          x < Math.ceil(region.x + region.radiusX); x++) {
          matching += Number(region.semanticMaterials.includes(first.cells()[y * 612 + x]));
        }
      }
      expect(matching, region.name).toBe(region.expectedMatching);
    }
    const soapRegion = MATERIAL_SHOWCASE_AUDIT.regions.find(({ name }) => name === 'liquidSoap');
    expect(soapRegion).toMatchObject({
      family: 'liquid', profile: 'cohesive-liquid',
      x: 76, y: 216, radiusX: 16, radiusY: 6,
      semanticMaterials: [Material.Soap], expectedMatching: 384,
    });
    expect(first.cells()[216 * 612 + 76]).toBe(Material.Soap);
    expect(first.cells()[331 * 612 + 530]).toBe(Material.ROCK);
    expect(renderPhase(ALL_MATERIALS.find(({ id }) => id === Material.ROCK)!))
      .toBe(RenderPhase.Solid);
    expect(first.cells()[235 * 612 + 360]).toBe(Material.Water);
    expect(first.cells()[235 * 612 + 420]).toBe(Material.Oil);
    expect(first.cells()[265 * 612 + 285]).toBe(Material.Glass);
    expect(first.cells()[270 * 612 + 512]).toBe(Material.DTEC);
    expect(first.cells()[173 * 612 + 554]).toBe(Material.POLO);
    expect(first.cells()[73 * 612 + 232]).toBe(Material.ISZS);
    expect(first.cells()[154 * 612 + 253]).toBe(Material.VIBR);
    expect(first.cells()[166 * 612 + 398]).toBe(Material.CarbonDioxide);
  });

  it('freezes a separate deterministic candidate survey without mutating showcase v6', () => {
    const first = new RenderLabBackend(612, 384);
    const second = new RenderLabBackend(612, 384);
    applyMaterialCandidateSurveyScene(first);
    applyMaterialCandidateSurveyScene(second);

    expect(first.cells()).toEqual(second.cells());
    expect(first.walls()).toEqual(second.walls());
    expect(materialCandidateSurveyRequested('?scene=candidate-survey')).toBe(true);
    expect(materialCandidateSurveyRequested('?scene=showcase')).toBe(false);
    expect(materialShowcaseRequested('?scene=candidate-survey')).toBe(false);
    expect(MATERIAL_SHOWCASE_AUDIT.version).toBe(6);
    expect(MATERIAL_CANDIDATE_SURVEY_AUDIT.version).toBe(1);
    expect(MATERIAL_CANDIDATE_SURVEY_AUDIT.world).toEqual({ width: 612, height: 384 });

    const counts = new Uint32Array(256);
    for (const material of first.cells()) counts[material]++;
    const candidateMaterials = [
      Material.Nitro, Material.Snow, Material.BASE, Material.C4, Material.BGLA, Material.Quartz,
    ] as const;
    expect(MATERIAL_CANDIDATE_SURVEY_AUDIT.regions.map(({ material }) => material))
      .toEqual(candidateMaterials);
    expect(MATERIAL_CANDIDATE_SURVEY_AUDIT.semantic.materialCounts.map(({ material }) => (
      [material, counts[material]]
    ))).toEqual(MATERIAL_CANDIDATE_SURVEY_AUDIT.semantic.materialCounts.map(({ material, count }) => (
      [material, count]
    )));
    expect(first.cells().length - counts[Material.Empty])
      .toBe(MATERIAL_CANDIDATE_SURVEY_AUDIT.semantic.occupied);
    expect(semanticHash(first.cells())).toBe(MATERIAL_CANDIDATE_SURVEY_AUDIT.semantic.hash);

    for (const region of MATERIAL_CANDIDATE_SURVEY_AUDIT.regions) {
      let matching = 0;
      for (let y = region.y - region.radiusY; y < region.y + region.radiusY; y++) {
        for (let x = region.x - region.radiusX; x < region.x + region.radiusX; x++) {
          matching += Number(region.semanticMaterials.includes(first.cells()[y * 612 + x]));
        }
      }
      expect(matching, region.name).toBe(region.expectedMatching);
      expect(region.support).toMatchObject({
        kind: 'semantic', materials: [region.material], minimumRecall: 0.96,
      });
      const material = ALL_MATERIALS.find(({ id }) => id === region.material)!;
      expect(renderPhase(material)).toBe(region.phase === 'powder' ? RenderPhase.Powder : RenderPhase.Liquid);
    }

    for (const probe of MATERIAL_CANDIDATE_SURVEY_AUDIT.sharedContext.contactProbes) {
      expect(first.cells()[probe.y * 612 + probe.x]).toBe(probe.material);
      expect(first.cells()[(probe.y + (probe.y < 200 ? 1 : -1)) * 612 + probe.x])
        .toBe(MATERIAL_CANDIDATE_SURVEY_AUDIT.sharedContext.material);
    }
    for (const probe of MATERIAL_CANDIDATE_SURVEY_AUDIT.sharedContext.wallProbes) {
      expect(first.walls()[probe.y * 612 + probe.x]).not.toBe(0);
      expect(first.cells()[probe.y * 612 + probe.x])
        .toBe(MATERIAL_CANDIDATE_SURVEY_AUDIT.sharedContext.material);
    }

    expect(first.cells()[76 * 612 + 70]).toBe(Material.Empty);
    expect(first.cells()[90 * 612 + 252]).toBe(Material.Empty);
    expect(first.cells()[32 * 612 + 502]).toBe(Material.BASE);
    expect(first.cells()[268 * 612 + 70]).toBe(Material.Empty);
    expect(first.cells()[276 * 612 + 252]).toBe(Material.Empty);
    expect(first.cells()[350 * 612 + 502]).toBe(Material.Quartz);
  });

  it('routes the candidate survey through the deterministic RenderLab backend', () => {
    const main = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
    expect(main).toContain(
      'renderLabRequested() || materialShowcaseRequested() || materialCandidateSurveyRequested()',
    );
    expect(main).toContain(') && !nativeLab');
  });

  it('builds a deterministic atlas with representative material families', () => {
    const first = new RenderLabBackend(612, 384);
    const second = new RenderLabBackend(612, 384);
    applyRenderLabScene(first);
    applyRenderLabScene(second);
    expect(first.cells()).toEqual(second.cells());
    expect(first.walls()).toEqual(second.walls());
    expect(first.temperature()).toEqual(second.temperature());

    const counts = new Uint32Array(256);
    for (const material of first.cells()) counts[material]++;
    expect(counts[Material.Sand]).toBeGreaterThan(8_000);
    expect(counts[Material.Clay]).toBeGreaterThan(1_000);
    expect(counts[Material.Concrete]).toBeGreaterThan(900);
    expect(counts[Material.Water]).toBeGreaterThan(8_000);
    expect(counts[Material.Smoke]).toBeGreaterThan(1_000);
    expect(counts[Material.Oxygen]).toBeGreaterThan(700);
    expect(counts[Material.NobleGas]).toBeGreaterThan(400);
    expect(counts[Material.FOG]).toBeGreaterThan(500);
    expect(counts[Material.CFLM]).toBeGreaterThan(450);
    expect(counts[Material.Metal]).toBeGreaterThan(500);
    expect(counts[Material.PLUT]).toBeGreaterThan(500);
    expect(counts[Material.CONV]).toBeGreaterThan(500);
    expect(counts[Material.CLNE]).toBeGreaterThan(500);
    expect(counts[Material.PRTI]).toBeGreaterThan(500);
    expect(counts[Material.ACEL]).toBeGreaterThan(500);
    expect(counts[Material.Fire]).toBeGreaterThan(500);
    expect(counts[Material.ELEC]).toBeGreaterThan(500);
    expect(counts[Material.Plasma]).toBeGreaterThan(500);
    expect(counts[Material.PHOT]).toBeGreaterThan(500);
    expect(counts[Material.GRVT]).toBeGreaterThan(500);
    expect(counts[Material.LIFE_GOL]).toBeGreaterThan(500);
    expect(counts[Material.PCLN]).toBeGreaterThan(500);
    expect(counts[Material.DTEC]).toBeGreaterThan(500);
    expect(counts[Material.URAN]).toBeGreaterThan(500);
    expect(counts[Material.VIBR]).toBeGreaterThan(500);
    expect(first.cells()[149 * 612 + 18]).toBe(Material.Sand);
    expect(first.cells()[141 * 612 + 18]).toBe(Material.Empty);
    expect(first.cells()[141 * 612 + 170]).toBe(Material.Sand);
    expect(first.cells()[50 * 612 + 148]).toBe(Material.Clay);
    expect(first.cells()[80 * 612 + 163]).toBe(Material.Concrete);
    expect(first.cells()[120 * 612 + 148]).toBe(Material.Clay);
    expect(first.cells()[120 * 612 + 163]).toBe(Material.Concrete);
    expect(first.cells()[62 * 612 + 144]).toBe(Material.Empty);
    expect(first.cells()[73 * 612 + 159]).toBe(Material.Empty);
    expect(first.cells()[93 * 612 + 152]).toBe(Material.Empty);
    expect(first.cells()[110 * 612 + 167]).toBe(Material.Empty);
    expect(first.cells()[229 * 612 + 425]).toBe(Material.Fire);
    expect(first.cells()[229 * 612 + 545]).toBe(Material.ELEC);
    expect(first.cells()[229 * 612 + 431]).toBe(Material.Glass);
    expect(first.cells()[229 * 612 + 539]).toBe(Material.Ice);
    expect(first.cells()[229 * 612 + 405]).toBe(Material.Metal);
    expect(first.cells()[229 * 612 + 421]).toBe(Material.Empty);
    expect(first.cells()[254 * 612 + 445]).toBe(Material.Plant);
    expect(first.cells()[254 * 612 + 461]).toBe(Material.Empty);
    expect(first.cells()[304 * 612 + 485]).toBe(Material.DTEC);
    expect(first.cells()[304 * 612 + 501]).toBe(Material.Empty);
    expect(first.walls()[172 * 612 + 128]).not.toBe(0);
    expect(first.walls()[172 * 612 + 160]).not.toBe(0);
    expect(first.cells()[172 * 612 + 286]).toBe(Material.Water);
    expect(first.cells()[172 * 612 + 314]).toBe(Material.Oil);
    expect(first.walls()[172 * 612 + 286]).not.toBe(0);
    expect(first.walls()[172 * 612 + 314]).not.toBe(0);
    expect(first.cells()[230 * 612 + 339]).toBe(Material.Lava);
    expect(first.cells()[231 * 612 + 340]).toBe(Material.Empty);
    expect(first.walls()[230 * 612 + 339]).not.toBe(0);
    expect(first.walls()[231 * 612 + 340]).not.toBe(0);
    for (const [start, material] of [
      [382, Material.Smoke], [449, Material.FOG], [516, Material.CFLM],
    ] as const) {
      for (const offset of [0, 4, 8, 12, 16, 20, 36, 40, 44, 48, 52, 56]) {
        expect(first.cells()[145 * 612 + start + offset]).toBe(material);
      }
      for (const gapX of [start + 27, start + 28, start + 29]) {
        expect(first.cells()[145 * 612 + gapX]).toBe(Material.Empty);
      }
    }
    expect(first.walls()[229 * 612 + 405]).toBe(0);
    expect(first.walls()[229 * 612 + 445]).not.toBe(0);
    expect(first.walls()[229 * 612 + 525]).not.toBe(0);
    expect(first.walls()[172 * 612 + 128]).toBe(first.walls()[172 * 612 + 132]);
    expect(first.walls()[229 * 612 + 445]).toBe(first.walls()[229 * 612 + 525]);

    const thermalFixtures = [
      [30, Material.Metal, RENDER_LAB_COLD_TEMPERATURE],
      [70, Material.Metal, RENDER_LAB_AMBIENT_TEMPERATURE],
      [110, Material.Metal, RENDER_LAB_HOT_TEMPERATURE],
      [166, Material.Sand, RENDER_LAB_COLD_TEMPERATURE],
      [206, Material.Sand, RENDER_LAB_AMBIENT_TEMPERATURE],
      [246, Material.Sand, RENDER_LAB_HOT_TEMPERATURE],
    ] as const;
    for (const [x, material, temperature] of thermalFixtures) {
      expect(first.cells()[370 * 612 + x]).toBe(material);
      expect(first.temperature()[370 * 612 + x]).toBe(temperature);
    }
    expect(first.temperature()[229 * 612 + 445]).toBe(RENDER_LAB_HOT_TEMPERATURE);
    expect(first.temperature()[229 * 612 + 539]).toBe(RENDER_LAB_COLD_TEMPERATURE);
    expect(second.temperature()[229 * 612 + 445]).toBe(RENDER_LAB_HOT_TEMPERATURE);
    expect(second.temperature()[229 * 612 + 539]).toBe(RENDER_LAB_COLD_TEMPERATURE);
    expect(first.cells()[370 * 612 + 290]).toBe(Material.Glass);
    expect(first.cells()[370 * 612 + 330]).toBe(Material.Ice);
    expect(first.walls()[370 * 612 + 290]).toBe(0);
    expect(first.walls()[370 * 612 + 330]).toBe(0);
    expect(first.temperature()[370 * 612 + 290]).toBe(RENDER_LAB_AMBIENT_TEMPERATURE);
    expect(first.temperature()[370 * 612 + 330]).toBe(RENDER_LAB_AMBIENT_TEMPERATURE);

    for (const [leftX, rightX, leftMaterial, rightMaterial] of [
      [380, 408, Material.Water, Material.Metal],
      [460, 488, Material.Oil, Material.Glass],
      [540, 568, Material.Sand, Material.Water],
    ] as const) {
      expect(first.cells()[369 * 612 + leftX]).toBe(leftMaterial);
      expect(first.cells()[369 * 612 + rightX]).toBe(rightMaterial);
      expect(first.walls()[369 * 612 + leftX]).toBe(0);
      expect(first.walls()[369 * 612 + rightX]).toBe(0);
    }

    for (const [column, material] of RENDER_LAB_ENERGY_SAMPLES.entries()) {
      const left = 388 + column * 40;
      const top = 319;
      expect(first.cells()[(top + 10) * 612 + left + 17]).toBe(material);
      expect(first.cells()[top * 612 + left + 17]).toBe(material);
      expect(first.cells()[(top + 10) * 612 + left]).toBe(material);
      expect(first.cells()[top * 612 + left]).toBe(Material.Empty);
      expect(first.cells()[(top + 20) * 612 + left + 34]).toBe(Material.Empty);
    }
  });

  it('exercises every non-neutral styled family plus an energy phase', () => {
    expect(renderPhase(ALL_MATERIALS.find(({ id }) => id === Material.CFLM)!))
      .toBe(RenderPhase.Gas);
    const profiles = new Set(RENDER_LAB_STYLE_SAMPLES.map((id) => {
      const material = ALL_MATERIALS.find((candidate) => candidate.id === id)!;
      return renderProfile(material.category);
    }));
    expect(profiles).toEqual(new Set([
      RenderProfile.Neutral,
      RenderProfile.Granular,
      RenderProfile.Rigid,
      RenderProfile.Organic,
      RenderProfile.Radioactive,
      RenderProfile.Device,
      RenderProfile.Field,
    ]));
    expect(RENDER_LAB_ENERGY_SAMPLES).toHaveLength(5);
    for (const id of RENDER_LAB_ENERGY_SAMPLES) {
      const material = ALL_MATERIALS.find((candidate) => candidate.id === id)!;
      expect(renderPhase(material)).toBe(RenderPhase.Energy);
      expect(RENDER_LAB_STYLE_SAMPLES).toContain(id);
    }
    const optics = new Set(RENDER_LAB_STYLE_SAMPLES.map((id) => {
      const material = ALL_MATERIALS.find((candidate) => candidate.id === id)!;
      return renderOptics(material);
    }));
    for (const opticalClass of [
      RenderOptics.RoughGranular,
      RenderOptics.SmoothRigid,
      RenderOptics.Organic,
      RenderOptics.Device,
      RenderOptics.Radioactive,
      RenderOptics.TranslucentRigid,
    ]) expect(optics.has(opticalClass)).toBe(true);
    for (const trait of [
      RenderTrait.Emitter, RenderTrait.Sink, RenderTrait.Channel, RenderTrait.Force,
      RenderTrait.Radioactive, RenderTrait.Organic, RenderTrait.Fibrous, RenderTrait.Carrier,
    ]) {
      expect(RENDER_LAB_STYLE_SAMPLES.some((id) => {
        const material = ALL_MATERIALS.find((candidate) => candidate.id === id)!;
        return hasRenderTrait(renderTraits(material), trait);
      })).toBe(true);
    }
  });
});

function semanticHash(cells: Uint8Array): number {
  let hash = 2166136261;
  for (let index = 0; index < cells.length; index++) {
    hash = Math.imul(hash ^ cells[index] ^ index, 16777619) >>> 0;
  }
  return hash;
}
