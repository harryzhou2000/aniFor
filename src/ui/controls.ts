import { MATERIALS, Material, type MaterialCategory, type MaterialInfo } from '../shared/materials';

export interface MaterialGroup {
  readonly id: MaterialCategory;
  readonly label: string;
  readonly description: string;
  readonly materials: readonly MaterialInfo[];
}

const MATERIAL_GROUP_DEFINITIONS: ReadonlyArray<Omit<MaterialGroup, 'materials'>> = [
  { id: 'powders', label: 'Powders', description: 'Grains, crystals, and reactive dusts' },
  { id: 'liquids', label: 'Liquids', description: 'Flowing, molten, and cryogenic fluids' },
  { id: 'solids', label: 'Solids', description: 'Structures and organic matter' },
  { id: 'gases', label: 'Gases', description: 'Drifting and reactive atmospheres' },
  { id: 'energy', label: 'Energy', description: 'Heat, flame, and plasma' },
  { id: 'explosives', label: 'Explosives', description: 'Energetic powders and compounds' },
  { id: 'special', label: 'Special', description: 'Unusual tools and materials' },
];

export function groupMaterials(materials: readonly MaterialInfo[] = MATERIALS): readonly MaterialGroup[] {
  return MATERIAL_GROUP_DEFINITIONS.map((group) => ({
    ...group,
    materials: materials.filter((material) => material.category === group.id),
  })).filter((group) => group.materials.length > 0);
}

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
  for (const [groupIndex, group] of groupMaterials().entries()) {
    const disclosure = document.createElement('details');
    disclosure.className = 'material-group';
    disclosure.open = groupIndex === 0;

    const heading = document.createElement('summary');
    heading.innerHTML = `<span><strong>${group.label}</strong><small>${group.description}</small></span><span class="material-count">${group.materials.length}</span>`;
    disclosure.append(heading);

    const grid = document.createElement('div');
    grid.className = 'material-grid';
    for (const material of group.materials) {
      const button = document.createElement('button');
      button.className = 'material-button';
      button.style.setProperty('--material-color', material.color);
      button.dataset.material = String(material.id);
      button.innerHTML = `<span class="material-dot">${material.icon}</span><span>${material.name}</span>`;
      button.title = material.description;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        const selected = tools.querySelector<HTMLButtonElement>('.material-button.selected');
        selected?.classList.remove('selected');
        selected?.setAttribute('aria-pressed', 'false');
        button.classList.add('selected');
        button.setAttribute('aria-pressed', 'true');
        callbacks.onMaterial(material.id);
      });
      grid.append(button);
    }
    disclosure.append(grid);
    tools.append(disclosure);
  }
  const initialMaterial = tools.querySelector<HTMLButtonElement>('.material-button');
  initialMaterial?.classList.add('selected');
  initialMaterial?.setAttribute('aria-pressed', 'true');

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
