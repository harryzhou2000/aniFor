import { describe, expect, it } from 'vitest';
import type { NativeSign } from '../simulation';
import { hitTestNativeSign } from './native-signs';

const signs: readonly NativeSign[] = [
  { index: 0, x: 40, y: 40, justification: 0, text: 'Left', displayText: 'Left' },
  { index: 1, x: 120, y: 40, justification: 1, text: '{p}', displayText: '2.50' },
  { index: 2, x: 200, y: 12, justification: 2, text: 'Right', displayText: 'Right' },
];

describe('native sign hit testing', () => {
  it('uses TPT justification and flips labels below anchors near the top edge', () => {
    expect(hitTestNativeSign(signs, { x: 44, y: 24 })?.index).toBe(0);
    expect(hitTestNativeSign(signs, { x: 120, y: 24 })?.index).toBe(1);
    expect(hitTestNativeSign(signs, { x: 196, y: 18 })?.index).toBe(2);
  });

  it('keeps an anchor easy to select on touch without swallowing unrelated space', () => {
    expect(hitTestNativeSign(signs, { x: 42, y: 42 })?.index).toBe(0);
    expect(hitTestNativeSign(signs, { x: 80, y: 80 })).toBeUndefined();
  });
});
