export type WebGLContextLossTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

/**
 * Installs the cancelable WebGL loss hook required for deterministic fallback.
 * The caller owns one-shot policy because browsers may dispatch repeated loss
 * notifications while a renderer is being torn down.
 */
export function installWebGLContextLossHandler(
  target: WebGLContextLossTarget,
  onContextLost: () => void,
): () => void {
  const listener = (event: Event): void => {
    event.preventDefault();
    onContextLost();
  };
  target.addEventListener('webglcontextlost', listener);
  return () => target.removeEventListener('webglcontextlost', listener);
}
