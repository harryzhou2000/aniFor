import { describe, expect, it, vi } from 'vitest';
import { createAnimationFrameCoalescer, MaterialRenderer } from './field-renderer';

describe('field renderer layout scheduling', () => {
  it('reads and hashes the exact fallback suspension field without reallocating it', () => {
    const bytes = new Uint8Array([
      215, 170, 104, 9,
      184, 121, 85, 13,
    ]);
    const renderer = Object.create(MaterialRenderer.prototype) as {
      simulation: { width: number; height: number };
      fallbackFields: {
        suspension: {
          width: number;
          height: number;
          bytes: Uint8Array;
          hasSuspension: boolean;
        };
      };
      suspensionAt(x: number, y: number): readonly [number, number, number, number];
      getSuspensionSupportAudit(): {
        active: boolean;
        nonzero: number;
        alphaSum: number;
        signature: number;
      } | undefined;
    };
    Object.assign(renderer, {
      simulation: { width: 4, height: 2 },
      fallbackFields: {
        suspension: { width: 2, height: 1, bytes, hasSuspension: true },
      },
    });

    expect(renderer.suspensionAt(0, 0)).toEqual([215, 170, 104, 9]);
    expect(renderer.suspensionAt(3, 1)).toEqual([184, 121, 85, 13]);
    expect(renderer.suspensionAt(-1, 0)).toEqual([0, 0, 0, 0]);
    const original = renderer.getSuspensionSupportAudit();
    expect(original).toMatchObject({ active: true, nonzero: 2, alphaSum: 22 });

    bytes[0]++;
    const rgbChanged = renderer.getSuspensionSupportAudit();
    expect(rgbChanged?.signature).not.toBe(original?.signature);
    expect(rgbChanged).toMatchObject({ active: true, nonzero: 2, alphaSum: 22 });
  });

  it('coalesces every resize source into one post-layout update per frame', () => {
    const frames: FrameRequestCallback[] = [];
    let updates = 0;
    const schedule = createAnimationFrameCoalescer(
      () => { updates++; },
      (frame) => {
        frames.push(frame);
        return frames.length;
      },
    );

    // Host ResizeObserver, window resize, visual viewport, and compact-media
    // notifications can all arrive for the same layout change.
    schedule();
    schedule();
    schedule();
    schedule();
    expect(frames).toHaveLength(1);
    expect(updates).toBe(0);

    frames.shift()?.(0);
    expect(updates).toBe(1);

    schedule();
    expect(frames).toHaveLength(1);
    frames.shift()?.(16.7);
    expect(updates).toBe(2);
  });

  it('submits a thermal toggle once through WebGL without queuing a Canvas redraw', () => {
    const setThermalMaterialStylingEnabled = vi.fn();
    const markAll = vi.fn();
    const renderer = Object.create(MaterialRenderer.prototype) as {
      thermalMaterialStylingEnabled: boolean;
      simulation: { temperature?: Float32Array };
      presenter?: { setThermalMaterialStylingEnabled(enabled: boolean): void };
      contourChunks: { markAll(): void };
      changed: boolean;
      setThermalMaterialStylingEnabled(enabled: boolean): void;
    };
    Object.assign(renderer, {
      thermalMaterialStylingEnabled: true,
      simulation: { temperature: new Float32Array(1) },
      presenter: { setThermalMaterialStylingEnabled },
      contourChunks: { markAll },
      changed: false,
    });

    renderer.setThermalMaterialStylingEnabled(false);

    expect(setThermalMaterialStylingEnabled).toHaveBeenCalledOnce();
    expect(setThermalMaterialStylingEnabled).toHaveBeenCalledWith(false);
    expect(markAll).not.toHaveBeenCalled();
    expect(renderer.changed).toBe(false);
  });

  it('keeps thermal Canvas invalidation when no WebGL presenter is active', () => {
    const markAll = vi.fn();
    const renderer = Object.create(MaterialRenderer.prototype) as {
      thermalMaterialStylingEnabled: boolean;
      simulation: { temperature?: Float32Array };
      presenter?: undefined;
      contourChunks: { markAll(): void };
      changed: boolean;
      setThermalMaterialStylingEnabled(enabled: boolean): void;
    };
    Object.assign(renderer, {
      thermalMaterialStylingEnabled: true,
      simulation: { temperature: new Float32Array(1) },
      presenter: undefined,
      contourChunks: { markAll },
      changed: false,
    });

    renderer.setThermalMaterialStylingEnabled(false);

    expect(markAll).toHaveBeenCalledOnce();
    expect(renderer.changed).toBe(true);
  });

  it('ignores a queued frame after navigation has disposed the outgoing renderer', () => {
    const renderer = Object.create(MaterialRenderer.prototype) as {
      disposed: boolean;
      render(time: number): void;
    };
    renderer.disposed = true;

    expect(() => renderer.render(1000)).not.toThrow();
  });
});
