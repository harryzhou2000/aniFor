import { MaterialId, RULESET_VERSION, WORLD_HEIGHT, WORLD_WIDTH, type Simulation, type SimulationCommand, type SimulationView, type WorldSnapshot } from "./contracts";
import { FixedRandom } from "./prng";
import { rasterizeCircle } from "./raster";

export const AMBIENT_TEMPERATURE = 200;
export const MIN_TEMPERATURE = -500;
export const MAX_TEMPERATURE = 2000;
export const FIRE_TEMPERATURE = 1400;
export const SMOKE_TEMPERATURE = 500;
export const STEAM_TEMPERATURE = 1050;
export const ICE_TEMPERATURE = -50;
export const FIRE_LIFETIME = 90;
export const SMOKE_LIFETIME = 120;
export const STEAM_LIFETIME = 180;
export const ACID_LIFETIME = 400;
const CELLS = WORLD_WIDTH * WORLD_HEIGHT;
const UINT32_MAX = 0xffffffff;

export class SandboxSimulation implements Simulation {
  private readonly material = new Uint8Array(CELLS);
  private readonly lifetime = new Uint16Array(CELLS);
  private readonly temperature = new Int16Array(CELLS).fill(AMBIENT_TEMPERATURE);
  private readonly nextTemperature = new Int16Array(CELLS);
  private readonly moved = new Uint32Array(CELLS);
  private generation = 1;
  private readonly random: FixedRandom;
  private currentTick = 0;
  private readonly worldView: SimulationView;

  constructor(seed = 0x6d2b79f5) {
    this.random = new FixedRandom(seed);
    this.worldView = { width: WORLD_WIDTH, height: WORLD_HEIGHT, get tick() { return 0; }, material: this.material, lifetime: this.lifetime, temperature: this.temperature } as SimulationView;
    Object.defineProperty(this.worldView, "tick", { get: () => this.currentTick });
  }

  applyCommands(commands: readonly SimulationCommand[]): { readonly changed: boolean } {
    const accepted = commands.filter(command => this.validCommand(command)).slice().sort((a, b) => a.sequence - b.sequence);
    let changed = false;
    for (const command of accepted) {
      for (const point of rasterizeCircle(command.brush.x, command.brush.y, command.brush.radius, WORLD_WIDTH, WORLD_HEIGHT)) {
        const index = point.y * WORLD_WIDTH + point.x;
        const next = command.type === "erase" ? MaterialId.Empty : command.brush.material;
        const nextLifetime = this.initialLifetime(next);
        const nextTemperature = this.initialTemperature(next);
        if (this.material[index] !== next || this.lifetime[index] !== nextLifetime || this.temperature[index] !== nextTemperature) changed = true;
        this.material[index] = next;
        this.lifetime[index] = nextLifetime;
        this.temperature[index] = nextTemperature;
      }
    }
    return { changed };
  }

  advanceTick(): { readonly changed: boolean } {
    this.generation = (this.generation + 1) >>> 0 || 1;
    let changed = this.thermalPass();
    changed = this.passGas() || changed;
    changed = this.passFire() || changed;
    changed = this.passSolids() || changed;
    changed = this.passLiquids() || changed;
    this.currentTick++;
    return { changed };
  }

  snapshot(): WorldSnapshot {
    return { rulesetVersion: RULESET_VERSION, width: WORLD_WIDTH, height: WORLD_HEIGHT, tick: this.currentTick, seed: this.random.seed, randomState: this.random.state, material: this.material.slice(), lifetime: this.lifetime.slice(), temperature: this.temperature.slice() };
  }

  restore(snapshot: WorldSnapshot): void {
    if (snapshot.rulesetVersion !== RULESET_VERSION || snapshot.width !== WORLD_WIDTH || snapshot.height !== WORLD_HEIGHT || !Number.isSafeInteger(snapshot.tick) || snapshot.tick < 0 || snapshot.material.length !== CELLS || snapshot.lifetime.length !== CELLS || snapshot.temperature.length !== CELLS || !isUint32(snapshot.seed) || !isUint32(snapshot.randomState)) throw new Error("Invalid world snapshot");
    for (let i = 0; i < CELLS; i++) {
      const material = snapshot.material[i];
      const life = snapshot.lifetime[i];
      const temp = snapshot.temperature[i];
      if (material < MaterialId.Empty || material > MaterialId.Acid || temp < MIN_TEMPERATURE || temp > MAX_TEMPERATURE) throw new Error("Invalid material or temperature");
      if (this.isStatic(material) && life !== 0) throw new Error("Static material has a lifetime");
      if (material === MaterialId.Fire && (life === 0 || life > FIRE_LIFETIME) || material === MaterialId.Smoke && (life === 0 || life > SMOKE_LIFETIME) || material === MaterialId.Steam && (life === 0 || life > STEAM_LIFETIME) || material === MaterialId.Acid && (life === 0 || life > ACID_LIFETIME)) throw new Error("Invalid lifetime");
    }
    this.material.set(snapshot.material); this.lifetime.set(snapshot.lifetime); this.temperature.set(snapshot.temperature); this.moved.fill(0); this.generation = 1;
    this.currentTick = snapshot.tick; this.random.seed = snapshot.seed; this.random.state = snapshot.randomState;
  }

  view(): SimulationView { return this.worldView; }

  private validCommand(command: SimulationCommand): boolean {
    if (!Number.isSafeInteger(command.targetTick) || command.targetTick !== this.currentTick || !Number.isSafeInteger(command.sequence) || command.sequence < 0 || !command.brush || !Number.isInteger(command.brush.x) || !Number.isInteger(command.brush.y) || !Number.isInteger(command.brush.radius) || command.brush.radius < 0) return false;
    return command.type === "erase" || (command.type === "paint" && [MaterialId.Wall, MaterialId.Sand, MaterialId.Water, MaterialId.Fire, MaterialId.Oil, MaterialId.Wood, MaterialId.Ice, MaterialId.Acid].includes(command.brush.material));
  }
  private isStatic(material: number): boolean { return material !== MaterialId.Fire && material !== MaterialId.Smoke && material !== MaterialId.Steam && material !== MaterialId.Acid; }
  private initialLifetime(material: number): number { return material === MaterialId.Fire ? FIRE_LIFETIME : material === MaterialId.Smoke ? SMOKE_LIFETIME : material === MaterialId.Steam ? STEAM_LIFETIME : material === MaterialId.Acid ? ACID_LIFETIME : 0; }
  private initialTemperature(material: number): number { return material === MaterialId.Fire ? FIRE_TEMPERATURE : material === MaterialId.Smoke ? SMOKE_TEMPERATURE : material === MaterialId.Steam ? STEAM_TEMPERATURE : material === MaterialId.Ice ? ICE_TEMPERATURE : AMBIENT_TEMPERATURE; }
  private inside(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < WORLD_WIDTH && y < WORLD_HEIGHT; }
  private empty(x: number, y: number): boolean { return this.inside(x, y) && this.material[y * WORLD_WIDTH + x] === MaterialId.Empty; }
  private eligible(x: number, y: number): boolean { return this.inside(x, y) && this.moved[y * WORLD_WIDTH + x] !== this.generation; }
  private mark(i: number): void { this.moved[i] = this.generation; }
  private unmark(i: number): void { this.moved[i] = 0; }
  private horizontal(n: number): number { return (this.currentTick & 1) === 0 ? n : WORLD_WIDTH - 1 - n; }

  private thermalPass(): boolean {
    let changed = false;
    for (let y = 0; y < WORLD_HEIGHT; y++) for (let x = 0; x < WORLD_WIDTH; x++) {
      const index = y * WORLD_WIDTH + x;
      const base = this.temperature[index]; let sum = 0; let count = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.inside(x + dx, y + dy)) { sum += this.temperature[(y + dy) * WORLD_WIDTH + x + dx]; count++; }
      const diffusion = Math.trunc((sum - count * base) / 16);
      const ambient = Math.trunc((AMBIENT_TEMPERATURE - base) / 64);
      const next = Math.max(MIN_TEMPERATURE, Math.min(MAX_TEMPERATURE, base + diffusion + ambient));
      this.nextTemperature[index] = next;
      if (next !== base) changed = true;
    }
    this.temperature.set(this.nextTemperature);
    return changed;
  }

  private move(sx: number, sy: number, dx: number, dy: number, swap = false): boolean {
    if (!this.inside(dx, dy) || !this.eligible(dx, dy)) return false;
    const source = sy * WORLD_WIDTH + sx; const destination = dy * WORLD_WIDTH + dx;
    if (!swap && this.material[destination] !== MaterialId.Empty) return false;
    if (swap) {
      [this.material[source], this.material[destination]] = [this.material[destination], this.material[source]];
      [this.lifetime[source], this.lifetime[destination]] = [this.lifetime[destination], this.lifetime[source]];
      [this.temperature[source], this.temperature[destination]] = [this.temperature[destination], this.temperature[source]];
      this.mark(source);
    } else {
      this.material[destination] = this.material[source]; this.lifetime[destination] = this.lifetime[source]; this.temperature[destination] = this.temperature[source];
      this.material[source] = MaterialId.Empty; this.lifetime[source] = 0; this.temperature[source] = AMBIENT_TEMPERATURE; this.unmark(source);
    }
    this.mark(destination); return true;
  }

  private transform(index: number, material: MaterialId, lifetime: number, temperature: number): void { this.material[index] = material; this.lifetime[index] = lifetime; this.temperature[index] = temperature; this.mark(index); }
  private gasMove(x: number, y: number): boolean { const first = this.random.bit() ? -1 : 1; return this.move(x, y, x, y - 1) || this.move(x, y, x + first, y - 1) || this.move(x, y, x - first, y - 1); }

  private passGas(): boolean {
    let changed = false;
    for (let y = 0; y < WORLD_HEIGHT; y++) for (let n = 0; n < WORLD_WIDTH; n++) {
      const x = this.horizontal(n); const i = y * WORLD_WIDTH + x; const material = this.material[i];
      if ((material !== MaterialId.Smoke && material !== MaterialId.Steam) || !this.eligible(x, y)) continue;
      this.mark(i);
      if (material === MaterialId.Steam && this.temperature[i] <= 900) { this.transform(i, MaterialId.Water, 0, 900); changed = true; continue; }
      this.lifetime[i]--; changed = true;
      if (this.lifetime[i] === 0) { this.material[i] = MaterialId.Empty; this.temperature[i] = AMBIENT_TEMPERATURE; this.unmark(i); continue; }
      changed = this.gasMove(x, y) || changed;
    }
    return changed;
  }

  private passFire(): boolean {
    let changed = false;
    for (let y = 0; y < WORLD_HEIGHT; y++) for (let n = 0; n < WORLD_WIDTH; n++) {
      const x = this.horizontal(n); const i = y * WORLD_WIDTH + x;
      if (this.material[i] !== MaterialId.Fire || !this.eligible(x, y)) continue;
      this.mark(i);
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = x + dx, ny = y + dy; if (!this.inside(nx, ny)) continue;
        const ni = ny * WORLD_WIDTH + nx; this.temperature[ni] = Math.min(MAX_TEMPERATURE, this.temperature[ni] + 250); changed = true;
        const ignition = this.material[ni] === MaterialId.Oil ? 700 : this.material[ni] === MaterialId.Wood ? 800 : MAX_TEMPERATURE + 1;
        if (this.temperature[ni] >= ignition) { this.transform(ni, MaterialId.Fire, FIRE_LIFETIME, FIRE_TEMPERATURE); changed = true; }
      }
      const wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.inside(x + dx, y + dy) && this.material[(y + dy) * WORLD_WIDTH + x + dx] === MaterialId.Water);
      if (wet) { this.material[i] = MaterialId.Empty; this.lifetime[i] = 0; this.temperature[i] = AMBIENT_TEMPERATURE; this.unmark(i); changed = true; continue; }
      this.lifetime[i]--; changed = true;
      if (this.lifetime[i] === 0) { if (this.random.below(0x80000000)) this.transform(i, MaterialId.Smoke, SMOKE_LIFETIME, SMOKE_TEMPERATURE); else { this.material[i] = MaterialId.Empty; this.temperature[i] = AMBIENT_TEMPERATURE; this.unmark(i); } continue; }
      changed = this.gasMove(x, y) || changed;
    }
    return changed;
  }

  private passSolids(): boolean {
    let changed = false;
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) for (let n = 0; n < WORLD_WIDTH; n++) {
      const x = this.horizontal(n); const i = y * WORLD_WIDTH + x; const material = this.material[i];
      if (![MaterialId.Sand, MaterialId.Ice, MaterialId.Wood].includes(material) || !this.eligible(x, y)) continue;
      this.mark(i);
      if (material === MaterialId.Ice) { if (this.temperature[i] >= 50) { this.transform(i, MaterialId.Water, 0, 50); changed = true; } continue; }
      if (material === MaterialId.Wood) continue;
      if (this.empty(x, y + 1)) { changed = this.move(x, y, x, y + 1) || changed; continue; }
      if (this.isSwappableLiquid(x, y + 1)) { changed = this.move(x, y, x, y + 1, true) || changed; continue; }
      const first = this.random.bit() ? -1 : 1;
      for (const d of [first, -first]) {
        if (this.empty(x + d, y + 1)) { changed = this.move(x, y, x + d, y + 1) || changed; break; }
        if (this.isSwappableLiquid(x + d, y + 1)) { changed = this.move(x, y, x + d, y + 1, true) || changed; break; }
      }
    }
    return changed;
  }

  private isSwappableLiquid(x: number, y: number): boolean {
    if (!this.inside(x, y) || !this.eligible(x, y)) return false;
    const material = this.material[y * WORLD_WIDTH + x];
    return material === MaterialId.Water || material === MaterialId.Oil || material === MaterialId.Acid;
  }

  private liquidMove(x: number, y: number, allowOilSwap: boolean, chosenDirection?: number): boolean {
    if (this.empty(x, y + 1)) return this.move(x, y, x, y + 1);
    if (allowOilSwap && this.inside(x, y + 1) && this.material[(y + 1) * WORLD_WIDTH + x] === MaterialId.Oil && this.eligible(x, y + 1)) return this.move(x, y, x, y + 1, true);
    const first = chosenDirection ?? (this.random.bit() ? -1 : 1);
    for (const d of [first, -first]) {
      let destination = -1;
      for (let distance = 1; distance <= 3; distance++) { const nx = x + d * distance; if (!this.empty(nx, y) || !this.eligible(nx, y)) break; destination = nx; }
      if (destination >= 0) return this.move(x, y, destination, y);
    }
    return false;
  }

  private passLiquids(): boolean {
    // Water runs before oil so an unprocessed oil cell can be displaced downward.
    let changed = this.passWaterLiquid();
    changed = this.passOilLiquid() || changed;
    changed = this.passAcidLiquid() || changed;
    return changed;
  }

  private passWaterLiquid(): boolean {
    let changed = false;
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) for (let n = 0; n < WORLD_WIDTH; n++) {
      const x = this.horizontal(n); const i = y * WORLD_WIDTH + x; const material = this.material[i];
      if (material !== MaterialId.Water || !this.eligible(x, y)) continue;
      this.mark(i);
      if (this.temperature[i] <= 0) { this.transform(i, MaterialId.Ice, 0, ICE_TEMPERATURE); changed = true; continue; }
      if (this.temperature[i] >= 1000) { this.transform(i, MaterialId.Steam, STEAM_LIFETIME, STEAM_TEMPERATURE); changed = true; continue; }
      changed = this.liquidMove(x, y, true) || changed;
    }
    return changed;
  }

  private passOilLiquid(): boolean {
    let changed = false;
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) for (let n = 0; n < WORLD_WIDTH; n++) {
      const x = this.horizontal(n); const i = y * WORLD_WIDTH + x;
      if (this.material[i] !== MaterialId.Oil || !this.eligible(x, y)) continue;
      this.mark(i);
      changed = this.liquidMove(x, y, false) || changed;
    }
    return changed;
  }

  private passAcidLiquid(): boolean {
    let changed = false;
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) for (let n = 0; n < WORLD_WIDTH; n++) {
      const x = this.horizontal(n); const i = y * WORLD_WIDTH + x;
      if (this.material[i] !== MaterialId.Acid || !this.eligible(x, y)) continue;
      this.mark(i);
      const first = this.random.bit() ? -1 : 1;
      const neighbors: Array<[number, number]> = [[0, 1], [first, 0], [-first, 0], [0, -1]];
      for (const [dx, dy] of neighbors) {
        const nx = x + dx, ny = y + dy; if (!this.inside(nx, ny)) continue;
        const ni = ny * WORLD_WIDTH + nx;
        if (this.material[ni] !== MaterialId.Sand && this.material[ni] !== MaterialId.Wood && this.material[ni] !== MaterialId.Wall) continue;
        if (this.random.below(0x20000000)) { this.material[ni] = MaterialId.Empty; this.lifetime[ni] = 0; this.temperature[ni] = AMBIENT_TEMPERATURE; this.unmark(ni); this.lifetime[i] = Math.max(0, this.lifetime[i] - 40); changed = true; }
        break;
      }
      if (this.lifetime[i] === 0) { this.material[i] = MaterialId.Empty; this.temperature[i] = AMBIENT_TEMPERATURE; this.unmark(i); changed = true; continue; }
      changed = this.liquidMove(x, y, false, first) || changed;
    }
    return changed;
  }
}

function isUint32(value: number): boolean { return Number.isInteger(value) && value >= 0 && value <= UINT32_MAX; }
export { rasterizeCircle } from "./raster";
export { SandboxSimulation as SimulationEngine };
export function createSimulation(seed = 0x6d2b79f5): Simulation { return new SandboxSimulation(seed); }
