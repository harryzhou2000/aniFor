const DOWNSAMPLE = 2;
const KERNEL = [1, 4, 6, 4, 1] as const;
const KERNEL_RADIUS = 2;
const CLOUD_GAIN = 4.2;

/**
 * A bounded half-resolution gas volume. RGB stores blended gas colour and alpha
 * stores a widened density field; the texture can therefore be linearly sampled
 * without interpolating discrete material IDs.
 */
export class AtmosphereField {
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8Array;
  private readonly seed: Float32Array;
  private readonly horizontal: Float32Array;
  private readonly blurred: Float32Array;

  constructor(
    private readonly worldWidth: number,
    private readonly worldHeight: number,
    private readonly gasByMaterial: Uint8Array,
    private readonly colorByMaterial: Uint8Array,
  ) {
    this.width = Math.ceil(worldWidth / DOWNSAMPLE);
    this.height = Math.ceil(worldHeight / DOWNSAMPLE);
    this.bytes = new Uint8Array(this.width * this.height * 4);
    this.seed = new Float32Array(this.bytes.length);
    this.horizontal = new Float32Array(this.bytes.length);
    this.blurred = new Float32Array(this.bytes.length);
  }

  update(materials: Uint8Array): void {
    if (materials.length !== this.worldWidth * this.worldHeight) throw new Error('Atmosphere field size mismatch');
    this.seed.fill(0);
    this.seedGas(materials);
    this.blurHorizontal();
    this.blurVertical();
    this.packBytes();
  }

  private seedGas(materials: Uint8Array): void {
    for (let ay = 0; ay < this.height; ay++) {
      for (let ax = 0; ax < this.width; ax++) {
        let count = 0;
        let red = 0;
        let green = 0;
        let blue = 0;
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
      }
    }
  }

  private blurHorizontal(): void {
    this.horizontal.fill(0);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const target = (y * this.width + x) * 4;
        let weightSum = 0;
        for (let kernel = -KERNEL_RADIUS; kernel <= KERNEL_RADIUS; kernel++) {
          const sourceX = x + kernel;
          if (sourceX < 0 || sourceX >= this.width) continue;
          const weight = KERNEL[kernel + KERNEL_RADIUS];
          const source = (y * this.width + sourceX) * 4;
          for (let channel = 0; channel < 4; channel++) this.horizontal[target + channel] += this.seed[source + channel] * weight;
          weightSum += weight;
        }
        for (let channel = 0; channel < 4; channel++) this.horizontal[target + channel] /= weightSum;
      }
    }
  }

  private blurVertical(): void {
    this.blurred.fill(0);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const target = (y * this.width + x) * 4;
        let weightSum = 0;
        for (let kernel = -KERNEL_RADIUS; kernel <= KERNEL_RADIUS; kernel++) {
          const sourceY = y + kernel;
          if (sourceY < 0 || sourceY >= this.height) continue;
          const weight = KERNEL[kernel + KERNEL_RADIUS];
          const source = (sourceY * this.width + x) * 4;
          for (let channel = 0; channel < 4; channel++) this.blurred[target + channel] += this.horizontal[source + channel] * weight;
          weightSum += weight;
        }
        for (let channel = 0; channel < 4; channel++) this.blurred[target + channel] /= weightSum;
      }
    }
  }

  private packBytes(): void {
    for (let offset = 0; offset < this.bytes.length; offset += 4) {
      const blurredDensity = this.blurred[offset + 3];
      const density = Math.min(1, Math.max(this.seed[offset + 3] * 0.85, blurredDensity * CLOUD_GAIN));
      if (density <= 1 / 255 || blurredDensity <= 1e-6) {
        this.bytes.fill(0, offset, offset + 4);
        continue;
      }
      this.bytes[offset] = Math.min(255, Math.round(this.blurred[offset] / blurredDensity * 255));
      this.bytes[offset + 1] = Math.min(255, Math.round(this.blurred[offset + 1] / blurredDensity * 255));
      this.bytes[offset + 2] = Math.min(255, Math.round(this.blurred[offset + 2] / blurredDensity * 255));
      this.bytes[offset + 3] = Math.round(density * 255);
    }
  }
}
