/**
 * Stable capture-variant ABI shared by portable Visual Lab evidence tooling.
 * Values and ordering are part of the off/A/B capture contract.
 */
export const VISUAL_LAB_CAPTURE_VARIANTS = Object.freeze([
  Object.freeze({ value: 0, name: 'off' }),
  Object.freeze({ value: 1, name: 'a' }),
  Object.freeze({ value: 2, name: 'b' }),
]);

export const VISUAL_LAB_CAPTURE_VARIANT_NAMES = Object.freeze(
  VISUAL_LAB_CAPTURE_VARIANTS.map(({ name }) => name),
);
