import { Material, type MaterialCategory, type MaterialInfo } from '../shared/materials';
import { SimulationTool, type SimulationToolId } from '../simulation/simulation-tools';

export type ToolKind = 'element' | 'wall' | 'force' | 'thermal' | 'source' | 'sign' | 'utility';
export type ToolFilter = 'all' | 'favorites' | 'recent' | ToolKind;

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

export interface SignToolInfo extends ToolInfoBase {
  readonly kind: 'sign';
  readonly maximumLength: number;
}

export type CatalogTool = ElementToolInfo | WallToolInfo | SimToolInfo | SourceToolInfo | SignToolInfo;

export interface ToolCapabilities {
  readonly walls?: boolean;
  readonly simulationTools?: boolean;
  readonly configuredSources?: boolean;
  readonly signs?: boolean;
}

const WALL_DEFINITIONS = [
  [8, 'Solid wall', 'Blocks particles and air', '#777777', '■'],
  [1, 'Conductive wall', 'Blocks matter and conducts electricity', '#909090', '▦'],
  [2, 'E-Wall', 'Becomes transparent when powered', '#6f7784', '▥'],
  [3, 'Detector wall', 'Detects passing particles', '#c78d42', '◇'],
  [6, 'Liquid filter', 'Allows liquids through', '#4f9fb8', '≈'],
  [9, 'Air-only wall', 'Allows air but blocks particles', '#8294a4', '↟'],
  [10, 'Powder filter', 'Allows powders through', '#c69a58', '⁙'],
  [13, 'Gas filter', 'Allows gases through', '#9a8ab5', '☁'],
  [15, 'Energy filter', 'Allows energy particles through', '#e8df88', '✦'],
  [16, 'Air blocker', 'Blocks air while allowing particles', '#52606d', '▧'],
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
  return [
    ...walls,
    {
      key: 'source:configured', kind: 'source', emitter: Material.CLNE, requiresTarget: true,
      name: 'Configured source', description: 'Emits a selected target element', color: '#ffd040', icon: '◎', category: 'sources',
      ...unsupported(capabilities.configuredSources, 'configured-sources-unavailable'),
    },
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
      available: metadata.available,
      limitations: metadata.limitations,
    };
  });
}

export function filterTools(tools: readonly CatalogTool[], state: CatalogFilterState): readonly CatalogTool[] {
  const query = state.query.trim().toLocaleLowerCase();
  const recent = new Set(state.recent);
  return tools.filter((tool) => {
    if (state.mode === 'favorites' && !state.favorites.has(tool.key)) return false;
    if (state.mode === 'recent' && !recent.has(tool.key)) return false;
    if (!['all', 'favorites', 'recent'].includes(state.mode) && tool.kind !== state.mode) return false;
    if (!query) return true;
    return `${tool.name} ${tool.description} ${tool.category} ${tool.kind} ${tool.hazard ?? ''} ${tool.limitations?.join(' ') ?? ''}`.toLocaleLowerCase().includes(query);
  }).sort((a, b) => state.mode === 'recent' ? state.recent.indexOf(a.key) - state.recent.indexOf(b.key) : 0);
}

export function isToolAvailable(tool: CatalogTool): boolean { return tool.available !== false; }

export function recordRecent(recent: readonly string[], key: string, limit = 12): readonly string[] {
  return [key, ...recent.filter((item) => item !== key)].slice(0, limit);
}
