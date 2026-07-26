import { describe, expect, it } from 'vitest';
import { createAnimationFrameCoalescer } from './field-renderer';

describe('field renderer layout scheduling', () => {
  it('coalesces every resize source into one post-layout update per frame', () => {
    const frames: FrameRequestCallback[] = [];
    let updates = 0;
    const schedule = createAnimationFrameCoalescer(
      () => { updates++; },
      (frame) => {
        frames.push(frame);
        return frames.length;
      },
    );

    // Host ResizeObserver, window resize, visual viewport, and compact-media
    // notifications can all arrive for the same layout change.
    schedule();
    schedule();
    schedule();
    schedule();
    expect(frames).toHaveLength(1);
    expect(updates).toBe(0);

    frames.shift()?.(0);
    expect(updates).toBe(1);

    schedule();
    expect(frames).toHaveLength(1);
    frames.shift()?.(16.7);
    expect(updates).toBe(2);
  });
});
