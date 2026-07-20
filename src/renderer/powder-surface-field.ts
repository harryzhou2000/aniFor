import { Material } from '../shared/materials';
import { RenderPhase } from './render-profile';

export const POWDER_SURFACE_REFRESH_INTERVAL = 1000 / 8;
const HORIZONTAL_RADIUS = 10;
const GRADIENT_BYTE_SCALE = 508;
const VERTICAL_OUTER_WEIGHT = 1 / 16;
const VERTICAL_INNER_WEIGHT = 4 / 16;
const VERTICAL_CENTRE_WEIGHT = 6 / 16;

/**
 * Gravity-aware, presentation-only powder coverage. A wide horizontal and tight
 * vertical reconstruction turns discrete heap terraces into a continuous
 * tangent without changing semantic occupancy or material ownership.
 *
 * RGBA stores density, signed x/y density gradients, and stable 3x3 support.
 * The WebGL path consumes one linearly sampled texture; Canvas samples the same
 * bytes at its selected supersampling rate.
 */
export class PowderSurfaceField {
  readonly bytes: Uint8Array<ArrayBuffer>;
  /** 255 only for passable cells connected to a world edge by cardinal air. */
  readonly exteriorAirBytes: Uint8Array<ArrayBuffer>;
  /** Bit 0 is stable density, bit 1 local support, bit 2 an exterior-air blocker. */
  private readonly seed: Uint8Array<ArrayBuffer>;
  private readonly horizontal: Float32Array<ArrayBuffer>;
  private readonly blurred: Float32Array<ArrayBuffer>;
  hasSurface = false;

  constructor(
    readonly width: number,
    readonly height: number,
    private readonly styleBytes: Uint8Array,
  ) {
    const cells = width * height;
    this.bytes = new Uint8Array(cells * 4);
    this.exteriorAirBytes = new Uint8Array(cells);
    this.seed = new Uint8Array(cells);
    this.horizontal = new Float32Array(cells);
    this.blurred = new Float32Array(cells);
  }

  update(materials: Uint8Array, stability: Uint8Array, walls?: Uint8Array): boolean {
    const cells = this.width * this.height;
    if (materials.length !== cells || stability.length !== cells
      || (walls !== undefined && walls.length !== cells)) {
      throw new Error('Powder surface field size mismatch');
    }
    let changed = false;
    let hasSurface = false;
    const seed = this.seed;
    const styleBytes = this.styleBytes;
    if (walls === undefined) {
      for (let index = 0; index < cells; index++) {
        const material = materials[index];
        let state = 0;
        if (material !== 0 && material !== Material.Wall) {
          const phase = styleBytes[material * 4];
          if (phase === RenderPhase.Powder) {
            state = 6;
            if (stability[index] >= 192) {
              state = 7;
              hasSurface = true;
            }
          } else if (phase === RenderPhase.Solid) state = 6;
          else if (phase !== RenderPhase.Gas && phase !== RenderPhase.Energy) state = 4;
        } else if (material === Material.Wall) state = 4;
        if (seed[index] !== state) changed = true;
        seed[index] = state;
      }
    } else {
      for (let index = 0; index < cells; index++) {
        const material = materials[index];
        let state = 0;
        if (walls[index] === 0 && material !== 0 && material !== Material.Wall) {
          const phase = styleBytes[material * 4];
          if (phase === RenderPhase.Powder) {
            state = 6;
            if (stability[index] >= 192) {
              state = 7;
              hasSurface = true;
            }
          } else if (phase === RenderPhase.Solid) state = 6;
          else if (phase !== RenderPhase.Gas && phase !== RenderPhase.Energy) state = 4;
        } else if (walls[index] !== 0 || material === Material.Wall) state = 4;
        if (seed[index] !== state) changed = true;
        seed[index] = state;
      }
    }
    this.hasSurface = hasSurface;
    if (!this.hasSurface) {
      if (changed) {
        this.bytes.fill(0);
        this.horizontal.fill(0);
        this.blurred.fill(0);
        this.rebuildExteriorAir();
      }
      return changed;
    }
    if (!changed) return false;
    this.blurHorizontalTwice();
    this.blurVertical();
    this.packBytes();
    this.rebuildExteriorAir();
    return true;
  }

  get allocatedByteLength(): number {
    return this.bytes.byteLength + this.exteriorAirBytes.byteLength + this.seed.byteLength
      + this.horizontal.byteLength + this.blurred.byteLength;
  }

  private blurHorizontalTwice(): void {
    const divisor = HORIZONTAL_RADIUS * 2 + 1;
    for (let y = 0; y < this.height; y++) {
      const row = y * this.width;
      let total = 0;
      for (let x = 0; x <= HORIZONTAL_RADIUS && x < this.width; x++) {
        total += this.seed[row + x] & 1;
      }
      for (let x = 0; x < this.width; x++) {
        this.horizontal[row + x] = total / divisor;
        const removeX = x - HORIZONTAL_RADIUS;
        const addX = x + HORIZONTAL_RADIUS + 1;
        if (removeX >= 0) total -= this.seed[row + removeX] & 1;
        if (addX < this.width) total += this.seed[row + addX] & 1;
      }
    }
    for (let y = 0; y < this.height; y++) {
      const row = y * this.width;
      let total = 0;
      for (let x = 0; x <= HORIZONTAL_RADIUS && x < this.width; x++) {
        total += this.horizontal[row + x];
      }
      for (let x = 0; x < this.width; x++) {
        this.blurred[row + x] = total / divisor;
        const removeX = x - HORIZONTAL_RADIUS;
        const addX = x + HORIZONTAL_RADIUS + 1;
        if (removeX >= 0) total -= this.horizontal[row + removeX];
        if (addX < this.width) total += this.horizontal[row + addX];
      }
    }
  }

  private blurVertical(): void {
    const width = this.width;
    const height = this.height;
    if (width === 0 || height === 0) return;
    const source = this.blurred;
    const target = this.horizontal;
    for (let x = 0; x < width; x++) {
      target[x] = source[x] * VERTICAL_CENTRE_WEIGHT
        + (height > 1 ? source[width + x] * VERTICAL_INNER_WEIGHT : 0)
        + (height > 2 ? source[width * 2 + x] * VERTICAL_OUTER_WEIGHT : 0);
    }
    if (height === 1) return;
    for (let x = 0; x < width; x++) {
      target[width + x] = source[x] * VERTICAL_INNER_WEIGHT
        + source[width + x] * VERTICAL_CENTRE_WEIGHT
        + (height > 2 ? source[width * 2 + x] * VERTICAL_INNER_WEIGHT : 0)
        + (height > 3 ? source[width * 3 + x] * VERTICAL_OUTER_WEIGHT : 0);
    }
    if (height === 2) return;
    for (let y = 2; y < height - 2; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        target[row + x] = source[row - width * 2 + x] * VERTICAL_OUTER_WEIGHT
          + source[row - width + x] * VERTICAL_INNER_WEIGHT
          + source[row + x] * VERTICAL_CENTRE_WEIGHT
          + source[row + width + x] * VERTICAL_INNER_WEIGHT
          + source[row + width * 2 + x] * VERTICAL_OUTER_WEIGHT;
      }
    }
    if (height > 3) {
      const row = (height - 2) * width;
      for (let x = 0; x < width; x++) {
        target[row + x] = source[row - width * 2 + x] * VERTICAL_OUTER_WEIGHT
          + source[row - width + x] * VERTICAL_INNER_WEIGHT
          + source[row + x] * VERTICAL_CENTRE_WEIGHT
          + source[row + width + x] * VERTICAL_INNER_WEIGHT;
      }
    }
    const row = (height - 1) * width;
    for (let x = 0; x < width; x++) {
      target[row + x] = source[row - width * 2 + x] * VERTICAL_OUTER_WEIGHT
        + source[row - width + x] * VERTICAL_INNER_WEIGHT
        + source[row + x] * VERTICAL_CENTRE_WEIGHT;
    }
  }

  private packBytes(): void {
    const width = this.width;
    const height = this.height;
    const densityBytes = this.bytes;
    const densityField = this.horizontal;
    const seed = this.seed;
    const doubleWidth = width * 2;
    for (let y = 0; y < height; y++) {
      const row = y * width;
      const supportFirstRow = y === 0 ? row : row - width;
      const supportRows = height === 1 ? 1 : y === 0 || y === height - 1 ? 2 : 3;
      let support = 0;
      const initialColumns = Math.min(2, width);
      for (let supportY = 0; supportY < supportRows; supportY++) {
        let supportIndex = supportFirstRow + supportY * width;
        for (let supportX = 0; supportX < initialColumns; supportX++) {
          support += (seed[supportIndex + supportX] & 2) >>> 1;
        }
      }
      for (let x = 0; x < width; x++) {
        const index = row + x;
        const offset = index * 4;
        const density = densityField[index];
        const left = x === 0 ? 0 : densityField[index - 1];
        const right = x === width - 1 ? 0 : densityField[index + 1];
        const top = y === 0 ? 0 : densityField[index - width];
        const bottom = y === height - 1 ? 0 : densityField[index + width];
        densityBytes[offset] = Math.round(density * 255);
        densityBytes[offset + 1] = clampByte(128 + (right - left) * 0.5 * GRADIENT_BYTE_SCALE);
        densityBytes[offset + 2] = clampByte(128 + (bottom - top) * 0.5 * GRADIENT_BYTE_SCALE);
        densityBytes[offset + 3] = Math.round(support / 9 * 255);

        const removeX = x - 1;
        const addX = x + 2;
        if (removeX >= 0) {
          const supportIndex = supportFirstRow + removeX;
          support -= (seed[supportIndex] & 2) >>> 1;
          if (supportRows > 1) support -= (seed[supportIndex + width] & 2) >>> 1;
          if (supportRows > 2) support -= (seed[supportIndex + doubleWidth] & 2) >>> 1;
        }
        if (addX < width) {
          const supportIndex = supportFirstRow + addX;
          support += (seed[supportIndex] & 2) >>> 1;
          if (supportRows > 1) support += (seed[supportIndex + width] & 2) >>> 1;
          if (supportRows > 2) support += (seed[supportIndex + doubleWidth] & 2) >>> 1;
        }
      }
    }
  }

  /**
   * Exact four-neighbour exterior classification. The completed blur scratch is
   * reused as an integer queue, so the only persistent cost is one byte/cell and
   * the result is independent of output scale.
   */
  private rebuildExteriorAir(): void {
    const width = this.width;
    const height = this.height;
    const cells = width * height;
    const seed = this.seed;
    const exterior = this.exteriorAirBytes;
    const queue = this.blurred;
    exterior.fill(0);
    let tail = 0;
    for (let x = 0; x < width; x++) {
      const top = x;
      if ((seed[top] & 4) === 0 && exterior[top] === 0) {
        exterior[top] = 255;
        queue[tail++] = top;
      }
      const bottom = (height - 1) * width + x;
      if ((seed[bottom] & 4) === 0 && exterior[bottom] === 0) {
        exterior[bottom] = 255;
        queue[tail++] = bottom;
      }
    }
    for (let y = 1; y + 1 < height; y++) {
      const left = y * width;
      if ((seed[left] & 4) === 0 && exterior[left] === 0) {
        exterior[left] = 255;
        queue[tail++] = left;
      }
      const right = left + width - 1;
      if ((seed[right] & 4) === 0 && exterior[right] === 0) {
        exterior[right] = 255;
        queue[tail++] = right;
      }
    }
    let head = 0;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const left = index - 1;
      const right = index + 1;
      const top = index - width;
      const bottom = index + width;
      if (x > 0 && exterior[left] === 0 && (seed[left] & 4) === 0) {
        exterior[left] = 255;
        queue[tail++] = left;
      }
      if (x + 1 < width && exterior[right] === 0 && (seed[right] & 4) === 0) {
        exterior[right] = 255;
        queue[tail++] = right;
      }
      if (top >= 0 && exterior[top] === 0 && (seed[top] & 4) === 0) {
        exterior[top] = 255;
        queue[tail++] = top;
      }
      if (bottom < cells && exterior[bottom] === 0 && (seed[bottom] & 4) === 0) {
        exterior[bottom] = 255;
        queue[tail++] = bottom;
      }
    }
  }
}

function clampByte(value: number): number {
  const rounded = Math.round(value);
  return rounded < 0 ? 0 : rounded > 255 ? 255 : rounded;
}
