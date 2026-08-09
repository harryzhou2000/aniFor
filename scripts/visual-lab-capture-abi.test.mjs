import { describe, expect, it } from 'vitest';
import {
  VISUAL_LAB_CAPTURE_VARIANT_NAMES,
  VISUAL_LAB_CAPTURE_VARIANTS,
} from './visual-lab-capture-abi.mjs';

describe('Visual Lab capture ABI', () => {
  it('pins the exact ordered off/A/B descriptor mapping', () => {
    expect(VISUAL_LAB_CAPTURE_VARIANTS).toEqual([
      { value: 0, name: 'off' },
      { value: 1, name: 'a' },
      { value: 2, name: 'b' },
    ]);
    expect(VISUAL_LAB_CAPTURE_VARIANT_NAMES).toEqual(['off', 'a', 'b']);
    expect(VISUAL_LAB_CAPTURE_VARIANT_NAMES).toEqual(
      VISUAL_LAB_CAPTURE_VARIANTS.map(({ name }) => name),
    );
  });

  it('is recursively immutable', () => {
    expect(Object.isFrozen(VISUAL_LAB_CAPTURE_VARIANTS)).toBe(true);
    expect(Object.isFrozen(VISUAL_LAB_CAPTURE_VARIANT_NAMES)).toBe(true);
    expect(VISUAL_LAB_CAPTURE_VARIANTS.every(Object.isFrozen)).toBe(true);
    expect(() => { VISUAL_LAB_CAPTURE_VARIANTS[0].name = 'changed'; }).toThrow(TypeError);
    expect(() => { VISUAL_LAB_CAPTURE_VARIANT_NAMES.push('changed'); }).toThrow(TypeError);
  });

  it('has unique contiguous values and JSON-safe data only', () => {
    const values = VISUAL_LAB_CAPTURE_VARIANTS.map(({ value }) => value);
    const names = VISUAL_LAB_CAPTURE_VARIANTS.map(({ name }) => name);
    expect(new Set(values).size).toBe(values.length);
    expect(new Set(names).size).toBe(names.length);
    expect(values).toEqual(Array.from({ length: values.length }, (_, index) => index));
    expect(JSON.parse(JSON.stringify(VISUAL_LAB_CAPTURE_VARIANTS))).toEqual(
      VISUAL_LAB_CAPTURE_VARIANTS,
    );
    expect(JSON.parse(JSON.stringify(VISUAL_LAB_CAPTURE_VARIANT_NAMES))).toEqual(
      VISUAL_LAB_CAPTURE_VARIANT_NAMES,
    );
  });
});
