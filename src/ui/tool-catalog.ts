import { LIFE_PRESETS, Material, type MaterialCategory, type MaterialInfo } from '../shared/materials';
import { SimulationTool, type SimulationToolId } from '../simulation/simulation-tools';
import { isForceMaterial } from '../renderer/render-traits';

export type ToolKind = 'element' | 'wall' | 'force' | 'thermal' | 'source' | 'life' | 'sign' | 'utility';
export type ToolFilter = 'all' | 'favorites' | 'recent' | 'radioactive' | ToolKind;

interface ToolInfoBase {
  readonly key: string;
  readonly kind: ToolKind;
  readonly name: string;
  readonly description: string;
  readonly color: string;
  readonly icon: string;
  readonly category: string;
  readonly hazard?: 'caution' | 'danger';
  readonly available?: boolean;
  readonly limitations?: readonly string[];
}

export interface ElementToolInfo extends ToolInfoBase {
  readonly kind: 'element';
  readonly id: Material;
  readonly category: MaterialCategory;
}

export interface WallToolInfo extends ToolInfoBase {
  readonly kind: 'wall';
  readonly nativeWall: number;
}

export interface SimToolInfo extends ToolInfoBase {
  readonly kind: 'force' | 'thermal' | 'utility';
  readonly nativeTool: SimulationToolId;
  readonly gesture: 'brush' | 'vector';
}

export interface SourceToolInfo extends ToolInfoBase {
  readonly kind: 'source';
  readonly emitter: Material;
  readonly requiresTarget: boolean;
}

export interface LifeToolInfo extends ToolInfoBase {
  readonly kind: 'life';
  readonly preset: number;
  readonly projection: Material;
}

export interface SignToolInfo extends ToolInfoBase {
  readonly kind: 'sign';
  readonly maximumLength: number;
}

export type CatalogTool = ElementToolInfo | WallToolInfo | SimToolInfo | SourceToolInfo | LifeToolInfo | SignToolInfo;

export interface ToolCapabilities {
  readonly walls?: boolean;
  readonly simulationTools?: boolean;
  readonly configuredSources?: boolean;
  readonly lifePresets?: boolean;
  readonly signs?: boolean;
}

const WALL_DEFINITIONS = [
  [8, 'Solid wall', 'Blocks particles and air', '#777777', '■'],
  [1, 'Conductive wall', 'Blocks matter and conducts electricity', '#909090', '▦'],
  [2, 'E-Wall', 'Becomes transparent when powered', '#6f7784', '▥'],
  [3, 'Detector wall', 'Detects passing particles', '#c78d42', '◇'],
  [4, 'Streamline', 'Creates a line that follows air movement', '#808080', '〰'],
  [6, 'Liquid filter', 'Allows liquids through', '#4f9fb8', '≈'],
  [7, 'Absorb wall', 'Absorbs particles while allowing air currents', '#808080', '◉'],
  [9, 'Air-only wall', 'Allows air but blocks particles', '#8294a4', '↟'],
  [10, 'Powder filter', 'Allows powders through', '#c69a58', '⁙'],
  [11, 'Conductor', 'Allows particles through and conducts electricity', '#ffff22', '⚡'],
  [12, 'E-Hole', 'Absorbs particles and releases them when powered', '#242424', '◌'],
  [13, 'Gas filter', 'Allows gases through', '#9a8ab5', '☁'],
  [15, 'Energy filter', 'Allows energy particles through', '#e8df88', '✦'],
  [16, 'Air blocker', 'Blocks air while allowing particles', '#52606d', '▧'],
  [18, 'Stasis wall', 'Freezes particles in place until powered', '#800080', '❄'],
] as const;

// These native wall IDs need an extra configuration gesture which the current
// wall brush ABI does not expose.  Keep them discoverable in the catalog, but
// deliberately outside WALL_DEFINITIONS: enabling native walls must never turn
// an explanatory tile into a partially-functional brush.
const UNSUPPORTED_WALL_DEFINITIONS = [
  [5, 'Fan wall', 'Native fan wall; its directional air-vector configuration is not available in this build', '#5d8b9d', '➜', 'native-fan-wall-configuration-unavailable'],
  [14, 'Gravity wall', 'Native gravity wall; its field configuration is not available in this build', '#70598c', '⌁', 'native-gravity-wall-configuration-unavailable'],
] as const;

const SOURCE_DEFINITIONS = [
  ['clne', Material.CLNE, 'CLNE source', 'Places a clone configured to emit the selected target element', '#ffd010', '◇'],
  ['bcln', Material.BCLN, 'BCLN source', 'Places a breakable clone configured to emit the selected target element', '#ffd040', '◇'],
  ['pcln', Material.PCLN, 'PCLN source', 'Places a powered clone configured to emit the selected target element', '#c4b84a', '▣'],
  ['pbcn', Material.PBCN, 'PBCN source', 'Places a powered breakable clone configured to emit the selected target element', '#b86f43', '▣'],
  ['conv', Material.CONV, 'CONV source', 'Places a converter configured to produce the selected target element', '#0aab0a', '◇'],
  ['cray', Material.CRAY, 'CRAY source', 'Places a particle ray configured to emit the selected target element when sparked', '#bbff00', '⇢'],
] as const;

export function semanticTools(capabilities: ToolCapabilities = {}): readonly Exclude<CatalogTool, ElementToolInfo>[] {
  const unsupported = (available: boolean | undefined, limitation: string): Pick<ToolInfoBase, 'available' | 'limitations'> => (
    available ? { available: true } : { available: false, limitations: [limitation] }
  );
  const walls: WallToolInfo[] = WALL_DEFINITIONS.map(([nativeWall, name, description, color, icon]) => ({
    key: `wall:${nativeWall}`,
    kind: 'wall',
    nativeWall,
    name,
    description,
    color,
    icon,
    category: 'walls',
    ...unsupported(capabilities.walls, 'native-walls-unavailable'),
  }));
  const unsupportedWalls: WallToolInfo[] = UNSUPPORTED_WALL_DEFINITIONS.map(([
    nativeWall, name, description, color, icon, limitation,
  ]) => ({
    key: `wall:${nativeWall}`,
    kind: 'wall',
    nativeWall,
    name,
    description,
    color,
    icon,
    category: 'walls',
    available: false,
    limitations: [limitation],
  }));
  const sources: SourceToolInfo[] = SOURCE_DEFINITIONS.map(([key, emitter, name, description, color, icon]) => ({
    key: `source:${key}`,
    kind: 'source',
    emitter,
    requiresTarget: true,
    name,
    description,
    color,
    icon,
    category: 'sources',
    ...unsupported(capabilities.configuredSources, 'configured-sources-unavailable'),
  }));
  const lifePresets: LifeToolInfo[] = LIFE_PRESETS.map(({ preset, material, code, name, rule, color }) => ({
    key: `life:${code.toLowerCase()}`,
    kind: 'life',
    preset,
    projection: material,
    name: code,
    description: `${name}: ${rule}`,
    color,
    icon: '▦',
    category: 'automata',
    ...unsupported(capabilities.lifePresets, 'life-presets-unavailable'),
  }));
  return [
    ...walls,
    ...unsupportedWalls,
    ...sources,
    ...lifePresets,
    {
      key: 'sign:place', kind: 'sign', maximumLength: 45,
      name: 'Sign', description: 'Places a persistent text annotation', color: '#f1e4c8', icon: 'T', category: 'signs',
      ...unsupported(capabilities.signs, 'native-signs-unavailable'),
    },
    {
      key: 'tool:air', kind: 'force', nativeTool: SimulationTool.Air, gesture: 'brush',
      name: 'Air', description: 'Adds positive air pressure', color: '#7cc8ff', icon: '↗', category: 'simulation-forces',
      ...unsupported(capabilities.simulationTools, 'simulation-tools-unavailable'),
    },
    {
      key: 'tool:vacuum', kind: 'force', nativeTool: SimulationTool.Vacuum, gesture: 'brush',
      name: 'Vacuum', description: 'Adds negative air pressure', color: '#6b78a8', icon: '↙', category: 'simulation-forces',
      ...unsupported(capabilities.simulationTools, 'simulation-tools-unavailable'),
    },
    {
      key: 'tool:wind', kind: 'force', nativeTool: SimulationTool.Wind, gesture: 'vector',
      name: 'Wind', description: 'Pushes air along a dragged vector', color: '#9bdcff', icon: '➜', category: 'simulation-forces',
      ...unsupported(capabilities.simulationTools, 'simulation-tools-unavailable'),
    },
    {
      key: 'tool:heat', kind: 'thermal', nativeTool: SimulationTool.Heat, gesture: 'brush',
      name: 'Heat', description: 'Raises local particle temperature', color: '#ff754f', icon: '+', category: 'thermal-tools',
      ...unsupported(capabilities.simulationTools, 'simulation-tools-unavailable'),
    },
    {
      key: 'tool:cool', kind: 'thermal', nativeTool: SimulationTool.Cool, gesture: 'brush',
      name: 'Cool', description: 'Lowers local particle temperature', color: '#63bce8', icon: '−', category: 'thermal-tools',
      ...unsupported(capabilities.simulationTools, 'simulation-tools-unavailable'),
    },
  ];
}

export function buildToolCatalog(materials: readonly MaterialInfo[], capabilities: ToolCapabilities = {}): readonly CatalogTool[] {
  return [...materialTools(materials), ...semanticTools(capabilities)];
}

export interface CatalogFilterState {
  readonly mode: ToolFilter;
  readonly query: string;
  readonly favorites: ReadonlySet<string>;
  readonly recent: readonly string[];
}

export function materialTools(materials: readonly MaterialInfo[]): readonly ElementToolInfo[] {
  return materials.map((material) => {
    const metadata = material as MaterialInfo & { readonly hazard?: 'caution' | 'danger'; readonly available?: boolean; readonly limitations?: readonly string[] };
    // Render-only products have stable identities in imported/native worlds,
    // but cannot safely cross the ordinary powder_set ABI.  Keep them visible
    // and searchable rather than silently hiding them, while disabling their
    // tile before it can become a misleading brush selection.
    const nativeProductOnly = !material.selectable;
    return {
      key: `material:${material.id}`,
      kind: 'element',
      id: material.id,
      name: material.name,
      description: material.description,
      color: material.color,
      icon: material.icon,
      category: material.category,
      hazard: metadata.hazard,
      available: nativeProductOnly ? false : metadata.available,
      limitations: nativeProductOnly ? ['native-product-only'] : metadata.limitations,
    };
  });
}

export function filterTools(tools: readonly CatalogTool[], state: CatalogFilterState): readonly CatalogTool[] {
  const query = state.query.trim().toLocaleLowerCase();
  const recent = new Set(state.recent);
  return tools.filter((tool) => {
    if (state.mode === 'favorites' && !state.favorites.has(tool.key)) return false;
    if (state.mode === 'recent' && !recent.has(tool.key)) return false;
    const categoryElement = tool.kind === 'element' && (
      (state.mode === 'force' && isForceMaterial(tool.id))
      || (state.mode === 'life' && tool.category === 'life')
      || (state.mode === 'radioactive' && tool.category === 'radioactive')
    );
    if (!['all', 'favorites', 'recent'].includes(state.mode)
      && tool.kind !== state.mode && !categoryElement) return false;
    if (!query) return true;
    return `${tool.name} ${tool.description} ${tool.category} ${tool.kind} ${tool.hazard ?? ''} ${tool.limitations?.join(' ') ?? ''}`.toLocaleLowerCase().includes(query);
  }).sort((a, b) => state.mode === 'recent' ? state.recent.indexOf(a.key) - state.recent.indexOf(b.key) : 0);
}

export function isToolAvailable(tool: CatalogTool): boolean { return tool.available !== false; }

export function recordRecent(recent: readonly string[], key: string, limit = 12): readonly string[] {
  return [key, ...recent.filter((item) => item !== key)].slice(0, limit);
}
