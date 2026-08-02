import { describe, expect, it, vi } from 'vitest';
import { createAnimationFrameCoalescer, MaterialRenderer } from './field-renderer';

describe('field renderer layout scheduling', () => {
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
});
