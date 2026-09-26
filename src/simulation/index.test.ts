import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSimulation } from './index';
import type { SimulationBackend } from './types';

const { load } = vi.hoisted(() => ({load: vi.fn()}));
vi.mock('./powder-toy-backend', () => ({PowderToyBackend: {load}}));

describe('native TPT startup', () => {
  beforeEach(() => { vi.useFakeTimers(); load.mockReset(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('retains native TPT when a hosted download exceeds the old seven-second deadline', async () => {
    const native = {name: 'native TPT', width: 612, height: 384} as SimulationBackend;
    load.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(native), 9000)));
    const ready = createSimulation();
    await vi.advanceTimersByTimeAsync(9000);
    expect(await ready).toBe(native);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('surfaces native failure instead of starting another solver', async () => {
    load.mockRejectedValue(new Error('Native module unavailable'));
    await expect(createSimulation()).rejects.toThrow('Native module unavailable');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds a hung native startup and ignores late completion', async () => {
    let resolve!: (backend: SimulationBackend) => void;
    load.mockImplementation(() => new Promise(done => { resolve = done; }));
    const ready = createSimulation();
    const rejected = expect(ready).rejects.toThrow('Native TPT took too long');
    await vi.advanceTimersByTimeAsync(30000); await rejected;
    resolve({name: 'late native TPT'} as SimulationBackend);
    await expect(ready).rejects.toThrow('Native TPT took too long');
  });

  it('keeps the explicitly requested deterministic visual lab available', async () => {
    const fixture = await createSimulation({renderLab: true});
    expect(fixture.width).toBe(612); expect(fixture.height).toBe(384);
    expect(load).not.toHaveBeenCalled();
  });
});
