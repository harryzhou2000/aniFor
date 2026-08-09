import { describe, expect, it } from 'vitest';
import type { PowderRenderStyle } from '../renderer/powder-render-style';
import {
  VISUAL_CAPTURE_CONTROL_FIXTURE_IDS,
  VisualCaptureControlRegistry,
  type VisualCaptureControlHost,
} from './visual-capture-control-registry';

const FIXTURE = 'powder-style-atlas' as const;

describe('Visual capture control registry', () => {
  it('exports the exact frozen supported fixture list', () => {
    expect(VISUAL_CAPTURE_CONTROL_FIXTURE_IDS).toEqual([FIXTURE]);
    expect(Object.isFrozen(VISUAL_CAPTURE_CONTROL_FIXTURE_IDS)).toBe(true);
  });

  it('maps variants exactly to Smooth, Local, and Grains and reads them back', () => {
    const fake = new PowderStyleHost('grains');
    const registry = new VisualCaptureControlRegistry(fake);
    registry.markFixturePrepared(FIXTURE);

    expect(registry.getVariant(FIXTURE)).toBe(2);
    for (const [variant, style] of [
      [0, 'smooth'],
      [1, 'local'],
      [2, 'grains'],
    ] as const) {
      registry.setVariant(FIXTURE, variant);
      expect(fake.style).toBe(style);
      expect(registry.getVariant(FIXTURE)).toBe(variant);
    }
  });

  it('rejects selection and readback before preparation', () => {
    const registry = new VisualCaptureControlRegistry(new PowderStyleHost());
    expect(() => registry.setVariant(FIXTURE, 0)).toThrow('has not been prepared');
    expect(() => registry.getVariant(FIXTURE)).toThrow('has not been prepared');
  });

  it('rejects unknown, unsupported, and mismatched fixtures without stale authority', () => {
    const registry = new VisualCaptureControlRegistry(new PowderStyleHost());
    expect(() => registry.markFixturePrepared('not-a-fixture' as never))
      .toThrow('Unknown prepared Visual Lab fixture');

    registry.markFixturePrepared(FIXTURE);
    expect(() => registry.setVariant('water-motion', 1)).toThrow('fixture mismatch');
    expect(() => registry.getVariant('oil-motion')).toThrow('fixture mismatch');
    expect(registry.getVariant(FIXTURE)).toBe(0);

    registry.markFixturePrepared('oil-motion');
    expect(() => registry.setVariant('oil-motion', 1))
      .toThrow('Unsupported Visual capture control fixture');
    expect(() => registry.getVariant('oil-motion'))
      .toThrow('Unsupported Visual capture control fixture');
    expect(() => registry.getVariant(FIXTURE)).toThrow('fixture mismatch');
  });

  it.each([-1, 3, 1.5, '1', null, undefined])(
    'rejects invalid runtime variant %j',
    (variant) => {
      const fake = new PowderStyleHost();
      const registry = new VisualCaptureControlRegistry(fake);
      registry.markFixturePrepared(FIXTURE);
      expect(() => registry.setVariant(FIXTURE, variant as never)).toThrow(
        'Invalid Visual capture control variant',
      );
      expect(fake.style).toBe('smooth');
    },
  );

  it('rejects impossible observed styles and a valid but incorrect setter readback', () => {
    const impossible = new PowderStyleHost();
    const impossibleRegistry = new VisualCaptureControlRegistry(impossible);
    impossibleRegistry.markFixturePrepared(FIXTURE);
    impossible.style = 'dots' as PowderRenderStyle;
    expect(() => impossibleRegistry.getVariant(FIXTURE))
      .toThrow('Impossible observed powder render style');

    const ignored = new PowderStyleHost('smooth', true);
    const ignoredRegistry = new VisualCaptureControlRegistry(ignored);
    ignoredRegistry.markFixturePrepared(FIXTURE);
    expect(() => ignoredRegistry.setVariant(FIXTURE, 2))
      .toThrow('did not apply "powder-style-atlas" variant 2');
  });
});

class PowderStyleHost implements VisualCaptureControlHost {
  constructor(
    public style: PowderRenderStyle = 'smooth',
    private readonly ignoreWrites = false,
  ) {}

  setPowderRenderStyle(style: PowderRenderStyle): void {
    if (!this.ignoreWrites) this.style = style;
  }

  getPowderRenderStyle(): PowderRenderStyle {
    return this.style;
  }
}
