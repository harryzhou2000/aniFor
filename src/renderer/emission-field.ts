import { Material } from '../shared/materials';
import { blackbodyRadiance, blackbodyRgb } from './blackbody-emission';
import { RenderPhase } from './render-profile';
import { semanticTemperatureByte } from './semantic-field';

const DOWNSAMPLE = 3;
// A nine-tap binomial field reaches twelve world cells from a sparse source.
// That is broad enough for thick material shoulders to receive the same shared
// scene light as their contours, while the existing downsample keeps the field
// compact and the shader still performs exactly its established centre sample.
const KERNEL = [1, 8, 28, 56, 70, 56, 28, 8, 1] as const;
const KERNEL_RADIUS = 4;
// A second, B-only carrier reaches eighteen world cells while preserving the
// established emission bytes used by ordinary lighting and OFF/A captures.
const TRANSPORT_KERNEL_RADIUS = 12;
const TRANSPORT_KERNEL_SUM = 9_434;
const TRANSPORT_CENTRE_WEIGHT = 1024 / TRANSPORT_KERNEL_SUM;
const TRANSPORT_DECAY = 0.8187307530779818; // exp(-0.2), source kernel rounded to integers.
const TRANSPORT_TAIL_DECAY = TRANSPORT_DECAY ** (TRANSPORT_KERNEL_RADIUS + 1);
const TRANSPORT_GAIN = 64;
const GLOW_GAIN = 8;
const BLACKBODY_LUT_STRIDE = 4;
const BLACKBODY_SOURCE_THRESHOLD = 0.001;

/** Build the expensive approximation once; field refreshes only index this table. */
const BLACKBODY_SOURCE_LUT = (() => {
  const table = new Float32Array(256 * BLACKBODY_LUT_STRIDE);
  const color = new Float32Array(3);
  for (let temperature = 0; temperature < 256; temperature++) {
    blackbodyRgb(color, temperature);
    const offset = temperature * BLACKBODY_LUT_STRIDE;
    table[offset] = color[0];
    table[offset + 1] = color[1];
    table[offset + 2] = color[2];
    table[offset + 3] = blackbodyRadiance(temperature);
  }
  return table;
})();

/**
 * A compact coloured light field for energy and emissive materials. It is
 * intentionally lower resolution than matter: linear sampling turns sparse
 * sources into a broad aura without changing their exact semantic core.
 */
export class EmissionField {
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8Array;
  /** B-only long-range radiance; legacy emission bytes remain unchanged. */
  transportBytes?: Uint8Array;
  hasLight = false;
  hasThermalCandidate = false;
  private minimumLightX = 0;
  private maximumLightX = -1;
  private minimumLightY = 0;
  private maximumLightY = -1;
  private readonly seed: Float32Array;
  private readonly horizontal: Float32Array;
  private readonly blurred: Float32Array;
  private transmittance?: Uint8Array;

  constructor(
    private readonly worldWidth: number,
    private readonly worldHeight: number,
    private readonly emissiveByMaterial: Uint8Array,
    private readonly colorByMaterial: Uint8Array,
    private readonly styleBytes?: Uint8Array,
  ) {
    this.width = Math.ceil(worldWidth / DOWNSAMPLE);
    this.height = Math.ceil(worldHeight / DOWNSAMPLE);
    this.bytes = new Uint8Array(this.width * this.height * 4);
    this.seed = new Float32Array(this.bytes.length);
    this.horizontal = new Float32Array(this.bytes.length);
    this.blurred = new Float32Array(this.bytes.length);
  }

  /** Opt-in normal-WebGL carrier; Canvas and compact 8x never allocate it. */
  enableLongRangeTransport(): void {
    this.transportBytes ??= new Uint8Array(this.bytes.length);
    this.transmittance ??= new Uint8Array(this.width * this.height);
  }

  get longRangeTransportEnabled(): boolean { return this.transportBytes !== undefined; }

  update(materials: Uint8Array, temperatures?: Uint16Array, walls?: Uint8Array): void {
    if (materials.length !== this.worldWidth * this.worldHeight) throw new Error('Emission field size mismatch');
    if (temperatures && temperatures.length !== materials.length) {
      throw new Error('Emission temperature field size mismatch');
    }
    if (walls && walls.length !== materials.length) {
      throw new Error('Emission wall field size mismatch');
    }
    this.seed.fill(0);
    this.seedSources(materials, temperatures);
    this.blurHorizontal();
    this.blurVertical();
    this.packBytes();
    if (this.longRangeTransportEnabled) {
      this.buildTransmittance(materials, walls);
      this.transportHorizontal();
      this.transportVertical();
      this.packTransportBytes();
    }
  }

  get allocatedByteLength(): number {
    return this.bytes.byteLength + (this.transportBytes?.byteLength ?? 0)
      + this.seed.byteLength + this.horizontal.byteLength + this.blurred.byteLength
      + (this.transmittance?.byteLength ?? 0);
  }

  /** Cheap rejection before a caller pays for a four-tap coloured sample. */
  mayLightWorldCell(x: number, y: number): boolean {
    if (!this.hasLight) return false;
    const fieldX = Math.max(0, Math.min(
      this.width - 1, (x + 0.5) * this.width / this.worldWidth - 0.5,
    ));
    const fieldY = Math.max(0, Math.min(
      this.height - 1, (y + 0.5) * this.height / this.worldHeight - 0.5,
    ));
    const x0 = Math.floor(fieldX);
    const y0 = Math.floor(fieldY);
    const x1 = Math.min(this.width - 1, x0 + 1);
    const y1 = Math.min(this.height - 1, y0 + 1);
    return x1 >= this.minimumLightX && x0 <= this.maximumLightX
      && y1 >= this.minimumLightY && y0 <= this.maximumLightY;
  }

  /** Mirrors the normal-HDR blackbody eligibility contract on the CPU field. */
  canMaterialEmitThermally(material: number): boolean {
    if (material === Material.Fire || material === Material.Lava || material === Material.Plasma) {
      return true;
    }
    if (!this.styleBytes || this.emissiveByMaterial[material]
      || material === Material.Empty || material === Material.Wall) return false;
    const styleOffset = material * 4;
    const phase = this.styleBytes[styleOffset];
    const traits = this.styleBytes[styleOffset + 3];
    return traits === 0 && (phase === RenderPhase.Solid || phase === RenderPhase.Powder);
  }

  private seedSources(materials: Uint8Array, temperatures?: Uint16Array): void {
    this.hasThermalCandidate = false;
    for (let fieldY = 0; fieldY < this.height; fieldY++) for (let fieldX = 0; fieldX < this.width; fieldX++) {
      let count = 0;
      let red = 0;
      let green = 0;
      let blue = 0;
      let thermalWeight = 0;
      let thermalRed = 0;
      let thermalGreen = 0;
      let thermalBlue = 0;
      for (let offsetY = 0; offsetY < DOWNSAMPLE; offsetY++) {
        const y = fieldY * DOWNSAMPLE + offsetY;
        if (y >= this.worldHeight) continue;
        for (let offsetX = 0; offsetX < DOWNSAMPLE; offsetX++) {
          const x = fieldX * DOWNSAMPLE + offsetX;
          if (x >= this.worldWidth) continue;
          const worldIndex = y * this.worldWidth + x;
          const material = materials[worldIndex];
          const emissive = this.emissiveByMaterial[material] !== 0;
          const thermalCandidate = this.canMaterialEmitThermally(material);
          if (thermalCandidate) this.hasThermalCandidate = true;
          const colorOffset = material * 3;
          const temperature = temperatures && this.styleBytes
            ? semanticTemperatureByte(temperatures[worldIndex]) : 0;
          const blackbodyOffset = temperature * BLACKBODY_LUT_STRIDE;
          const radiance = BLACKBODY_SOURCE_LUT[blackbodyOffset + 3];
          const thermallyVisible = radiance > BLACKBODY_SOURCE_THRESHOLD
            && thermalCandidate;
          if (thermallyVisible) {
            // Ordinary incandescent matter should enter the shared light field
            // as a visible but still graded source.  The old linear /1.2 ramp
            // left the useful orange-hot range faint even though the body's HDR
            // blackbody response was already clear.  This bounded shoulder
            // lifts that range without flattening hotter stages to one weight;
            // native emissive materials retain their established unit weight.
            const sourceWeight = emissive ? 1 : radiance / (0.45 + radiance);
            const tint = emissive ? Math.min(1, radiance / 1.2) : 1;
            thermalWeight += sourceWeight;
            thermalRed += (
              this.colorByMaterial[colorOffset] * (1 - tint)
                + BLACKBODY_SOURCE_LUT[blackbodyOffset] * 255 * tint
            ) * sourceWeight;
            thermalGreen += (
              this.colorByMaterial[colorOffset + 1] * (1 - tint)
                + BLACKBODY_SOURCE_LUT[blackbodyOffset + 1] * 255 * tint
            ) * sourceWeight;
            thermalBlue += (
              this.colorByMaterial[colorOffset + 2] * (1 - tint)
                + BLACKBODY_SOURCE_LUT[blackbodyOffset + 2] * 255 * tint
            ) * sourceWeight;
            continue;
          }
          if (!emissive) continue;
          red += this.colorByMaterial[colorOffset];
          green += this.colorByMaterial[colorOffset + 1];
          blue += this.colorByMaterial[colorOffset + 2];
          count++;
        }
      }
      if (!count && thermalWeight <= 0) continue;
      const target = (fieldY * this.width + fieldX) * 4;
      if (thermalWeight <= 0) {
        // Preserve the established static-emission arithmetic byte-for-byte.
        const density = count / (DOWNSAMPLE * DOWNSAMPLE);
        this.seed[target] = red / count / 255 * density;
        this.seed[target + 1] = green / count / 255 * density;
        this.seed[target + 2] = blue / count / 255 * density;
        this.seed[target + 3] = density;
      } else {
        const sourceWeight = count + thermalWeight;
        const density = sourceWeight / (DOWNSAMPLE * DOWNSAMPLE);
        this.seed[target] = (red + thermalRed) / sourceWeight / 255 * density;
        this.seed[target + 1] = (green + thermalGreen) / sourceWeight / 255 * density;
        this.seed[target + 2] = (blue + thermalBlue) / sourceWeight / 255 * density;
        this.seed[target + 3] = density;
      }
    }
  }

  private blurHorizontal(): void {
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const target = (y * this.width + x) * 4;
      let red = 0;
      let green = 0;
      let blue = 0;
      let density = 0;
      let weightSum = 0;
      for (let kernel = -KERNEL_RADIUS; kernel <= KERNEL_RADIUS; kernel++) {
        const sourceX = x + kernel;
        if (sourceX < 0 || sourceX >= this.width) continue;
        const weight = KERNEL[kernel + KERNEL_RADIUS];
        const source = (y * this.width + sourceX) * 4;
        red += this.seed[source] * weight;
        green += this.seed[source + 1] * weight;
        blue += this.seed[source + 2] * weight;
        density += this.seed[source + 3] * weight;
        weightSum += weight;
      }
      const inverseWeight = 1 / weightSum;
      this.horizontal[target] = red * inverseWeight;
      this.horizontal[target + 1] = green * inverseWeight;
      this.horizontal[target + 2] = blue * inverseWeight;
      this.horizontal[target + 3] = density * inverseWeight;
    }
  }

  private blurVertical(): void {
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const target = (y * this.width + x) * 4;
      let red = 0;
      let green = 0;
      let blue = 0;
      let density = 0;
      let weightSum = 0;
      for (let kernel = -KERNEL_RADIUS; kernel <= KERNEL_RADIUS; kernel++) {
        const sourceY = y + kernel;
        if (sourceY < 0 || sourceY >= this.height) continue;
        const weight = KERNEL[kernel + KERNEL_RADIUS];
        const source = (sourceY * this.width + x) * 4;
        red += this.horizontal[source] * weight;
        green += this.horizontal[source + 1] * weight;
        blue += this.horizontal[source + 2] * weight;
        density += this.horizontal[source + 3] * weight;
        weightSum += weight;
      }
      const inverseWeight = 1 / weightSum;
      this.blurred[target] = red * inverseWeight;
      this.blurred[target + 1] = green * inverseWeight;
      this.blurred[target + 2] = blue * inverseWeight;
      this.blurred[target + 3] = density * inverseWeight;
    }
  }

  private packBytes(): void {
    this.hasLight = false;
    this.minimumLightX = this.width;
    this.maximumLightX = -1;
    this.minimumLightY = this.height;
    this.maximumLightY = -1;
    for (let offset = 0; offset < this.bytes.length; offset += 4) {
      const blurredDensity = this.blurred[offset + 3];
      const density = Math.min(1, Math.max(this.seed[offset + 3] * 0.9, blurredDensity * GLOW_GAIN));
      if (density <= 1 / 255 || blurredDensity <= 1e-6) {
        this.bytes[offset] = 0;
        this.bytes[offset + 1] = 0;
        this.bytes[offset + 2] = 0;
        this.bytes[offset + 3] = 0;
        continue;
      }
      this.bytes[offset] = Math.min(255, Math.round(this.blurred[offset] / blurredDensity * 255));
      this.bytes[offset + 1] = Math.min(255, Math.round(this.blurred[offset + 1] / blurredDensity * 255));
      this.bytes[offset + 2] = Math.min(255, Math.round(this.blurred[offset + 2] / blurredDensity * 255));
      this.bytes[offset + 3] = Math.round(density * 255);
      if (this.bytes[offset + 3] > 0) {
        const sample = offset / 4;
        const x = sample % this.width;
        const y = Math.floor(sample / this.width);
        this.minimumLightX = Math.min(this.minimumLightX, x);
        this.maximumLightX = Math.max(this.maximumLightX, x);
        this.minimumLightY = Math.min(this.minimumLightY, y);
        this.maximumLightY = Math.max(this.maximumLightY, y);
        this.hasLight = true;
      }
    }
  }

  private buildTransmittance(materials: Uint8Array, walls?: Uint8Array): void {
    const transmittance = this.transmittance;
    if (!transmittance) return;
    for (let fieldY = 0; fieldY < this.height; fieldY++) for (let fieldX = 0; fieldX < this.width; fieldX++) {
      let occupied = 0;
      let minimum = 1;
      let hardBlock = false;
      for (let offsetY = 0; offsetY < DOWNSAMPLE; offsetY++) {
        const y = fieldY * DOWNSAMPLE + offsetY;
        if (y >= this.worldHeight) continue;
        for (let offsetX = 0; offsetX < DOWNSAMPLE; offsetX++) {
          const x = fieldX * DOWNSAMPLE + offsetX;
          if (x >= this.worldWidth) continue;
          const worldIndex = y * this.worldWidth + x;
          const material = materials[worldIndex];
          if (walls?.[worldIndex] || material === Material.Wall) {
            hardBlock = true;
            continue;
          }
          if (material === Material.Empty) continue;
          occupied++;
          const styleOffset = material * 4;
          const phase = this.styleBytes?.[styleOffset] ?? RenderPhase.Solid;
          const traits = this.styleBytes?.[styleOffset + 3] ?? 0;
          if ((traits & 0x0e) !== 0 || phase === RenderPhase.Field) {
            hardBlock = true;
          } else if (phase === RenderPhase.Solid) minimum = Math.min(minimum, 0.92);
          else if (phase === RenderPhase.Powder) minimum = Math.min(minimum, 0.94);
          else if (phase === RenderPhase.Liquid) minimum = Math.min(minimum, 0.97);
          else if (phase === RenderPhase.Gas) minimum = Math.min(minimum, 0.99);
        }
      }
      const coverage = occupied / (DOWNSAMPLE * DOWNSAMPLE);
      const value = hardBlock ? 0 : 1 - coverage * (1 - minimum);
      transmittance[fieldY * this.width + fieldX] = Math.round(value * 255);
    }
  }

  private transportHorizontal(): void {
    if (!this.transmittance) return;
    this.horizontal.fill(0);
    this.transportAxis(this.seed, this.horizontal, this.height, this.width, this.width, 1);
  }

  private transportVertical(): void {
    if (!this.transmittance) return;
    this.blurred.fill(0);
    this.transportAxis(this.horizontal, this.blurred, this.width, this.height, 1, this.width);
  }

  /**
   * Applies one finite, separable exponential carrier along each line. The
   * delayed tail subtraction retains the established radius-12 support while
   * replacing a neighbour loop per target with two linear directional sweeps.
   */
  private transportAxis(
    sourcePlane: Float32Array,
    targetPlane: Float32Array,
    lineCount: number,
    lineLength: number,
    lineStride: number,
    cellStride: number,
  ): void {
    const transmittance = this.transmittance!;
    for (let line = 0; line < lineCount; line++) {
      const lineStart = line * lineStride;
      let red = 0;
      let green = 0;
      let blue = 0;
      let density = 0;
      let windowProduct = 1;
      let windowBlockers = 0;
      for (let position = 0; position < lineLength; position++) {
        if (position > 0) {
          const incomingCell = lineStart + (position - 1) * cellStride;
          const incomingTransmittance = transmittance[incomingCell] / 255;
          if (incomingTransmittance === 0) windowBlockers++;
          else windowProduct *= incomingTransmittance;
          const decay = TRANSPORT_DECAY * incomingTransmittance;
          red *= decay;
          green *= decay;
          blue *= decay;
          density *= decay;
        }
        const expiredPosition = position - TRANSPORT_KERNEL_RADIUS - 2;
        if (expiredPosition >= 0) {
          const expiredCell = lineStart + expiredPosition * cellStride;
          const expiredTransmittance = transmittance[expiredCell] / 255;
          if (expiredTransmittance === 0) windowBlockers--;
          else windowProduct /= expiredTransmittance;
        }
        const cell = lineStart + position * cellStride;
        const target = cell * 4;
        red += sourcePlane[target];
        green += sourcePlane[target + 1];
        blue += sourcePlane[target + 2];
        density += sourcePlane[target + 3];
        const tailPosition = position - TRANSPORT_KERNEL_RADIUS - 1;
        if (tailPosition >= 0 && windowBlockers === 0) {
          const tail = (lineStart + tailPosition * cellStride) * 4;
          const tailWeight = TRANSPORT_TAIL_DECAY * windowProduct;
          red = Math.max(0, red - sourcePlane[tail] * tailWeight);
          green = Math.max(0, green - sourcePlane[tail + 1] * tailWeight);
          blue = Math.max(0, blue - sourcePlane[tail + 2] * tailWeight);
          density = Math.max(0, density - sourcePlane[tail + 3] * tailWeight);
        }
        targetPlane[target] = red;
        targetPlane[target + 1] = green;
        targetPlane[target + 2] = blue;
        targetPlane[target + 3] = density;
      }

      red = 0;
      green = 0;
      blue = 0;
      density = 0;
      windowProduct = 1;
      windowBlockers = 0;
      for (let position = lineLength - 1; position >= 0; position--) {
        if (position + 1 < lineLength) {
          const incomingCell = lineStart + (position + 1) * cellStride;
          const incomingTransmittance = transmittance[incomingCell] / 255;
          if (incomingTransmittance === 0) windowBlockers++;
          else windowProduct *= incomingTransmittance;
          const decay = TRANSPORT_DECAY * incomingTransmittance;
          red *= decay;
          green *= decay;
          blue *= decay;
          density *= decay;
        }
        const expiredPosition = position + TRANSPORT_KERNEL_RADIUS + 2;
        if (expiredPosition < lineLength) {
          const expiredCell = lineStart + expiredPosition * cellStride;
          const expiredTransmittance = transmittance[expiredCell] / 255;
          if (expiredTransmittance === 0) windowBlockers--;
          else windowProduct /= expiredTransmittance;
        }
        const cell = lineStart + position * cellStride;
        const target = cell * 4;
        red += sourcePlane[target];
        green += sourcePlane[target + 1];
        blue += sourcePlane[target + 2];
        density += sourcePlane[target + 3];
        const tailPosition = position + TRANSPORT_KERNEL_RADIUS + 1;
        if (tailPosition < lineLength && windowBlockers === 0) {
          const tail = (lineStart + tailPosition * cellStride) * 4;
          const tailWeight = TRANSPORT_TAIL_DECAY * windowProduct;
          red = Math.max(0, red - sourcePlane[tail] * tailWeight);
          green = Math.max(0, green - sourcePlane[tail + 1] * tailWeight);
          blue = Math.max(0, blue - sourcePlane[tail + 2] * tailWeight);
          density = Math.max(0, density - sourcePlane[tail + 3] * tailWeight);
        }
        targetPlane[target] = (targetPlane[target] + red - sourcePlane[target])
          * TRANSPORT_CENTRE_WEIGHT;
        targetPlane[target + 1] = (targetPlane[target + 1] + green - sourcePlane[target + 1])
          * TRANSPORT_CENTRE_WEIGHT;
        targetPlane[target + 2] = (targetPlane[target + 2] + blue - sourcePlane[target + 2])
          * TRANSPORT_CENTRE_WEIGHT;
        targetPlane[target + 3] = (targetPlane[target + 3] + density - sourcePlane[target + 3])
          * TRANSPORT_CENTRE_WEIGHT;
      }
    }
  }

  private packTransportBytes(): void {
    const transportBytes = this.transportBytes;
    if (!transportBytes) return;
    for (let offset = 0; offset < transportBytes.length; offset += 4) {
      const density = this.blurred[offset + 3];
      if (density <= 1e-6) {
        transportBytes.fill(0, offset, offset + 4);
        continue;
      }
      transportBytes[offset] = Math.min(255, Math.round(this.blurred[offset] / density * 255));
      transportBytes[offset + 1] = Math.min(255, Math.round(this.blurred[offset + 1] / density * 255));
      transportBytes[offset + 2] = Math.min(255, Math.round(this.blurred[offset + 2] / density * 255));
      transportBytes[offset + 3] = Math.min(255, Math.round(density * TRANSPORT_GAIN * 255));
    }
  }
}
