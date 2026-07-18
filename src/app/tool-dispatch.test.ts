import { describe, expect, it, vi } from 'vitest';
import { Material } from '../shared/materials';
import { SimulationTool } from '../simulation/simulation-tools';
import type { SimulationBackend } from '../simulation';
import type { SimToolInfo } from '../ui/tool-catalog';
import { drawToolPoint, drawToolSegment, type ActiveToolSelection } from './tool-dispatch';

function backend(): SimulationBackend {
  return {
    name: 'test', width: 32, height: 20,
    step: vi.fn(), paint: vi.fn(), erase: vi.fn(), clear: vi.fn(),
    cells: () => new Uint8Array(32 * 20), consumeDirtyCells: () => [],
    saveWorld: () => '', loadWorld: vi.fn(), applySimulationTool: vi.fn(),
  };
}

function tool(nativeTool: SimToolInfo['nativeTool'], gesture: SimToolInfo['gesture']): SimToolInfo {
  return {
    key: `tool:${nativeTool}`, kind: 'force', nativeTool, gesture,
    name: 'test', description: 'test', color: '#fff', icon: 'x', category: 'test',
  };
}

function selection(simulationTool?: SimToolInfo): ActiveToolSelection {
  return { material: Material.Sand, radius: 4, simulationTool };
}

describe('semantic tool dispatch', () => {
  it('never paints the selected material while a vector tool is active', () => {
    const simulation = backend();
    const active = selection(tool(SimulationTool.Wind, 'vector'));

    drawToolPoint(simulation, { x: 8, y: 7 }, active, false);
    drawToolSegment(simulation, { x: 8, y: 7 }, { x: 14, y: 9 }, active, false);

    expect(simulation.paint).not.toHaveBeenCalled();
    expect(simulation.applySimulationTool).toHaveBeenCalledOnce();
    expect(simulation.applySimulationTool).toHaveBeenCalledWith(
      SimulationTool.Wind, 8, 7, 4, 6, 2,
    );
  });

  it('applies brush tools at points and keeps right-button erase semantic', () => {
    const simulation = backend();
    const active = selection(tool(SimulationTool.Air, 'brush'));

    drawToolPoint(simulation, { x: 5, y: 6 }, active, false);
    drawToolPoint(simulation, { x: 7, y: 8 }, active, true);

    expect(simulation.applySimulationTool).toHaveBeenCalledWith(SimulationTool.Air, 5, 6, 4);
    expect(simulation.erase).toHaveBeenCalledWith(7, 8, 5);
    expect(simulation.paint).not.toHaveBeenCalled();
  });
});
