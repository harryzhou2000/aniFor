import { describe, expect, it, vi } from 'vitest';
import {
  digestVisualCaptureEvidenceAlpha,
  readVisualCaptureEvidenceAlpha,
  type VisualCaptureEvidenceReaders,
} from './visual-capture-evidence';

describe('renderer visual capture evidence bridge', () => {
  it('dispatches every closed plane to the byte-identical legacy reader', () => {
    const readers: VisualCaptureEvidenceReaders = {
      atmosphereFieldAlphaAt: vi.fn(() => 11),
      liquidFieldAlphaAt: vi.fn(() => 22),
      emissionFieldAlphaAt: vi.fn(() => 33),
      powderSurfaceAlphaAt: vi.fn(() => 44),
    };
    expect(readVisualCaptureEvidenceAlpha(readers, 'atmosphere-alpha', 4, 7)).toBe(11);
    expect(readVisualCaptureEvidenceAlpha(readers, 'liquid-alpha', 4, 7)).toBe(22);
    expect(readVisualCaptureEvidenceAlpha(readers, 'emission-alpha', 4, 7)).toBe(33);
    expect(readVisualCaptureEvidenceAlpha(readers, 'powder-surface-alpha', 4, 7)).toBe(44);
    for (const reader of Object.values(readers)) expect(reader).toHaveBeenCalledWith(4, 7);
  });

  it('rejects an untyped runtime plane before any reader executes', () => {
    const readers: VisualCaptureEvidenceReaders = {
      atmosphereFieldAlphaAt: vi.fn(),
      liquidFieldAlphaAt: vi.fn(),
      emissionFieldAlphaAt: vi.fn(),
      powderSurfaceAlphaAt: vi.fn(),
    };
    expect(() => readVisualCaptureEvidenceAlpha(readers, 'hostile-alpha' as never, 1, 2))
      .toThrow('Unknown visual capture evidence plane "hostile-alpha"');
    for (const reader of Object.values(readers)) expect(reader).not.toHaveBeenCalled();
  });

  it('keeps the bulk digest byte-identical while dispatching its plane once', () => {
    const bytes = [0, 255, 17, 128, 1, 0];
    const readers: VisualCaptureEvidenceReaders = {
      atmosphereFieldAlphaAt: vi.fn(),
      liquidFieldAlphaAt: vi.fn((x, y) => bytes[y * 3 + x]),
      emissionFieldAlphaAt: vi.fn(),
      powderSurfaceAlphaAt: vi.fn(),
    };
    let hash = 2166136261 >>> 0;
    let supportHash = 2166136261 >>> 0;
    let alphaSum = 0;
    let nonzero = 0;
    bytes.forEach((byte, index) => {
      const supported = Number(byte > 0);
      hash = Math.imul((hash ^ byte ^ index) >>> 0, 16777619) >>> 0;
      supportHash = Math.imul((supportHash ^ supported ^ index) >>> 0, 16777619) >>> 0;
      alphaSum += byte;
      nonzero += supported;
    });
    expect(digestVisualCaptureEvidenceAlpha(readers, 'liquid-alpha', 3, 2))
      .toEqual({ hash, supportHash, alphaSum, nonzero });
    expect(readers.liquidFieldAlphaAt).toHaveBeenCalledTimes(6);
    expect(readers.atmosphereFieldAlphaAt).not.toHaveBeenCalled();
    expect(readers.emissionFieldAlphaAt).not.toHaveBeenCalled();
    expect(readers.powderSurfaceAlphaAt).not.toHaveBeenCalled();
  });
});
