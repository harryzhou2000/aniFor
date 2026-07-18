import type { Material, MaterialCategory, MaterialInfo } from '../shared/materials';

export type ToolKind = 'element' | 'wall' | 'force' | 'thermal' | 'source' | 'utility';
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
  readonly nativeTool: number;
  readonly gesture: 'brush' | 'vector';
}

export interface SourceToolInfo extends ToolInfoBase {
  readonly kind: 'source';
  readonly emitter: Material;
  readonly requiresTarget: boolean;
}

export type CatalogTool = ElementToolInfo | WallToolInfo | SimToolInfo | SourceToolInfo;

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
