export function supportsWebGL(): boolean {
  const probe = document.createElement('canvas');
  const context = probe.getContext('webgl2') ?? probe.getContext('webgl');
  if (!context || context.isContextLost()) return false;
  return true;
}
