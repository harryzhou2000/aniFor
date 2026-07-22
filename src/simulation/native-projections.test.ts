import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { PowderToyBackend } from './powder-toy-backend';
import { SimulationTool, type SimulationToolId } from './simulation-tools';

const moduleArtifact = new URL('../../public/wasm/stillroom_core.js', import.meta.url);
const point = { x: 306, y: 180 };

interface LocalMaterialSample {
  readonly count: number;
  readonly minimumTemperature: number;
  readonly maximumTemperature: number;
  readonly firstPosition?: Readonly<{ x: number; y: number }>;
}

function sampleLocalMaterial(
  simulation: PowderToyBackend,
  material: Material,
  halfExtent = 24,
): LocalMaterialSample {
  // cells() refreshes every exported native field before temperature() exposes
  // its decikelvin view, so identity and temperature come from one extraction.
  const cells = simulation.cells();
  const temperatures = simulation.temperature();
  let count = 0;
  let minimumTemperature = Number.POSITIVE_INFINITY;
  let maximumTemperature = Number.NEGATIVE_INFINITY;
  let firstPosition: Readonly<{ x: number; y: number }> | undefined;
  for (let y = point.y - halfExtent; y <= point.y + halfExtent; y++) {
    for (let x = point.x - halfExtent; x <= point.x + halfExtent; x++) {
      const index = y * simulation.width + x;
      if (cells[index] !== material) continue;
      count++;
      firstPosition ??= { x, y };
      minimumTemperature = Math.min(minimumTemperature, temperatures[index]);
      maximumTemperature = Math.max(maximumTemperature, temperatures[index]);
    }
  }
  return { count, minimumTemperature, maximumTemperature, firstPosition };
}

function advanceToLocalPhase(
  simulation: PowderToyBackend,
  source: Material,
  product: Material,
  maximumSteps = 64,
): LocalMaterialSample {
  for (let step = 1; step <= maximumSteps; step++) {
    simulation.step();
    const productSample = sampleLocalMaterial(simulation, product, 96);
    if (productSample.count === 1) {
      expect(sampleLocalMaterial(simulation, source, 96).count).toBe(0);
      return productSample;
    }
    expect(productSample.count).toBe(0);
    expect(sampleLocalMaterial(simulation, source, 96).count).toBe(1);
  }
  const remaining = sampleLocalMaterial(simulation, source, 96);
  throw new Error(
    `Native transition ${source} -> ${product} did not complete in ${maximumSteps} steps `
      + `(source temperature ${remaining.minimumTemperature}-${remaining.maximumTemperature} dK)`,
  );
}

function applyThermalTool(
  simulation: PowderToyBackend,
  tool: SimulationToolId,
  applications: number,
  target = point,
): void {
  for (let index = 0; index < applications; index++) {
    simulation.applySimulationTool(tool, target.x, target.y, 0);
  }
}

async function temperatureProduct(
  source: Material,
  tool: SimulationToolId,
  applications: number,
): Promise<Uint8Array> {
  const simulation = await PowderToyBackend.load(moduleArtifact.href);
  simulation.paint(point.x, point.y, source, 0);
  for (let index = 0; index < applications; index++) {
    simulation.applySimulationTool(tool, point.x, point.y, 0);
  }
  for (let index = 0; index < 5; index++) simulation.step();
  const cells = simulation.cells();
  return cells;
}

async function pressureProduct(source: Material, applications: number): Promise<Uint8Array> {
  const simulation = await PowderToyBackend.load(moduleArtifact.href);
  simulation.paint(point.x, point.y, source, 2);
  for (let index = 0; index < applications; index++) {
    simulation.applySimulationTool(SimulationTool.Air, point.x, point.y, 4);
  }
  for (let index = 0; index < 5; index++) simulation.step();
  return simulation.cells();
}

async function virusPhaseRoundTrip(
  outwardTool: SimulationToolId,
  outwardApplications: number,
  projectedPhase: Material.VRSG | Material.VRSS,
  returnTool: SimulationToolId,
  returnApplications: number,
): Promise<void> {
  const simulation = await PowderToyBackend.load(moduleArtifact.href);
  simulation.paint(point.x, point.y, Material.VIRS, 2);
  for (let index = 0; index < outwardApplications; index++) {
    simulation.applySimulationTool(outwardTool, point.x, point.y, 6);
  }
  for (let index = 0; index < 3; index++) simulation.step();
  expect(simulation.cells()).toContain(projectedPhase);

  for (let index = 0; index < returnApplications; index++) {
    simulation.applySimulationTool(returnTool, point.x, point.y, 12);
  }
  for (let index = 0; index < 5; index++) simulation.step();
  expect(simulation.cells()).toContain(Material.VIRS);
}

describe('compiled native-only projections', () => {
  it('retains distinct gas, solid, liquid, and pressure products from native transitions', async () => {
    expect(await temperatureProduct(Material.BIZR, SimulationTool.Cool, 100)).toContain(Material.BIZRG);
    expect(await temperatureProduct(Material.BIZR, SimulationTool.Heat, 70)).toContain(Material.BIZRS);
    expect(await temperatureProduct(Material.FRZZ, SimulationTool.Heat, 20)).toContain(Material.FRZW);
    expect(await temperatureProduct(Material.VIRS, SimulationTool.Cool, 30)).toContain(Material.VRSS);
    expect(await temperatureProduct(Material.VIRS, SimulationTool.Heat, 200)).toContain(Material.VRSG);
    expect(await pressureProduct(Material.PSTE, 20)).toContain(Material.PSTS);
    expect(await pressureProduct(Material.RFRG, 55)).toContain(Material.RFGL);
  });

  it('round-trips the native virus family through both temperature phase products', async () => {
    await virusPhaseRoundTrip(
      SimulationTool.Cool, 30, Material.VRSS, SimulationTool.Heat, 25,
    );
    await virusPhaseRoundTrip(
      SimulationTool.Heat, 200, Material.VRSG, SimulationTool.Cool, 60,
    );
  });

  it('round-trips wax through liquid wax at native thresholds and burns overheated liquid wax', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    simulation.paint(point.x, point.y, Material.Wax, 0);
    expect(sampleLocalMaterial(simulation, Material.Wax).count).toBe(1);

    for (let index = 0; index < 30; index++) {
      simulation.applySimulationTool(SimulationTool.Heat, point.x, point.y, 8);
    }
    const hotWax = sampleLocalMaterial(simulation, Material.Wax);
    expect(hotWax.count).toBe(1);
    expect(hotWax.minimumTemperature).toBeGreaterThan(3190);

    const liquidWax = advanceToLocalPhase(simulation, Material.Wax, Material.MWAX);
    expect(liquidWax.firstPosition).toBeDefined();

    for (let index = 0; index < 20; index++) {
      simulation.applySimulationTool(
        SimulationTool.Cool,
        liquidWax.firstPosition!.x,
        liquidWax.firstPosition!.y,
        0,
      );
    }
    const coolLiquidWax = sampleLocalMaterial(simulation, Material.MWAX, 96);
    expect(coolLiquidWax.count).toBe(1);
    expect(coolLiquidWax.maximumTemperature).toBeLessThan(3180);

    advanceToLocalPhase(simulation, Material.MWAX, Material.Wax);

    simulation.clear();
    simulation.paint(point.x, point.y, Material.MWAX, 0);
    expect(sampleLocalMaterial(simulation, Material.MWAX).count).toBe(1);
    for (let index = 0; index < 180; index++) {
      simulation.applySimulationTool(SimulationTool.Heat, point.x, point.y, 8);
    }
    const burningLiquidWax = sampleLocalMaterial(simulation, Material.MWAX);
    expect(burningLiquidWax.count).toBe(1);
    expect(burningLiquidWax.minimumTemperature).toBeGreaterThan(6730);

    advanceToLocalPhase(simulation, Material.MWAX, Material.Fire);
  });

  it('round-trips dry ice through carbon dioxide across the native hysteresis', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    simulation.paint(point.x, point.y, Material.DRIC, 0);
    expect(sampleLocalMaterial(simulation, Material.DRIC).count).toBe(1);

    applyThermalTool(simulation, SimulationTool.Heat, 12);
    const hotDryIce = sampleLocalMaterial(simulation, Material.DRIC);
    expect(hotDryIce.count).toBe(1);
    expect(hotDryIce.minimumTemperature).toBeGreaterThan(1956);

    // DRIC has HeatConduct=2, so upstream evaluates its thermal transition on
    // only 2/250 deterministic update ticks.
    const carbonDioxide = advanceToLocalPhase(
      simulation, Material.DRIC, Material.CarbonDioxide, 512,
    );
    applyThermalTool(simulation, SimulationTool.Cool, 2, carbonDioxide.firstPosition!);
    const coldCarbonDioxide = sampleLocalMaterial(simulation, Material.CarbonDioxide, 96);
    expect(coldCarbonDioxide.count).toBe(1);
    expect(coldCarbonDioxide.maximumTemperature).toBeLessThan(1946);

    advanceToLocalPhase(simulation, Material.CarbonDioxide, Material.DRIC);
  });

  it('round-trips nitrogen ice through liquid nitrogen and removes overheated liquid nitrogen', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    simulation.paint(point.x, point.y, Material.NICE, 0);
    expect(sampleLocalMaterial(simulation, Material.NICE).count).toBe(1);

    applyThermalTool(simulation, SimulationTool.Heat, 15);
    const hotNitrogenIce = sampleLocalMaterial(simulation, Material.NICE);
    expect(hotNitrogenIce.count).toBe(1);
    expect(hotNitrogenIce.minimumTemperature).toBeGreaterThan(631);

    const liquidNitrogen = advanceToLocalPhase(simulation, Material.NICE, Material.LiquidNitrogen);
    applyThermalTool(simulation, SimulationTool.Cool, 2, liquidNitrogen.firstPosition!);
    const coldLiquidNitrogen = sampleLocalMaterial(simulation, Material.LiquidNitrogen, 96);
    expect(coldLiquidNitrogen.count).toBe(1);
    expect(coldLiquidNitrogen.maximumTemperature).toBeLessThan(630);

    advanceToLocalPhase(simulation, Material.LiquidNitrogen, Material.NICE);

    simulation.clear();
    simulation.paint(point.x, point.y, Material.LiquidNitrogen, 0);
    applyThermalTool(simulation, SimulationTool.Heat, 4);
    const overheatedLiquidNitrogen = sampleLocalMaterial(simulation, Material.LiquidNitrogen);
    expect(overheatedLiquidNitrogen.count).toBe(1);
    expect(overheatedLiquidNitrogen.minimumTemperature).toBeGreaterThanOrEqual(770);
    simulation.step();
    expect(simulation.cells().some(Boolean)).toBe(false);
  });

  it('restores quartz from its native typed lava phase', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    simulation.paint(point.x, point.y, Material.QRTZ, 0);
    expect(sampleLocalMaterial(simulation, Material.QRTZ).count).toBe(1);

    applyThermalTool(simulation, SimulationTool.Heat, 1140);
    const hotQuartz = sampleLocalMaterial(simulation, Material.QRTZ);
    expect(hotQuartz.count).toBe(1);
    expect(hotQuartz.minimumTemperature).toBeGreaterThan(25731);

    // QRTZ has HeatConduct=3 and therefore the same bounded low-conductivity
    // transition cadence as the native engine.
    const quartzLava = advanceToLocalPhase(simulation, Material.QRTZ, Material.Lava, 512);
    applyThermalTool(simulation, SimulationTool.Cool, 2, quartzLava.firstPosition!);
    const coolingQuartzLava = sampleLocalMaterial(simulation, Material.Lava, 96);
    expect(coolingQuartzLava.count).toBe(1);
    expect(coolingQuartzLava.maximumTemperature).toBeLessThan(25732);

    advanceToLocalPhase(simulation, Material.Lava, Material.QRTZ);
  });

  it('melts direct rime to water and preserves distilled-water ancestry through steam', async () => {
    const simulation = await PowderToyBackend.load(moduleArtifact.href);
    simulation.paint(point.x, point.y, Material.RIME, 0);
    expect(sampleLocalMaterial(simulation, Material.RIME).count).toBe(1);

    applyThermalTool(simulation, SimulationTool.Heat, 16);
    const hotRime = sampleLocalMaterial(simulation, Material.RIME);
    expect(hotRime.count).toBe(1);
    expect(hotRime.minimumTemperature).toBeGreaterThanOrEqual(2732);
    advanceToLocalPhase(simulation, Material.RIME, Material.Water);

    simulation.clear();
    simulation.paint(point.x, point.y, Material.Steam, 0);
    applyThermalTool(simulation, SimulationTool.Cool, 62);
    const coldSteam = sampleLocalMaterial(simulation, Material.Steam);
    expect(coldSteam.count).toBe(1);
    expect(coldSteam.maximumTemperature).toBeLessThan(2730);

    const depositedRime = advanceToLocalPhase(simulation, Material.Steam, Material.RIME);
    applyThermalTool(simulation, SimulationTool.Heat, 2, depositedRime.firstPosition!);
    const reheatedRime = sampleLocalMaterial(simulation, Material.RIME, 96);
    expect(reheatedRime.count).toBe(1);
    expect(reheatedRime.minimumTemperature).toBeGreaterThanOrEqual(2732);
    advanceToLocalPhase(simulation, Material.RIME, Material.DistilledWater);
  });
});
