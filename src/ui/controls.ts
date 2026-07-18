import { MATERIALS, Material, type MaterialCategory, type MaterialInfo } from '../shared/materials';
import { filterTools, isToolAvailable, materialTools, recordRecent, type CatalogTool, type ElementToolInfo, type ToolFilter, type ToolKind } from './tool-catalog';

const FAVORITES_KEY = 'anifortpt-favorite-tools-v1';
const RECENT_KEY = 'anifortpt-recent-tools-v1';
let controlsInstance = 0;

export interface MaterialGroup {
  readonly id: MaterialCategory;
  readonly label: string;
  readonly description: string;
  readonly materials: readonly MaterialInfo[];
}

interface ToolGroup {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly tools: readonly CatalogTool[];
}

const MATERIAL_GROUP_DEFINITIONS: ReadonlyArray<{ readonly id: string; readonly label: string; readonly description: string }> = [
  { id: 'powders', label: 'Powders', description: 'Grains, crystals, and reactive dusts' },
  { id: 'liquids', label: 'Liquids', description: 'Flowing, molten, and cryogenic fluids' },
  { id: 'solids', label: 'Solids', description: 'Structures and organic matter' },
  { id: 'gases', label: 'Gases', description: 'Drifting and reactive atmospheres' },
  { id: 'energy', label: 'Energy', description: 'Heat, flame, and plasma' },
  { id: 'explosives', label: 'Explosives', description: 'Energetic powders and compounds' },
  { id: 'life', label: 'Life', description: 'Plants, growth, and living systems' },
  { id: 'radioactive', label: 'Radioactive', description: 'Radiation and subatomic particles' },
  { id: 'force', label: 'Force elements', description: 'Particles that influence pressure and gravity' },
  { id: 'electronics', label: 'Electronics', description: 'Conductors, switches, and logic' },
  { id: 'powered', label: 'Powered', description: 'Elements activated by electricity' },
  { id: 'sensors', label: 'Sensors', description: 'Elements that detect world conditions' },
  { id: 'special', label: 'Special', description: 'Unusual tools and materials' },
];

const KIND_LABELS: Readonly<Record<ToolKind, string>> = {
  element: 'Elements', wall: 'Walls', force: 'Forces', thermal: 'Thermal', source: 'Sources', sign: 'Signs', utility: 'Tools',
};

export function groupMaterials(materials: readonly MaterialInfo[] = MATERIALS): readonly MaterialGroup[] {
  const definitions = new Map<string, { label: string; description: string }>(
    MATERIAL_GROUP_DEFINITIONS.map(({ id, label, description }) => [id, { label, description }]),
  );
  const categories = new Map<MaterialCategory, MaterialInfo[]>();
  for (const material of materials) {
    const group = categories.get(material.category) ?? [];
    group.push(material);
    categories.set(material.category, group);
  }
  return Array.from(categories, ([id, groupedMaterials]) => ({
    id,
    label: definitions.get(id)?.label ?? titleCase(id),
    description: definitions.get(id)?.description ?? `${titleCase(id)} elements`,
    materials: groupedMaterials,
  }));
}

function groupCatalogTools(tools: readonly CatalogTool[]): readonly ToolGroup[] {
  const elementById = new Map(MATERIALS.map((material) => [material.id, material]));
  const materialGroups = groupMaterials(tools.flatMap((tool) => tool.kind === 'element' ? [elementById.get(tool.id)!] : []).filter(Boolean));
  const definitions = new Map<string, { label: string; description: string }>(materialGroups.map(({ id, label, description }) => [id, { label, description }]));
  const categories = new Map<string, CatalogTool[]>();
  for (const tool of tools) {
    const group = categories.get(tool.category) ?? [];
    group.push(tool);
    categories.set(tool.category, group);
  }
  return Array.from(categories, ([id, groupedTools]) => ({
    id,
    label: definitions.get(id)?.label ?? titleCase(id),
    description: definitions.get(id)?.description ?? `${titleCase(id)} tools`,
    tools: groupedTools,
  }));
}

export interface ControlsCallbacks {
  onMaterial(material: Material): void;
  onRadius(radius: number): void;
  onPause(): void;
  onEraseMode(erase: boolean): void;
  canConfigureSource?(source: Material, target: Material): boolean;
  onSaveFile(): Promise<boolean>;
  onOpenFile(file: File): Promise<boolean>;
  onClear(): void;
  onTool?(tool: Exclude<CatalogTool, ElementToolInfo>): void;
}


export function toolCountLabel(count: number): string { return count + ' ' + (count === 1 ? 'tool' : 'tools'); }

export function sourceSelectionLabel(source: Material, target: Material): string {
  const name = (material: Material): string => MATERIALS.find(({ id }) => id === material)?.name ?? String(material);
  return `${name(source)} → ${name(target)}`;
}

export function sourceRejectionLabel(source: Material, target: Material): string {
  return `${sourceSelectionLabel(source, target)} unsupported`;
}

export function mountControls(host: HTMLElement, callbacks: ControlsCallbacks, catalog: readonly CatalogTool[] = materialTools(MATERIALS)): void {
  const tools = document.createElement('nav');
  tools.className = 'palette glass';
  tools.ariaLabel = 'Tool library';

  const finder = document.createElement('label');
  finder.className = 'tool-search';
  finder.innerHTML = '<span>Find a tool</span><input type="search" placeholder="Search elements and tools" autocomplete="off" />';
  const search = finder.querySelector('input') as HTMLInputElement;
  search.setAttribute('aria-label', 'Search elements and tools');

  const filters = document.createElement('div');
  filters.className = 'tool-filters';
  filters.setAttribute('role', 'group');
  filters.ariaLabel = 'Tool filters';

  const library = document.createElement('div');
  library.className = 'tool-library';
  library.id = 'tool-library-' + String(++controlsInstance);
  search.setAttribute('aria-controls', library.id);

  const results = document.createElement('output');
  results.className = 'tool-results';
  results.setAttribute('aria-live', 'polite');
  results.setAttribute('aria-atomic', 'true');

  const sourceSelection = document.createElement('output');
  sourceSelection.className = 'source-selection';
  sourceSelection.hidden = true;
  sourceSelection.setAttribute('aria-live', 'polite');
  sourceSelection.title = 'Configured source and target element';
  finder.append(sourceSelection);

  const validKeys = new Set(catalog.map(({ key }) => key));
  let favorites = new Set(loadList(FAVORITES_KEY).filter((key) => validKeys.has(key)));
  let recent: readonly string[] = loadList(RECENT_KEY).filter((key) => validKeys.has(key));
  let mode: ToolFilter = 'all';
  let selectedKey = catalog.find((tool) => tool.kind === 'element' && tool.id === Material.Sand)?.key
    ?? catalog[0]?.key;
  let sourceTarget = Material.Sand;

  const filterChoices: Array<{ mode: ToolFilter; label: string }> = [
    { mode: 'all', label: 'All' },
    ...Array.from(new Set(catalog.map(({ kind }) => kind)), (kind) => ({ mode: kind, label: KIND_LABELS[kind] })),
    { mode: 'favorites', label: 'Favorites' },
    { mode: 'recent', label: 'Recent' },
  ];

  const createToolTile = (tool: CatalogTool): HTMLElement => {
    const tile = document.createElement('span');
    tile.className = 'tool-tile';
    tile.dataset.toolKey = tool.key;
    tile.dataset.toolKind = tool.kind;

    const button = document.createElement('button');
    button.className = 'material-button';
    button.type = 'button';
    button.style.setProperty('--material-color', tool.color);
    const badges = [tool.hazard ? `<i class="tool-badge hazard-${tool.hazard}">${tool.hazard}</i>` : '', tool.available === false ? '<i class="tool-badge unavailable">unavailable</i>' : tool.limitations?.length ? '<i class="tool-badge limited">limited</i>' : ''].join('');
    button.innerHTML = `<span class="material-dot" aria-hidden="true">${tool.icon}</span><span>${tool.name}</span><span class="tool-badges">${badges}</span>`;
    button.title = tool.available === false ? `${tool.description} · Unavailable in this build: ${tool.limitations?.map(humanizeLimitation).join(', ') ?? 'unsupported'}` : tool.limitations?.length ? `${tool.description} · ${tool.limitations.map(humanizeLimitation).join(', ')}` : tool.description;
    button.disabled = !isToolAvailable(tool) || (tool.kind !== 'element' && !callbacks.onTool);
    const selected = tool.key === selectedKey;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.addEventListener('click', () => {
      if (tool.kind === 'source' && callbacks.canConfigureSource?.(tool.emitter, sourceTarget) === false) {
        sourceSelection.value = sourceRejectionLabel(tool.emitter, sourceTarget);
        sourceSelection.hidden = false;
        sourceSelection.classList.add('rejected');
        sourceSelection.dataset.emitter = String(tool.emitter);
        sourceSelection.dataset.target = String(sourceTarget);
        return;
      }
      selectedKey = tool.key;
      recent = recordRecent(recent, tool.key);
      saveList(RECENT_KEY, recent);
      if (tool.kind === 'element') {
        sourceTarget = tool.id;
        sourceSelection.hidden = true;
        sourceSelection.classList.remove('rejected');
        callbacks.onMaterial(tool.id);
      } else {
        sourceSelection.hidden = tool.kind !== 'source';
        if (tool.kind === 'source') {
          sourceSelection.value = sourceSelectionLabel(tool.emitter, sourceTarget);
          sourceSelection.classList.remove('rejected');
          sourceSelection.dataset.emitter = String(tool.emitter);
          sourceSelection.dataset.target = String(sourceTarget);
        }
        callbacks.onTool?.(tool);
      }
      renderLibrary();
    });

    const favorite = document.createElement('button');
    favorite.className = 'favorite-button';
    favorite.type = 'button';
    favorite.textContent = favorites.has(tool.key) ? '★' : '☆';
    favorite.title = favorites.has(tool.key) ? `Remove ${tool.name} from favorites` : `Add ${tool.name} to favorites`;
    favorite.setAttribute('aria-label', favorite.title);
    favorite.setAttribute('aria-pressed', String(favorites.has(tool.key)));
    favorite.addEventListener('click', () => {
      favorites = new Set(favorites);
      if (favorites.has(tool.key)) favorites.delete(tool.key); else favorites.add(tool.key);
      saveList(FAVORITES_KEY, Array.from(favorites));
      renderLibrary();
    });
    tile.append(button, favorite);
    return tile;
  };

  const renderLibrary = (): void => {
    const visible = filterTools(catalog, { mode, query: search.value, favorites, recent });
    library.replaceChildren();
    results.value = toolCountLabel(visible.length);
    if (!visible.length) {
      const empty = document.createElement('p');
      empty.className = 'tool-empty';
      empty.textContent = search.value ? 'No tools match this search.' : mode === 'favorites' ? 'Star tools to keep them here.' : 'No tools here yet.';
      library.append(empty);
      return;
    }

    for (const [groupIndex, group] of groupCatalogTools(visible).entries()) {
      const disclosure = document.createElement('details');
      disclosure.className = 'material-group';
      disclosure.dataset.category = group.id;
      disclosure.open = Boolean(search.value) || mode === 'recent' || mode === 'favorites' || groupIndex === 0;
      const heading = document.createElement('summary');
      heading.innerHTML = `<span><strong>${group.label}</strong><small>${group.description}</small></span><span class="material-count">${group.tools.length}</span>`;
      disclosure.append(heading);
      const grid = document.createElement('div');
      grid.className = 'material-grid';
      for (const tool of group.tools) grid.append(createToolTile(tool));
      disclosure.append(grid);
      library.append(disclosure);
    }
  };

  for (const choice of filterChoices) {
    const button = document.createElement('button');
    button.className = 'tool-filter';
    button.type = 'button';
    button.dataset.filter = choice.mode;
    button.textContent = choice.label;
    button.setAttribute('aria-controls', library.id);
    button.setAttribute('aria-pressed', choice.mode === mode ? 'true' : 'false');
    button.addEventListener('click', () => {
      mode = choice.mode;
      for (const filter of filters.querySelectorAll<HTMLButtonElement>('.tool-filter')) filter.setAttribute('aria-pressed', String(filter === button));
      renderLibrary();
    });
    filters.append(button);
  }

  search.addEventListener('input', renderLibrary);
  search.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !search.value) return;
    search.value = '';
    renderLibrary();
  });
  tools.append(finder, filters, results, library);
  renderLibrary();

  const actions = document.createElement('div');
  actions.className = 'actions glass';
  actions.innerHTML = `
    <label class="brush-size"><span>Brush</span><input aria-label="Brush size" type="range" min="2" max="24" value="7" /></label>
    <div class="brush-modes" role="group" aria-label="Mobile brush mode">
      <button class="action-button brush-mode selected" type="button" data-erase="false" aria-pressed="true">Draw</button>
      <button class="action-button brush-mode" type="button" data-erase="true" aria-pressed="false">Eraser</button>
    </div>
    <button class="action-button pause" aria-label="Pause simulation">Pause</button>
    <button class="action-button save-file" aria-label="Save or share world as a file">Save / share</button>
    <button class="action-button open-file" aria-label="Open a world file">Open file</button>
    <button class="action-button clear" aria-label="Clear world">Clear</button>`;
  const filePicker = document.createElement('input');
  filePicker.className = 'world-file-input';
  filePicker.type = 'file';
  filePicker.accept = '.cps,.stm,.anifortpt,application/octet-stream,application/x-anifortpt-save';
  filePicker.setAttribute('aria-label', 'Choose a Powder Toy save file');
  actions.append(filePicker);
  const radius = actions.querySelector('input') as HTMLInputElement;
  radius.addEventListener('input', () => callbacks.onRadius(Number(radius.value)));
  for (const brushMode of actions.querySelectorAll<HTMLButtonElement>('.brush-mode')) {
    brushMode.addEventListener('click', () => {
      const erase = brushMode.dataset.erase === 'true';
      for (const button of actions.querySelectorAll<HTMLButtonElement>('.brush-mode')) {
        const selected = button === brushMode;
        button.classList.toggle('selected', selected);
        button.setAttribute('aria-pressed', String(selected));
      }
      callbacks.onEraseMode(erase);
    });
  }
  const pause = actions.querySelector('.pause') as HTMLButtonElement;
  pause.addEventListener('click', () => { callbacks.onPause(); pause.classList.toggle('active'); pause.textContent = pause.classList.contains('active') ? 'Play' : 'Pause'; });
  const saveFile = actions.querySelector('.save-file') as HTMLButtonElement;
  saveFile.addEventListener('click', async () => {
    saveFile.disabled = true;
    saveFile.textContent = await callbacks.onSaveFile() ? 'File ready' : 'Save failed';
    window.setTimeout(() => { saveFile.disabled = false; saveFile.textContent = 'Save / share'; }, 1600);
  });
  const openFile = actions.querySelector('.open-file') as HTMLButtonElement;
  openFile.addEventListener('click', () => filePicker.click());
  filePicker.addEventListener('change', async () => {
    const file = filePicker.files?.[0];
    if (!file) return;
    openFile.disabled = true;
    openFile.textContent = 'Opening…';
    openFile.textContent = await callbacks.onOpenFile(file) ? 'Opened' : 'Invalid file';
    filePicker.value = '';
    window.setTimeout(() => { openFile.disabled = false; openFile.textContent = 'Open file'; }, 1600);
  });
  actions.querySelector('.clear')?.addEventListener('click', callbacks.onClear);
  host.append(tools, actions);
}

function loadList(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch { return []; }
}

function saveList(key: string, values: readonly string[]): void {
  try { localStorage.setItem(key, JSON.stringify(values)); } catch { /* storage may be unavailable */ }
}

function titleCase(value: string): string { return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function humanizeLimitation(value: string): string { return titleCase(value).replace('Unavailable', ' unavailable').replace('Limited', ' limited'); }
