const KERNEL = [1, 2, 1] as const;
const KERNEL_RADIUS = 1;
const EDGE_GAIN = 1.4;

/** Full-resolution liquid occupancy with a tight one-cell reconstruction halo. */
export class LiquidDensityField {
  readonly bytes: Uint8Array;
  private readonly seed: Float32Array;
  private readonly horizontal: Float32Array;
  private readonly blurred: Float32Array;

  constructor(
    readonly width: number,
    readonly height: number,
    private readonly liquidByMaterial: Uint8Array,
  ) {
    const cells = width * height;
    this.bytes = new Uint8Array(cells * 4);
    this.seed = new Float32Array(cells);
    this.horizontal = new Float32Array(cells);
    this.blurred = new Float32Array(cells);
  }

  update(materials: Uint8Array): void {
    if (materials.length !== this.seed.length) throw new Error('Liquid density field size mismatch');
    for (let index = 0; index < materials.length; index++) this.seed[index] = this.liquidByMaterial[materials[index]] ? 1 : 0;
    this.blurHorizontal();
    this.blurVertical();
    for (let index = 0; index < this.seed.length; index++) {
      const density = Math.min(1, Math.max(this.seed[index] * 0.96, this.blurred[index] * EDGE_GAIN));
      const offset = index * 4;
      this.bytes[offset] = Math.round(density * 255);
      this.bytes[offset + 1] = 0;
      this.bytes[offset + 2] = 0;
      this.bytes[offset + 3] = 255;
    }
  }

  private blurHorizontal(): void {
    this.horizontal.fill(0);
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      let total = 0;
      let weightSum = 0;
      for (let kernel = -KERNEL_RADIUS; kernel <= KERNEL_RADIUS; kernel++) {
        const sourceX = x + kernel;
        if (sourceX < 0 || sourceX >= this.width) continue;
        const weight = KERNEL[kernel + KERNEL_RADIUS];
        total += this.seed[y * this.width + sourceX] * weight;
        weightSum += weight;
      }
      this.horizontal[y * this.width + x] = total / weightSum;
    }
  }

  private blurVertical(): void {
    this.blurred.fill(0);
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      let total = 0;
      let weightSum = 0;
      for (let kernel = -KERNEL_RADIUS; kernel <= KERNEL_RADIUS; kernel++) {
        const sourceY = y + kernel;
        if (sourceY < 0 || sourceY >= this.height) continue;
        const weight = KERNEL[kernel + KERNEL_RADIUS];
        total += this.horizontal[sourceY * this.width + x] * weight;
        weightSum += weight;
      }
      this.blurred[y * this.width + x] = total / weightSum;
    }
  }
}
