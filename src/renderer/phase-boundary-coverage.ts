/** Monotone cubic weight mirrored by the WebGL semantic-field shader. */
export function hermiteWeight(position: number): number {
  const bounded = Math.max(0, Math.min(1, position));
  return bounded * bounded * (3 - 2 * bounded);
}

/** Analytic derivative of hermiteWeight over the unit cell. */
export function hermiteDerivative(position: number): number {
  const bounded = Math.max(0, Math.min(1, position));
  return 6 * bounded * (1 - bounded);
}

export interface PhaseCoverageSample {
  readonly density: number;
  readonly gradientX: number;
  readonly gradientY: number;
}

/** Four-corner reference evaluator for tests and a future Canvas 2x contour path. */
export function samplePhaseCoverage(
  q00: number, q10: number, q01: number, q11: number, x: number, y: number,
): PhaseCoverageSample {
  const weightX = hermiteWeight(x);
  const weightY = hermiteWeight(y);
  const top = q00 + (q10 - q00) * weightX;
  const bottom = q01 + (q11 - q01) * weightX;
  return {
    density: top + (bottom - top) * weightY,
    gradientX: ((q10 - q00) + (q11 - q01 - q10 + q00) * weightY) * hermiteDerivative(x),
    gradientY: ((q01 - q00) + (q11 - q10 - q01 + q00) * weightX) * hermiteDerivative(y),
  };
}

export type ContactPhase = 'solid' | 'powder' | 'liquid' | 'gas' | 'energy' | 'field';

/** Mirrors the shader's asymmetric phase-contact coverage policy. */
export function phaseContactCompatible(owner: ContactPhase, candidate: ContactPhase): boolean {
  if (owner === 'solid') return candidate === 'solid';
  if (owner === 'powder') return candidate === 'powder' || candidate === 'solid';
  if (owner === 'liquid') return candidate === 'liquid';
  if (owner === 'gas') return candidate === 'gas';
  return false;
}

/** Continuous loose-grain to settled-heap blend mirrored by the WebGL shader. */
export function powderBulkWeight(compatibleSupport: number, velocity: number): number {
  return smoothstep(1.55, 2.85, compatibleSupport)
    * (1 - smoothstep(0.025, 0.095, Math.max(0, velocity)));
}

/** Analytic AA disc used as the fixed-2x loose-powder reference. */
export function roundGrainCoverage(
  localX: number, localY: number, offsetX = 0, offsetY = 0,
): number {
  const distance = Math.hypot(localX - 0.5 - offsetX, localY - 0.5 - offsetY);
  return 1 - smoothstep(0.34, 0.56, distance);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}
