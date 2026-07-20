const DOWNSAMPLE = 3;
// A nine-tap binomial field reaches twelve world cells from a sparse source.
// That is broad enough for thick material shoulders to receive the same shared
// scene light as their contours, while the existing downsample keeps the field
// compact and the shader still performs exactly its established centre sample.
const KERNEL = [1, 8, 28, 56, 70, 56, 28, 8, 1] as const;
const KERNEL_RADIUS = 4;
const GLOW_GAIN = 8;

/**
 * A compact coloured light field for energy and emissive materials. It is
 * intentionally lower resolution than matter: linear sampling turns sparse
 * sources into a broad aura without changing their exact semantic core.
 */
export class EmissionField {
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8Array;
  hasLight = false;
  private minimumLightX = 0;
  private maximumLightX = -1;
  private minimumLightY = 0;
  private maximumLightY = -1;
  private readonly seed: Float32Array;
  private readonly horizontal: Float32Array;
  private readonly blurred: Float32Array;

  constructor(
    private readonly worldWidth: number,
    private readonly worldHeight: number,
    private readonly emissiveByMaterial: Uint8Array,
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
    if (materials.length !== this.worldWidth * this.worldHeight) throw new Error('Emission field size mismatch');
    this.seed.fill(0);
    this.seedSources(materials);
    this.blurHorizontal();
    this.blurVertical();
    this.packBytes();
  }

  get allocatedByteLength(): number {
    return this.bytes.byteLength + this.seed.byteLength + this.horizontal.byteLength + this.blurred.byteLength;
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

  private seedSources(materials: Uint8Array): void {
    for (let fieldY = 0; fieldY < this.height; fieldY++) for (let fieldX = 0; fieldX < this.width; fieldX++) {
      let count = 0;
      let red = 0;
      let green = 0;
      let blue = 0;
      for (let offsetY = 0; offsetY < DOWNSAMPLE; offsetY++) {
        const y = fieldY * DOWNSAMPLE + offsetY;
        if (y >= this.worldHeight) continue;
        for (let offsetX = 0; offsetX < DOWNSAMPLE; offsetX++) {
          const x = fieldX * DOWNSAMPLE + offsetX;
          if (x >= this.worldWidth) continue;
          const material = materials[y * this.worldWidth + x];
          if (!this.emissiveByMaterial[material]) continue;
          const colorOffset = material * 3;
          red += this.colorByMaterial[colorOffset];
          green += this.colorByMaterial[colorOffset + 1];
          blue += this.colorByMaterial[colorOffset + 2];
          count++;
        }
      }
      if (!count) continue;
      const density = count / (DOWNSAMPLE * DOWNSAMPLE);
      const target = (fieldY * this.width + fieldX) * 4;
      this.seed[target] = red / count / 255 * density;
      this.seed[target + 1] = green / count / 255 * density;
      this.seed[target + 2] = blue / count / 255 * density;
      this.seed[target + 3] = density;
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
}
