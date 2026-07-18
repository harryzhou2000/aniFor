export function supportsWebGL(): boolean {
  const probe = document.createElement('canvas');
  const context = probe.getContext('webgl2') ?? probe.getContext('webgl');
  if (!context || context.isContextLost()) return false;
  return true;
}

/** Diagnostic override for exercising the compatibility renderer in real browsers. */
export function forceCanvas2D(search = globalThis.location?.search ?? ''): boolean {
  return new URLSearchParams(search).get('renderer') === 'canvas2d';
}
