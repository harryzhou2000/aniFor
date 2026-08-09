import { describe, expect, it } from 'vitest';
import { VISUAL_CAPTURE_STATIC_CONTRACT } from '../src/shared/visual-capture-static-contract.js';
import { VISUAL_LAB_STATIC_CONTRACT } from '../src/shared/visual-lab-static-contract.js';
import {
  buildVisualCaptureEvidenceReaderExpression,
  normalizeVisualCaptureEvidence,
  resolveVisualCaptureEvidence,
  VISUAL_CAPTURE_EVIDENCE_DESCRIPTORS,
} from './visual-capture-evidence.mjs';

describe('closed visual capture evidence registry', () => {
  it('owns the complete frozen plane-to-browser-reader mapping', () => {
    expect(VISUAL_CAPTURE_EVIDENCE_DESCRIPTORS).toEqual([
      { readerMethod: 'atmosphereFieldAlpha', plane: 'atmosphere-alpha' },
      { readerMethod: 'liquidFieldAlpha', plane: 'liquid-alpha' },
      { readerMethod: 'emissionFieldAlpha', plane: 'emission-alpha' },
      { readerMethod: 'powderSurfaceAlpha', plane: 'powder-surface-alpha' },
    ]);
    expect(Object.isFrozen(VISUAL_CAPTURE_EVIDENCE_DESCRIPTORS)).toBe(true);
    for (const descriptor of VISUAL_CAPTURE_EVIDENCE_DESCRIPTORS) {
      expect(Object.isFrozen(descriptor)).toBe(true);
      expect(resolveVisualCaptureEvidence(descriptor.plane)).toBe(descriptor);
    }
  });

  it('normalizes data-only and matching legacy records without trusting method metadata', () => {
    expect(normalizeVisualCaptureEvidence({ plane: 'powder-surface-alpha' })).toEqual({
      readerMethod: 'powderSurfaceAlpha', plane: 'powder-surface-alpha',
    });
    expect(normalizeVisualCaptureEvidence({
      plane: 'liquid-alpha', readerMethod: 'liquidFieldAlpha',
    })).toEqual({ plane: 'liquid-alpha', readerMethod: 'liquidFieldAlpha' });
    expect(() => normalizeVisualCaptureEvidence({
      plane: 'liquid-alpha', readerMethod: 'powderSurfaceAlpha',
    })).toThrow('mismatched legacy reader');
    expect(() => normalizeVisualCaptureEvidence({
      plane: 'liquid-alpha', expression: 'hostile()',
    })).toThrow('unsupported metadata');
    expect(() => normalizeVisualCaptureEvidence({ plane: 'unknown-alpha' }))
      .toThrow('Unknown visual capture evidence plane');
  });

  it('emits a direct fixed browser call and rejects an unsafe audit identifier', () => {
    const expression = buildVisualCaptureEvidenceReaderExpression('powder-surface-alpha');
    expect(expression).toContain(
      'audit.visualCaptureEvidenceAlpha("powder-surface-alpha", x, y)',
    );
    expect(expression).not.toContain('audit[');
    const reader = Function('audit', `return ${expression};`)({
      visualCaptureEvidenceAlpha: (plane, x, y) => (
        plane === 'powder-surface-alpha' ? x * 10 + y : -1
      ),
    });
    expect(reader(4, 7)).toBe(47);
    expect(() => Function('audit', `return ${expression};`)({})(1, 2))
      .toThrow('visual-capture evidence bridge is unavailable: powder-surface-alpha');
    expect(() => buildVisualCaptureEvidenceReaderExpression(
      'powder-surface-alpha', 'audit[hostile]',
    )).toThrow('Unsafe visual capture audit identifier');
  });

  it('covers every deployed evidence plane while keeping the sibling contract data-only', () => {
    for (const domain of VISUAL_LAB_STATIC_CONTRACT.domains) {
      if (domain.evidence !== null) expect(() => normalizeVisualCaptureEvidence(domain.evidence)).not.toThrow();
    }
    for (const domain of VISUAL_CAPTURE_STATIC_CONTRACT.extensionDomains) {
      expect(() => normalizeVisualCaptureEvidence(domain.evidence)).not.toThrow();
    }
    expect(JSON.stringify(VISUAL_CAPTURE_STATIC_CONTRACT)).not.toContain('readerMethod');
  });

  it('preserves the historical report evidence byte order exactly', () => {
    expect(JSON.stringify(normalizeVisualCaptureEvidence({ plane: 'powder-surface-alpha' })))
      .toBe('{"readerMethod":"powderSurfaceAlpha","plane":"powder-surface-alpha"}');
    expect(JSON.stringify(normalizeVisualCaptureEvidence({
      readerMethod: 'atmosphereFieldAlpha', plane: 'atmosphere-alpha',
    }))).toBe('{"readerMethod":"atmosphereFieldAlpha","plane":"atmosphere-alpha"}');
  });
});
