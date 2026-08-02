import { describe, expect, it, vi } from 'vitest';
import { navigateToRenderScale } from './render-scale-navigation';

describe('navigateToRenderScale', () => {
  it('persists an ordinary world synchronously before navigation', () => {
    const order: string[] = [];
    let assigned = '';
    navigateToRenderScale(8, {
      currentUrl: 'https://example.test/game?powder=smooth&renderScale=2#probe',
      diagnosticScene: false,
      persist: () => { order.push('persist'); },
      assign: (href) => { order.push('assign'); assigned = href; },
    });

    expect(order).toEqual(['persist', 'assign']);
    expect(assigned).toBe('https://example.test/game?powder=smooth&renderScale=8#probe');
  });

  it('does not persist a render or wall diagnostic fixture', () => {
    const persist = vi.fn();
    const assign = vi.fn();
    navigateToRenderScale(4, {
      currentUrl: 'https://example.test/?scene=render-lab&simulation=native&renderScale=2',
      diagnosticScene: true,
      persist,
      assign,
    });

    expect(persist).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith(
      'https://example.test/?scene=render-lab&simulation=native&renderScale=4',
    );
  });

  it('waits for an optional renderer release before replacing the document', async () => {
    const order: string[] = [];
    let release: (() => void) | undefined;
    navigateToRenderScale(8, {
      currentUrl: 'https://example.test/?renderScale=2',
      diagnosticScene: false,
      persist: () => { order.push('persist'); },
      prepare: () => new Promise<void>((resolve) => {
        release = () => { order.push('release'); resolve(); };
      }),
      assign: () => { order.push('assign'); },
    });

    expect(order).toEqual(['persist']);
    release?.();
    await Promise.resolve();
    expect(order).toEqual(['persist', 'release', 'assign']);
  });
});
