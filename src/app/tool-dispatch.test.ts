import { describe, expect, it, vi } from 'vitest';
import { Material } from '../shared/materials';
import { SimulationTool } from '../simulation/simulation-tools';
import type { SimulationBackend } from '../simulation';
import type { LifeToolInfo, SignToolInfo, SimToolInfo, SourceToolInfo } from '../ui/tool-catalog';
import { drawToolPoint, drawToolSegment, type ActiveToolSelection } from './tool-dispatch';

function backend(): SimulationBackend {
  return {
    name: 'test', width: 32, height: 20,
    step: vi.fn(), paint: vi.fn(), erase: vi.fn(), clear: vi.fn(),
    cells: () => new Uint8Array(32 * 20), consumeDirtyCells: () => [],
    saveWorld: () => '', loadWorld: vi.fn(), applySimulationTool: vi.fn(),
    paintConfiguredSource: vi.fn(),
    paintLifePreset: vi.fn(),
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

function sourceTool(emitter: SourceToolInfo['emitter']): SourceToolInfo {
  return {
    key: `source:${emitter}`, kind: 'source', emitter, requiresTarget: true,
    name: 'source', description: 'source', color: '#fff', icon: 'x', category: 'sources',
  };
}

function lifeTool(preset = 0): LifeToolInfo {
  return {
    key: `life:${preset}`, kind: 'life', preset, projection: Material.LIFE_GOL,
    name: 'GOL', description: 'Game of Life B3/S23', color: '#0cac00', icon: '◫',
    category: 'automata',
  };
}

function signTool(): SignToolInfo {
  return {
    key: 'sign:place', kind: 'sign', maximumLength: 45,
    name: 'Sign', description: 'Sign', color: '#fff', icon: 'T', category: 'signs',
  };
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

  it('configures a source with the selected material without ordinary paint fallback', () => {
    const simulation = backend();
    const active: ActiveToolSelection = {
      material: Material.Water,
      radius: 3,
      sourceTool: sourceTool(Material.PCLN),
    };

    drawToolPoint(simulation, { x: 9, y: 11 }, active, false);

    expect(simulation.paintConfiguredSource).toHaveBeenCalledWith(
      9, 11, Material.PCLN, Material.Water, 3,
    );
    expect(simulation.paint).not.toHaveBeenCalled();
  });

  it('keeps source erase semantic and never falls through when the capability is absent', () => {
    const simulation = backend();
    const active: ActiveToolSelection = {
      material: Material.Fire,
      radius: 2,
      sourceTool: sourceTool(Material.CONV),
    };

    drawToolPoint(simulation, { x: 4, y: 6 }, active, true);
    expect(simulation.erase).toHaveBeenCalledWith(4, 6, 3);
    expect(simulation.paintConfiguredSource).not.toHaveBeenCalled();

    delete simulation.paintConfiguredSource;
    drawToolPoint(simulation, { x: 7, y: 8 }, active, false);
    expect(simulation.paint).not.toHaveBeenCalled();
  });

  it('places a native LIFE preset without ordinary material fallback', () => {
    const simulation = backend();
    const active: ActiveToolSelection = {
      material: Material.Water,
      radius: 3,
      lifeTool: lifeTool(12),
    };

    drawToolPoint(simulation, { x: 9, y: 11 }, active, false);

    expect(simulation.paintLifePreset).toHaveBeenCalledWith(9, 11, 12, 3);
    expect(simulation.paint).not.toHaveBeenCalled();
  });

  it('keeps LIFE erase semantic and never falls through when the capability is absent', () => {
    const simulation = backend();
    const active: ActiveToolSelection = {
      material: Material.Fire,
      radius: 2,
      lifeTool: lifeTool(23),
    };

    drawToolPoint(simulation, { x: 4, y: 6 }, active, true);
    expect(simulation.erase).toHaveBeenCalledWith(4, 6, 3);
    expect(simulation.paintLifePreset).not.toHaveBeenCalled();

    delete simulation.paintLifePreset;
    drawToolPoint(simulation, { x: 7, y: 8 }, active, false);
    expect(simulation.paint).not.toHaveBeenCalled();
  });

  it('never treats a sign gesture as particle paint or erasure', () => {
    const simulation = backend();
    const active: ActiveToolSelection = {
      material: Material.Water,
      radius: 3,
      signTool: signTool(),
    };

    drawToolPoint(simulation, { x: 9, y: 11 }, active, false);
    drawToolPoint(simulation, { x: 9, y: 11 }, active, true);

    expect(simulation.paint).not.toHaveBeenCalled();
    expect(simulation.erase).not.toHaveBeenCalled();
  });
});
