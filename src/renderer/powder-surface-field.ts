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
  /** Bit 0 is stable powder density; bit 1 is local powder/solid support. */
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
            state = 2;
            if (stability[index] >= 192) {
              state = 3;
              hasSurface = true;
            }
          } else if (phase === RenderPhase.Solid) state = 2;
        }
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
            state = 2;
            if (stability[index] >= 192) {
              state = 3;
              hasSurface = true;
            }
          } else if (phase === RenderPhase.Solid) state = 2;
        }
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
      }
      return changed;
    }
    if (!changed) return false;
    this.blurHorizontalTwice();
    this.blurVertical();
    this.packBytes();
    return true;
  }

  get allocatedByteLength(): number {
    return this.bytes.byteLength + this.seed.byteLength
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
          support += seed[supportIndex + supportX] >>> 1;
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
          support -= seed[supportIndex] >>> 1;
          if (supportRows > 1) support -= seed[supportIndex + width] >>> 1;
          if (supportRows > 2) support -= seed[supportIndex + doubleWidth] >>> 1;
        }
        if (addX < width) {
          const supportIndex = supportFirstRow + addX;
          support += seed[supportIndex] >>> 1;
          if (supportRows > 1) support += seed[supportIndex + width] >>> 1;
          if (supportRows > 2) support += seed[supportIndex + doubleWidth] >>> 1;
        }
      }
    }
  }
}

function clampByte(value: number): number {
  const rounded = Math.round(value);
  return rounded < 0 ? 0 : rounded > 255 ? 255 : rounded;
}
