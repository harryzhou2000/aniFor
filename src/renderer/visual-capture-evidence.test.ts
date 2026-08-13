import { describe, expect, it, vi } from 'vitest';
import {
  digestPackedVisualCaptureEvidenceAlpha,
  digestVisualCaptureEvidenceAlpha,
  readVisualCaptureEvidenceAlpha,
  type VisualCaptureEvidenceReaders,
} from './visual-capture-evidence';
import { canvasAtmosphereAlphaAtWorldCell } from './canvas-atmosphere-relief';
import { sampleCanvasFieldAlpha } from './canvas-surface-light';

function rgbaField(width: number, height: number, seed: number) {
  const bytes = new Uint8Array(width * height * 4);
  let state = seed >>> 0;
  for (let index = 0; index < bytes.length; index++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    bytes[index] = state >>> 24;
  }
  return { bytes, width, height };
}

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

  it('matches the scalar readers for packed direct and compact fields', () => {
    for (const [worldWidth, worldHeight, compactWidth, compactHeight] of [
      [1, 1, 1, 1], [3, 2, 2, 1], [5, 7, 2, 3], [4, 3, 7, 5], [31, 19, 11, 7],
    ] as const) {
      const fields = {
        atmosphere: rgbaField(compactWidth, compactHeight, worldWidth * 101 + worldHeight),
        liquid: rgbaField(worldWidth, worldHeight, worldWidth * 103 + worldHeight),
        emission: rgbaField(compactWidth, compactHeight, worldWidth * 107 + worldHeight),
        powderSurface: rgbaField(worldWidth, worldHeight, worldWidth * 109 + worldHeight),
      };
      const readers: VisualCaptureEvidenceReaders = {
        atmosphereFieldAlphaAt: (x, y) => canvasAtmosphereAlphaAtWorldCell(
          fields.atmosphere.bytes, compactWidth, compactHeight,
          worldWidth, worldHeight, x, y,
        ) * 255,
        liquidFieldAlphaAt: (x, y) => fields.liquid.bytes[(y * worldWidth + x) * 4 + 3],
        emissionFieldAlphaAt: (x, y) => sampleCanvasFieldAlpha(
          fields.emission.bytes, compactWidth, compactHeight,
          worldWidth, worldHeight, x, y,
        ),
        powderSurfaceAlphaAt: (x, y) => (
          fields.powderSurface.bytes[(y * worldWidth + x) * 4 + 3]
        ),
      };
      for (const plane of [
        'atmosphere-alpha', 'liquid-alpha', 'emission-alpha', 'powder-surface-alpha',
      ] as const) {
        expect(digestPackedVisualCaptureEvidenceAlpha(
          fields, plane, worldWidth, worldHeight,
        )).toEqual(digestVisualCaptureEvidenceAlpha(
          readers, plane, worldWidth, worldHeight,
        ));
      }
    }
  });

  it('preserves the atmosphere half-tie arithmetic at real field dimensions', () => {
    const worldWidth = 612;
    const worldHeight = 384;
    const fields = {
      atmosphere: rgbaField(306, 192, 0x5eed),
      liquid: rgbaField(worldWidth, worldHeight, 1),
      emission: rgbaField(204, 128, 2),
      powderSurface: rgbaField(worldWidth, worldHeight, 3),
    };
    expect(digestPackedVisualCaptureEvidenceAlpha(
      fields, 'atmosphere-alpha', worldWidth, worldHeight,
    )).toEqual(digestVisualCaptureEvidenceAlpha({
      atmosphereFieldAlphaAt: (x, y) => canvasAtmosphereAlphaAtWorldCell(
        fields.atmosphere.bytes, 306, 192, worldWidth, worldHeight, x, y,
      ) * 255,
      liquidFieldAlphaAt: vi.fn(), emissionFieldAlphaAt: vi.fn(), powderSurfaceAlphaAt: vi.fn(),
    }, 'atmosphere-alpha', worldWidth, worldHeight));
  });

  it('fails packed routing closed on malformed dimensions', () => {
    const field = rgbaField(2, 2, 7);
    const fields = { atmosphere: field, liquid: field, emission: field, powderSurface: field };
    expect(digestPackedVisualCaptureEvidenceAlpha(fields, 'liquid-alpha', 3, 2)).toBeUndefined();
    expect(digestPackedVisualCaptureEvidenceAlpha(fields, 'atmosphere-alpha', 0, 2)).toBeUndefined();
    expect(() => digestPackedVisualCaptureEvidenceAlpha(
      fields, 'hostile-alpha' as never, 2, 2,
    )).toThrow('Unknown visual capture evidence plane "hostile-alpha"');
  });
});
