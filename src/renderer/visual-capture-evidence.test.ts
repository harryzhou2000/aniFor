import { describe, expect, it, vi } from 'vitest';
import { readVisualCaptureEvidenceAlpha, type VisualCaptureEvidenceReaders } from './visual-capture-evidence';

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
});
