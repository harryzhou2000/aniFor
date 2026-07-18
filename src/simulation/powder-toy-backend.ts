import { base64UrlToBytes, bytesToBase64Url } from '../shared/base64-url';
import { Material } from '../shared/materials';
import type { DirtyCell, SimulationBackend } from './types';

interface PowderToyModule {
  HEAPU8: Uint8Array;
  HEAP8: Int8Array;
  HEAPU16: Uint16Array;
  _powder_init(): number;
  _powder_width(): number;
  _powder_height(): number;
  _powder_cells(): number;
  _powder_temperature(): number;
  _powder_pressure(): number;
  _powder_velocity(): number;
  _powder_tick(): number;
  _powder_set_tick(tick: number): void;
  _powder_clear(): void;
  _powder_set(x: number, y: number, material: number): void;
  _powder_step(): void;
  _powder_save(): number;
  _powder_save_size(): number;
  _powder_load_buffer(size: number): number;
  _powder_load_commit(): number;
}

type PowderToyFactory = () => Promise<PowderToyModule>;

/** Owns the official Powder Toy Emscripten module and its curated field ABI. */
export class PowderToyBackend implements SimulationBackend {
  readonly name = 'The Powder Toy 100.0 (direct WebAssembly)';
  readonly width: number;
  readonly height: number;
  private readonly shadow: Uint8Array;
  private dirtyCheck = true;

  private constructor(private readonly module: PowderToyModule) {
    if (module._powder_init() !== 1) throw new Error('Powder Toy initialization failed');
    this.width = module._powder_width();
    this.height = module._powder_height();
    if (this.width !== 612 || this.height !== 384) throw new Error('Unexpected Powder Toy field dimensions');
    this.shadow = new Uint8Array(this.width * this.height);
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
  clear(): void { this.module._powder_clear(); this.dirtyCheck = true; }

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

  saveWorld(): string {
    const pointer = this.module._powder_save();
    const size = this.module._powder_save_size();
    if (!pointer || size <= 0) throw new Error('Powder Toy save failed');
    return `tpt3.${bytesToBase64Url(this.module.HEAPU8.slice(pointer, pointer + size))}`;
  }

  loadWorld(serialized: string): void {
    if (!serialized.startsWith('tpt3.')) throw new Error('Incompatible world');
    const bytes = base64UrlToBytes(serialized.slice(5));
    const pointer = this.module._powder_load_buffer(bytes.length);
    if (!pointer) throw new Error('World is too large');
    this.module.HEAPU8.set(bytes, pointer);
    if (this.module._powder_load_commit() !== 1) throw new Error('Corrupt world');
    this.shadow.fill(0xFF);
    this.dirtyCheck = true;
  }
}
