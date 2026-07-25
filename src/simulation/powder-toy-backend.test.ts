import { describe, expect, it } from 'vitest';
import { MATERIALS, Material } from '../shared/materials';
import { PowderToyBackend } from './powder-toy-backend';
import { SimulationTool } from './simulation-tools';
import {
  DEUT_PRESENTATION_STATE, LAVA_PRESENTATION_STATE, POLO_PRESENTATION_STATE,
  PLNT_PRESENTATION_STATE, SEED_PRESENTATION_STATE, SPNG_PRESENTATION_STATE,
  SPRK_PRESENTATION_STATE, VIBR_PRESENTATION_STATE,
} from './types';
import { readFileSync } from 'node:fs';

const moduleArtifact = new URL('../../public/wasm/stillroom_core.js', import.meta.url);
const LIFE_FIRST_MATERIAL_ID = 171;
const LIFE_PRESET_COUNT = 24;

interface RawPowderModule {
  HEAPU8: Uint8Array;
  HEAPU16: Uint16Array;
  _powder_init(): number;
  _powder_cells(): number;
  _powder_temperature(): number;
  _powder_presentation_state(): number;
  _powder_pressure(): number;
  _powder_set(x: number, y: number, material: number): void;
  _powder_set_life(x: number, y: number, preset: number): number;
  _powder_set_configured_source(x: number, y: number, source: number, target: number): number;
  _powder_can_configure_source(source: number, target: number): number;
  _powder_source_target(x: number, y: number): number;
  _powder_apply_tool(tool: number, x: number, y: number, radius: number, deltaX: number, deltaY: number): number;
  _powder_step(): void;
  _powder_save(): number;
  _powder_save_size(): number;
  _powder_load_buffer(size: number): number;
  _powder_load_commit(): number;
}

describe('direct Powder Toy backend', () => {
  it('reserves a nonzero presentation bucket for the final native explosion tick', () => {
    const adapter = readFileSync(
      new URL('../../native/tpt/tpt_adapter.cpp', import.meta.url), 'utf8',
    );
    expect(adapter).toContain('auto const countdown = life > 0');
    expect(adapter).toContain('? std::max(1, (life * 255 + 375) / 750) : 0;');
    expect(adapter).toContain('std::clamp(part.life, 0, 0xFFFF)');
  });

  it('loads the pinned 612x384 engine and exposes rendering fields', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    expect([simulation.width, simulation.height]).toEqual([612, 384]);
    expect(simulation.name).toContain('direct WebAssembly');

    simulation.paint(300, 40, Material.Sand, 0);
    simulation.paint(302, 40, Material.Water, 0);
    for (let index = 0; index < 30; index++) simulation.step();

    const cells = simulation.cells();
    expect(cells.filter((value) => value !== Material.Empty)).toHaveLength(2);
    expect(simulation.temperature()).toHaveLength(612 * 384);
    const presentationState = simulation.presentationState();
    expect(presentationState).toHaveLength(612 * 384);
    expect(presentationState.byteLength).toBe(612 * 384 * Uint16Array.BYTES_PER_ELEMENT);
    expect(presentationState.every((value) => value === 0)).toBe(true);
    const photonState = simulation.photonState();
    expect(photonState).toHaveLength(612 * 384);
    expect(photonState.byteLength).toBe(612 * 384 * Uint16Array.BYTES_PER_ELEMENT);
    expect(photonState.every((value) => value === 0)).toBe(true);
    const pressure = simulation.pressure();
    expect(pressure).toHaveLength(612 * 384);
    expect(Array.from(pressure).every(Number.isFinite)).toBe(true);
    expect(simulation.velocity()).toHaveLength(612 * 384 * 2);
    expect(simulation.consumeDirtyCells().length).toBeGreaterThan(0);
    expect(simulation.walls()).toHaveLength(612 * 384);
    expect(simulation.consumeDirtyWalls()).toEqual([]);
    simulation.paintWall(340, 120, 8, 0);
    expect(simulation.walls()[120 * simulation.width + 340]).toBe(8);
    expect(simulation.cells()[120 * simulation.width + 340]).toBe(Material.Empty);
    const dirtyWalls = simulation.consumeDirtyWalls();
    expect(dirtyWalls).toHaveLength(16);
    expect(dirtyWalls.every(({ wall }) => wall === 8)).toBe(true);
  });

  it('keeps PHOT spectrum independent when a photons-map particle coexists with pmap matter', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    const point = { x: 306, y: 180 };
    const index = point.y * simulation.width + point.x;
    simulation.paint(point.x, point.y, Material.PHOT, 0);
    simulation.paint(point.x, point.y, Material.RSST, 0);

    // `cells()` runs the shared native extraction. pmap matter owns the primary
    // material projection, while the independent photon plane must still retain
    // PHOT's valid spectrum/presence bit at the exact same coordinate.
    expect(simulation.cells()[index]).toBe(Material.RSST);
    expect(simulation.presentationState()[index]).toBe(0);
    expect(simulation.photonState()[index] & 0x8000).toBe(0x8000);
  });

  it('extracts exact-owner VIBR charge and preserves it through the BVBR phase change', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    const point = { x: 306, y: 180 };
    const index = point.y * simulation.width + point.x;
    const stateAtPoint = (): number => {
      simulation.cells();
      return simulation.presentationState()[index];
    };

    simulation.paint(point.x, point.y, Material.VIBR, 0);
    expect(stateAtPoint()).toBe(0);

    // Sustained native pressure adds seven tmp units per update. Fifty updates
    // produce a visible upstream tmp/10 charge bucket without entering explosion.
    for (let step = 0; step < 50; step++) {
      for (let application = 0; application < 80; application++) {
        simulation.applySimulationTool(SimulationTool.Air, point.x, point.y, 0);
      }
      simulation.step();
    }
    const charged = stateAtPoint();
    expect(simulation.cells()[index]).toBe(Material.VIBR);
    expect(charged & VIBR_PRESENTATION_STATE.chargeMask).toBeGreaterThan(0);
    expect(charged & VIBR_PRESENTATION_STATE.countdownMask).toBe(0);
    expect(charged & VIBR_PRESENTATION_STATE.alternateModeMask).toBe(0);

    // VIBR + ANAR changes only the exact native owner; its stored energy remains.
    simulation.paint(point.x + 1, point.y, Material.ANAR, 0);
    simulation.step();
    const broken = stateAtPoint();
    expect(simulation.cells()[index]).toBe(Material.BVBR);
    expect(broken & VIBR_PRESENTATION_STATE.chargeMask)
      .toBeGreaterThanOrEqual(charged & VIBR_PRESENTATION_STATE.chargeMask);

    simulation.clear();
    expect(simulation.presentationState().every((value) => value === 0)).toBe(true);
  });

  it('projects native ACEL/DCEL activity and preserves active tmp through OPS1', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    const fixtures = [
      { material: Material.ACEL, active: { x: 180, y: 180 }, isolated: { x: 210, y: 180 } },
      { material: Material.DCEL, active: { x: 240, y: 180 }, isolated: { x: 270, y: 180 } },
    ] as const;
    const indexOf = (x: number, y: number): number => y * simulation.width + x;

    for (const fixture of fixtures) {
      const { x, y } = fixture.active;
      // A three-cell diamond shelf keeps the cardinal Sand neighbour in place;
      // the isolated same-owner control has no eligible cardinal neighbour.
      for (let supportX = x; supportX <= x + 2; supportX++) {
        simulation.paint(supportX, y + 1, Material.Wall, 0);
      }
      simulation.paint(x, y, fixture.material, 0);
      simulation.paint(x + 1, y, Material.Sand, 0);
      simulation.paint(fixture.isolated.x, fixture.isolated.y, fixture.material, 0);
    }

    let cells = simulation.cells();
    let state = simulation.presentationState();
    for (const fixture of fixtures) {
      expect(cells[indexOf(fixture.active.x, fixture.active.y)]).toBe(fixture.material);
      expect(cells[indexOf(fixture.isolated.x, fixture.isolated.y)]).toBe(fixture.material);
      expect(state[indexOf(fixture.active.x, fixture.active.y)]).toBe(0);
      expect(state[indexOf(fixture.isolated.x, fixture.isolated.y)]).toBe(0);
    }

    simulation.step();
    cells = simulation.cells();
    state = simulation.presentationState();
    for (const fixture of fixtures) {
      expect(cells[indexOf(fixture.active.x, fixture.active.y)]).toBe(fixture.material);
      expect(cells[indexOf(fixture.isolated.x, fixture.isolated.y)]).toBe(fixture.material);
      expect(state[indexOf(fixture.active.x, fixture.active.y)]).toBe(1);
      expect(state[indexOf(fixture.isolated.x, fixture.isolated.y)]).toBe(0);
    }

    const file = simulation.saveFile();
    expect(new TextDecoder().decode(file.slice(0, 4))).toBe('OPS1');
    const restored = await PowderToyBackend.load(moduleArtifact.href);
    restored.loadFile(file);
    cells = restored.cells();
    state = restored.presentationState();
    for (const fixture of fixtures) {
      const activeIndex = fixture.active.y * restored.width + fixture.active.x;
      const isolatedIndex = fixture.isolated.y * restored.width + fixture.isolated.x;
      expect(cells[activeIndex]).toBe(fixture.material);
      expect(cells[isolatedIndex]).toBe(fixture.material);
      expect(state[activeIndex]).toBe(1);
      expect(state[isolatedIndex]).toBe(0);
    }
  });

  it('projects native POLO lifecycle state and preserves its proton dose through OPS1', async () => {
    const point = { x: 306, y: 180 };
    const indexOf = (simulation: PowderToyBackend): number => (
      point.y * simulation.width + point.x
    );
    const owner = (simulation: PowderToyBackend): number => {
      const cells = simulation.cells();
      return cells[indexOf(simulation)];
    };
    const state = (simulation: PowderToyBackend): number => {
      simulation.cells();
      return simulation.presentationState()[indexOf(simulation)];
    };
    const protonDose = (word: number): number => (
      (word & POLO_PRESENTATION_STATE.protonDoseMask)
      >>> POLO_PRESENTATION_STATE.protonDoseShift
    );
    const advanceToDose = (
      simulation: PowderToyBackend, targetDose: number, maximumSteps = 512,
    ): number => {
      let previousDose = protonDose(state(simulation));
      for (let step = 0; step < maximumSteps; step++) {
        simulation.step();
        expect(owner(simulation)).toBe(Material.POLO);
        const word = state(simulation);
        const currentDose = protonDose(word);
        expect(currentDose).toBeGreaterThanOrEqual(previousDose);
        expect(currentDose).toBeLessThanOrEqual(previousDose + 1);
        if (currentDose === targetDose) return word;
        previousDose = currentDose;
      }
      throw new Error(`Native POLO did not accept proton dose ${targetDose}`);
    };
    const saveAndRestore = async (source: PowderToyBackend): Promise<PowderToyBackend> => {
      const file = source.saveFile();
      expect(new TextDecoder().decode(file.slice(0, 4))).toBe('OPS1');
      const restored = await PowderToyBackend.load(moduleArtifact.href);
      restored.loadFile(file);
      return restored;
    };

    const source = await PowderToyBackend.load(moduleArtifact.href);
    // Keep the powder owner at one exact world cell. Six ordinary configured
    // CLNE sources emit native PROT particles, which travel into the owner and
    // are consumed from TPT's independent photons map one accepted dose at a time.
    for (let x = point.x - 2; x <= point.x + 2; x++) {
      source.paint(x, point.y + 1, Material.Wall, 0);
    }
    for (const sourceX of [point.x - 6, point.x - 4, point.x - 2,
      point.x + 2, point.x + 4, point.x + 6]) {
      expect(source.paintConfiguredSource(
        sourceX, point.y, Material.CLNE, Material.PROT, 0,
      )).toBe(1);
    }
    source.paint(point.x, point.y, Material.POLO, 0);
    expect(owner(source)).toBe(Material.POLO);
    const initialState = state(source);
    expect(initialState).toBe(POLO_PRESENTATION_STATE.presentMask);
    expect(initialState & POLO_PRESENTATION_STATE.reservedMask).toBe(0);

    // Initial default POLO is already glowing upstream and must remain a
    // nonzero exact-owner state after an OPS round trip.
    let simulation = await saveAndRestore(source);
    expect(owner(simulation)).toBe(Material.POLO);
    expect(state(simulation)).toBe(initialState);

    let midDoseState = 0;
    for (let dose = 1; dose <= 5; dose++) {
      midDoseState = advanceToDose(simulation, dose);
    }
    expect(midDoseState & POLO_PRESENTATION_STATE.presentMask)
      .toBe(POLO_PRESENTATION_STATE.presentMask);

    simulation = await saveAndRestore(simulation);
    expect(owner(simulation)).toBe(Material.POLO);
    expect(state(simulation)).toBe(midDoseState);
    expect(protonDose(state(simulation))).toBe(5);

    for (let dose = 6; dose <= POLO_PRESENTATION_STATE.protonDoseMaximum; dose++) {
      advanceToDose(simulation, dose);
    }

    // Upstream checks the accumulated tmp2 dose before accepting a new proton,
    // so the first update after the tenth accepted dose performs POLO -> PLUT.
    simulation.step();
    expect(owner(simulation)).toBe(Material.PLUT);
    expect(state(simulation)).toBe(0);

    simulation.clear();
    simulation.paint(point.x, point.y, Material.Water, 0);
    expect(owner(simulation)).toBe(Material.Water);
    expect(state(simulation)).toBe(0);
  });

  it('projects native SPNG hydration and preserves absorbed water through OPS1', async () => {
    const point = { x: 306, y: 180 };
    const indexOf = (simulation: PowderToyBackend): number => (
      point.y * simulation.width + point.x
    );
    const owner = (simulation: PowderToyBackend): number => {
      const cells = simulation.cells();
      return cells[indexOf(simulation)];
    };
    const state = (simulation: PowderToyBackend): number => {
      simulation.cells();
      return simulation.presentationState()[indexOf(simulation)];
    };
    const hydration = (word: number): number => (
      word & SPNG_PRESENTATION_STATE.hydrationMask
    );

    const source = await PowderToyBackend.load(moduleArtifact.href);
    source.paint(point.x, point.y, Material.SPNG, 0);
    expect(owner(source)).toBe(Material.SPNG);
    expect(state(source)).toBe(SPNG_PRESENTATION_STATE.presentMask);

    // Surround the immobile owner with native water. At zero hydration the
    // upstream first absorption trial is certain (500/500), so this exercises
    // SPNG's real update rule rather than a test-only state setter.
    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      for (let offsetX = -1; offsetX <= 1; offsetX++) {
        if (offsetX || offsetY) {
          source.paint(point.x + offsetX, point.y + offsetY, Material.Water, 0);
        }
      }
    }
    source.step();
    const hydratedState = state(source);
    expect(owner(source)).toBe(Material.SPNG);
    expect(hydration(hydratedState)).toBeGreaterThan(0);
    expect(hydration(hydratedState)).toBeLessThanOrEqual(
      SPNG_PRESENTATION_STATE.hydrationMaximum,
    );
    expect(hydratedState & SPNG_PRESENTATION_STATE.presentMask)
      .toBe(SPNG_PRESENTATION_STATE.presentMask);
    expect(hydratedState & SPNG_PRESENTATION_STATE.reservedMask).toBe(0);

    const file = source.saveFile();
    expect(new TextDecoder().decode(file.slice(0, 4))).toBe('OPS1');
    const restored = await PowderToyBackend.load(moduleArtifact.href);
    restored.loadFile(file);
    expect(owner(restored)).toBe(Material.SPNG);
    expect(state(restored)).toBe(hydratedState);

    // With the reservoir preserved, heating above upstream's 374 K release
    // threshold expels real WATR into adjacent empty cells and lowers life.
    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      for (let offsetX = -1; offsetX <= 1; offsetX++) {
        if (offsetX || offsetY) restored.erase(point.x + offsetX, point.y + offsetY, 0);
      }
    }
    // Leave enough headroom for native heat conduction before SPNG's update.
    for (let application = 0; application < 60; application++) {
      restored.applySimulationTool(SimulationTool.Heat, point.x, point.y, 0);
    }
    restored.step();
    expect(owner(restored)).toBe(Material.SPNG);
    expect(hydration(state(restored))).toBeLessThan(hydration(hydratedState));
    expect(restored.cells()).toContain(Material.Water);

    restored.clear();
    restored.paint(point.x, point.y, Material.Water, 0);
    expect(owner(restored)).toBe(Material.Water);
    expect(state(restored)).toBe(0);
  });

  it('projects conductor-aware SPRK hosts through native countdown, OPS1, and restoration', async () => {
    const fixtures = [
      { material: Material.Metal, x: 120, y: 120 },
      { material: Material.PSCN, x: 180, y: 120 },
      { material: Material.NSCN, x: 240, y: 120 },
      { material: Material.GOLD, x: 300, y: 120 },
      { material: Material.IRON, x: 360, y: 120 },
      { material: Material.Water, x: 420, y: 120 },
    ] as const;
    const wrongOwner = { x: 280, y: 220 } as const;
    const emptyControl = { x: 332, y: 220 } as const;
    const indexOf = (
      simulation: PowderToyBackend, point: { x: number; y: number },
    ): number => point.y * simulation.width + point.x;
    const ownerAt = (
      simulation: PowderToyBackend, point: { x: number; y: number },
    ): number => simulation.cells()[indexOf(simulation, point)];
    const stateAt = (
      simulation: PowderToyBackend, point: { x: number; y: number },
    ): number => {
      simulation.cells();
      return simulation.presentationState()[indexOf(simulation, point)];
    };
    const encode = (host: Material, life: number): number => (
      SPRK_PRESENTATION_STATE.presentMask
      | (life << SPRK_PRESENTATION_STATE.lifeShift)
      | host
    );
    const enclose = (
      simulation: PowderToyBackend, point: { x: number; y: number },
    ): void => {
      // Zero-conduct native DMND keeps the WATR host at its authored cell after
      // restoration and prevents one fixture from conducting into another.
      for (let offsetY = -1; offsetY <= 1; offsetY++) {
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
          if (offsetX || offsetY) {
            simulation.paint(
              point.x + offsetX, point.y + offsetY, Material.Wall, 0,
            );
          }
        }
      }
    };

    const source = await PowderToyBackend.load(moduleArtifact.href);
    source.paint(wrongOwner.x, wrongOwner.y, Material.GOLD, 0);
    for (const fixture of fixtures) {
      enclose(source, fixture);
      source.paint(fixture.x, fixture.y, fixture.material, 0);
      expect(ownerAt(source, fixture)).toBe(fixture.material);
      expect(stateAt(source, fixture)).toBe(0);

      // SPRK is the official brush operation on an existing native conductor.
      // It retains that conductor in ctype and starts the common four-tick life.
      source.paint(fixture.x, fixture.y, Material.SPRK, 0);
      expect(ownerAt(source, fixture)).toBe(Material.SPRK);
      expect(stateAt(source, fixture)).toBe(encode(fixture.material, 4));
    }
    expect(stateAt(source, wrongOwner)).toBe(0);
    expect(ownerAt(source, emptyControl)).toBe(Material.Empty);
    expect(stateAt(source, emptyControl)).toBe(0);

    // BeforeSim performs the native PROP_LIFE_DEC decrement; ExtractFields
    // reports that authoritative countdown without advancing or mirroring it.
    source.step();
    for (const fixture of fixtures) {
      expect(ownerAt(source, fixture)).toBe(Material.SPRK);
      const checkpoint = stateAt(source, fixture);
      expect(checkpoint).toBe(encode(fixture.material, 3));
      expect(checkpoint & SPRK_PRESENTATION_STATE.hostMask).toBe(fixture.material);
      expect(
        (checkpoint & SPRK_PRESENTATION_STATE.lifeMask)
        >>> SPRK_PRESENTATION_STATE.lifeShift,
      ).toBe(3);
      expect(checkpoint & SPRK_PRESENTATION_STATE.presentMask)
        .toBe(SPRK_PRESENTATION_STATE.presentMask);
    }

    const file = source.saveFile();
    expect(new TextDecoder().decode(file.slice(0, 4))).toBe('OPS1');
    const restored = await PowderToyBackend.load(moduleArtifact.href);
    restored.loadFile(file);
    for (const fixture of fixtures) {
      expect(ownerAt(restored, fixture)).toBe(Material.SPRK);
      expect(stateAt(restored, fixture)).toBe(encode(fixture.material, 3));
    }
    expect(stateAt(restored, wrongOwner)).toBe(0);
    expect(stateAt(restored, emptyControl)).toBe(0);

    restored.step();
    for (const fixture of fixtures) {
      expect(stateAt(restored, fixture)).toBe(encode(fixture.material, 2));
    }
    restored.step();
    for (const fixture of fixtures) {
      expect(stateAt(restored, fixture)).toBe(encode(fixture.material, 1));
    }
    restored.step();
    for (const fixture of fixtures) {
      // SPRK's official update restores ctype as the exact native material.
      expect(ownerAt(restored, fixture)).toBe(fixture.material);
      expect(stateAt(restored, fixture)).toBe(0);
    }

    // A free SPRK brush is rejected upstream, so no owner marker can leak into
    // empty space or a non-SPRK material in this owner-multiplexed plane.
    restored.paint(emptyControl.x, emptyControl.y, Material.SPRK, 0);
    expect(ownerAt(restored, emptyControl)).toBe(Material.Empty);
    expect(stateAt(restored, emptyControl)).toBe(0);
  });

  it('projects exact typed-Lava ancestry through native melting, OPS1, and cooling', async () => {
    const fixtures = [
      { material: Material.QRTZ, threshold: 2573.15, x: 180, y: 150 },
      { material: Material.Metal, threshold: 1273, x: 220, y: 150 },
      { material: Material.IRON, threshold: 1687, x: 260, y: 150 },
      { material: Material.Salt, threshold: 1173, x: 300, y: 150 },
      { material: Material.NSCN, threshold: 1687, x: 340, y: 150 },
      { material: Material.POLO, threshold: 526.95, x: 380, y: 150 },
    ] as const;
    const generic = { x: 420, y: 150 } as const;
    const indexOf = (simulation: PowderToyBackend, x: number, y: number): number => (
      y * simulation.width + x
    );
    const enclose = (simulation: PowderToyBackend, x: number, y: number): void => {
      // Native INSL has zero heat conduct and blocks the liquid owner without
      // diluting its test temperature or inventing a test-only particle setter.
      for (let offsetY = -1; offsetY <= 1; offsetY++) {
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
          if (offsetX || offsetY) {
            simulation.paint(x + offsetX, y + offsetY, Material.INSL, 0);
          }
        }
      }
    };
    const stateAt = (simulation: PowderToyBackend, x: number, y: number): number => {
      simulation.cells();
      return simulation.presentationState()[indexOf(simulation, x, y)];
    };

    const source = await PowderToyBackend.load(moduleArtifact.href);
    for (const fixture of fixtures) {
      enclose(source, fixture.x, fixture.y);
      source.paint(fixture.x, fixture.y, fixture.material, 0);
      expect(stateAt(source, fixture.x, fixture.y)).toBe(
        fixture.material === Material.POLO ? POLO_PRESENTATION_STATE.presentMask : 0,
      );
      const initialKelvin = source.temperature()[indexOf(source, fixture.x, fixture.y)] / 10;
      const heatApplications = Math.ceil((fixture.threshold + 4 - initialKelvin) / 2);
      for (let application = 0; application < heatApplications; application++) {
        source.applySimulationTool(SimulationTool.Heat, fixture.x, fixture.y, 0);
      }
    }
    enclose(source, generic.x, generic.y);
    source.paint(generic.x, generic.y, Material.Lava, 0);
    expect(stateAt(source, generic.x, generic.y)).toBe(
      LAVA_PRESENTATION_STATE.presentMask,
    );

    // TPT evaluates temperature transitions on the element's native heat-
    // conduct probability. Advance boundedly until even low-conduct QRTZ has
    // taken its authentic transition path.
    let cells = source.cells();
    for (let step = 0; step < 2048
      && fixtures.some((fixture) => (
        cells[indexOf(source, fixture.x, fixture.y)] !== Material.Lava
      )); step++) {
      source.step();
      cells = source.cells();
    }
    let state = source.presentationState();
    for (const fixture of fixtures) {
      const index = indexOf(source, fixture.x, fixture.y);
      expect(cells[index]).toBe(Material.Lava);
      expect(state[index]).toBe(
        LAVA_PRESENTATION_STATE.presentMask | fixture.material,
      );
      expect(state[index] & LAVA_PRESENTATION_STATE.originMask).toBe(fixture.material);
      expect(state[index] & LAVA_PRESENTATION_STATE.reservedMask).toBe(0);
    }
    expect(cells[indexOf(source, generic.x, generic.y)]).toBe(Material.Lava);
    expect(state[indexOf(source, generic.x, generic.y)]).toBe(
      LAVA_PRESENTATION_STATE.presentMask,
    );

    const file = source.saveFile();
    expect(new TextDecoder().decode(file.slice(0, 4))).toBe('OPS1');
    const restored = await PowderToyBackend.load(moduleArtifact.href);
    restored.loadFile(file);
    cells = restored.cells();
    state = restored.presentationState();
    for (const fixture of fixtures) {
      const index = indexOf(restored, fixture.x, fixture.y);
      expect(cells[index]).toBe(Material.Lava);
      expect(state[index]).toBe(
        LAVA_PRESENTATION_STATE.presentMask | fixture.material,
      );
      // Cool the native molten owner below its own upstream transition point.
      for (let application = 0; application < 40; application++) {
        restored.applySimulationTool(SimulationTool.Cool, fixture.x, fixture.y, 0);
      }
    }
    cells = restored.cells();
    for (let step = 0; step < 512
      && fixtures.some((fixture) => (
        cells[indexOf(restored, fixture.x, fixture.y)] !== fixture.material
      )); step++) {
      restored.step();
      cells = restored.cells();
    }
    state = restored.presentationState();
    for (const fixture of fixtures) {
      const index = indexOf(restored, fixture.x, fixture.y);
      expect(cells[index]).toBe(fixture.material);
      expect(state[index]).toBe(
        fixture.material === Material.POLO ? POLO_PRESENTATION_STATE.presentMask : 0,
      );
    }
    expect(cells[indexOf(restored, generic.x, generic.y)]).toBe(Material.Lava);
    expect(state[indexOf(restored, generic.x, generic.y)]).toBe(
      LAVA_PRESENTATION_STATE.presentMask,
    );

    restored.clear();
    restored.paint(generic.x, generic.y, Material.Water, 0);
    expect(stateAt(restored, generic.x, generic.y)).toBe(0);
  });

  it('projects native SEED hydration/germination and PLNT inherited growth state through OPS1', async () => {
    const canonical = { x: 210, y: 180 } as const;
    const noWater = { x: 290, y: 180 } as const;
    const noSoil = { x: 370, y: 180 } as const;
    const badTemperature = { x: 450, y: 180 } as const;
    const indexOf = (simulation: PowderToyBackend, point: { x: number; y: number }): number => (
      point.y * simulation.width + point.x
    );
    const ownerAt = (
      simulation: PowderToyBackend, point: { x: number; y: number },
    ): number => simulation.cells()[indexOf(simulation, point)];
    const stateAt = (
      simulation: PowderToyBackend, point: { x: number; y: number },
    ): number => {
      simulation.cells();
      return simulation.presentationState()[indexOf(simulation, point)];
    };
    const seedWater = (word: number): number => word & SEED_PRESENTATION_STATE.waterMask;
    const seedGermination = (word: number): number => (
      (word & SEED_PRESENTATION_STATE.germinationMask)
      >>> SEED_PRESENTATION_STATE.germinationShift
    );
    const placeSeed = (
      simulation: PowderToyBackend,
      point: { x: number; y: number },
      support: Material.Sand | Material.Wall,
      withWater: boolean,
    ): void => {
      // A three-cell substrate prevents the powder seed from slipping around
      // its required direct support. The wider non-falling DMND shelf keeps
      // native SAND from escaping diagonally during the 200-tick timer.
      for (let offsetX = -2; offsetX <= 2; offsetX++) {
        simulation.paint(point.x + offsetX, point.y + 2, Material.Wall, 0);
      }
      for (let offsetX = -1; offsetX <= 1; offsetX++) {
        simulation.paint(point.x + offsetX, point.y + 1, support, 0);
      }
      simulation.paint(point.x, point.y, Material.SEED, 0);
      if (!withWater) return;
      // The seed has a lower native particle ID than its surrounding fluid, so
      // its authentic update drinks the still-adjacent WATR before it can fall.
      for (let offsetY = -1; offsetY <= 1; offsetY++) {
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
          if ((offsetX || offsetY) && offsetY !== 1) {
            simulation.paint(point.x + offsetX, point.y + offsetY, Material.Water, 0);
          }
        }
      }
    };

    const source = await PowderToyBackend.load(moduleArtifact.href);
    placeSeed(source, canonical, Material.Sand, true);
    placeSeed(source, noWater, Material.Sand, false);
    placeSeed(source, noSoil, Material.Wall, true);
    placeSeed(source, badTemperature, Material.Sand, true);
    for (const point of [canonical, noWater, noSoil, badTemperature]) {
      expect(ownerAt(source, point)).toBe(Material.SEED);
      expect(stateAt(source, point)).toBe(0);
    }

    // One real update consumes five neighbouring WATR particles. Germination
    // starts only on a later update, after the upward cell has become empty.
    source.step();
    expect(seedWater(stateAt(source, canonical))).toBe(5);
    expect(seedGermination(stateAt(source, canonical))).toBe(0);
    expect(stateAt(source, noWater)).toBe(0);
    expect(seedWater(stateAt(source, noSoil))).toBe(5);
    expect(seedGermination(stateAt(source, noSoil))).toBe(0);
    expect(seedWater(stateAt(source, badTemperature))).toBe(5);

    // Upstream clears both water and the germination timer outside its supported
    // 278.15–343.15 K window, without changing an otherwise safe SEED owner.
    // Replace the consumed-fluid ring and its support with native zero-conduct
    // INSL so BeforeSim cannot immediately dissipate the deliberately bad
    // temperature into an eight-cell neighbourhood.
    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      for (let offsetX = -1; offsetX <= 1; offsetX++) {
        if (offsetX || offsetY) {
          source.erase(badTemperature.x + offsetX, badTemperature.y + offsetY, 0);
          source.paint(
            badTemperature.x + offsetX, badTemperature.y + offsetY, Material.INSL, 0,
          );
        }
      }
    }
    // The larger margin survives native heat conduction into the neighbouring
    // support during BeforeSim while staying far below SEED's FIRE transition.
    for (let application = 0; application < 80; application++) {
      source.applySimulationTool(
        SimulationTool.Heat, badTemperature.x, badTemperature.y, 0,
      );
    }
    source.cells();
    expect(source.temperature()[indexOf(source, badTemperature)] / 10).toBeGreaterThan(343.15);
    expect(source.temperature()[indexOf(source, badTemperature)] / 10).toBeLessThan(673.15);
    source.step();
    expect(ownerAt(source, badTemperature)).toBe(Material.SEED);
    expect(stateAt(source, badTemperature)).toBe(0);

    for (let step = 0; step < 48; step++) source.step();
    const seedCheckpoint = stateAt(source, canonical);
    expect(ownerAt(source, canonical)).toBe(Material.SEED);
    expect(seedWater(seedCheckpoint)).toBe(5);
    expect(seedGermination(seedCheckpoint)).toBeGreaterThan(0);
    expect(seedGermination(seedCheckpoint)).toBeLessThanOrEqual(
      SEED_PRESENTATION_STATE.germinationMaximum,
    );
    expect(stateAt(source, noWater)).toBe(0);
    expect(seedWater(stateAt(source, noSoil))).toBe(5);
    expect(seedGermination(stateAt(source, noSoil))).toBe(0);

    const seedFile = source.saveFile();
    expect(new TextDecoder().decode(seedFile.slice(0, 4))).toBe('OPS1');
    let restored = await PowderToyBackend.load(moduleArtifact.href);
    restored.loadFile(seedFile);
    expect(ownerAt(restored, canonical)).toBe(Material.SEED);
    expect(stateAt(restored, canonical)).toBe(seedCheckpoint);
    expect(stateAt(restored, noWater)).toBe(0);
    expect(stateAt(restored, noSoil)).toBe(stateAt(source, noSoil));
    expect(stateAt(restored, badTemperature)).toBe(0);

    // Continue only through the official update loop until supported hydrated
    // SEED changes into the first active tree-growth PLNT particle.
    for (let step = 0; step < 256
      && ownerAt(restored, canonical) === Material.SEED; step++) {
      restored.step();
    }
    expect(ownerAt(restored, canonical)).toBe(Material.Plant);
    const plantCheckpoint = stateAt(restored, canonical);
    expect(plantCheckpoint & PLNT_PRESENTATION_STATE.presentMask)
      .toBe(PLNT_PRESENTATION_STATE.presentMask);
    expect(plantCheckpoint & PLNT_PRESENTATION_STATE.treeMask)
      .toBe(PLNT_PRESENTATION_STATE.treeMask);
    expect(plantCheckpoint & PLNT_PRESENTATION_STATE.phaseMask).toBe(0);
    expect(
      (plantCheckpoint & PLNT_PRESENTATION_STATE.directionMask)
      >>> PLNT_PRESENTATION_STATE.directionShift,
    ).toBe(0);
    expect(
      (plantCheckpoint & PLNT_PRESENTATION_STATE.inheritedColourMask)
      >>> PLNT_PRESENTATION_STATE.inheritedColourShift,
    ).toBe(0b111011);
    expect(
      (plantCheckpoint & PLNT_PRESENTATION_STATE.hydrationClassMask)
      >>> PLNT_PRESENTATION_STATE.hydrationClassShift,
    ).toBe(2);
    expect(plantCheckpoint & PLNT_PRESENTATION_STATE.activeGrowthMask)
      .toBe(PLNT_PRESENTATION_STATE.activeGrowthMask);

    // The no-water, no-soil, and bad-temperature controls never germinate.
    for (const point of [noWater, noSoil, badTemperature]) {
      expect(ownerAt(restored, point)).toBe(Material.SEED);
    }
    expect(stateAt(restored, noWater)).toBe(0);
    expect(seedGermination(stateAt(restored, noSoil))).toBe(0);
    expect(stateAt(restored, badTemperature)).toBe(0);

    const plantFile = restored.saveFile();
    restored = await PowderToyBackend.load(moduleArtifact.href);
    restored.loadFile(plantFile);
    expect(ownerAt(restored, canonical)).toBe(Material.Plant);
    expect(stateAt(restored, canonical)).toBe(plantCheckpoint);

    restored.clear();
    restored.paint(canonical.x, canonical.y, Material.Water, 0);
    expect(stateAt(restored, canonical)).toBe(0);

    // SEED's separate upstream wax path is probabilistic but deterministic for
    // this pinned RNG seed. A radius-eight Air brush raises the whole local air
    // stencil above 50 without a private pressure setter, while an INSL ring
    // retains a safe 320–343.15 K particle temperature.
    const waxSource = await PowderToyBackend.load(moduleArtifact.href);
    const waxPoint = { x: 306, y: 180 } as const;
    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      for (let offsetX = -1; offsetX <= 1; offsetX++) {
        if (offsetX || offsetY) {
          waxSource.paint(waxPoint.x + offsetX, waxPoint.y + offsetY, Material.INSL, 0);
        }
      }
    }
    waxSource.paint(waxPoint.x, waxPoint.y, Material.SEED, 0);
    for (let application = 0; application < 16; application++) {
      waxSource.applySimulationTool(SimulationTool.Heat, waxPoint.x, waxPoint.y, 0);
    }
    waxSource.cells();
    expect(waxSource.temperature()[indexOf(waxSource, waxPoint)] / 10).toBeGreaterThan(320);
    expect(waxSource.temperature()[indexOf(waxSource, waxPoint)] / 10).toBeLessThan(343.15);
    for (let step = 0; step < 512
      && ownerAt(waxSource, waxPoint) === Material.SEED; step++) {
      for (let application = 0; application < 80; application++) {
        waxSource.applySimulationTool(SimulationTool.Air, waxPoint.x, waxPoint.y, 8);
      }
      waxSource.step();
    }
    expect(ownerAt(waxSource, waxPoint)).toBe(Material.MWAX);
    expect(stateAt(waxSource, waxPoint)).toBe(0);
  });

  it('extracts the native VIBR explosion countdown and alternate mode flags', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    const point = { x: 306, y: 180 };
    const index = point.y * simulation.width + point.x;

    simulation.paint(point.x, point.y, Material.VIBR, 0);
    for (let step = 0; step < 144; step++) {
      for (let application = 0; application < 80; application++) {
        simulation.applySimulationTool(SimulationTool.Air, point.x, point.y, 0);
      }
      simulation.step();
    }
    simulation.cells();
    let state = simulation.presentationState()[index];
    expect(state & VIBR_PRESENTATION_STATE.chargeMask).toBe(100);
    expect((state & VIBR_PRESENTATION_STATE.countdownMask)
      >> VIBR_PRESENTATION_STATE.countdownShift).toBe(255);
    expect(state & VIBR_PRESENTATION_STATE.alternateModeMask).toBe(0);

    // An exploding VIBR touching CFLM enters upstream's alternate explosion mode.
    simulation.paint(point.x + 1, point.y, Material.CFLM, 0);
    simulation.step();
    simulation.cells();
    state = simulation.presentationState()[index];
    expect(state & VIBR_PRESENTATION_STATE.countdownMask).toBeGreaterThan(0);
    expect(state & VIBR_PRESENTATION_STATE.alternateModeMask)
      .toBe(VIBR_PRESENTATION_STATE.alternateModeMask);
  });

  it('extracts exact native DEUT concentration and follows native coalescing', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    const point = { x: 306, y: 180 };
    const index = point.y * simulation.width + point.x;
    const stateAtPoint = (): number => {
      simulation.cells();
      return simulation.presentationState()[index];
    };

    simulation.paint(point.x, point.y, Material.DEUT, 0);
    expect(simulation.cells()[index]).toBe(Material.DEUT);
    expect(stateAtPoint()).toBe(DEUT_PRESENTATION_STATE.defaultConcentration);

    // Adjacent native DEUT owners absorb one another into their stored life.
    // This exercises the upstream concentration rules without a test-only ABI.
    for (let y = point.y - 2; y <= point.y + 2; y++) {
      for (let x = point.x - 2; x <= point.x + 2; x++) {
        simulation.paint(x, y, Material.DEUT, 0);
      }
    }
    simulation.step();
    simulation.step();
    const cells = simulation.cells();
    const states = simulation.presentationState();
    let concentration = 0;
    for (let ownerIndex = 0; ownerIndex < cells.length; ownerIndex++) {
      if (cells[ownerIndex] === Material.DEUT) {
        concentration = Math.max(concentration, states[ownerIndex]);
      }
    }
    expect(concentration).toBeGreaterThan(DEUT_PRESENTATION_STATE.defaultConcentration);
    expect(concentration).toBeLessThanOrEqual(DEUT_PRESENTATION_STATE.maximumConcentration);

    const saved = simulation.saveFile();
    const restored = await PowderToyBackend.load(moduleArtifact.href);
    restored.loadFile(saved);
    const restoredCells = restored.cells();
    const restoredStates = restored.presentationState();
    let restoredConcentration = 0;
    for (let ownerIndex = 0; ownerIndex < restoredCells.length; ownerIndex++) {
      if (restoredCells[ownerIndex] === Material.DEUT) {
        restoredConcentration = Math.max(restoredConcentration, restoredStates[ownerIndex]);
      }
    }
    expect(restoredConcentration).toBe(concentration);

    simulation.clear();
    simulation.paint(point.x, point.y, Material.Water, 0);
    expect(stateAtPoint()).toBe(0);
  });

  it('projects every generic native material as its stable frontend ID', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    const materials = MATERIALS.map(({ id }) => id);
    const point = (index: number) => ({ x: 24 + (index % 32) * 18, y: 24 + Math.floor(index / 32) * 28 });
    materials.forEach((material, index) => {
      const { x, y } = point(index);
      // SPRK is a brush operation on an existing conductor, not a free particle.
      if (material === Material.SPRK) simulation.paint(x, y, Material.Metal, 0);
      simulation.paint(x, y, material, 0);
    });
    const cells = simulation.cells();
    materials.forEach((material, index) => {
      const { x, y } = point(index);
      expect(cells[y * simulation.width + x]).toBe(material);
    });
  });

  it('keeps Coal and broken-coal particles distinct through native OPS bytes', async () => {
    const source = await PowderToyBackend.load(moduleArtifact.href);
    source.paint(280, 150, Material.Coal, 0);
    source.paint(300, 150, Material.BCOL, 0);
    expect(source.cells()[150 * source.width + 280]).toBe(Material.Coal);
    expect(source.cells()[150 * source.width + 300]).toBe(Material.BCOL);

    const restored = await PowderToyBackend.load(moduleArtifact.href);
    restored.loadFile(source.saveFile());
    expect(restored.cells()[150 * restored.width + 280]).toBe(Material.Coal);
    expect(restored.cells()[150 * restored.width + 300]).toBe(Material.BCOL);
  });

  it('projects native reaction-only phase products', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    simulation.paint(272, 190, Material.Water, 15);
    simulation.paint(304, 190, Material.Lava, 15);
    for (let index = 0; index < 180; index++) simulation.step();

    const cells = simulation.cells();
    expect(cells).toContain(Material.Steam);
  }, 15000);

  it('exposes changing native air pressure', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    for (let y = 170; y < 190; y++) simulation.paint(305, y, Material.C4, 10);
    for (let y = 170; y < 190; y++) simulation.paint(289, y, Material.Fire, 0);
    for (let index = 0; index < 90; index++) simulation.step();
    simulation.cells();
    let peakPressure = 0;
    for (const pressure of simulation.pressure()) peakPressure = Math.max(peakPressure, Math.abs(pressure));
    expect(peakPressure).toBeGreaterThan(0.01);
  });

  it('applies native pressure, thermal, and vector wind tools', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    const center = { x: 306, y: 180 };
    simulation.paint(center.x, center.y, Material.Wall, 0);
    simulation.cells();
    const centerIndex = center.y * simulation.width + center.x;
    const initialTemperature = simulation.temperature()[centerIndex];

    simulation.applySimulationTool(SimulationTool.Heat, center.x, center.y, 0);
    simulation.cells();
    expect(simulation.temperature()[centerIndex]).toBe(initialTemperature + 20);
    simulation.applySimulationTool(SimulationTool.Cool, center.x, center.y, 0);
    simulation.cells();
    expect(simulation.temperature()[centerIndex]).toBe(initialTemperature);

    const initialPressure = simulation.pressure()[centerIndex];
    simulation.applySimulationTool(SimulationTool.Air, center.x, center.y, 0);
    simulation.cells();
    expect(simulation.pressure()[centerIndex]).toBeCloseTo(initialPressure + 0.05, 5);
    simulation.applySimulationTool(SimulationTool.Vacuum, center.x, center.y, 0);
    simulation.cells();
    expect(simulation.pressure()[centerIndex]).toBeCloseTo(initialPressure, 5);

    simulation.clear();
    const control = await PowderToyBackend.load(moduleArtifact.href);
    for (const target of [simulation, control]) target.paint(center.x, center.y, Material.Dust, 4);
    simulation.applySimulationTool(SimulationTool.Wind, center.x, center.y, 10, 28, 0);
    for (let step = 0; step < 12; step++) { simulation.step(); control.step(); }
    const centroidX = (backend: PowderToyBackend): number => {
      const cells = backend.cells();
      let total = 0;
      let count = 0;
      for (let index = 0; index < cells.length; index++) {
        if (cells[index] !== Material.Dust) continue;
        total += index % backend.width;
        count++;
      }
      return total / Math.max(1, count);
    };
    expect(centroidX(simulation)).toBeGreaterThan(centroidX(control) + 1);
  });

  it('passes Wind through native air-wall blocking before particle advection', async () => {
    const openWind = await PowderToyBackend.load(moduleArtifact.href);
    const blockedWind = await PowderToyBackend.load(moduleArtifact.href);
    const blockedControl = await PowderToyBackend.load(moduleArtifact.href);
    const point = { x: 304, y: 180 };
    for (const target of [blockedWind, blockedControl]) target.paintWall(point.x, point.y, 16, 0);
    for (const target of [openWind, blockedWind, blockedControl]) target.paint(point.x, point.y, Material.Dust, 0);
    openWind.applySimulationTool(SimulationTool.Wind, point.x, point.y, 0, 400, 0);
    blockedWind.applySimulationTool(SimulationTool.Wind, point.x, point.y, 0, 400, 0);
    for (const target of [openWind, blockedWind, blockedControl]) target.step();

    const dustVelocityX = (backend: PowderToyBackend): number => {
      const cells = backend.cells();
      const velocities = backend.velocity();
      let total = 0;
      for (let index = 0; index < cells.length; index++) {
        if (cells[index] !== Material.Dust) continue;
        total += velocities[index * 2];
      }
      return total;
    };
    expect(dustVelocityX(openWind)).toBeGreaterThan(dustVelocityX(blockedWind) + 5);
    expect(dustVelocityX(blockedWind)).toBe(dustVelocityX(blockedControl));
  });

  it('does not reactivate unrelated residual air when a Wind gesture starts', async () => {
    const wind = await PowderToyBackend.load(moduleArtifact.href);
    const control = await PowderToyBackend.load(moduleArtifact.href);
    for (const target of [wind, control]) {
      for (let x = 30; x < target.width - 30; x += 2) target.paint(x, 220, Material.Wall, 1);
      target.paint(Math.floor(target.width / 2), 155, Material.Water, 12);
      for (let step = 0; step < 180; step++) target.step();
      target.paint(210, 90, Material.Dust, 12);
      for (let step = 0; step < 25; step++) target.step();
    }

    // AIR_VELOCITYOFF leaves particle-authored coarse vx/vy behind after a
    // frame. Starting Wind far away must not globally reactivate that residue.
    wind.applySimulationTool(SimulationTool.Wind, 560, 40, 0, 400, 0);
    wind.step();
    control.step();

    const windCells = wind.cells();
    const controlCells = control.cells();
    const windVelocity = wind.velocity();
    const controlVelocity = control.velocity();
    let cellDifferences = 0;
    let particleVelocityDifference = 0;
    let waterVelocityDifference = 0;
    for (let index = 0; index < windCells.length; index++) {
      if (windCells[index] !== controlCells[index]) cellDifferences++;
      const xDifference = Math.abs(windVelocity[index * 2] - controlVelocity[index * 2]);
      const yDifference = Math.abs(windVelocity[index * 2 + 1] - controlVelocity[index * 2 + 1]);
      particleVelocityDifference += xDifference + yDifference;
      if (windCells[index] === Material.Water || controlCells[index] === Material.Water) {
        waterVelocityDifference += xDifference + yDifference;
      }
    }
    expect(cellDifferences).toBe(0);
    expect(waterVelocityDifference).toBe(0);
    expect(particleVelocityDifference).toBeLessThanOrEqual(16);
  }, 15000);

  it('preserves an unstepped Wind vector through a native OPS round trip', async () => {
    const source = await PowderToyBackend.load(moduleArtifact.href);
    const point = { x: 304, y: 180 };
    source.paint(point.x, point.y, Material.Dust, 0);
    source.applySimulationTool(SimulationTool.Wind, point.x, point.y, 0, 400, 0);
    const file = source.saveFile();

    const restored = await PowderToyBackend.load(moduleArtifact.href);
    // Reload both sides so OPS velocity quantization is part of the comparison.
    source.loadFile(file);
    restored.loadFile(file);
    source.step();
    restored.step();

    expect(restored.cells()).toEqual(source.cells());
    expect(restored.pressure()).toEqual(source.pressure());
    expect(restored.velocity()).toEqual(source.velocity());
    const cells = restored.cells();
    const velocities = restored.velocity();
    const dustVelocity = Array.from(cells).reduce((total, material, index) => (
      material === Material.Dust ? total + velocities[index * 2] : total
    ), 0);
    expect(dustVelocity).toBeGreaterThan(5);
  }, 15000);

  it('rejects invalid native tool requests without contaminating the air field', async () => {
    const imported = await import(moduleArtifact.href) as { default: () => Promise<RawPowderModule> };
    const module = await imported.default();
    expect(module._powder_init()).toBe(1);
    const center = { x: 306, y: 180 };
    const centerIndex = center.y * 612 + center.x;
    const pressure = (): Float32Array => {
      module._powder_cells();
      return new Float32Array(module.HEAPU8.buffer, module._powder_pressure(), 612 * 384);
    };
    const before = pressure()[centerIndex];

    expect(module._powder_apply_tool(99, center.x, center.y, 0, 0, 0)).toBe(-1);
    expect(module._powder_apply_tool(SimulationTool.Air, -1, center.y, 0, 0, 0)).toBe(-1);
    expect(module._powder_apply_tool(SimulationTool.Air, center.x, center.y, 65, 0, 0)).toBe(-1);
    expect(module._powder_apply_tool(SimulationTool.Wind, center.x, center.y, 0, 613, 0)).toBe(-1);
    expect(module._powder_apply_tool(SimulationTool.Wind, center.x, center.y, 0, Number.NaN, Infinity)).toBe(0);

    const after = pressure();
    expect(after[centerIndex]).toBe(before);
    expect(Array.from(after).every(Number.isFinite)).toBe(true);
  });

  it('configures only whitelisted native sources and preserves rejected cells atomically', async () => {
    const imported = await import(moduleArtifact.href) as { default: () => Promise<RawPowderModule> };
    const module = await imported.default();
    expect(module._powder_init()).toBe(1);
    const cells = (): Uint8Array => new Uint8Array(
      module.HEAPU8.buffer, module._powder_cells(), 612 * 384,
    );
    const presentationState = (): Uint16Array => {
      module._powder_cells();
      return new Uint16Array(
        module.HEAPU8.buffer, module._powder_presentation_state(), 612 * 384,
      );
    };
    const sources = [
      Material.CLNE, Material.BCLN, Material.PCLN, Material.PBCN, Material.CONV,
      Material.CRAY,
    ];

    expect(module._powder_can_configure_source(Material.CLNE, Material.Water)).toBe(1);
    expect(module._powder_can_configure_source(Material.CLNE, Material.BCOL)).toBe(1);
    expect(module._powder_can_configure_source(Material.CLNE, Material.CLNE)).toBe(0);
    expect(module._powder_can_configure_source(Material.PCLN, Material.PSCN)).toBe(0);
    expect(module._powder_can_configure_source(Material.PBCN, Material.SPRK)).toBe(0);
    expect(module._powder_can_configure_source(Material.CRAY, Material.Water)).toBe(1);
    expect(module._powder_can_configure_source(Material.CRAY, Material.CRAY)).toBe(0);
    expect(module._powder_can_configure_source(Material.Sand, Material.Water)).toBe(0);

    sources.forEach((source, index) => {
      const x = 240 + index * 16;
      const y = 120;
      expect(module._powder_set_configured_source(x, y, source, Material.Sand)).toBe(1);
      expect(cells()[y * 612 + x]).toBe(source);
      expect(module._powder_source_target(x, y)).toBe(Material.Sand);
      expect(presentationState()[y * 612 + x]).toBe(Material.Sand);
    });

    const reconfigured = { x: 240, y: 120 };
    expect(module._powder_set_configured_source(
      reconfigured.x, reconfigured.y, Material.CLNE, Material.Water,
    )).toBe(1);
    expect(cells()[reconfigured.y * 612 + reconfigured.x]).toBe(Material.CLNE);
    expect(module._powder_source_target(reconfigured.x, reconfigured.y)).toBe(Material.Water);
    expect(presentationState()[reconfigured.y * 612 + reconfigured.x]).toBe(Material.Water);
    expect(module._powder_set_configured_source(
      reconfigured.x, reconfigured.y, Material.CLNE, Material.BCLN,
    )).toBe(0);
    expect(module._powder_source_target(reconfigured.x, reconfigured.y)).toBe(Material.Water);
    expect(presentationState()[reconfigured.y * 612 + reconfigured.x]).toBe(Material.Water);

    const occupied = { x: 360, y: 120 };
    module._powder_set(occupied.x, occupied.y, Material.Dust);
    expect(module._powder_set_configured_source(
      occupied.x, occupied.y, Material.CLNE, Material.Water,
    )).toBe(0);
    expect(cells()[occupied.y * 612 + occupied.x]).toBe(Material.Dust);
    expect(module._powder_source_target(occupied.x, occupied.y)).toBe(Material.Empty);
    expect(presentationState()[occupied.y * 612 + occupied.x]).toBe(0);

    const rejected = { x: 380, y: 120 };
    expect(module._powder_set_configured_source(
      rejected.x, rejected.y, Material.CLNE, Material.BCLN,
    )).toBe(0);
    expect(cells()[rejected.y * 612 + rejected.x]).toBe(Material.Empty);
    expect(module._powder_source_target(rejected.x, rejected.y)).toBe(Material.Empty);
    expect(presentationState()[rejected.y * 612 + rejected.x]).toBe(0);

    const unconfigured = { x: 420, y: 120 };
    module._powder_set(unconfigured.x, unconfigured.y, Material.CLNE);
    expect(cells()[unconfigured.y * 612 + unconfigured.x]).toBe(Material.CLNE);
    expect(presentationState()[unconfigured.y * 612 + unconfigured.x]).toBe(0);

    expect(module._powder_set_configured_source(400, 120, Material.Sand, Material.Water)).toBe(-1);
    expect(module._powder_set_configured_source(400, 120, Material.CLNE, Material.Empty)).toBe(-1);
    expect(module._powder_set_configured_source(0, 120, Material.CLNE, Material.Water)).toBe(-1);
    expect(module._powder_source_target(-1, 120)).toBe(Material.Empty);
  });

  it('round-trips representative targets for all configured source types through native OPS bytes', async () => {
    const imported = await import(moduleArtifact.href) as { default: () => Promise<RawPowderModule> };
    const source = await imported.default();
    expect(source._powder_init()).toBe(1);
    const emitters = [
      Material.CLNE, Material.BCLN, Material.PCLN, Material.PBCN, Material.CONV,
      Material.CRAY,
    ] as const;
    const targets = [
      Material.Sand, Material.Water, Material.Oxygen, Material.PHOT,
      Material.Metal, Material.Plant, Material.BCOL,
    ] as const;
    const cases: Array<readonly [typeof emitters[number], typeof targets[number] | Material.VSNS]> =
      emitters.flatMap((emitter) => targets.map((target) => [emitter, target] as const));
    cases.push([Material.CLNE, Material.VSNS]);
    cases.forEach(([emitter, target], index) => {
      const x = 80 + index % 7 * 64;
      const y = 80 + Math.floor(index / 7) * 48;
      expect(source._powder_set_configured_source(x, y, emitter, target)).toBe(1);
    });

    const savePointer = source._powder_save();
    const saveSize = source._powder_save_size();
    expect(savePointer).toBeGreaterThan(0);
    expect(saveSize).toBeGreaterThan(0);
    const save = source.HEAPU8.slice(savePointer, savePointer + saveSize);

    const restored = await imported.default();
    expect(restored._powder_init()).toBe(1);
    const loadPointer = restored._powder_load_buffer(save.length);
    expect(loadPointer).toBeGreaterThan(0);
    restored.HEAPU8.set(save, loadPointer);
    expect(restored._powder_load_commit()).toBe(1);
    const restoredCells = new Uint8Array(
      restored.HEAPU8.buffer, restored._powder_cells(), 612 * 384,
    );
    const restoredState = new Uint16Array(
      restored.HEAPU8.buffer, restored._powder_presentation_state(), 612 * 384,
    );
    cases.forEach(([emitter, target], index) => {
      const x = 80 + index % 7 * 64;
      const y = 80 + Math.floor(index / 7) * 48;
      expect(restoredCells[y * 612 + x]).toBe(emitter);
      expect(restored._powder_source_target(x, y)).toBe(target);
      expect(restoredState[y * 612 + x]).toBe(target);
    });
  });

  it('emits the configured CRAY target opposite a real native spark', async () => {
    const imported = await import(moduleArtifact.href) as { default: () => Promise<RawPowderModule> };
    const module = await imported.default();
    expect(module._powder_init()).toBe(1);
    const source = { x: 306, y: 180 };

    expect(module._powder_set_configured_source(
      source.x, source.y, Material.CRAY, Material.Water,
    )).toBe(1);
    module._powder_cells();
    const configuredTemperature = new Uint16Array(
      module.HEAPU8.buffer, module._powder_temperature(), 612 * 384,
    );
    // CRAY's native CtypeDraw also adopts the target's default temperature.
    // This proves the semantic adapter did not bypass target-specific setup by
    // assigning ctype directly.
    expect(configuredTemperature[source.y * 612 + source.x]).toBe(2931);
    module._powder_set(source.x - 1, source.y, Material.PSCN);
    module._powder_set(source.x - 1, source.y, Material.SPRK);
    module._powder_step();

    const cells = new Uint8Array(
      module.HEAPU8.buffer, module._powder_cells(), 612 * 384,
    );
    const state = new Uint16Array(
      module.HEAPU8.buffer, module._powder_presentation_state(), 612 * 384,
    );
    expect(cells[source.y * 612 + source.x]).toBe(Material.CRAY);
    expect(cells[source.y * 612 + source.x + 1]).toBe(Material.Water);
    expect(cells.filter((material) => material === Material.Water)).toHaveLength(255);
    expect(module._powder_source_target(source.x, source.y)).toBe(Material.Water);
    expect(state[source.y * 612 + source.x]).toBe(Material.Water);
  });

  it('projects all 24 native LIFE presets to stable frontend IDs', async () => {
    const imported = await import(moduleArtifact.href) as { default: () => Promise<RawPowderModule> };
    const module = await imported.default();
    expect(module._powder_init()).toBe(1);

    for (let preset = 0; preset < LIFE_PRESET_COUNT; preset++) {
      expect(module._powder_set_life(120 + preset * 16, 100, preset)).toBe(1);
    }
    const cells = new Uint8Array(module.HEAPU8.buffer, module._powder_cells(), 612 * 384);
    for (let preset = 0; preset < LIFE_PRESET_COUNT; preset++) {
      expect(cells[100 * 612 + 120 + preset * 16]).toBe(LIFE_FIRST_MATERIAL_ID + preset);
    }
  });

  it('rejects invalid LIFE presets and preserves occupied particles', async () => {
    const imported = await import(moduleArtifact.href) as { default: () => Promise<RawPowderModule> };
    const module = await imported.default();
    expect(module._powder_init()).toBe(1);
    const invalidLow = { x: 220, y: 120 };
    const invalidHigh = { x: 240, y: 120 };
    const occupied = { x: 260, y: 120 };
    const configuredSource = { x: 280, y: 120 };
    module._powder_set(occupied.x, occupied.y, Material.Dust);
    expect(module._powder_set_configured_source(
      configuredSource.x, configuredSource.y, Material.CLNE, Material.Water,
    )).toBe(1);

    expect(module._powder_set_life(invalidLow.x, invalidLow.y, -1)).toBe(-1);
    expect(module._powder_set_life(invalidHigh.x, invalidHigh.y, LIFE_PRESET_COUNT)).toBe(-1);
    expect(module._powder_set_life(0, 120, 0)).toBe(-1);
    expect(module._powder_set_life(occupied.x, occupied.y, 0)).toBe(0);
    expect(module._powder_set_life(configuredSource.x, configuredSource.y, 0)).toBe(0);

    const cells = new Uint8Array(module.HEAPU8.buffer, module._powder_cells(), 612 * 384);
    expect(cells[invalidLow.y * 612 + invalidLow.x]).toBe(Material.Empty);
    expect(cells[invalidHigh.y * 612 + invalidHigh.x]).toBe(Material.Empty);
    expect(cells[occupied.y * 612 + occupied.x]).toBe(Material.Dust);
    expect(cells[configuredSource.y * 612 + configuredSource.x]).toBe(Material.CLNE);
    expect(module._powder_source_target(configuredSource.x, configuredSource.y)).toBe(Material.Water);
  });

  it('rejects projection-only LIFE IDs through the generic particle brush', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    simulation.paint(300, 140, Material.LIFE_GOL, 0);
    expect(simulation.cells()[140 * simulation.width + 300]).toBe(Material.Empty);
  });

  it('round-trips all LIFE preset ctypes through native OPS bytes', async () => {
    const imported = await import(moduleArtifact.href) as { default: () => Promise<RawPowderModule> };
    const source = await imported.default();
    expect(source._powder_init()).toBe(1);
    for (let preset = 0; preset < LIFE_PRESET_COUNT; preset++) {
      expect(source._powder_set_life(120 + preset * 16, 140, preset)).toBe(1);
    }

    const savePointer = source._powder_save();
    const saveSize = source._powder_save_size();
    expect(savePointer).toBeGreaterThan(0);
    expect(saveSize).toBeGreaterThan(0);
    const save = source.HEAPU8.slice(savePointer, savePointer + saveSize);

    const restored = await imported.default();
    expect(restored._powder_init()).toBe(1);
    const loadPointer = restored._powder_load_buffer(save.length);
    expect(loadPointer).toBeGreaterThan(0);
    restored.HEAPU8.set(save, loadPointer);
    expect(restored._powder_load_commit()).toBe(1);
    const cells = new Uint8Array(restored.HEAPU8.buffer, restored._powder_cells(), 612 * 384);
    for (let preset = 0; preset < LIFE_PRESET_COUNT; preset++) {
      expect(cells[140 * 612 + 120 + preset * 16]).toBe(LIFE_FIRST_MATERIAL_ID + preset);
    }
  });

  it('creates, expands, edits, removes, and OPS-round-trips native signs outside matter fields', async () => {
    const source = await PowderToyBackend.load(moduleArtifact.href);
    const occupied = { x: 306, y: 180 };
    source.paint(occupied.x, occupied.y, Material.Water, 0);
    const cellsBeforeSigns = source.cells().slice();

    expect(source.upsertSign({
      x: occupied.x, y: occupied.y, justification: 1, text: 'Water: {type}',
    })).toBe(0);
    expect(source.upsertSign({
      x: 260, y: 120, justification: 0, text: 'Air {temp}',
    })).toBe(1);
    expect(source.cells()).toEqual(cellsBeforeSigns);
    expect(source.signs()).toEqual([
      expect.objectContaining({
        index: 0, x: occupied.x, y: occupied.y, justification: 1,
        text: 'Water: {type}', displayText: 'Water: WATR',
      }),
      expect.objectContaining({
        index: 1, x: 260, y: 120, justification: 0, text: 'Air {temp}',
      }),
    ]);

    const file = source.saveFile();
    const restored = await PowderToyBackend.load(moduleArtifact.href);
    restored.loadFile(file);
    expect(restored.signs().map(({ index: _index, displayText: _display, ...sign }) => sign)).toEqual([
      { x: occupied.x, y: occupied.y, justification: 1, text: 'Water: {type}' },
      { x: 260, y: 120, justification: 0, text: 'Air {temp}' },
    ]);
    expect(restored.cells()).toEqual(source.cells());

    expect(restored.upsertSign({
      x: 264, y: 124, justification: 2, text: 'Edited',
    }, 1)).toBe(1);
    expect(restored.signs()[1]).toMatchObject({
      index: 1, x: 264, y: 124, justification: 2, text: 'Edited', displayText: 'Edited',
    });
    expect(restored.removeSign(0)).toBe(true);
    expect(restored.removeSign(8)).toBe(false);
    expect(restored.signs()).toEqual([
      expect.objectContaining({ index: 0, x: 264, y: 124, text: 'Edited' }),
    ]);
    restored.clear();
    expect(restored.signs()).toEqual([]);
  });

  it('evolves the built-in GOL preset through one blinker generation', async () => {
    const imported = await import(moduleArtifact.href) as { default: () => Promise<RawPowderModule> };
    const module = await imported.default();
    expect(module._powder_init()).toBe(1);
    const center = { x: 306, y: 180 };
    for (const y of [center.y - 1, center.y, center.y + 1]) {
      expect(module._powder_set_life(center.x, y, 0)).toBe(1);
    }

    module._powder_step();
    const cells = new Uint8Array(module.HEAPU8.buffer, module._powder_cells(), 612 * 384);
    for (const x of [center.x - 1, center.x, center.x + 1]) {
      expect(cells[center.y * 612 + x]).toBe(LIFE_FIRST_MATERIAL_ID);
    }
    expect(cells[(center.y - 1) * 612 + center.x]).toBe(Material.Empty);
    expect(cells[(center.y + 1) * 612 + center.x]).toBe(Material.Empty);
  });

  it('executes upstream clone behavior for an explicitly configured target', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    const point = { x: 306, y: 180 };

    expect(simulation.paintConfiguredSource(
      point.x, point.y, Material.CLNE, Material.Water, 0,
    )).toBe(1);
    expect(simulation.configuredSourceTargetAt(point.x, point.y)).toBe(Material.Water);

    for (let step = 0; step < 12; step++) simulation.step();
    expect(simulation.cells().filter((material) => material === Material.Water).length).toBeGreaterThan(0);
    expect(simulation.configuredSourceTargetAt(point.x, point.y)).toBe(Material.Water);
  });

  it('settles water without air-driven ejection', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    const floorY = 220;
    for (let x = 30; x < simulation.width - 30; x += 2) simulation.paint(x, floorY, Material.Wall, 1);
    const centerY = 155;
    const radius = 12;
    simulation.paint(Math.floor(simulation.width / 2), centerY, Material.Water, radius);
    for (let index = 0; index < 180; index++) simulation.step();
    const cells = simulation.cells();
    const velocity = simulation.velocity();
    let waterCount = 0;
    let airborne = 0;
    let maxVerticalSpeed = 0;
    for (let index = 0; index < cells.length; index++) {
      if (cells[index] !== Material.Water) continue;
      waterCount++;
      if (Math.floor(index / simulation.width) < floorY - 30) airborne++;
      maxVerticalSpeed = Math.max(maxVerticalSpeed, Math.abs(velocity[index * 2 + 1]));
    }
    expect(waterCount).toBeGreaterThan(400);
    expect(airborne).toBeLessThanOrEqual(5);
    expect(maxVerticalSpeed).toBeLessThanOrEqual(48);
  }, 15000);

  it('uses the native wall field as a physical particle barrier', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    const floorY = 220;
    for (let x = 190; x <= 422; x += 4) simulation.paintWall(x, floorY, 8, 0);
    simulation.paint(306, 150, Material.Sand, 9);

    for (let index = 0; index < 180; index++) simulation.step();
    const cells = simulation.cells();
    let sandAboveWall = 0;
    let sandBelowWall = 0;
    for (let index = 0; index < cells.length; index++) {
      if (cells[index] !== Material.Sand) continue;
      const y = Math.floor(index / simulation.width);
      if (y < floorY) sandAboveWall++;
      if (y >= floorY + 4) sandBelowWall++;
    }
    expect(sandAboveWall).toBeGreaterThan(100);
    expect(sandBelowWall).toBe(0);
  }, 15000);

  it('continues native seed growth through OPS1 and reports it through the dirty stream', async () => {
    const buildFixture = async (soil: boolean, water: boolean): Promise<PowderToyBackend> => {
      const simulation = await PowderToyBackend.load(moduleArtifact.href);
      for (let x = 250; x < 360; x++) {
        for (let y = 250; y < 254; y++) simulation.paint(x, y, Material.Wall, 0);
      }
      if (soil) {
        for (let x = 260; x < 350; x++) {
          for (let y = 242; y < 250; y++) simulation.paint(x, y, Material.Sand, 0);
        }
      }
      if (water) {
        for (let x = 270; x < 295; x++) {
          for (let y = 225; y < 241; y++) simulation.paint(x, y, Material.Water, 0);
        }
      }
      for (let x = 305; x <= 325; x += 5) simulation.paint(x, 241, Material.SEED, 0);
      return simulation;
    };
    const countGrowth = (simulation: PowderToyBackend): number => simulation.cells()
      .filter((material) => material === Material.Wood || material === Material.Plant).length;
    const advance = (simulation: PowderToyBackend, ticks: number): void => {
      for (let tick = 0; tick < ticks; tick++) simulation.step();
    };

    const checkpointTick = 300;
    const continuationTicks = 600;
    const source = await buildFixture(true, true);
    advance(source, checkpointTick);
    const growthAtCheckpoint = countGrowth(source);
    const checkpointCells = source.cells().slice();
    const file = source.saveFile();
    expect(new TextDecoder().decode(file.slice(0, 4))).toBe('OPS1');

    const restored = await PowderToyBackend.load(moduleArtifact.href);
    restored.loadFile(file);
    restored.consumeDirtyCells();
    advance(restored, continuationTicks);
    const dirtyGrowth = restored.consumeDirtyCells().filter(
      ({ material }) => material === Material.Wood || material === Material.Plant,
    );
    const positiveGrowth = countGrowth(restored);
    const continuedCells = restored.cells();
    const newlyGrownIndices: number[] = [];
    for (let index = 0; index < continuedCells.length; index++) {
      const material = continuedCells[index];
      const previous = checkpointCells[index];
      if ((material === Material.Wood || material === Material.Plant)
        && previous !== Material.Wood && previous !== Material.Plant) {
        newlyGrownIndices.push(index);
      }
    }
    const dirtyGrowthIndices = new Set(dirtyGrowth.map(({ index }) => index));
    const positiveWood = continuedCells.filter((material) => material === Material.Wood).length;
    const positivePlant = continuedCells.filter((material) => material === Material.Plant).length;
    const dirtyWood = dirtyGrowth.filter(({ material }) => material === Material.Wood).length;
    const dirtyPlant = dirtyGrowth.filter(({ material }) => material === Material.Plant).length;

    const withoutWater = await buildFixture(true, false);
    advance(withoutWater, checkpointTick + continuationTicks);
    const dryGrowth = countGrowth(withoutWater);
    const withoutSoil = await buildFixture(false, true);
    advance(withoutSoil, checkpointTick + continuationTicks);
    const soillessGrowth = countGrowth(withoutSoil);

    expect(growthAtCheckpoint).toBe(39);
    expect(positiveGrowth).toBe(568);
    expect(positiveWood).toBe(494);
    expect(positivePlant).toBe(74);
    expect(dirtyGrowth).toHaveLength(532);
    expect(dirtyWood).toBe(458);
    expect(dirtyPlant).toBe(74);
    expect(newlyGrownIndices).toHaveLength(532);
    expect(newlyGrownIndices.every((index) => dirtyGrowthIndices.has(index))).toBe(true);
    expect(dryGrowth).toBe(0);
    expect(soillessGrowth).toBe(0);
  }, 20000);

  it('restores full native state for deterministic continuation', async () => {
    const source = await PowderToyBackend.load(moduleArtifact.href);
    source.paint(120, 80, Material.Wall, 3);
    source.paint(120, 40, Material.Sand, 4);
    source.paint(150, 42, Material.Water, 4);
    source.paint(180, 100, Material.Fire, 2);
    source.paintWall(210, 120, 8, 8);
    for (let index = 0; index < 40; index++) source.step();

    const file = source.saveFile();
    expect(new TextDecoder().decode(file.slice(0, 4))).toBe('OPS1');
    const saved = source.saveWorld();
    expect(saved.startsWith('tpt3.')).toBe(true);
    const restored = await PowderToyBackend.load(moduleArtifact.href);
    source.loadWorld(saved);
    restored.loadFile(file);
    expect(restored.cells()).toEqual(source.cells());
    expect(restored.temperature()).toEqual(source.temperature());
    expect(restored.velocity()).toEqual(source.velocity());
    expect(restored.walls()).toEqual(source.walls());

    for (let index = 0; index < 15; index++) { source.step(); restored.step(); }
    expect(restored.cells()).toEqual(source.cells());
    expect(restored.temperature()).toEqual(source.temperature());
    expect(restored.velocity()).toEqual(source.velocity());
    expect(restored.walls()).toEqual(source.walls());
  }, 15000);

  it('keeps the active world when a native file is rejected', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    simulation.paint(240, 180, Material.Wall, 6);
    const before = simulation.cells().slice();
    const corrupt = simulation.saveFile().slice(0, 24);
    expect(() => simulation.loadFile(corrupt)).toThrow('Corrupt world');
    expect(simulation.cells()).toEqual(before);
  });
});
