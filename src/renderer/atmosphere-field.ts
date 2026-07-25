const DOWNSAMPLE = 2;
const KERNEL = [1, 4, 6, 4, 1] as const;
const KERNEL_RADIUS = 2;
const CLOUD_GAIN = 4.2;
const STYLE_COMPETITOR_RATIO = 0.78;

/**
 * A bounded half-resolution gas volume. RGB stores blended gas colour and alpha
 * stores a widened density field; the texture can therefore be linearly sampled
 * without interpolating discrete material IDs.
 */
export class AtmosphereField {
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8Array;
  /** True only when the packed field currently has visible volume support. */
  hasVolume = false;
  /** Dominant gas identity propagated through the same separable cloud kernel. */
  readonly styleBytes: Uint8Array;
  private readonly seed: Float32Array;
  private readonly horizontal: Float32Array;
  private readonly blurred: Float32Array;
  private readonly horizontalStyles: Uint8Array;
  private readonly styleWeights = new Float32Array(18);

  constructor(
    private readonly worldWidth: number,
    private readonly worldHeight: number,
    private readonly gasByMaterial: Uint8Array,
    private readonly colorByMaterial: Uint8Array,
    private readonly styleByMaterial: Uint8Array = new Uint8Array(256),
  ) {
    this.width = Math.ceil(worldWidth / DOWNSAMPLE);
    this.height = Math.ceil(worldHeight / DOWNSAMPLE);
    this.bytes = new Uint8Array(this.width * this.height * 4);
    this.styleBytes = new Uint8Array(this.width * this.height);
    this.seed = new Float32Array(this.bytes.length);
    this.horizontal = new Float32Array(this.bytes.length);
    this.blurred = new Float32Array(this.bytes.length);
    this.horizontalStyles = new Uint8Array(this.styleBytes.length);
  }

  update(materials: Uint8Array, walls?: Uint8Array): void {
    if (materials.length !== this.worldWidth * this.worldHeight) throw new Error('Atmosphere field size mismatch');
    if (walls && walls.length !== materials.length) throw new Error('Atmosphere wall field size mismatch');
    this.seed.fill(0);
    this.seedGas(materials);
    this.blurHorizontal();
    this.blurVertical();
    this.suppressStylesNearMatter(materials, walls);
    this.packBytes();
  }

  /** Cheap dirty rejection for a changed non-gas particle or native wall. */
  mayHaveIdentityNearWorldIndex(index: number): boolean {
    if (index < 0 || index >= this.worldWidth * this.worldHeight) return false;
    const worldX = index % this.worldWidth;
    const worldY = Math.floor(index / this.worldWidth);
    const fieldX = Math.floor(worldX / DOWNSAMPLE);
    const fieldY = Math.floor(worldY / DOWNSAMPLE);
    for (let y = Math.max(0, fieldY - 2); y <= Math.min(this.height - 1, fieldY + 2); y++) {
      for (let x = Math.max(0, fieldX - 2); x <= Math.min(this.width - 1, fieldX + 2); x++) {
        if (this.bytes[(y * this.width + x) * 4 + 3] !== 0) return true;
      }
    }
    return false;
  }

  get allocatedByteLength(): number {
    return this.bytes.byteLength + this.styleBytes.byteLength
      + this.seed.byteLength + this.horizontal.byteLength + this.blurred.byteLength
      + this.horizontalStyles.byteLength + this.styleWeights.byteLength;
  }

  private seedGas(materials: Uint8Array): void {
    for (let ay = 0; ay < this.height; ay++) {
      for (let ax = 0; ax < this.width; ax++) {
        let count = 0;
        let red = 0;
        let green = 0;
        let blue = 0;
        let style0 = 0;
        let style1 = 0;
        let style2 = 0;
        let style3 = 0;
        for (let oy = 0; oy < DOWNSAMPLE; oy++) {
          const y = ay * DOWNSAMPLE + oy;
          if (y >= this.worldHeight) continue;
          for (let ox = 0; ox < DOWNSAMPLE; ox++) {
            const x = ax * DOWNSAMPLE + ox;
            if (x >= this.worldWidth) continue;
            const material = materials[y * this.worldWidth + x];
            if (!this.gasByMaterial[material]) continue;
            const colorOffset = material * 3;
            red += this.colorByMaterial[colorOffset];
            green += this.colorByMaterial[colorOffset + 1];
            blue += this.colorByMaterial[colorOffset + 2];
            const style = this.styleByMaterial[material];
            if (count === 0) style0 = style;
            else if (count === 1) style1 = style;
            else if (count === 2) style2 = style;
            else style3 = style;
            count++;
          }
        }
        if (!count) continue;
        const density = count / (DOWNSAMPLE * DOWNSAMPLE);
        const offset = (ay * this.width + ax) * 4;
        this.seed[offset] = red / count / 255 * density;
        this.seed[offset + 1] = green / count / 255 * density;
        this.seed[offset + 2] = blue / count / 255 * density;
        this.seed[offset + 3] = density;
        // A downsample block contains at most four cells. Resolve its modal
        // nonzero identity with local scalars so reconstruction remains free of
        // per-block allocation; lower style IDs deterministically win ties.
        let dominantStyle = 0;
        let dominantCount = 0;
        let style0Count = 0;
        let style1Count = 0;
        let style2Count = 0;
        let style3Count = 0;
        if (style0) {
          const matches = 1 + Number(style1 === style0) + Number(style2 === style0)
            + Number(style3 === style0);
          style0Count = matches;
          dominantStyle = style0;
          dominantCount = matches;
        }
        if (style1) {
          const matches = Number(style0 === style1) + 1 + Number(style2 === style1)
            + Number(style3 === style1);
          style1Count = matches;
          if (matches > dominantCount || (matches === dominantCount && style1 < dominantStyle)) {
            dominantStyle = style1;
            dominantCount = matches;
          }
        }
        if (style2) {
          const matches = Number(style0 === style2) + Number(style1 === style2) + 1
            + Number(style3 === style2);
          style2Count = matches;
          if (matches > dominantCount || (matches === dominantCount && style2 < dominantStyle)) {
            dominantStyle = style2;
            dominantCount = matches;
          }
        }
        if (style3) {
          const matches = Number(style0 === style3) + Number(style1 === style3)
            + Number(style2 === style3) + 1;
          style3Count = matches;
          if (matches > dominantCount || (matches === dominantCount && style3 < dominantStyle)) {
            dominantStyle = style3;
            dominantCount = matches;
          }
        }
        let runnerUpCount = 0;
        if (style0 && style0 !== dominantStyle) runnerUpCount = style0Count;
        if (style1 && style1 !== dominantStyle) runnerUpCount = Math.max(runnerUpCount, style1Count);
        if (style2 && style2 !== dominantStyle) runnerUpCount = Math.max(runnerUpCount, style2Count);
        if (style3 && style3 !== dominantStyle) runnerUpCount = Math.max(runnerUpCount, style3Count);
        if (dominantCount / count < 0.58
          || (dominantCount - runnerUpCount) / count < 0.12) dominantStyle = 0;
        this.styleBytes[ay * this.width + ax] = dominantStyle;
      }
    }
  }

  private blurHorizontal(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const target = (y * this.width + x) * 4;
        let red = 0;
        let green = 0;
        let blue = 0;
        let density = 0;
        let weightSum = 0;
        this.styleWeights.fill(0);
        for (let kernel = -KERNEL_RADIUS; kernel <= KERNEL_RADIUS; kernel++) {
          const sourceX = x + kernel;
          if (sourceX < 0 || sourceX >= this.width) continue;
          const weight = KERNEL[kernel + KERNEL_RADIUS];
          const source = (y * this.width + sourceX) * 4;
          red += this.seed[source] * weight;
          green += this.seed[source + 1] * weight;
          blue += this.seed[source + 2] * weight;
          density += this.seed[source + 3] * weight;
          const style = this.styleBytes[source / 4];
          const contribution = this.seed[source + 3] * weight;
          if (style) this.styleWeights[style] += contribution;
          weightSum += weight;
        }
        const inverseWeight = 1 / weightSum;
        this.horizontal[target] = red * inverseWeight;
        this.horizontal[target + 1] = green * inverseWeight;
        this.horizontal[target + 2] = blue * inverseWeight;
        this.horizontal[target + 3] = density * inverseWeight;
        this.horizontalStyles[target / 4] = dominantStyle(this.styleWeights);
      }
    }
  }

  private blurVertical(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const target = (y * this.width + x) * 4;
        let red = 0;
        let green = 0;
        let blue = 0;
        let density = 0;
        let weightSum = 0;
        this.styleWeights.fill(0);
        for (let kernel = -KERNEL_RADIUS; kernel <= KERNEL_RADIUS; kernel++) {
          const sourceY = y + kernel;
          if (sourceY < 0 || sourceY >= this.height) continue;
          const weight = KERNEL[kernel + KERNEL_RADIUS];
          const source = (sourceY * this.width + x) * 4;
          red += this.horizontal[source] * weight;
          green += this.horizontal[source + 1] * weight;
          blue += this.horizontal[source + 2] * weight;
          density += this.horizontal[source + 3] * weight;
          const style = this.horizontalStyles[source / 4];
          const contribution = this.horizontal[source + 3] * weight;
          if (style) this.styleWeights[style] += contribution;
          weightSum += weight;
        }
        const inverseWeight = 1 / weightSum;
        this.blurred[target] = red * inverseWeight;
        this.blurred[target + 1] = green * inverseWeight;
        this.blurred[target + 2] = blue * inverseWeight;
        this.blurred[target + 3] = density * inverseWeight;
        this.styleBytes[target / 4] = dominantStyle(this.styleWeights);
      }
    }
  }

  /**
   * Gas colour and alpha may softly overlap neighbouring matter, but categorical
   * identity must not tint a solid or liquid contact through the Canvas volume
   * plane. Keep one downsample texel of neutral identity around authoritative
   * non-gas cells. Two field texels absorb both stages of the Canvas presenter's
   * linear upsampling footprint while leaving the continuous mixed atmosphere
   * untouched.
   */
  private suppressStylesNearMatter(materials: Uint8Array, walls?: Uint8Array): void {
    // The horizontal style plane is dead after the vertical pass; reuse it as
    // a half-resolution blocker mask instead of allocating another world field.
    for (let fieldY = 0; fieldY < this.height; fieldY++) {
      for (let fieldX = 0; fieldX < this.width; fieldX++) {
        let blocked = false;
        for (let offsetY = 0; offsetY < DOWNSAMPLE && !blocked; offsetY++) {
          const y = fieldY * DOWNSAMPLE + offsetY;
          if (y >= this.worldHeight) continue;
          const row = y * this.worldWidth;
          for (let offsetX = 0; offsetX < DOWNSAMPLE; offsetX++) {
            const x = fieldX * DOWNSAMPLE + offsetX;
            if (x >= this.worldWidth) continue;
            const worldIndex = row + x;
            const material = materials[worldIndex];
            if ((material !== 0 && this.gasByMaterial[material] === 0)
              || (walls?.[worldIndex] ?? 0) !== 0) {
              blocked = true;
              break;
            }
          }
        }
        this.horizontalStyles[fieldY * this.width + fieldX] = blocked ? 1 : 0;
      }
    }
    for (let fieldY = 0; fieldY < this.height; fieldY++) {
      const minimumY = Math.max(0, fieldY - 2);
      const maximumY = Math.min(this.height - 1, fieldY + 2);
      for (let fieldX = 0; fieldX < this.width; fieldX++) {
        const styleOffset = fieldY * this.width + fieldX;
        if (this.styleBytes[styleOffset] === 0) continue;
        const minimumX = Math.max(0, fieldX - 2);
        const maximumX = Math.min(this.width - 1, fieldX + 2);
        let blocked = false;
        for (let y = minimumY; y <= maximumY && !blocked; y++) {
          const row = y * this.width;
          for (let x = minimumX; x <= maximumX; x++) {
            if (this.horizontalStyles[row + x] !== 0) {
              blocked = true;
              break;
            }
          }
        }
        if (blocked) this.styleBytes[styleOffset] = 0;
      }
    }
  }

  private packBytes(): void {
    this.hasVolume = false;
    for (let offset = 0; offset < this.bytes.length; offset += 4) {
      const blurredDensity = this.blurred[offset + 3];
      const density = Math.min(1, Math.max(this.seed[offset + 3] * 0.85, blurredDensity * CLOUD_GAIN));
      if (density <= 1 / 255 || blurredDensity <= 1e-6) {
        this.bytes[offset] = 0;
        this.bytes[offset + 1] = 0;
        this.bytes[offset + 2] = 0;
        this.bytes[offset + 3] = 0;
        this.styleBytes[offset / 4] = 0;
        continue;
      }
      this.bytes[offset] = Math.min(255, Math.round(this.blurred[offset] / blurredDensity * 255));
      this.bytes[offset + 1] = Math.min(255, Math.round(this.blurred[offset + 1] / blurredDensity * 255));
      this.bytes[offset + 2] = Math.min(255, Math.round(this.blurred[offset + 2] / blurredDensity * 255));
      this.bytes[offset + 3] = Math.round(density * 255);
      if (this.bytes[offset + 3] > 0) this.hasVolume = true;
    }
  }
}

function dominantStyle(weights: Float32Array): number {
  let strongestStyle = 0;
  let strongestWeight = 0;
  let runnerUpWeight = 0;
  for (let style = 1; style < weights.length; style++) {
    const weight = weights[style];
    if (weight > strongestWeight) {
      runnerUpWeight = strongestWeight;
      strongestWeight = weight;
      strongestStyle = style;
    } else if (weight > runnerUpWeight) {
      runnerUpWeight = weight;
    }
  }
  return strongestWeight > 0 && runnerUpWeight < strongestWeight * STYLE_COMPETITOR_RATIO
    ? strongestStyle : 0;
}
