import { describe, expect, it, vi } from 'vitest';
import type { SimulationBackend } from '../simulation/types';
import { exportWorldFile, importWorldFile, isPowderToySave, MAX_WORLD_FILE_BYTES, worldFileName } from './world-file';

function backend(overrides: Partial<SimulationBackend> = {}): SimulationBackend {
  return {
    width: 1, height: 1, name: 'test', step() {}, paint() {}, erase() {}, clear() {},
    cells: () => new Uint8Array(1), consumeDirtyCells: () => [],
    saveWorld: () => 'stored-world', loadWorld: vi.fn(),
    ...overrides,
  };
}

describe('world files', () => {
  it('recognizes modern and legacy Powder Toy file signatures', () => {
    expect(isPowderToySave(new Uint8Array([0x4F, 0x50, 0x53, 0x31]))).toBe(true);
    expect(isPowderToySave(new Uint8Array([0x50, 0x53, 0x76, 0x00]))).toBe(true);
    expect(isPowderToySave(new Uint8Array([0x66, 0x75, 0x43, 0x00]))).toBe(true);
    expect(isPowderToySave(new TextEncoder().encode('not-a-save'))).toBe(false);
  });

  it('exports native bytes unchanged as a TPT-compatible cps file', () => {
    const native = new Uint8Array([0x4F, 0x50, 0x53, 0x31, 4, 5, 6]);
    const result = exportWorldFile(backend({ saveFile: () => native }));
    expect(result).toMatchObject({ extension: 'cps', mediaType: 'application/octet-stream', powderToyCompatible: true });
    expect(result.bytes).toEqual(native);
  });

  it('loads native saves through the binary backend without text expansion', () => {
    const loadFile = vi.fn();
    const bytes = new Uint8Array([0x4F, 0x50, 0x53, 0x31, 1]);
    importWorldFile(backend({ loadFile }), bytes);
    expect(loadFile).toHaveBeenCalledWith(bytes);
  });

  it('round-trips a bounded fallback file when native files are unavailable', () => {
    const loadWorld = vi.fn();
    const simulation = backend({ loadWorld });
    const file = exportWorldFile(simulation);
    expect(file.extension).toBe('anifortpt');
    importWorldFile(simulation, file.bytes);
    expect(loadWorld).toHaveBeenCalledWith('stored-world');
  });

  it('rejects unknown and oversized files and creates stable names', () => {
    expect(() => importWorldFile(backend(), new Uint8Array([1, 2, 3]))).toThrow('Unrecognized');
    expect(() => importWorldFile(backend(), new Uint8Array(MAX_WORLD_FILE_BYTES + 1))).toThrow('too large');
    expect(worldFileName('cps', new Date(2026, 6, 18, 9, 7, 5))).toBe('AniforTPT-20260718-090705.cps');
  });
});
