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

  it('stores the WebGL-only dense ambient toggle without queuing a second field frame', () => {
    const setDenseBodyAmbientFillEnabled = vi.fn();
    const renderer = Object.create(MaterialRenderer.prototype) as {
      denseBodyAmbientFillEnabled: boolean;
      presenter?: { setDenseBodyAmbientFillEnabled(enabled: boolean): void };
      changed: boolean;
      setDenseBodyAmbientFillEnabled(enabled: boolean): void;
    };
    Object.assign(renderer, {
      denseBodyAmbientFillEnabled: true,
      presenter: { setDenseBodyAmbientFillEnabled },
      changed: false,
    });

    renderer.setDenseBodyAmbientFillEnabled(false);

    expect(setDenseBodyAmbientFillEnabled).toHaveBeenCalledOnce();
    expect(setDenseBodyAmbientFillEnabled).toHaveBeenCalledWith(false);
    expect(renderer.denseBodyAmbientFillEnabled).toBe(false);
    expect(renderer.changed).toBe(false);
  });

  it('submits a Powder-style change once through WebGL without queuing a second field frame', () => {
    const setPowderRenderStyle = vi.fn();
    const markAll = vi.fn();
    const renderer = Object.create(MaterialRenderer.prototype) as {
      powderRenderStyle: 'smooth' | 'local' | 'grains';
      presenter?: { setPowderRenderStyle(style: 'smooth' | 'local' | 'grains'): void };
      contourChunks: { markAll(): void };
      changed: boolean;
      setPowderRenderStyle(style: 'smooth' | 'local' | 'grains'): void;
    };
    Object.assign(renderer, {
      powderRenderStyle: 'smooth',
      presenter: { setPowderRenderStyle },
      contourChunks: { markAll },
      changed: false,
    });

    renderer.setPowderRenderStyle('local');

    expect(setPowderRenderStyle).toHaveBeenCalledOnce();
    expect(setPowderRenderStyle).toHaveBeenCalledWith('local');
    expect(markAll).not.toHaveBeenCalled();
    expect(renderer.powderRenderStyle).toBe('local');
    expect(renderer.changed).toBe(false);
  });

  it('retains Powder-style Canvas invalidation while no WebGL presenter is active', () => {
    const markAll = vi.fn();
    const renderer = Object.create(MaterialRenderer.prototype) as {
      powderRenderStyle: 'smooth' | 'local' | 'grains';
      presenter?: undefined;
      contourChunks: { markAll(): void };
      changed: boolean;
      setPowderRenderStyle(style: 'smooth' | 'local' | 'grains'): void;
    };
    Object.assign(renderer, {
      powderRenderStyle: 'smooth',
      presenter: undefined,
      contourChunks: { markAll },
      changed: false,
    });

    renderer.setPowderRenderStyle('grains');

    expect(markAll).toHaveBeenCalledOnce();
    expect(renderer.powderRenderStyle).toBe('grains');
    expect(renderer.changed).toBe(true);
  });

  it('delegates photon/Metal irradiance without queuing a Canvas or second field frame', () => {
    const setPhotonMetalIrradianceVfxEnabled = vi.fn();
    const renderer = Object.create(MaterialRenderer.prototype) as {
      presenter?: { setPhotonMetalIrradianceVfxEnabled(enabled: boolean): void };
      changed: boolean;
      setPhotonMetalIrradianceVfxEnabled(enabled: boolean): void;
    };
    Object.assign(renderer, {
      presenter: { setPhotonMetalIrradianceVfxEnabled },
      changed: false,
    });

    renderer.setPhotonMetalIrradianceVfxEnabled(false);

    expect(setPhotonMetalIrradianceVfxEnabled).toHaveBeenCalledOnce();
    expect(setPhotonMetalIrradianceVfxEnabled).toHaveBeenCalledWith(false);
    expect(renderer.changed).toBe(false);
  });

  it('retains an early Visual Lab choice across asynchronous WebGL startup', () => {
    const setVisualLabVariant = vi.fn();
    const renderer = Object.create(MaterialRenderer.prototype) as {
      desiredVisualLabVariant?: 0 | 1 | 2;
      presenter?: { setVisualLabVariant(variant: 0 | 1 | 2): void };
      setVisualLabVariant(variant: 0 | 1 | 2): void;
      getVisualLabVariant(): 0 | 1 | 2;
    };

    renderer.presenter = undefined;
    expect(renderer.getVisualLabVariant()).toBe(0);
    renderer.setVisualLabVariant(2);
    expect(renderer.desiredVisualLabVariant).toBe(2);
    expect(renderer.getVisualLabVariant()).toBe(2);

    renderer.presenter = { setVisualLabVariant };
    renderer.setVisualLabVariant(1);
    expect(renderer.desiredVisualLabVariant).toBe(1);
    expect(renderer.getVisualLabVariant()).toBe(1);
    expect(setVisualLabVariant).toHaveBeenCalledOnce();
    expect(setVisualLabVariant).toHaveBeenCalledWith(1);
  });

  it('retains a material-lighting choice across asynchronous WebGL startup', () => {
    const setMaterialLightingVariant = vi.fn();
    const renderer = Object.create(MaterialRenderer.prototype) as {
      desiredMaterialLightingVariant?: 0 | 1 | 2;
      presenter?: {
        setMaterialLightingVariant(variant: 0 | 1 | 2): void;
        getMaterialLightingVariant(): 0 | 1 | 2;
      };
      setMaterialLightingVariant(variant: 0 | 1 | 2): void;
      getMaterialLightingVariant(): 0 | 1 | 2;
    };

    renderer.presenter = undefined;
    expect(renderer.getMaterialLightingVariant()).toBe(0);
    renderer.setMaterialLightingVariant(2);
    expect(renderer.desiredMaterialLightingVariant).toBe(2);
    expect(renderer.getMaterialLightingVariant()).toBe(2);

    renderer.presenter = {
      setMaterialLightingVariant,
      getMaterialLightingVariant: () => renderer.desiredMaterialLightingVariant ?? 0,
    };
    renderer.setMaterialLightingVariant(1);
    expect(setMaterialLightingVariant).toHaveBeenCalledWith(1);
    expect(renderer.getMaterialLightingVariant()).toBe(1);
  });

  it('reports the live product material-lighting profile after WebGL promotion', () => {
    const renderer = Object.create(MaterialRenderer.prototype) as {
      desiredMaterialLightingVariant?: 0 | 1 | 2;
      presenter?: {
        getMaterialLightingVariant(): 0 | 1 | 2;
      };
      getMaterialLightingVariant(): 0 | 1 | 2;
    };
    expect(renderer.getMaterialLightingVariant()).toBe(0);
    renderer.presenter = { getMaterialLightingVariant: () => 2 };
    expect(renderer.getMaterialLightingVariant()).toBe(2);
    renderer.presenter = { getMaterialLightingVariant: () => 0 };
    renderer.desiredMaterialLightingVariant = 2;
    expect(renderer.getMaterialLightingVariant()).toBe(0);
  });

  it('forwards completed-frame tickets only through an active WebGL presenter', () => {
    const receipt = {
      schema: 'anifor.renderer.completed-frame-receipt/v1' as const,
      ticket: 7,
      submission: 19,
      state: 'completed' as const,
    };
    const requestWebGLCompletedFrameReceipt = vi.fn(() => 7);
    const getWebGLCompletedFrameReceipt = vi.fn(() => receipt);
    const renderer = Object.create(MaterialRenderer.prototype) as {
      presenter?: {
        requestWebGLCompletedFrameReceipt(): number | undefined;
        getWebGLCompletedFrameReceipt(ticket: number): typeof receipt | undefined;
      };
      requestWebGLCompletedFrameReceipt(): number | undefined;
      getWebGLCompletedFrameReceipt(ticket: number): typeof receipt | undefined;
    };
    renderer.presenter = {
      requestWebGLCompletedFrameReceipt,
      getWebGLCompletedFrameReceipt,
    };

    expect(renderer.requestWebGLCompletedFrameReceipt()).toBe(7);
    expect(renderer.getWebGLCompletedFrameReceipt(7)).toBe(receipt);
    expect(requestWebGLCompletedFrameReceipt).toHaveBeenCalledOnce();
    expect(getWebGLCompletedFrameReceipt).toHaveBeenCalledWith(7);

    renderer.presenter = undefined;
    expect(renderer.requestWebGLCompletedFrameReceipt()).toBeUndefined();
    expect(renderer.getWebGLCompletedFrameReceipt(7)).toBeUndefined();
  });

  it('forwards selector-owned receipt transactions only through an active presenter', () => {
    const transaction = vi.fn((present: () => void) => {
      present();
      return 9;
    });
    const renderer = Object.create(MaterialRenderer.prototype) as {
      presenter?: { runWithNextWebGLCompletedFrameReceipt(action: () => void): number | undefined };
      runWithNextWebGLCompletedFrameReceipt(action: () => void): number | undefined;
    };
    const present = vi.fn();
    renderer.presenter = { runWithNextWebGLCompletedFrameReceipt: transaction };

    expect(renderer.runWithNextWebGLCompletedFrameReceipt(present)).toBe(9);
    expect(present).toHaveBeenCalledOnce();
    renderer.presenter = undefined;
    expect(renderer.runWithNextWebGLCompletedFrameReceipt(present)).toBeUndefined();
    expect(present).toHaveBeenCalledOnce();
  });

  it('forwards framebuffer-alpha readback tickets only through an active WebGL presenter', () => {
    const readback = {
      schema: 'anifor.renderer.framebuffer-alpha-readback/v1' as const,
      ticket: 5,
      submission: 11,
      state: 'completed' as const,
      digest: { hash: 1, supportHash: 2, alphaSum: 3, nonzero: 4 },
    };
    const request = vi.fn(() => 5);
    const get = vi.fn(() => readback);
    const renderer = Object.create(MaterialRenderer.prototype) as {
      presenter?: {
        requestWebGLFramebufferAlphaReadback(): number | undefined;
        getWebGLFramebufferAlphaReadback(ticket: number): typeof readback | undefined;
      };
      requestWebGLFramebufferAlphaReadback(): number | undefined;
      getWebGLFramebufferAlphaReadback(ticket: number): typeof readback | undefined;
    };
    renderer.presenter = {
      requestWebGLFramebufferAlphaReadback: request,
      getWebGLFramebufferAlphaReadback: get,
    };
    expect(renderer.requestWebGLFramebufferAlphaReadback()).toBe(5);
    expect(renderer.getWebGLFramebufferAlphaReadback(5)).toBe(readback);
    expect(request).toHaveBeenCalledOnce();
    expect(get).toHaveBeenCalledWith(5);

    renderer.presenter = undefined;
    expect(renderer.requestWebGLFramebufferAlphaReadback()).toBeUndefined();
    expect(renderer.getWebGLFramebufferAlphaReadback(5)).toBeUndefined();
  });

  it('ignores a queued frame after navigation has disposed the outgoing renderer', () => {
    const renderer = Object.create(MaterialRenderer.prototype) as {
      disposed: boolean;
      render(time: number): void;
    };
    renderer.disposed = true;

    expect(() => renderer.render(1000)).not.toThrow();
  });

  it('surfaces strict audit teardown failures after detaching the WebGL presenter', async () => {
    const failure = new Error('forced presenter teardown failure');
    const destroyForAudit = vi.fn(() => { throw failure; });
    const renderer = Object.create(MaterialRenderer.prototype) as {
      disposed: boolean;
      presenter?: { destroyForAudit(): void };
      disposeForAudit(): Promise<void>;
    };
    Object.assign(renderer, { disposed: false, presenter: { destroyForAudit } });

    await expect(renderer.disposeForAudit()).rejects.toBe(failure);
    expect(destroyForAudit).toHaveBeenCalledOnce();
    expect(renderer.disposed).toBe(true);
    expect(renderer.presenter).toBeUndefined();
  });

  it('rejects strict Canvas/race teardown while ordinary disposal remains best effort', async () => {
    const missingPresenter = Object.create(MaterialRenderer.prototype) as {
      disposed: boolean;
      presenter?: undefined;
      disposeForAudit(): Promise<void>;
    };
    Object.assign(missingPresenter, { disposed: false, presenter: undefined });
    await expect(missingPresenter.disposeForAudit()).rejects.toThrow(/active WebGL presenter/);

    const forcedCanvas = Object.create(MaterialRenderer.prototype) as {
      disposed: boolean;
      presenter?: undefined;
      backend: { backend: 'canvas2d'; label: 'Canvas 2D'; reason: 'forced' };
      disposeForAudit(): Promise<void>;
    };
    Object.assign(forcedCanvas, {
      disposed: false,
      presenter: undefined,
      backend: { backend: 'canvas2d', label: 'Canvas 2D', reason: 'forced' },
    });
    await expect(forcedCanvas.disposeForAudit()).resolves.toBeUndefined();

    const destroy = vi.fn(() => { throw new Error('ordinary navigation race'); });
    const ordinary = Object.create(MaterialRenderer.prototype) as {
      disposed: boolean;
      presenter?: { destroy(): void };
      dispose(): void;
    };
    Object.assign(ordinary, { disposed: false, presenter: { destroy } });
    expect(() => ordinary.dispose()).not.toThrow();
    expect(destroy).toHaveBeenCalledOnce();
    expect(ordinary.presenter).toBeUndefined();
  });

  it('destroys a strict presenter once even if ordinary pagehide follows', async () => {
    const destroyForAudit = vi.fn();
    const renderer = Object.create(MaterialRenderer.prototype) as {
      disposed: boolean;
      presenter?: { destroyForAudit(): void };
      disposeForAudit(): Promise<void>;
      dispose(): void;
    };
    Object.assign(renderer, { disposed: false, presenter: { destroyForAudit } });

    await expect(renderer.disposeForAudit()).resolves.toBeUndefined();
    renderer.dispose();
    expect(destroyForAudit).toHaveBeenCalledOnce();
  });
});
