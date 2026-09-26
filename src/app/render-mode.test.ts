import { describe, expect, it, vi } from 'vitest';
import { renderModeUrl, resolveRenderMode, switchRenderMode, WORLD_STORAGE_KEY } from './render-mode';

describe('render mode transitions', () => {
  it('keeps existing links in 2D and recognizes explicit 3D links', () => {
    expect(resolveRenderMode('?renderer=webgl')).toBe('2d');
    expect(resolveRenderMode('?view=3d')).toBe('3d');
  });
  it('carries pause state and removes fixture and shared-world overrides', () => {
    const url = new URL(renderModeUrl('https://example.test/game/?scene=showcase&renderer=canvas2d#world=old', '3d', true));
    expect(url.pathname).toBe('/game/');
    expect(Object.fromEntries(url.searchParams)).toEqual({ view: '3d', handoff: '1', paused: '1' });
    expect(url.hash).toBe('');
  });
  it('persists the exact native save before navigating', () => {
    const events: string[] = [];
    switchRenderMode({saveWorld: () => 'native-world'}, '2d', false, {
      currentUrl: 'https://example.test/?view=3d',
      storage: {setItem: (key, value) => events.push(`${key}:${value}`)},
      navigate: () => events.push('navigate'),
    });
    expect(events).toEqual([`${WORLD_STORAGE_KEY}:native-world`, 'navigate']);
  });
  it('keeps the current view when storage fails', () => {
    const navigate = vi.fn();
    expect(() => switchRenderMode({saveWorld: () => 'world'}, '3d', false, {
      currentUrl: 'https://example.test/', storage: {setItem: () => { throw new Error('quota'); }}, navigate,
    })).toThrow('quota');
    expect(navigate).not.toHaveBeenCalled();
  });
});
