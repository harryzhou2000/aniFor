import { Material } from '../shared/materials';
import type { DirtyCell, SimulationBackend } from './types';

const SAVE_VERSION = 1;

export class DeterministicBackend implements SimulationBackend {
  readonly name = 'TypeScript deterministic fallback';
  readonly width: number;
  readonly height: number;
  private readonly world: Uint8Array;
  private readonly dirty = new Set<number>();
  private tick = 0;

  constructor(width = 160, height = 100) {
    this.width = width;
    this.height = height;
    this.world = new Uint8Array(width * height);
    this.dirtyAll();
  }

  cells(): Uint8Array { return this.world; }

  paint(cx: number, cy: number, material: Material, radius: number): void {
    const r2 = radius * radius;
    for (let y = Math.max(0, cy - radius); y <= Math.min(this.height - 1, cy + radius); y++) {
      for (let x = Math.max(0, cx - radius); x <= Math.min(this.width - 1, cx + radius); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) this.set(x, y, material);
      }
    }
  }

  erase(x: number, y: number, radius: number): void { this.paint(x, y, Material.Empty, radius); }

  clear(): void {
    this.world.fill(Material.Empty);
    this.tick = 0;
    this.dirtyAll();
  }

  step(): void {
    this.tick++;
    const leftFirst = (this.tick & 1) === 0;
    for (let y = this.height - 2; y >= 1; y--) {
      for (let n = 0; n < this.width; n++) {
        const x = leftFirst ? n : this.width - 1 - n;
        const material = this.get(x, y);
        if (material === Material.Sand) this.updateSand(x, y);
        else if (material === Material.Water) this.updateWater(x, y);
      }
    }
    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 0; x < this.width; x++) {
        const material = this.get(x, y);
        if (material === Material.Fire) this.updateFire(x, y);
        else if (material === Material.Smoke) this.updateSmoke(x, y);
      }
    }
  }

  consumeDirtyCells(): readonly DirtyCell[] {
    const result = Array.from(this.dirty, (index) => ({ index, material: this.world[index] as Material }));
    this.dirty.clear();
    return result;
  }

  saveWorld(): string {
    let binary = '';
    for (const value of this.world) binary += String.fromCharCode(value);
    return btoa(JSON.stringify({ v: SAVE_VERSION, w: this.width, h: this.height, t: this.tick, d: btoa(binary) }));
  }

  loadWorld(serialized: string): void {
    const data = JSON.parse(atob(serialized)) as { v: number; w: number; h: number; t: number; d: string };
    if (data.v !== SAVE_VERSION || data.w !== this.width || data.h !== this.height) throw new Error('Incompatible world');
    const binary = atob(data.d);
    if (binary.length !== this.world.length) throw new Error('Corrupt world');
    for (let i = 0; i < binary.length; i++) this.world[i] = binary.charCodeAt(i);
    this.tick = data.t;
    this.dirtyAll();
  }

  private updateSand(x: number, y: number): void {
    if (this.canDisplace(x, y + 1, Material.Sand)) { this.swap(x, y, x, y + 1); return; }
    const direction = this.direction(x, y);
    if (this.canDisplace(x + direction, y + 1, Material.Sand)) this.swap(x, y, x + direction, y + 1);
    else if (this.canDisplace(x - direction, y + 1, Material.Sand)) this.swap(x, y, x - direction, y + 1);
  }

  private updateWater(x: number, y: number): void {
    if (this.isEmpty(x, y + 1)) { this.swap(x, y, x, y + 1); return; }
    const direction = this.direction(x, y);
    if (this.isEmpty(x + direction, y + 1)) { this.swap(x, y, x + direction, y + 1); return; }
    if (this.isEmpty(x - direction, y + 1)) { this.swap(x, y, x - direction, y + 1); return; }
    for (let distance = 1; distance <= 3; distance++) {
      if (this.isEmpty(x + direction * distance, y)) { this.swap(x, y, x + direction * distance, y); return; }
      if (!this.isEmpty(x + direction * distance, y)) break;
    }
  }

  private updateFire(x: number, y: number): void {
    if (this.noise(x, y, 19) % 38 === 0) { this.set(x, y, Material.Smoke); return; }
    const direction = this.direction(x, y);
    if (this.isEmpty(x + direction, y - 1)) this.swap(x, y, x + direction, y - 1);
    else if (this.isEmpty(x, y - 1)) this.swap(x, y, x, y - 1);
  }

  private updateSmoke(x: number, y: number): void {
    if (this.noise(x, y, 31) % 90 === 0) { this.set(x, y, Material.Empty); return; }
    const direction = this.direction(x, y);
    if (this.isEmpty(x + direction, y - 1)) this.swap(x, y, x + direction, y - 1);
    else if (this.isEmpty(x + direction, y)) this.swap(x, y, x + direction, y);
  }

  private direction(x: number, y: number): number { return (this.noise(x, y, 7) & 1) === 0 ? -1 : 1; }
  private noise(x: number, y: number, salt: number): number {
    let value = Math.imul(x + salt, 374761393) ^ Math.imul(y + this.tick, 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return (value ^ (value >>> 16)) >>> 0;
  }
  private index(x: number, y: number): number { return y * this.width + x; }
  private inBounds(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.width && y < this.height; }
  private get(x: number, y: number): Material { return this.inBounds(x, y) ? this.world[this.index(x, y)] as Material : Material.Wall; }
  private isEmpty(x: number, y: number): boolean { return this.get(x, y) === Material.Empty; }
  private canDisplace(x: number, y: number, by: Material): boolean {
    const target = this.get(x, y);
    return target === Material.Empty || (by === Material.Sand && target === Material.Water);
  }
  private set(x: number, y: number, material: Material): void {
    if (!this.inBounds(x, y)) return;
    const i = this.index(x, y);
    if (this.world[i] === material) return;
    this.world[i] = material;
    this.dirty.add(i);
  }
  private swap(ax: number, ay: number, bx: number, by: number): void {
    if (!this.inBounds(ax, ay) || !this.inBounds(bx, by)) return;
    const a = this.index(ax, ay), b = this.index(bx, by);
    const value = this.world[a]; this.world[a] = this.world[b]; this.world[b] = value;
    this.dirty.add(a); this.dirty.add(b);
  }
  private dirtyAll(): void { for (let i = 0; i < this.world.length; i++) this.dirty.add(i); }
}
