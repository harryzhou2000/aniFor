import { MaterialId, RULESET_VERSION, WORLD_HEIGHT, WORLD_WIDTH, type Simulation, type SimulationCommand, type SimulationView, type WorldSnapshot } from "./contracts";
import { FixedRandom } from "./prng";
import { rasterizeCircle } from "./raster";

export const FIRE_LIFETIME = 90;
export const SMOKE_LIFETIME = 120;
const CELLS = WORLD_WIDTH * WORLD_HEIGHT;
const UINT32_MAX = 0xffffffff;

export class SandboxSimulation implements Simulation {
  private readonly material = new Uint8Array(CELLS);
  private readonly lifetime = new Uint16Array(CELLS);
  private readonly moved = new Uint32Array(CELLS);
  private generation = 1;
  private readonly random: FixedRandom;
  private currentTick = 0;
  private readonly worldView: SimulationView;

  constructor(seed = 0x6d2b79f5) {
    this.random = new FixedRandom(seed);
    this.worldView = { width: WORLD_WIDTH, height: WORLD_HEIGHT, get tick() { return 0; }, material: this.material, lifetime: this.lifetime } as SimulationView;
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
        if (this.material[index] !== next || this.lifetime[index] !== nextLifetime) changed = true;
        this.material[index] = next;
        this.lifetime[index] = nextLifetime;
      }
    }
    return { changed };
  }

  advanceTick(): { readonly changed: boolean } {
    this.generation = (this.generation + 1) >>> 0 || 1;
    let changed = false;
    // These four passes, including their traversal direction, are authoritative.
    changed = this.passSmoke() || changed;
    changed = this.passFire() || changed;
    changed = this.passSand() || changed;
    changed = this.passWater() || changed;
    this.currentTick++;
    return { changed };
  }

  snapshot(): WorldSnapshot {
    return {
      rulesetVersion: RULESET_VERSION, width: WORLD_WIDTH, height: WORLD_HEIGHT,
      tick: this.currentTick, seed: this.random.seed, randomState: this.random.state,
      material: this.material.slice(), lifetime: this.lifetime.slice()
    };
  }

  restore(snapshot: WorldSnapshot): void {
    if (snapshot.rulesetVersion !== RULESET_VERSION || snapshot.width !== WORLD_WIDTH || snapshot.height !== WORLD_HEIGHT ||
        !Number.isSafeInteger(snapshot.tick) || snapshot.tick < 0 || snapshot.material.length !== CELLS || snapshot.lifetime.length !== CELLS ||
        !isUint32(snapshot.seed) || !isUint32(snapshot.randomState)) {
      throw new Error("Invalid world snapshot");
    }
    for (let index = 0; index < CELLS; index++) {
      const material = snapshot.material[index];
      const value = snapshot.lifetime[index];
      if (material < MaterialId.Empty || material > MaterialId.Smoke) throw new Error("Invalid material");
      if (material === MaterialId.Empty || material === MaterialId.Wall || material === MaterialId.Sand || material === MaterialId.Water) {
        if (value !== 0) throw new Error("Static material has a lifetime");
      } else if (material === MaterialId.Fire) {
        if (value === 0 || value > FIRE_LIFETIME) throw new Error("Invalid fire lifetime");
      } else if (value === 0 || value > SMOKE_LIFETIME) {
        throw new Error("Invalid smoke lifetime");
      }
    }
    this.material.set(snapshot.material);
    this.lifetime.set(snapshot.lifetime);
    this.moved.fill(0);
    this.currentTick = snapshot.tick;
    this.random.seed = snapshot.seed;
    this.random.state = snapshot.randomState;
    this.generation = 1;
  }

  view(): SimulationView { return this.worldView; }

  private validCommand(command: SimulationCommand): boolean {
    if (!Number.isSafeInteger(command.targetTick) || command.targetTick !== this.currentTick ||
        !Number.isSafeInteger(command.sequence) || command.sequence < 0 || !command.brush ||
        !Number.isInteger(command.brush.x) || !Number.isInteger(command.brush.y) ||
        !Number.isInteger(command.brush.radius) || command.brush.radius < 0) return false;
    return command.type === "erase" ||
      (command.type === "paint" && Number.isInteger(command.brush.material) && command.brush.material >= MaterialId.Wall && command.brush.material <= MaterialId.Fire);
  }

  private initialLifetime(material: number): number {
    return material === MaterialId.Fire ? FIRE_LIFETIME : material === MaterialId.Smoke ? SMOKE_LIFETIME : 0;
  }
  private inside(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < WORLD_WIDTH && y < WORLD_HEIGHT; }
  private empty(x: number, y: number): boolean { return this.inside(x, y) && this.material[y * WORLD_WIDTH + x] === MaterialId.Empty; }
  private eligible(x: number, y: number): boolean { return this.inside(x, y) && this.moved[y * WORLD_WIDTH + x] !== this.generation; }
  private mark(index: number): void { this.moved[index] = this.generation; }
  private unmark(index: number): void { this.moved[index] = 0; }

  private move(sourceX: number, sourceY: number, destinationX: number, destinationY: number, swap = false): boolean {
    if (!this.inside(destinationX, destinationY) || !this.eligible(destinationX, destinationY)) return false;
    const source = sourceY * WORLD_WIDTH + sourceX;
    const destination = destinationY * WORLD_WIDTH + destinationX;
    if (!swap && this.material[destination] !== MaterialId.Empty) return false;
    if (swap) {
      const destinationMaterial = this.material[destination];
      const destinationLifetime = this.lifetime[destination];
      this.material[destination] = this.material[source];
      this.lifetime[destination] = this.lifetime[source];
      this.material[source] = destinationMaterial;
      this.lifetime[source] = destinationLifetime;
      this.mark(source);
    } else {
      this.material[destination] = this.material[source];
      this.lifetime[destination] = this.lifetime[source];
      this.material[source] = MaterialId.Empty;
      this.lifetime[source] = 0;
      this.unmark(source);
    }
    this.mark(destination);
    return true;
  }

  private horizontalStart(n: number): number { return (this.currentTick & 1) === 0 ? n : WORLD_WIDTH - 1 - n; }

  private passSmoke(): boolean {
    let changed = false;
    for (let y = 0; y < WORLD_HEIGHT; y++) for (let n = 0; n < WORLD_WIDTH; n++) {
      const x = this.horizontalStart(n);
      const index = y * WORLD_WIDTH + x;
      if (this.material[index] !== MaterialId.Smoke || !this.eligible(x, y)) continue;
      this.mark(index);
      if (this.lifetime[index] > 0) {
        this.lifetime[index]--;
        changed = true;
      }
      if (this.lifetime[index] === 0) {
        this.material[index] = MaterialId.Empty;
        this.unmark(index);
        changed = true;
        continue;
      }
      const first = this.random.bit() ? -1 : 1;
      changed = this.move(x, y, x, y - 1) || this.move(x, y, x + first, y - 1) || this.move(x, y, x - first, y - 1) || changed;
    }
    return changed;
  }

  private passFire(): boolean {
    let changed = false;
    for (let y = 0; y < WORLD_HEIGHT; y++) for (let n = 0; n < WORLD_WIDTH; n++) {
      const x = this.horizontalStart(n);
      const index = y * WORLD_WIDTH + x;
      if (this.material[index] !== MaterialId.Fire || !this.eligible(x, y)) continue;
      this.mark(index);
      const wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.inside(x + dx, y + dy) && this.material[(y + dy) * WORLD_WIDTH + x + dx] === MaterialId.Water);
      if (wet) {
        this.material[index] = MaterialId.Empty;
        this.lifetime[index] = 0;
        this.unmark(index);
        changed = true;
        continue;
      }
      this.lifetime[index]--;
      changed = true;
      if (this.lifetime[index] === 0) {
        if (this.random.below(0x80000000)) { this.material[index] = MaterialId.Smoke; this.lifetime[index] = SMOKE_LIFETIME; }
        else {
          this.material[index] = MaterialId.Empty;
          this.unmark(index);
        }
        changed = true;
        continue;
      }
      const first = this.random.bit() ? -1 : 1;
      changed = this.move(x, y, x, y - 1) || this.move(x, y, x + first, y - 1) || this.move(x, y, x - first, y - 1) || changed;
    }
    return changed;
  }

  private passSand(): boolean {
    let changed = false;
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) for (let n = 0; n < WORLD_WIDTH; n++) {
      const x = this.horizontalStart(n);
      const index = y * WORLD_WIDTH + x;
      if (this.material[index] !== MaterialId.Sand || !this.eligible(x, y)) continue;
      this.mark(index);
      const belowX = x, belowY = y + 1;
      if (this.empty(belowX, belowY)) { changed = this.move(x, y, belowX, belowY) || changed; continue; }
      if (this.inside(belowX, belowY) && this.material[belowY * WORLD_WIDTH + belowX] === MaterialId.Water && this.eligible(belowX, belowY)) { changed = this.move(x, y, belowX, belowY, true) || changed; continue; }
      const first = this.random.bit() ? -1 : 1;
      for (const direction of [first, -first]) {
        const targetX = x + direction;
        const targetY = y + 1;
        if (this.empty(targetX, targetY)) { changed = this.move(x, y, targetX, targetY) || changed; break; }
        if (this.inside(targetX, targetY) && this.material[targetY * WORLD_WIDTH + targetX] === MaterialId.Water && this.eligible(targetX, targetY)) {
          changed = this.move(x, y, targetX, targetY, true) || changed;
          break;
        }
      }
    }
    return changed;
  }

  private passWater(): boolean {
    let changed = false;
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) for (let n = 0; n < WORLD_WIDTH; n++) {
      const x = this.horizontalStart(n);
      const index = y * WORLD_WIDTH + x;
      if (this.material[index] !== MaterialId.Water || !this.eligible(x, y)) continue;
      this.mark(index);
      if (this.empty(x, y + 1)) { changed = this.move(x, y, x, y + 1) || changed; continue; }
      const first = this.random.bit() ? -1 : 1;
      for (const direction of [first, -first]) {
        let destination = -1;
        for (let distance = 1; distance <= 3; distance++) {
          const candidateX = x + direction * distance;
          if (!this.empty(candidateX, y) || !this.eligible(candidateX, y)) break;
          destination = candidateX;
        }
        if (destination >= 0) { changed = this.move(x, y, destination, y) || changed; break; }
      }
    }
    return changed;
  }
}

function isUint32(value: number): boolean { return Number.isInteger(value) && value >= 0 && value <= UINT32_MAX; }

export { rasterizeCircle } from "./raster";
export { SandboxSimulation as SimulationEngine };
export function createSimulation(seed = 0x6d2b79f5): Simulation { return new SandboxSimulation(seed); }
