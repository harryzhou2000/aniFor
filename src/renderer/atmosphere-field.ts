const DOWNSAMPLE = 2;
const KERNEL = [1, 4, 6, 4, 1] as const;
const KERNEL_RADIUS = 2;
const CLOUD_GAIN = 4.2;
const STYLE_COMPETITOR_RATIO = 0.78;
const STYLE_STRIDE = 4;
const FLOW_ZERO_BYTE = 128;

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
  /**
   * Existing atmosphere-style plane, now RGBA: dominant identity in R,
   * density-weighted signed flow in G/B, and directional coherence in A.
   * It remains one half-resolution texture and one upload; the extra channels
   * let normal WebGL shade the field-owned cloud instead of individual gas
   * carriers.
   */
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
    this.styleBytes = new Uint8Array(this.width * this.height * STYLE_STRIDE);
    initializeFlowZeros(this.styleBytes);
    this.seed = new Float32Array(this.bytes.length);
    this.horizontal = new Float32Array(this.bytes.length);
    this.blurred = new Float32Array(this.bytes.length);
    this.horizontalStyles = new Uint8Array(this.width * this.height);
  }

  update(materials: Uint8Array, walls?: Uint8Array, velocities?: Int8Array): void {
    if (materials.length !== this.worldWidth * this.worldHeight) throw new Error('Atmosphere field size mismatch');
    if (walls && walls.length !== materials.length) throw new Error('Atmosphere wall field size mismatch');
    if (velocities && velocities.length !== materials.length * 2) {
      throw new Error('Atmosphere velocity field size mismatch');
    }
    this.seed.fill(0);
    this.seedGas(materials, velocities);
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

  private seedGas(materials: Uint8Array, velocities?: Int8Array): void {
    for (let ay = 0; ay < this.height; ay++) {
      for (let ax = 0; ax < this.width; ax++) {
        let count = 0;
        let red = 0;
        let green = 0;
        let blue = 0;
        let velocityX = 0;
        let velocityY = 0;
        let velocityMagnitude = 0;
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
            const worldIndex = y * this.worldWidth + x;
            const material = materials[worldIndex];
            if (!this.gasByMaterial[material]) continue;
            const colorOffset = material * 3;
            red += this.colorByMaterial[colorOffset];
            green += this.colorByMaterial[colorOffset + 1];
            blue += this.colorByMaterial[colorOffset + 2];
            const sourceVelocity = worldIndex * 2;
            const sourceVelocityX = velocities?.[sourceVelocity] ?? 0;
            const sourceVelocityY = velocities?.[sourceVelocity + 1] ?? 0;
            velocityX += sourceVelocityX;
            velocityY += sourceVelocityY;
            velocityMagnitude += Math.hypot(sourceVelocityX, sourceVelocityY);
            const style = this.styleByMaterial[material];
            if (count === 0) style0 = style;
            else if (count === 1) style1 = style;
            else if (count === 2) style2 = style;
            else style3 = style;
            count++;
          }
        }
        const styleOffset = (ay * this.width + ax) * STYLE_STRIDE;
        if (!count) {
          this.styleBytes[styleOffset] = 0;
          writeFlowScratch(this.styleBytes, styleOffset, 0, 0, 0);
          continue;
        }
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
        this.styleBytes[styleOffset] = dominantStyle;
        writeFlowScratch(
          this.styleBytes, styleOffset,
          velocityX / count, velocityY / count, velocityMagnitude / count,
        );
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
        let flowX = 0;
        let flowY = 0;
        let flowMagnitude = 0;
        let flowDensity = 0;
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
          const style = this.styleBytes[source];
          const contribution = this.seed[source + 3] * weight;
          if (style) this.styleWeights[style] += contribution;
          const sourceFlowX = this.styleBytes[source + 1] - FLOW_ZERO_BYTE;
          const sourceFlowY = this.styleBytes[source + 2] - FLOW_ZERO_BYTE;
          const sourceMagnitude = this.styleBytes[source + 3];
          flowX += sourceFlowX * contribution;
          flowY += sourceFlowY * contribution;
          flowMagnitude += sourceMagnitude * contribution;
          flowDensity += contribution;
          weightSum += weight;
        }
        const inverseWeight = 1 / weightSum;
        this.horizontal[target] = red * inverseWeight;
        this.horizontal[target + 1] = green * inverseWeight;
        this.horizontal[target + 2] = blue * inverseWeight;
        this.horizontal[target + 3] = density * inverseWeight;
        this.horizontalStyles[target / 4] = dominantStyle(this.styleWeights);
        writeFlowScratch(
          this.bytes, target,
          flowDensity > 1e-8 ? flowX / flowDensity : 0,
          flowDensity > 1e-8 ? flowY / flowDensity : 0,
          flowDensity > 1e-8 ? flowMagnitude / flowDensity : 0,
        );
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
        let flowX = 0;
        let flowY = 0;
        let flowMagnitude = 0;
        let flowDensity = 0;
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
          const sourceFlowX = this.bytes[source + 1] - FLOW_ZERO_BYTE;
          const sourceFlowY = this.bytes[source + 2] - FLOW_ZERO_BYTE;
          const sourceMagnitude = this.bytes[source + 3];
          flowX += sourceFlowX * contribution;
          flowY += sourceFlowY * contribution;
          flowMagnitude += sourceMagnitude * contribution;
          flowDensity += contribution;
          weightSum += weight;
        }
        const inverseWeight = 1 / weightSum;
        this.blurred[target] = red * inverseWeight;
        this.blurred[target + 1] = green * inverseWeight;
        this.blurred[target + 2] = blue * inverseWeight;
        this.blurred[target + 3] = density * inverseWeight;
        this.styleBytes[target] = dominantStyle(this.styleWeights);
        writeFlowFinal(
          this.styleBytes, target,
          flowDensity > 1e-8 ? flowX / flowDensity : 0,
          flowDensity > 1e-8 ? flowY / flowDensity : 0,
          flowDensity > 1e-8 ? flowMagnitude / flowDensity : 0,
        );
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
        const styleOffset = (fieldY * this.width + fieldX) * STYLE_STRIDE;
        if (this.blurred[styleOffset + 3] <= 1e-6) continue;
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
        if (blocked) {
          this.styleBytes[styleOffset] = 0;
          writeFlowFinal(this.styleBytes, styleOffset, 0, 0, 0);
        }
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
        this.styleBytes[offset] = 0;
        writeFlowFinal(this.styleBytes, offset, 0, 0, 0);
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

function initializeFlowZeros(target: Uint8Array): void {
  for (let offset = 0; offset < target.length; offset += STYLE_STRIDE) {
    target[offset + 1] = FLOW_ZERO_BYTE;
    target[offset + 2] = FLOW_ZERO_BYTE;
  }
}

/** Intermediate passes retain mean speed directly so cancellation is lossless. */
function writeFlowScratch(
  target: Uint8Array, offset: number,
  velocityX: number, velocityY: number, meanMagnitude: number,
): void {
  const boundedX = Math.max(-128, Math.min(127, velocityX));
  const boundedY = Math.max(-128, Math.min(127, velocityY));
  target[offset + 1] = roundSigned(boundedX) + FLOW_ZERO_BYTE;
  target[offset + 2] = roundSigned(boundedY) + FLOW_ZERO_BYTE;
  target[offset + 3] = Math.round(Math.max(0, Math.min(255, meanMagnitude)));
}

/** Final texture stores signed mean flow plus `|mean vector| / mean speed`. */
function writeFlowFinal(
  target: Uint8Array, offset: number,
  velocityX: number, velocityY: number, meanMagnitude: number,
): void {
  const boundedX = Math.max(-128, Math.min(127, velocityX));
  const boundedY = Math.max(-128, Math.min(127, velocityY));
  const roundedX = roundSigned(boundedX);
  const roundedY = roundSigned(boundedY);
  const resultant = Math.hypot(roundedX, roundedY);
  const coherence = meanMagnitude > 1e-6
    ? Math.max(0, Math.min(1, resultant / meanMagnitude)) : 0;
  target[offset + 1] = roundedX + FLOW_ZERO_BYTE;
  target[offset + 2] = roundedY + FLOW_ZERO_BYTE;
  target[offset + 3] = Math.round(coherence * 255);
}

/** Keep exact velocity reversal byte-symmetric at half-integer boundaries. */
function roundSigned(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}
