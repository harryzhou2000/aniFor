import { MATERIALS, Material } from '../shared/materials';

export interface ControlsCallbacks {
  onMaterial(material: Material): void;
  onRadius(radius: number): void;
  onPause(): void;
  onShare(): Promise<boolean>;
  onClear(): void;
}

export function mountControls(host: HTMLElement, callbacks: ControlsCallbacks): void {
  const tools = document.createElement('nav');
  tools.className = 'palette glass';
  tools.ariaLabel = 'Material palette';
  for (const material of MATERIALS) {
    const button = document.createElement('button');
    button.className = 'material-button';
    button.style.setProperty('--material-color', material.color);
    button.dataset.material = String(material.id);
    button.innerHTML = `<span class="material-dot">${material.icon}</span><span>${material.name}</span>`;
    button.title = material.description;
    button.addEventListener('click', () => {
      tools.querySelector('.selected')?.classList.remove('selected');
      button.classList.add('selected');
      callbacks.onMaterial(material.id);
    });
    tools.append(button);
  }
  tools.querySelector('button')?.classList.add('selected');

  const actions = document.createElement('div');
  actions.className = 'actions glass';
  actions.innerHTML = `
    <label class="brush-size"><span>Brush</span><input aria-label="Brush size" type="range" min="2" max="24" value="7" /></label>
    <button class="action-button pause" aria-label="Pause simulation">Pause</button>
    <button class="action-button share" aria-label="Copy shareable world link">Share</button>
    <button class="action-button clear" aria-label="Clear world">Clear</button>`;
  const radius = actions.querySelector('input') as HTMLInputElement;
  radius.addEventListener('input', () => callbacks.onRadius(Number(radius.value)));
  const pause = actions.querySelector('.pause') as HTMLButtonElement;
  pause.addEventListener('click', () => { callbacks.onPause(); pause.classList.toggle('active'); pause.textContent = pause.classList.contains('active') ? 'Play' : 'Pause'; });
  const share = actions.querySelector('.share') as HTMLButtonElement;
  share.addEventListener('click', async () => {
    share.disabled = true;
    share.textContent = await callbacks.onShare() ? 'Copied' : 'Link ready';
    window.setTimeout(() => { share.disabled = false; share.textContent = 'Share'; }, 1600);
  });
  actions.querySelector('.clear')?.addEventListener('click', callbacks.onClear);
  host.append(tools, actions);
}
