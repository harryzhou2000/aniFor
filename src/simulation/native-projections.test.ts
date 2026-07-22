import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { PowderToyBackend } from './powder-toy-backend';
import { SimulationTool, type SimulationToolId } from './simulation-tools';

const moduleArtifact = new URL('../../public/wasm/stillroom_core.js', import.meta.url);
const point = { x: 306, y: 180 };

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
});
