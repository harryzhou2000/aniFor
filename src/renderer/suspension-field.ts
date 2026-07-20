import { RenderOptics } from './render-optics';
import { RenderPhase } from './render-profile';

export const SUSPENSION_FIELD_SCALE = 2;
const LIQUID_SUPPORT_ALPHA = 64;
const CLUSTER_GAIN = 1.6;
const KERNEL_RADIUS = 1;
const KERNEL_0 = 1;
const KERNEL_1 = 2;

/**
 * Half-resolution, presentation-only sediment clusters. RGB is always one
 * exact powder's canonical palette colour and alpha is cluster density.
 * Unlike powder or liquid ownership is rejected instead of averaged.
 */
export class SuspensionField {
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8Array;
  hasSuspension = false;

  private readonly seed: Float32Array;
  private readonly horizontal: Float32Array;
  private readonly seedOwner: Uint16Array;

  constructor(
    readonly worldWidth: number,
    readonly worldHeight: number,
    private readonly styleBytes: Uint8Array,
    private readonly paletteBytes: Uint8Array,
  ) {
    if (worldWidth <= 0 || worldHeight <= 0) {
      throw new Error('Suspension field dimensions must be positive');
    }
    if (styleBytes.length < 256 * 4 || paletteBytes.length < 256 * 4) {
      throw new Error('Suspension field lookups must cover 256 materials');
    }
    this.width = Math.ceil(worldWidth / SUSPENSION_FIELD_SCALE);
    this.height = Math.ceil(worldHeight / SUSPENSION_FIELD_SCALE);
    const cells = this.width * this.height;
    this.bytes = new Uint8Array(cells * 4);
    this.seed = new Float32Array(cells);
    this.horizontal = new Float32Array(cells);
    this.seedOwner = new Uint16Array(cells);
  }

  /** Rebuilds into existing storage and reports whether packed output changed. */
  update(materials: Uint8Array, liquidBytes: Uint8Array, walls?: Uint8Array): boolean {
    const worldCells = this.worldWidth * this.worldHeight;
    if (materials.length !== worldCells || liquidBytes.length !== worldCells * 4
      || (walls !== undefined && walls.length !== worldCells)) {
      throw new Error('Suspension field size mismatch');
    }
    this.buildSeeds(materials, liquidBytes, walls);
    this.blurHorizontal();
    this.blurVertical();
    return this.pack(liquidBytes, walls);
  }

  get allocatedByteLength(): number {
    return this.bytes.byteLength + this.seed.byteLength + this.horizontal.byteLength
      + this.seedOwner.byteLength;
  }

  private buildSeeds(
    materials: Uint8Array,
    liquidBytes: Uint8Array,
    walls: Uint8Array | undefined,
  ): void {
    for (let fieldY = 0; fieldY < this.height; fieldY++) {
      const worldTop = fieldY * SUSPENSION_FIELD_SCALE;
      const worldBottom = Math.min(this.worldHeight, worldTop + SUSPENSION_FIELD_SCALE);
      for (let fieldX = 0; fieldX < this.width; fieldX++) {
        const fieldIndex = fieldY * this.width + fieldX;
        const worldLeft = fieldX * SUSPENSION_FIELD_SCALE;
        const worldRight = Math.min(this.worldWidth, worldLeft + SUSPENSION_FIELD_SCALE);
        let blockCells = 0;
        let powderCells = 0;
        let powder = 0;
        let contactLiquid = 0;
        let ambiguous = false;
        for (let worldY = worldTop; worldY < worldBottom; worldY++) {
          for (let worldX = worldLeft; worldX < worldRight; worldX++) {
            blockCells++;
            const worldIndex = worldY * this.worldWidth + worldX;
            const material = materials[worldIndex];
            if (this.styleBytes[material * 4] === RenderPhase.Liquid) {
              if (!this.isAqueousLiquid(material)
                || (contactLiquid !== 0 && contactLiquid !== material)) {
                // 256 is a temporary unlike/non-aqueous sentinel. The Float32
                // horizontal buffer carries it only until seed validation, then
                // becomes the blur scratch again without extra allocation.
                contactLiquid = 256;
              } else if (contactLiquid === 0) contactLiquid = material;
            }
            if ((walls?.[worldIndex] ?? 0) !== 0 || !this.isOrdinaryPowder(material)) continue;
            if (powder !== 0 && powder !== material) {
              ambiguous = true;
              continue;
            }
            powder = material;
            powderCells++;
          }
        }
        if (ambiguous || powder === 0 || powderCells === 0) {
          this.seed[fieldIndex] = 0;
          this.seedOwner[fieldIndex] = 0;
        } else {
          this.seed[fieldIndex] = powderCells / blockCells;
          this.seedOwner[fieldIndex] = powder;
        }
        this.horizontal[fieldIndex] = contactLiquid;
      }
    }
    this.validateSeedContacts(materials, liquidBytes, walls);
  }

  private validateSeedContacts(
    materials: Uint8Array,
    liquidBytes: Uint8Array,
    walls: Uint8Array | undefined,
  ): void {
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const index = y * this.width + x;
      const powder = this.seedOwner[index] & 0xff;
      if (powder === 0) continue;
      let expected = 0;
      let valid = true;
      for (let sampleY = Math.max(0, y - 1); sampleY <= Math.min(this.height - 1, y + 1); sampleY++) {
        for (let sampleX = Math.max(0, x - 1); sampleX <= Math.min(this.width - 1, x + 1); sampleX++) {
          const candidate = this.horizontal[sampleY * this.width + sampleX];
          if (candidate === 0) continue;
          if (candidate === 256 || (expected !== 0 && candidate !== expected)) valid = false;
          else expected = candidate;
        }
      }
      let supported = 0;
      let blockCells = 0;
      if (valid && expected !== 0) {
        const top = y * SUSPENSION_FIELD_SCALE;
        const left = x * SUSPENSION_FIELD_SCALE;
        for (let offsetY = 0; offsetY < SUSPENSION_FIELD_SCALE && top + offsetY < this.worldHeight; offsetY++) {
          for (let offsetX = 0; offsetX < SUSPENSION_FIELD_SCALE && left + offsetX < this.worldWidth; offsetX++) {
            const worldIndex = (top + offsetY) * this.worldWidth + left + offsetX;
            blockCells++;
            if (materials[worldIndex] === powder && (walls?.[worldIndex] ?? 0) === 0
              && this.liquidFieldMatches(liquidBytes, worldIndex * 4, expected)) supported++;
          }
        }
      }
      if (supported > 0) {
        this.seed[index] = supported / blockCells;
        this.seedOwner[index] = powder | (expected << 8);
      } else {
        this.seed[index] = 0;
        this.seedOwner[index] = 0;
      }
    }
  }

  private blurHorizontal(): void {
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      let total = 0;
      let weightSum = 0;
      for (let offset = -KERNEL_RADIUS; offset <= KERNEL_RADIUS; offset++) {
        const sampleX = x + offset;
        if (sampleX < 0 || sampleX >= this.width) continue;
        const weight = offset === 0 ? KERNEL_1 : KERNEL_0;
        total += this.seed[y * this.width + sampleX] * weight;
        weightSum += weight;
      }
      this.horizontal[y * this.width + x] = total / weightSum;
    }
  }

  private blurVertical(): void {
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      let total = 0;
      let weightSum = 0;
      for (let offset = -KERNEL_RADIUS; offset <= KERNEL_RADIUS; offset++) {
        const sampleY = y + offset;
        if (sampleY < 0 || sampleY >= this.height) continue;
        const weight = offset === 0 ? KERNEL_1 : KERNEL_0;
        total += this.horizontal[sampleY * this.width + x] * weight;
        weightSum += weight;
      }
      this.seed[y * this.width + x] = total / weightSum;
    }
  }

  private pack(
    liquidBytes: Uint8Array,
    walls: Uint8Array | undefined,
  ): boolean {
    let changed = false;
    let hasSuspension = false;
    for (let fieldY = 0; fieldY < this.height; fieldY++) for (let fieldX = 0; fieldX < this.width; fieldX++) {
      const fieldIndex = fieldY * this.width + fieldX;
      const pixel = fieldIndex * 4;
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      const density = Math.min(1, this.seed[fieldIndex] * CLUSTER_GAIN);
      if (density > 0) {
        const owner = this.uniqueSeedValue(this.seedOwner, fieldX, fieldY);
        const powder = owner & 0xff;
        const seededLiquid = owner >>> 8;
        const supportedLiquid = this.outputAqueousLiquid(
          liquidBytes, walls, fieldX, fieldY, seededLiquid,
        );
        if (powder !== 0 && seededLiquid !== 0 && supportedLiquid === seededLiquid) {
          const palette = powder * 4;
          red = this.paletteBytes[palette];
          green = this.paletteBytes[palette + 1];
          blue = this.paletteBytes[palette + 2];
          alpha = Math.round(density * 255);
          hasSuspension = alpha > 0 || hasSuspension;
        }
      }
      if (this.bytes[pixel] !== red || this.bytes[pixel + 1] !== green
        || this.bytes[pixel + 2] !== blue || this.bytes[pixel + 3] !== alpha) changed = true;
      this.bytes[pixel] = red;
      this.bytes[pixel + 1] = green;
      this.bytes[pixel + 2] = blue;
      this.bytes[pixel + 3] = alpha;
    }
    this.hasSuspension = hasSuspension;
    return changed;
  }

  private outputAqueousLiquid(
    liquidBytes: Uint8Array,
    walls: Uint8Array | undefined,
    fieldX: number,
    fieldY: number,
    expected: number,
  ): number {
    if (expected === 0) return 0;
    const worldLeft = fieldX * SUSPENSION_FIELD_SCALE;
    const worldTop = fieldY * SUSPENSION_FIELD_SCALE;
    const worldRight = Math.min(this.worldWidth, worldLeft + SUSPENSION_FIELD_SCALE);
    const worldBottom = Math.min(this.worldHeight, worldTop + SUSPENSION_FIELD_SCALE);
    let liquid = 0;
    for (let y = worldTop; y < worldBottom; y++) {
      for (let x = worldLeft; x < worldRight; x++) {
        const index = y * this.worldWidth + x;
        if ((walls?.[index] ?? 0) !== 0) return 0;
        if (!this.liquidFieldMatches(liquidBytes, index * 4, expected)) continue;
        liquid = expected;
      }
    }
    return liquid;
  }

  private uniqueSeedValue(source: Uint16Array, x: number, y: number): number {
    let value = 0;
    for (let sampleY = Math.max(0, y - 1); sampleY <= Math.min(this.height - 1, y + 1); sampleY++) {
      for (let sampleX = Math.max(0, x - 1); sampleX <= Math.min(this.width - 1, x + 1); sampleX++) {
        const candidate = source[sampleY * this.width + sampleX];
        if (candidate === 0) continue;
        if (value !== 0 && value !== candidate) return 0;
        value = candidate;
      }
    }
    return value;
  }

  private liquidFieldMatches(bytes: Uint8Array, pixel: number, material: number): boolean {
    const palette = material * 4;
    return bytes[pixel + 3] >= LIQUID_SUPPORT_ALPHA
      && bytes[pixel] === this.paletteBytes[palette]
      && bytes[pixel + 1] === this.paletteBytes[palette + 1]
      && bytes[pixel + 2] === this.paletteBytes[palette + 2];
  }

  private isOrdinaryPowder(material: number): boolean {
    const offset = material * 4;
    return material !== 0
      && this.styleBytes[offset] === RenderPhase.Powder
      && this.styleBytes[offset + 2] === 0
      && this.styleBytes[offset + 3] === 0
      && this.paletteBytes[offset + 3] === RenderOptics.RoughGranular;
  }

  private isAqueousLiquid(material: number): boolean {
    const offset = material * 4;
    return this.styleBytes[offset] === RenderPhase.Liquid
      && this.styleBytes[offset + 2] === 0
      && this.styleBytes[offset + 3] === 0
      && this.paletteBytes[offset + 3] === RenderOptics.Aqueous;
  }
}
