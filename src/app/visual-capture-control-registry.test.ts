import { describe, expect, it } from 'vitest';
import type { PowderRenderStyle } from '../renderer/powder-render-style';
import { VISUAL_CAPTURE_STATIC_CONTRACT } from '../shared/visual-capture-static-contract.js';
import { VISUAL_LAB_STATIC_CONTRACT } from '../shared/visual-lab-static-contract.js';
import {
  VISUAL_CAPTURE_CONTROL_FIXTURE_IDS,
  VisualCaptureControlRegistry,
  type VisualCaptureControlHost,
} from './visual-capture-control-registry';

const POWDER_FIXTURE = 'powder-style-atlas' as const;
const NORMAL_FIXTURES = VISUAL_LAB_STATIC_CONTRACT.fixtures.map(({ name }) => name);

describe('Visual capture control registry', () => {
  it('exports the exact frozen supported fixture list', () => {
    expect(VISUAL_CAPTURE_CONTROL_FIXTURE_IDS).toEqual([
      ...NORMAL_FIXTURES,
      ...VISUAL_CAPTURE_STATIC_CONTRACT.fixtures.map(({ name }) => name),
    ]);
    expect(Object.isFrozen(VISUAL_CAPTURE_CONTROL_FIXTURE_IDS)).toBe(true);
  });

  it('maps variants exactly to Smooth, Local, and Grains and reads them back', () => {
    const fake = new PowderStyleHost('grains');
    const registry = new VisualCaptureControlRegistry(fake);
    registry.markFixturePrepared(POWDER_FIXTURE);

    expect(registry.getVariant(POWDER_FIXTURE)).toBe(2);
    for (const [variant, style] of [
      [0, 'smooth'],
      [1, 'local'],
      [2, 'grains'],
    ] as const) {
      registry.setVariant(POWDER_FIXTURE, variant);
      expect(fake.style).toBe(style);
      expect(registry.getVariant(POWDER_FIXTURE)).toBe(variant);
    }
  });

  it.each(NORMAL_FIXTURES)(
    'maps normal-HDR fixture %s directly to its typed Visual Lab variant',
    (fixture) => {
      const fake = new PowderStyleHost();
      const registry = new VisualCaptureControlRegistry(fake);
      registry.markFixturePrepared(fixture);

      expect(registry.getVariant(fixture)).toBe(0);
      for (const variant of [0, 1, 2] as const) {
        registry.setVariant(fixture, variant);
        expect(fake.visualLabVariant).toBe(variant);
        expect(registry.getVariant(fixture)).toBe(variant);
      }
      expect(fake.style).toBe('smooth');
    },
  );

  it('rejects selection and readback before preparation', () => {
    const registry = new VisualCaptureControlRegistry(new PowderStyleHost());
    expect(() => registry.setVariant(POWDER_FIXTURE, 0)).toThrow('has not been prepared');
    expect(() => registry.getVariant(POWDER_FIXTURE)).toThrow('has not been prepared');
  });

  it('rejects unknown and mismatched fixtures without stale authority', () => {
    const registry = new VisualCaptureControlRegistry(new PowderStyleHost());
    expect(() => registry.markFixturePrepared('not-a-fixture' as never))
      .toThrow('Unknown Visual Lab fixture');

    registry.markFixturePrepared(POWDER_FIXTURE);
    expect(() => registry.setVariant('water-motion', 1)).toThrow('fixture mismatch');
    expect(() => registry.getVariant('oil-motion')).toThrow('fixture mismatch');
    expect(registry.getVariant(POWDER_FIXTURE)).toBe(0);

    registry.markFixturePrepared('water-motion');
    registry.setVariant('water-motion', 1);
    expect(registry.getVariant('water-motion')).toBe(1);
    expect(() => registry.getVariant(POWDER_FIXTURE)).toThrow('fixture mismatch');
  });

  it.each([-1, 3, 1.5, '1', null, undefined])(
    'rejects invalid runtime variant %j',
    (variant) => {
      const fake = new PowderStyleHost();
      const registry = new VisualCaptureControlRegistry(fake);
      registry.markFixturePrepared(POWDER_FIXTURE);
      expect(() => registry.setVariant(POWDER_FIXTURE, variant as never)).toThrow(
        'Invalid Visual capture control variant',
      );
      expect(fake.style).toBe('smooth');
    },
  );

  it('rejects impossible observed styles and a valid but incorrect setter readback', () => {
    const impossible = new PowderStyleHost();
    const impossibleRegistry = new VisualCaptureControlRegistry(impossible);
    impossibleRegistry.markFixturePrepared(POWDER_FIXTURE);
    impossible.style = 'dots' as PowderRenderStyle;
    expect(() => impossibleRegistry.getVariant(POWDER_FIXTURE))
      .toThrow('Impossible observed powder render style');

    const ignored = new PowderStyleHost('smooth', true);
    const ignoredRegistry = new VisualCaptureControlRegistry(ignored);
    ignoredRegistry.markFixturePrepared(POWDER_FIXTURE);
    expect(() => ignoredRegistry.setVariant(POWDER_FIXTURE, 2))
      .toThrow('did not apply "powder-style-atlas" variant 2');
  });

  it('rejects a normal-HDR setter that ignores a requested variant', () => {
    const ignored = new PowderStyleHost('smooth', false, 0, true);
    const registry = new VisualCaptureControlRegistry(ignored);
    registry.markFixturePrepared('water-motion');

    expect(() => registry.setVariant('water-motion', 2))
      .toThrow('did not apply "water-motion" variant 2');
    expect(ignored.visualLabVariant).toBe(0);
  });

  it('rejects impossible normal-HDR readback before it crosses the browser ABI', () => {
    const impossible = new PowderStyleHost();
    const registry = new VisualCaptureControlRegistry(impossible);
    registry.markFixturePrepared('showcase');
    impossible.visualLabVariant = 9 as never;

    expect(() => registry.getVariant('showcase'))
      .toThrow('Invalid Visual capture control variant 9');
  });
});

class PowderStyleHost implements VisualCaptureControlHost {
  constructor(
    public style: PowderRenderStyle = 'smooth',
    private readonly ignoreWrites = false,
    public visualLabVariant: 0 | 1 | 2 = 0,
    private readonly ignoreVisualLabWrites = false,
  ) {}

  setPowderRenderStyle(style: PowderRenderStyle): void {
    if (!this.ignoreWrites) this.style = style;
  }

  getPowderRenderStyle(): PowderRenderStyle {
    return this.style;
  }

  setVisualLabVariant(variant: 0 | 1 | 2): void {
    if (!this.ignoreVisualLabWrites) this.visualLabVariant = variant;
  }

  getVisualLabVariant(): 0 | 1 | 2 {
    return this.visualLabVariant;
  }
}
