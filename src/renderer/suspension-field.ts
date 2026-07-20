import { RenderOptics } from './render-optics';
import { RenderPhase } from './render-profile';

export const SUSPENSION_FIELD_SCALE = 2;
const LIQUID_SUPPORT_ALPHA = 64;
const CLUSTER_GAIN = 1.6;
const NON_AQUEOUS_OWNER = 0x100;
const LIQUID_OWNER_MASK = 0x1ff;
const ORDINARY_POWDER_BIT = 0x200;
const AMBIGUOUS_OWNER = 0xffff;
const FOUR_CELL_DENSITY = Uint8Array.of(0, 64, 128, 191, 255);

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

  private readonly seed: Uint8Array;
  private readonly horizontal: Uint8Array;
  private readonly seedOwner: Uint16Array;
  private readonly ownerHorizontal: Uint16Array;
  private readonly materialClass: Uint16Array;

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
    this.seed = new Uint8Array(cells);
    this.horizontal = new Uint8Array(cells);
    this.seedOwner = new Uint16Array(cells);
    this.ownerHorizontal = new Uint16Array(cells);
    this.materialClass = new Uint16Array(256);
    for (let material = 1; material < 256; material++) {
      const offset = material * 4;
      let classification = 0;
      if (styleBytes[offset] === RenderPhase.Liquid) {
        classification = this.isAqueousLiquid(material) ? material : NON_AQUEOUS_OWNER;
      }
      if (this.isOrdinaryPowder(material)) classification |= ORDINARY_POWDER_BIT;
      this.materialClass[material] = classification;
    }
  }

  /** Rebuilds into existing storage and reports whether packed output changed. */
  update(materials: Uint8Array, liquidBytes: Uint8Array, walls?: Uint8Array): boolean {
    const worldCells = this.worldWidth * this.worldHeight;
    if (materials.length !== worldCells || liquidBytes.length !== worldCells * 4
      || (walls !== undefined && walls.length !== worldCells)) {
      throw new Error('Suspension field size mismatch');
    }
    const evenTwoByTwo = (this.worldWidth & 1) === 0 && (this.worldHeight & 1) === 0;
    if (evenTwoByTwo) {
      if (walls === undefined) this.buildSeedsEvenNoWalls(materials, liquidBytes);
      else this.buildSeedsEvenWithWalls(materials, liquidBytes, walls);
    } else {
      this.buildSeedsGeneric(materials, liquidBytes, walls);
    }
    this.blurHorizontal();
    this.blurVertical();
    this.blurOwnersHorizontal();
    this.blurOwnersVertical();
    if (!evenTwoByTwo) return this.packGeneric(liquidBytes, walls);
    return walls === undefined
      ? this.packEvenNoWalls(liquidBytes)
      : this.packEvenWithWalls(liquidBytes, walls);
  }

  get allocatedByteLength(): number {
    return this.bytes.byteLength + this.seed.byteLength + this.horizontal.byteLength
      + this.seedOwner.byteLength + this.ownerHorizontal.byteLength
      + this.materialClass.byteLength;
  }

  /** Canonical 612x384 path with no per-cell optional-wall branch. */
  private buildSeedsEvenNoWalls(materials: Uint8Array, liquidBytes: Uint8Array): void {
    const width = this.worldWidth;
    const materialClass = this.materialClass;
    const seed = this.seed;
    const seedOwner = this.seedOwner;
    const contactOwner = this.ownerHorizontal;
    let fieldIndex = 0;
    for (let top = 0; top < this.worldHeight; top += SUSPENSION_FIELD_SCALE) {
      let worldIndex = top * width;
      for (let left = 0; left < width; left += SUSPENSION_FIELD_SCALE) {
        const material0 = materials[worldIndex];
        const material1 = materials[worldIndex + 1];
        const material2 = materials[worldIndex + width];
        const material3 = materials[worldIndex + width + 1];
        const class0 = materialClass[material0];
        const class1 = materialClass[material1];
        const class2 = materialClass[material2];
        const class3 = materialClass[material3];

        let contact = class0 & LIQUID_OWNER_MASK;
        let candidate = class1 & LIQUID_OWNER_MASK;
        if (candidate !== 0) {
          contact = contact === 0 ? candidate
            : contact === candidate ? contact : NON_AQUEOUS_OWNER;
        }
        candidate = class2 & LIQUID_OWNER_MASK;
        if (candidate !== 0) {
          contact = contact === 0 ? candidate
            : contact === candidate ? contact : NON_AQUEOUS_OWNER;
        }
        candidate = class3 & LIQUID_OWNER_MASK;
        if (candidate !== 0) {
          contact = contact === 0 ? candidate
            : contact === candidate ? contact : NON_AQUEOUS_OWNER;
        }

        let powder = 0;
        let powderCells = 0;
        let ambiguous = false;
        if ((class0 & ORDINARY_POWDER_BIT) !== 0) {
          powder = material0;
          powderCells++;
        }
        if ((class1 & ORDINARY_POWDER_BIT) !== 0) {
          if (powder !== 0 && powder !== material1) ambiguous = true;
          else {
            powder = material1;
            powderCells++;
          }
        }
        if ((class2 & ORDINARY_POWDER_BIT) !== 0) {
          if (powder !== 0 && powder !== material2) ambiguous = true;
          else {
            powder = material2;
            powderCells++;
          }
        }
        if ((class3 & ORDINARY_POWDER_BIT) !== 0) {
          if (powder !== 0 && powder !== material3) ambiguous = true;
          else {
            powder = material3;
            powderCells++;
          }
        }

        if (ambiguous || powder === 0) {
          seed[fieldIndex] = 0;
          seedOwner[fieldIndex] = 0;
        } else {
          seed[fieldIndex] = FOUR_CELL_DENSITY[powderCells];
          seedOwner[fieldIndex] = powder;
        }
        contactOwner[fieldIndex] = contact;
        fieldIndex++;
        worldIndex += SUSPENSION_FIELD_SCALE;
      }
    }
    this.propagateContactsHorizontal();
    this.propagateContactsVertical();
    this.validateSeedsEvenNoWalls(materials, liquidBytes);
  }

  /** Canonical wall-aware path; the wall plane is read directly without unions. */
  private buildSeedsEvenWithWalls(
    materials: Uint8Array,
    liquidBytes: Uint8Array,
    walls: Uint8Array,
  ): void {
    const width = this.worldWidth;
    const materialClass = this.materialClass;
    const seed = this.seed;
    const seedOwner = this.seedOwner;
    const contactOwner = this.ownerHorizontal;
    let fieldIndex = 0;
    for (let top = 0; top < this.worldHeight; top += SUSPENSION_FIELD_SCALE) {
      let worldIndex = top * width;
      for (let left = 0; left < width; left += SUSPENSION_FIELD_SCALE) {
        const index1 = worldIndex + 1;
        const index2 = worldIndex + width;
        const index3 = index2 + 1;
        const material0 = materials[worldIndex];
        const material1 = materials[index1];
        const material2 = materials[index2];
        const material3 = materials[index3];
        const class0 = materialClass[material0];
        const class1 = materialClass[material1];
        const class2 = materialClass[material2];
        const class3 = materialClass[material3];

        let contact = class0 & LIQUID_OWNER_MASK;
        let candidate = class1 & LIQUID_OWNER_MASK;
        if (candidate !== 0) {
          contact = contact === 0 ? candidate
            : contact === candidate ? contact : NON_AQUEOUS_OWNER;
        }
        candidate = class2 & LIQUID_OWNER_MASK;
        if (candidate !== 0) {
          contact = contact === 0 ? candidate
            : contact === candidate ? contact : NON_AQUEOUS_OWNER;
        }
        candidate = class3 & LIQUID_OWNER_MASK;
        if (candidate !== 0) {
          contact = contact === 0 ? candidate
            : contact === candidate ? contact : NON_AQUEOUS_OWNER;
        }

        let powder = 0;
        let powderCells = 0;
        let ambiguous = false;
        if (walls[worldIndex] === 0 && (class0 & ORDINARY_POWDER_BIT) !== 0) {
          powder = material0;
          powderCells++;
        }
        if (walls[index1] === 0 && (class1 & ORDINARY_POWDER_BIT) !== 0) {
          if (powder !== 0 && powder !== material1) ambiguous = true;
          else {
            powder = material1;
            powderCells++;
          }
        }
        if (walls[index2] === 0 && (class2 & ORDINARY_POWDER_BIT) !== 0) {
          if (powder !== 0 && powder !== material2) ambiguous = true;
          else {
            powder = material2;
            powderCells++;
          }
        }
        if (walls[index3] === 0 && (class3 & ORDINARY_POWDER_BIT) !== 0) {
          if (powder !== 0 && powder !== material3) ambiguous = true;
          else {
            powder = material3;
            powderCells++;
          }
        }

        if (ambiguous || powder === 0) {
          seed[fieldIndex] = 0;
          seedOwner[fieldIndex] = 0;
        } else {
          seed[fieldIndex] = FOUR_CELL_DENSITY[powderCells];
          seedOwner[fieldIndex] = powder;
        }
        contactOwner[fieldIndex] = contact;
        fieldIndex++;
        worldIndex += SUSPENSION_FIELD_SCALE;
      }
    }
    this.propagateContactsHorizontal();
    this.propagateContactsVertical();
    this.validateSeedsEvenWithWalls(materials, liquidBytes, walls);
  }

  private validateSeedsEvenNoWalls(materials: Uint8Array, liquidBytes: Uint8Array): void {
    const width = this.worldWidth;
    const paletteBytes = this.paletteBytes;
    let fieldIndex = 0;
    for (let top = 0; top < this.worldHeight; top += SUSPENSION_FIELD_SCALE) {
      let worldIndex = top * width;
      for (let left = 0; left < width; left += SUSPENSION_FIELD_SCALE) {
        const powder = this.seedOwner[fieldIndex] & 0xff;
        const expected = this.ownerHorizontal[fieldIndex];
        let supported = 0;
        if (powder !== 0 && expected !== 0 && expected !== NON_AQUEOUS_OWNER
          && expected !== AMBIGUOUS_OWNER) {
          const palette = expected * 4;
          const red = paletteBytes[palette];
          const green = paletteBytes[palette + 1];
          const blue = paletteBytes[palette + 2];
          const index1 = worldIndex + 1;
          const index2 = worldIndex + width;
          const index3 = index2 + 1;
          let pixel = worldIndex * 4;
          if (materials[worldIndex] === powder && liquidBytes[pixel + 3] >= LIQUID_SUPPORT_ALPHA
            && liquidBytes[pixel] === red && liquidBytes[pixel + 1] === green
            && liquidBytes[pixel + 2] === blue) supported++;
          pixel += 4;
          if (materials[index1] === powder && liquidBytes[pixel + 3] >= LIQUID_SUPPORT_ALPHA
            && liquidBytes[pixel] === red && liquidBytes[pixel + 1] === green
            && liquidBytes[pixel + 2] === blue) supported++;
          pixel = index2 * 4;
          if (materials[index2] === powder && liquidBytes[pixel + 3] >= LIQUID_SUPPORT_ALPHA
            && liquidBytes[pixel] === red && liquidBytes[pixel + 1] === green
            && liquidBytes[pixel + 2] === blue) supported++;
          pixel += 4;
          if (materials[index3] === powder && liquidBytes[pixel + 3] >= LIQUID_SUPPORT_ALPHA
            && liquidBytes[pixel] === red && liquidBytes[pixel + 1] === green
            && liquidBytes[pixel + 2] === blue) supported++;
        }
        if (supported > 0) {
          this.seed[fieldIndex] = FOUR_CELL_DENSITY[supported];
          this.seedOwner[fieldIndex] = powder | (expected << 8);
        } else {
          this.seed[fieldIndex] = 0;
          this.seedOwner[fieldIndex] = 0;
        }
        fieldIndex++;
        worldIndex += SUSPENSION_FIELD_SCALE;
      }
    }
  }

  private validateSeedsEvenWithWalls(
    materials: Uint8Array,
    liquidBytes: Uint8Array,
    walls: Uint8Array,
  ): void {
    const width = this.worldWidth;
    const paletteBytes = this.paletteBytes;
    let fieldIndex = 0;
    for (let top = 0; top < this.worldHeight; top += SUSPENSION_FIELD_SCALE) {
      let worldIndex = top * width;
      for (let left = 0; left < width; left += SUSPENSION_FIELD_SCALE) {
        const powder = this.seedOwner[fieldIndex] & 0xff;
        const expected = this.ownerHorizontal[fieldIndex];
        let supported = 0;
        if (powder !== 0 && expected !== 0 && expected !== NON_AQUEOUS_OWNER
          && expected !== AMBIGUOUS_OWNER) {
          const palette = expected * 4;
          const red = paletteBytes[palette];
          const green = paletteBytes[palette + 1];
          const blue = paletteBytes[palette + 2];
          const index1 = worldIndex + 1;
          const index2 = worldIndex + width;
          const index3 = index2 + 1;
          let pixel = worldIndex * 4;
          if (walls[worldIndex] === 0 && materials[worldIndex] === powder
            && liquidBytes[pixel + 3] >= LIQUID_SUPPORT_ALPHA
            && liquidBytes[pixel] === red && liquidBytes[pixel + 1] === green
            && liquidBytes[pixel + 2] === blue) supported++;
          pixel += 4;
          if (walls[index1] === 0 && materials[index1] === powder
            && liquidBytes[pixel + 3] >= LIQUID_SUPPORT_ALPHA
            && liquidBytes[pixel] === red && liquidBytes[pixel + 1] === green
            && liquidBytes[pixel + 2] === blue) supported++;
          pixel = index2 * 4;
          if (walls[index2] === 0 && materials[index2] === powder
            && liquidBytes[pixel + 3] >= LIQUID_SUPPORT_ALPHA
            && liquidBytes[pixel] === red && liquidBytes[pixel + 1] === green
            && liquidBytes[pixel + 2] === blue) supported++;
          pixel += 4;
          if (walls[index3] === 0 && materials[index3] === powder
            && liquidBytes[pixel + 3] >= LIQUID_SUPPORT_ALPHA
            && liquidBytes[pixel] === red && liquidBytes[pixel + 1] === green
            && liquidBytes[pixel + 2] === blue) supported++;
        }
        if (supported > 0) {
          this.seed[fieldIndex] = FOUR_CELL_DENSITY[supported];
          this.seedOwner[fieldIndex] = powder | (expected << 8);
        } else {
          this.seed[fieldIndex] = 0;
          this.seedOwner[fieldIndex] = 0;
        }
        fieldIndex++;
        worldIndex += SUSPENSION_FIELD_SCALE;
      }
    }
  }

  private buildSeedsGeneric(
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
                // NON_AQUEOUS_OWNER is a temporary unlike/non-aqueous sentinel. The owner
                // scratch carries it only until seed validation, then becomes
                // the propagated powder-owner scratch without extra allocation.
                contactLiquid = NON_AQUEOUS_OWNER;
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
          this.seed[fieldIndex] = Math.round(powderCells / blockCells * 255);
          this.seedOwner[fieldIndex] = powder;
        }
        this.ownerHorizontal[fieldIndex] = contactLiquid;
      }
    }
    this.propagateContactsHorizontal();
    this.propagateContactsVertical();
    this.validateSeedContacts(materials, liquidBytes, walls);
  }

  private mergeContact(left: number, right: number): number {
    if (left === 0) return right;
    if (right === 0) return left;
    if (left === NON_AQUEOUS_OWNER || right === NON_AQUEOUS_OWNER || left === AMBIGUOUS_OWNER
      || right === AMBIGUOUS_OWNER || left !== right) return AMBIGUOUS_OWNER;
    return left;
  }

  /** Expands exact liquid ownership by one half-resolution cell in-place. */
  private propagateContactsHorizontal(): void {
    if (this.width === 1) return;
    for (let y = 0; y < this.height; y++) {
      const row = y * this.width;
      let previous = 0;
      let current = this.ownerHorizontal[row];
      for (let x = 0; x < this.width; x++) {
        const next = x + 1 < this.width ? this.ownerHorizontal[row + x + 1] : 0;
        this.ownerHorizontal[row + x] = this.mergeContact(
          this.mergeContact(previous, current), next,
        );
        previous = current;
        current = next;
      }
    }
  }

  /** Completes the exact 3x3 ownership expansion without another allocation. */
  private propagateContactsVertical(): void {
    if (this.height === 1) return;
    for (let x = 0; x < this.width; x++) {
      let previous = 0;
      let current = this.ownerHorizontal[x];
      for (let y = 0; y < this.height; y++) {
        const next = y + 1 < this.height
          ? this.ownerHorizontal[(y + 1) * this.width + x]
          : 0;
        const index = y * this.width + x;
        this.ownerHorizontal[index] = this.mergeContact(
          this.mergeContact(previous, current), next,
        );
        previous = current;
        current = next;
      }
    }
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
      const expected = this.ownerHorizontal[index];
      const valid = expected !== AMBIGUOUS_OWNER && expected !== NON_AQUEOUS_OWNER;
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
        this.seed[index] = Math.round(supported / blockCells * 255);
        this.seedOwner[index] = powder | (expected << 8);
      } else {
        this.seed[index] = 0;
        this.seedOwner[index] = 0;
      }
    }
  }

  private blurHorizontal(): void {
    if (this.width === 1) {
      this.horizontal.set(this.seed);
      return;
    }
    for (let y = 0; y < this.height; y++) {
      const row = y * this.width;
      for (let x = 0; x < this.width; x++) {
        const index = row + x;
        const centre = this.seed[index] * 2;
        if (x === 0) {
          this.horizontal[index] = Math.round((centre + this.seed[index + 1]) / 3);
        } else if (x === this.width - 1) {
          this.horizontal[index] = Math.round((this.seed[index - 1] + centre) / 3);
        } else {
          this.horizontal[index] = (this.seed[index - 1] + centre + this.seed[index + 1] + 2) >> 2;
        }
      }
    }
  }

  private blurVertical(): void {
    if (this.height === 1) {
      this.seed.set(this.horizontal);
      return;
    }
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const index = y * this.width + x;
      const centre = this.horizontal[index] * 2;
      if (y === 0) {
        this.seed[index] = Math.round((centre + this.horizontal[index + this.width]) / 3);
      } else if (y === this.height - 1) {
        this.seed[index] = Math.round((this.horizontal[index - this.width] + centre) / 3);
      } else {
        this.seed[index] = (
          this.horizontal[index - this.width] + centre
          + this.horizontal[index + this.width] + 2
        ) >> 2;
      }
    }
  }

  private blurOwnersHorizontal(): void {
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const index = y * this.width + x;
      let owner = 0;
      let ambiguous = false;
      const left = Math.max(0, x - 1);
      const right = Math.min(this.width - 1, x + 1);
      for (let sampleX = left; sampleX <= right; sampleX++) {
        const candidate = this.seedOwner[y * this.width + sampleX];
        if (candidate === 0) continue;
        if (candidate === AMBIGUOUS_OWNER || (owner !== 0 && owner !== candidate)) {
          ambiguous = true;
          break;
        }
        owner = candidate;
      }
      this.ownerHorizontal[index] = ambiguous ? AMBIGUOUS_OWNER : owner;
    }
  }

  private blurOwnersVertical(): void {
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const index = y * this.width + x;
      let owner = 0;
      let ambiguous = false;
      const top = Math.max(0, y - 1);
      const bottom = Math.min(this.height - 1, y + 1);
      for (let sampleY = top; sampleY <= bottom; sampleY++) {
        const candidate = this.ownerHorizontal[sampleY * this.width + x];
        if (candidate === 0) continue;
        if (candidate === AMBIGUOUS_OWNER || (owner !== 0 && owner !== candidate)) {
          ambiguous = true;
          break;
        }
        owner = candidate;
      }
      this.seedOwner[index] = ambiguous ? AMBIGUOUS_OWNER : owner;
    }
  }

  private packEvenNoWalls(liquidBytes: Uint8Array): boolean {
    const width = this.worldWidth;
    const paletteBytes = this.paletteBytes;
    let changed = false;
    let hasSuspension = false;
    let fieldIndex = 0;
    for (let top = 0; top < this.worldHeight; top += SUSPENSION_FIELD_SCALE) {
      let worldIndex = top * width;
      for (let left = 0; left < width; left += SUSPENSION_FIELD_SCALE) {
        const fieldPixel = fieldIndex * 4;
        let red = 0;
        let green = 0;
        let blue = 0;
        let alpha = 0;
        const density = Math.min(255, Math.round(this.seed[fieldIndex] * CLUSTER_GAIN));
        const owner = this.seedOwner[fieldIndex];
        if (density > 0 && owner !== AMBIGUOUS_OWNER) {
          const powder = owner & 0xff;
          const expected = owner >>> 8;
          if (powder !== 0 && expected !== 0) {
            const liquidPalette = expected * 4;
            const liquidRed = paletteBytes[liquidPalette];
            const liquidGreen = paletteBytes[liquidPalette + 1];
            const liquidBlue = paletteBytes[liquidPalette + 2];
            const pixel0 = worldIndex * 4;
            const pixel1 = pixel0 + 4;
            const pixel2 = pixel0 + width * 4;
            const pixel3 = pixel2 + 4;
            const supported = (
              liquidBytes[pixel0 + 3] >= LIQUID_SUPPORT_ALPHA
                && liquidBytes[pixel0] === liquidRed
                && liquidBytes[pixel0 + 1] === liquidGreen
                && liquidBytes[pixel0 + 2] === liquidBlue
            ) || (
              liquidBytes[pixel1 + 3] >= LIQUID_SUPPORT_ALPHA
                && liquidBytes[pixel1] === liquidRed
                && liquidBytes[pixel1 + 1] === liquidGreen
                && liquidBytes[pixel1 + 2] === liquidBlue
            ) || (
              liquidBytes[pixel2 + 3] >= LIQUID_SUPPORT_ALPHA
                && liquidBytes[pixel2] === liquidRed
                && liquidBytes[pixel2 + 1] === liquidGreen
                && liquidBytes[pixel2 + 2] === liquidBlue
            ) || (
              liquidBytes[pixel3 + 3] >= LIQUID_SUPPORT_ALPHA
                && liquidBytes[pixel3] === liquidRed
                && liquidBytes[pixel3 + 1] === liquidGreen
                && liquidBytes[pixel3 + 2] === liquidBlue
            );
            if (supported) {
              const powderPalette = powder * 4;
              red = paletteBytes[powderPalette];
              green = paletteBytes[powderPalette + 1];
              blue = paletteBytes[powderPalette + 2];
              alpha = density;
              hasSuspension = true;
            }
          }
        }
        if (this.bytes[fieldPixel] !== red || this.bytes[fieldPixel + 1] !== green
          || this.bytes[fieldPixel + 2] !== blue
          || this.bytes[fieldPixel + 3] !== alpha) changed = true;
        this.bytes[fieldPixel] = red;
        this.bytes[fieldPixel + 1] = green;
        this.bytes[fieldPixel + 2] = blue;
        this.bytes[fieldPixel + 3] = alpha;
        fieldIndex++;
        worldIndex += SUSPENSION_FIELD_SCALE;
      }
    }
    this.hasSuspension = hasSuspension;
    return changed;
  }

  private packEvenWithWalls(liquidBytes: Uint8Array, walls: Uint8Array): boolean {
    const width = this.worldWidth;
    const paletteBytes = this.paletteBytes;
    let changed = false;
    let hasSuspension = false;
    let fieldIndex = 0;
    for (let top = 0; top < this.worldHeight; top += SUSPENSION_FIELD_SCALE) {
      let worldIndex = top * width;
      for (let left = 0; left < width; left += SUSPENSION_FIELD_SCALE) {
        const fieldPixel = fieldIndex * 4;
        let red = 0;
        let green = 0;
        let blue = 0;
        let alpha = 0;
        const density = Math.min(255, Math.round(this.seed[fieldIndex] * CLUSTER_GAIN));
        const owner = this.seedOwner[fieldIndex];
        if (density > 0 && owner !== AMBIGUOUS_OWNER) {
          const powder = owner & 0xff;
          const expected = owner >>> 8;
          const index1 = worldIndex + 1;
          const index2 = worldIndex + width;
          const index3 = index2 + 1;
          if (powder !== 0 && expected !== 0
            && (walls[worldIndex] | walls[index1] | walls[index2] | walls[index3]) === 0) {
            const liquidPalette = expected * 4;
            const liquidRed = paletteBytes[liquidPalette];
            const liquidGreen = paletteBytes[liquidPalette + 1];
            const liquidBlue = paletteBytes[liquidPalette + 2];
            const pixel0 = worldIndex * 4;
            const pixel1 = pixel0 + 4;
            const pixel2 = pixel0 + width * 4;
            const pixel3 = pixel2 + 4;
            const supported = (
              liquidBytes[pixel0 + 3] >= LIQUID_SUPPORT_ALPHA
                && liquidBytes[pixel0] === liquidRed
                && liquidBytes[pixel0 + 1] === liquidGreen
                && liquidBytes[pixel0 + 2] === liquidBlue
            ) || (
              liquidBytes[pixel1 + 3] >= LIQUID_SUPPORT_ALPHA
                && liquidBytes[pixel1] === liquidRed
                && liquidBytes[pixel1 + 1] === liquidGreen
                && liquidBytes[pixel1 + 2] === liquidBlue
            ) || (
              liquidBytes[pixel2 + 3] >= LIQUID_SUPPORT_ALPHA
                && liquidBytes[pixel2] === liquidRed
                && liquidBytes[pixel2 + 1] === liquidGreen
                && liquidBytes[pixel2 + 2] === liquidBlue
            ) || (
              liquidBytes[pixel3 + 3] >= LIQUID_SUPPORT_ALPHA
                && liquidBytes[pixel3] === liquidRed
                && liquidBytes[pixel3 + 1] === liquidGreen
                && liquidBytes[pixel3 + 2] === liquidBlue
            );
            if (supported) {
              const powderPalette = powder * 4;
              red = paletteBytes[powderPalette];
              green = paletteBytes[powderPalette + 1];
              blue = paletteBytes[powderPalette + 2];
              alpha = density;
              hasSuspension = true;
            }
          }
        }
        if (this.bytes[fieldPixel] !== red || this.bytes[fieldPixel + 1] !== green
          || this.bytes[fieldPixel + 2] !== blue
          || this.bytes[fieldPixel + 3] !== alpha) changed = true;
        this.bytes[fieldPixel] = red;
        this.bytes[fieldPixel + 1] = green;
        this.bytes[fieldPixel + 2] = blue;
        this.bytes[fieldPixel + 3] = alpha;
        fieldIndex++;
        worldIndex += SUSPENSION_FIELD_SCALE;
      }
    }
    this.hasSuspension = hasSuspension;
    return changed;
  }

  private packGeneric(
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
      const density = Math.min(255, Math.round(this.seed[fieldIndex] * CLUSTER_GAIN));
      if (density > 0) {
        const owner = this.seedOwner[fieldIndex];
        const powder = owner & 0xff;
        const seededLiquid = owner >>> 8;
        const supportedLiquid = this.outputAqueousLiquid(
          liquidBytes, walls, fieldX, fieldY, seededLiquid,
        );
        if (owner !== AMBIGUOUS_OWNER && powder !== 0 && seededLiquid !== 0
          && supportedLiquid === seededLiquid) {
          const palette = powder * 4;
          red = this.paletteBytes[palette];
          green = this.paletteBytes[palette + 1];
          blue = this.paletteBytes[palette + 2];
          alpha = density;
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
