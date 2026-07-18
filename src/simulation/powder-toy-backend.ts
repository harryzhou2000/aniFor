import { base64UrlToBytes, bytesToBase64Url } from '../shared/base64-url';
import { Material } from '../shared/materials';
import type { SimulationToolId } from './simulation-tools';
import type { DirtyCell, DirtyWallCell, SimulationBackend } from './types';

interface PowderToyModule {
  HEAPU8: Uint8Array;
  HEAP8: Int8Array;
  HEAPU16: Uint16Array;
  _powder_init(): number;
  _powder_width(): number;
  _powder_height(): number;
  _powder_cells(): number;
  _powder_walls(): number;
  _powder_temperature(): number;
  _powder_pressure(): number;
  _powder_velocity(): number;
  _powder_tick(): number;
  _powder_set_tick(tick: number): void;
  _powder_clear(): void;
  _powder_set(x: number, y: number, material: number): void;
  _powder_set_configured_source(x: number, y: number, source: number, target: number): number;
  _powder_can_configure_source(source: number, target: number): number;
  _powder_source_target(x: number, y: number): number;
  _powder_set_wall(x: number, y: number, wall: number, radius: number): void;
  _powder_apply_tool(tool: SimulationToolId, x: number, y: number, radius: number, deltaX: number, deltaY: number): number;
  _powder_step(): void;
  _powder_save(): number;
  _powder_save_size(): number;
  _powder_load_buffer(size: number): number;
  _powder_load_commit(): number;
}

type PowderToyFactory = () => Promise<PowderToyModule>;
interface DirtyBounds { left: number; top: number; right: number; bottom: number }
const TPT_CELL_SIZE = 4;

/** Owns the official Powder Toy Emscripten module and its curated field ABI. */
export class PowderToyBackend implements SimulationBackend {
  readonly name = 'The Powder Toy 100.0 (direct WebAssembly)';
  readonly width: number;
  readonly height: number;
  private readonly shadow: Uint8Array;
  private readonly wallShadow: Uint8Array;
  private dirtyCheck = true;
  private wallDirtyAll = true;
  private wallDirtyBounds?: DirtyBounds;

  private constructor(private readonly module: PowderToyModule) {
    if (module._powder_init() !== 1) throw new Error('Powder Toy initialization failed');
    this.width = module._powder_width();
    this.height = module._powder_height();
    if (this.width !== 612 || this.height !== 384) throw new Error('Unexpected Powder Toy field dimensions');
    this.shadow = new Uint8Array(this.width * this.height);
    this.wallShadow = new Uint8Array(this.width * this.height);
  }

  static async load(moduleUrl = './wasm/stillroom_core.js'): Promise<PowderToyBackend> {
    const absoluteUrl = new URL(moduleUrl, globalThis.document?.baseURI ?? import.meta.url).href;
    const imported = await import(/* @vite-ignore */ absoluteUrl) as { default?: PowderToyFactory };
    if (typeof imported.default !== 'function') throw new Error('Invalid Powder Toy module factory');
    return new PowderToyBackend(await imported.default());
  }

  cells(): Uint8Array {
    const pointer = this.module._powder_cells();
    return new Uint8Array(this.module.HEAPU8.buffer, pointer, this.width * this.height);
  }

  walls(): Uint8Array {
    const pointer = this.module._powder_walls();
    return new Uint8Array(this.module.HEAPU8.buffer, pointer, this.width * this.height);
  }

  temperature(): Uint16Array {
    return new Uint16Array(this.module.HEAPU16.buffer, this.module._powder_temperature(), this.width * this.height);
  }

  pressure(): Float32Array {
    return new Float32Array(this.module.HEAPU8.buffer, this.module._powder_pressure(), this.width * this.height);
  }

  velocity(): Int8Array {
    return new Int8Array(this.module.HEAP8.buffer, this.module._powder_velocity(), this.width * this.height * 2);
  }

  step(): void { this.module._powder_step(); this.dirtyCheck = true; }
  clear(): void { this.module._powder_clear(); this.dirtyCheck = true; this.wallDirtyAll = true; this.wallDirtyBounds = undefined; }

  paint(cx: number, cy: number, material: Material, radius: number): void {
    const r2 = radius * radius;
    for (let y = Math.max(0, cy - radius); y <= Math.min(this.height - 1, cy + radius); y++) {
      for (let x = Math.max(0, cx - radius); x <= Math.min(this.width - 1, cx + radius); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) this.module._powder_set(x, y, material);
      }
    }
    this.dirtyCheck = true;
  }

  erase(x: number, y: number, radius: number): void { this.paint(x, y, Material.Empty, radius); }

  paintConfiguredSource(cx: number, cy: number, source: Material, target: Material, radius: number): number {
    const r2 = radius * radius;
    let applied = 0;
    for (let y = Math.max(0, cy - radius); y <= Math.min(this.height - 1, cy + radius); y++) {
      for (let x = Math.max(0, cx - radius); x <= Math.min(this.width - 1, cx + radius); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > r2) continue;
        if (this.module._powder_set_configured_source(x, y, source, target) > 0) applied++;
      }
    }
    if (applied) this.dirtyCheck = true;
    return applied;
  }

  canConfigureSource(source: Material, target: Material): boolean {
    return this.module._powder_can_configure_source(source, target) === 1;
  }

  configuredSourceTargetAt(x: number, y: number): Material | undefined {
    const target = this.module._powder_source_target(x, y);
    return target > Material.Empty ? target as Material : undefined;
  }

  paintWall(x: number, y: number, wall: number, radius: number): void {
    this.module._powder_set_wall(x, y, wall, radius);
    this.markWallBrushDirty(x, y, radius);
  }

  eraseWall(x: number, y: number, radius: number): void { this.paintWall(x, y, 0, radius); }

  applySimulationTool(tool: SimulationToolId, x: number, y: number, radius: number, deltaX = 0, deltaY = 0): void {
    const applied = this.module._powder_apply_tool(tool, x, y, radius, deltaX, deltaY);
    // Simulation tools mutate air or particle temperature without necessarily
    // changing material IDs. Force one field extraction on the next render.
    if (applied > 0) this.dirtyCheck = true;
  }

  consumeDirtyCells(): readonly DirtyCell[] {
    if (!this.dirtyCheck) return [];
    this.dirtyCheck = false;
    const world = this.cells();
    const changed: DirtyCell[] = [];
    for (let index = 0; index < world.length; index++) {
      if (world[index] === this.shadow[index]) continue;
      this.shadow[index] = world[index];
      changed.push({ index, material: world[index] as Material });
    }
    return changed;
  }

  consumeDirtyWalls(): readonly DirtyWallCell[] {
    const bounds = this.wallDirtyAll
      ? { left: 0, top: 0, right: this.width, bottom: this.height }
      : this.wallDirtyBounds;
    if (!bounds) return [];
    this.wallDirtyAll = false;
    this.wallDirtyBounds = undefined;
    const walls = this.walls();
    const changed: DirtyWallCell[] = [];
    for (let y = bounds.top; y < bounds.bottom; y++) {
      for (let x = bounds.left; x < bounds.right; x++) {
        const index = y * this.width + x;
        if (walls[index] === this.wallShadow[index]) continue;
        this.wallShadow[index] = walls[index];
        changed.push({ index, wall: walls[index] });
      }
    }
    return changed;
  }

  saveWorld(): string {
    return `tpt3.${bytesToBase64Url(this.saveFile())}`;
  }

  saveFile(): Uint8Array {
    const pointer = this.module._powder_save();
    const size = this.module._powder_save_size();
    if (!pointer || size <= 0) throw new Error('Powder Toy save failed');
    return this.module.HEAPU8.slice(pointer, pointer + size);
  }

  loadWorld(serialized: string): void {
    if (!serialized.startsWith('tpt3.')) throw new Error('Incompatible world');
    this.loadFile(base64UrlToBytes(serialized.slice(5)));
  }

  loadFile(bytes: Uint8Array): void {
    const pointer = this.module._powder_load_buffer(bytes.length);
    if (!pointer) throw new Error('World is too large');
    this.module.HEAPU8.set(bytes, pointer);
    if (this.module._powder_load_commit() !== 1) throw new Error('Corrupt world');
    this.shadow.fill(0xFF);
    this.wallShadow.fill(0xFF);
    this.dirtyCheck = true;
    this.wallDirtyAll = true;
    this.wallDirtyBounds = undefined;
  }

  private markWallBrushDirty(x: number, y: number, radius: number): void {
    if (this.wallDirtyAll) return;
    const coarseRadius = Math.max(0, Math.ceil(radius / TPT_CELL_SIZE));
    const cellX = Math.floor(x / TPT_CELL_SIZE);
    const cellY = Math.floor(y / TPT_CELL_SIZE);
    const bounds = {
      left: Math.max(0, (cellX - coarseRadius) * TPT_CELL_SIZE),
      top: Math.max(0, (cellY - coarseRadius) * TPT_CELL_SIZE),
      right: Math.min(this.width, (cellX + coarseRadius + 1) * TPT_CELL_SIZE),
      bottom: Math.min(this.height, (cellY + coarseRadius + 1) * TPT_CELL_SIZE),
    };
    if (bounds.left >= bounds.right || bounds.top >= bounds.bottom) return;
    const previous = this.wallDirtyBounds;
    this.wallDirtyBounds = previous ? {
      left: Math.min(previous.left, bounds.left),
      top: Math.min(previous.top, bounds.top),
      right: Math.max(previous.right, bounds.right),
      bottom: Math.max(previous.bottom, bounds.bottom),
    } : bounds;
  }
}
