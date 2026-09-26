import type { SimulationBackend } from '../simulation/types';

export type RenderMode = '2d' | '3d';
export const WORLD_STORAGE_KEY = 'stillroom-world-v1';

export function resolveRenderMode(search: string): RenderMode {
  return new URLSearchParams(search).get('view') === '3d' ? '3d' : '2d';
}

/** A mode transition carries the world, not the outgoing mode's diagnostic flags. */
export function renderModeUrl(current: string, mode: RenderMode, paused: boolean): string {
  const url = new URL(current);
  url.search = '';
  url.hash = '';
  url.searchParams.set('view', mode);
  url.searchParams.set('handoff', '1');
  if (paused) url.searchParams.set('paused', '1');
  return url.href;
}

export function switchRenderMode(
  simulation: Pick<SimulationBackend, 'saveWorld'>,
  mode: RenderMode,
  paused: boolean,
  options: { currentUrl: string; storage: Pick<Storage, 'setItem'>; navigate: (url: string) => void },
): void {
  // Synchronous persistence must succeed before navigation can release the backend.
  const world = simulation.saveWorld();
  if (!world) throw new Error('The current world could not be saved.');
  options.storage.setItem(WORLD_STORAGE_KEY, world);
  options.navigate(renderModeUrl(options.currentUrl, mode, paused));
}

export function mountRenderModeSwitch(
  host: HTMLElement, mode: RenderMode, simulation: SimulationBackend, paused: () => boolean,
): void {
  const group = document.createElement('div');
  group.className = 'render-mode-switch';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Rendering mode');
  for (const value of ['2d', '3d'] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = value === '2d' ? '2D · Field' : '3D · Studio';
    button.dataset.renderMode = value;
    button.setAttribute('aria-pressed', String(mode === value));
    button.addEventListener('click', () => {
      if (value === mode) return;
      try {
        switchRenderMode(simulation, value, paused(), {
          currentUrl: location.href, storage: localStorage, navigate: (url) => location.assign(url),
        });
      } catch (error) {
        message.textContent = `Could not switch views: ${error instanceof Error ? error.message : String(error)} Your world is still open.`;
      }
    });
    group.append(button);
  }
  const message = document.createElement('span');
  message.className = 'render-mode-error';
  message.setAttribute('role', 'alert');
  group.append(message);
  host.append(group);
}
