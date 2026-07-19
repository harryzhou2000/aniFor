import { describe, expect, it, vi } from 'vitest';
import { installWebGLContextLossHandler } from './webgl-context-loss';

describe('WebGL context-loss hook', () => {
  it('cancels context loss and forwards it to the renderer recovery path', () => {
    const target = new EventTarget();
    const onContextLost = vi.fn();
    const remove = installWebGLContextLossHandler(target, onContextLost);
    const event = new Event('webglcontextlost', { cancelable: true });

    expect(target.dispatchEvent(event)).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    expect(onContextLost).toHaveBeenCalledOnce();

    remove();
    target.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(onContextLost).toHaveBeenCalledOnce();
  });
});
