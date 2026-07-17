import { Material } from '../shared/materials';
import type { DirtyCell, SimulationBackend } from './types';

interface PowderExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  powder_width(): number;
  powder_height(): number;
  powder_cells(): number;
  powder_tick(): number;
  powder_set_tick(tick: number): void;
  powder_clear(): void;
  powder_set(x: number, y: number, material: number): void;
  powder_step(): void;
}

/** Thin owner of the C ABI; no Powder-specific state crosses this boundary. */
export class WasmBackend implements SimulationBackend {
  readonly name = 'C++ WebAssembly core';
  readonly width: number;
  readonly height: number;
  private view: Uint8Array;
  private readonly shadow: Uint8Array;
  private dirtyCheck = true;

  private constructor(private readonly wasm: PowderExports) {
    this.width = wasm.powder_width();
    this.height = wasm.powder_height();
    this.view = this.makeView();
    this.shadow = new Uint8Array(this.width * this.height);
  }

  static async load(url = './wasm/powder_core.wasm'): Promise<WasmBackend> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`WASM backend unavailable (${response.status})`);
    const result = await WebAssembly.instantiateStreaming(response, {});
    const raw = result.instance.exports as Record<string, WebAssembly.ExportValue>;
    const pick = (name: string): WebAssembly.ExportValue | undefined => raw[name] ?? raw[`_${name}`];
    const exports = {
      memory: raw.memory,
      powder_width: pick('powder_width'), powder_height: pick('powder_height'),
      powder_cells: pick('powder_cells'), powder_tick: pick('powder_tick'), powder_set_tick: pick('powder_set_tick'), powder_clear: pick('powder_clear'),
      powder_set: pick('powder_set'), powder_step: pick('powder_step'),
    } as unknown as PowderExports;
    if (!(exports.memory instanceof WebAssembly.Memory) || typeof exports.powder_step !== 'function') throw new Error('Invalid powder WASM ABI');
    return new WasmBackend(exports);
  }

  cells(): Uint8Array {
    if (this.view.buffer !== this.wasm.memory.buffer) this.view = this.makeView();
    return this.view;
  }
  step(): void { this.wasm.powder_step(); this.dirtyCheck = true; }
  clear(): void { this.wasm.powder_clear(); this.dirtyCheck = true; }
  paint(cx: number, cy: number, material: Material, radius: number): void {
    const r2 = radius * radius;
    for (let y = Math.max(0, cy - radius); y <= Math.min(this.height - 1, cy + radius); y++) {
      for (let x = Math.max(0, cx - radius); x <= Math.min(this.width - 1, cx + radius); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) this.wasm.powder_set(x, y, material);
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
    let binary = '';
    for (const value of this.cells()) binary += String.fromCharCode(value);
    return btoa(JSON.stringify({ v: 1, w: this.width, h: this.height, t: this.wasm.powder_tick(), d: btoa(binary) }));
  }
  loadWorld(serialized: string): void {
    const data = JSON.parse(atob(serialized)) as { v: number; w: number; h: number; t: number; d: string };
    if (data.v !== 1 || data.w !== this.width || data.h !== this.height) throw new Error('Incompatible world');
    const binary = atob(data.d);
    if (binary.length !== this.width * this.height) throw new Error('Incompatible world');
    this.clear();
    this.wasm.powder_set_tick(data.t);
    for (let i = 0; i < binary.length; i++) {
      const material = binary.charCodeAt(i);
      if (material) this.wasm.powder_set(i % this.width, Math.floor(i / this.width), material);
    }
  }
  private makeView(): Uint8Array { return new Uint8Array(this.wasm.memory.buffer, this.wasm.powder_cells(), this.width * this.height); }
}
