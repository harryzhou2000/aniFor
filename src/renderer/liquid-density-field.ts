const KERNEL = [1, 2, 1] as const;
const KERNEL_RADIUS = 1;
const EDGE_GAIN = 1.4;
const OPTICAL_DEPTH_STEP = 6;
const NEIGHBOUR_X = new Int8Array([-1, 1, 0, 0, -1, 1, -1, 1]);
const NEIGHBOUR_Y = new Int8Array([0, 0, -1, 1, -1, -1, 1, 1]);
const NEIGHBOUR_WEIGHT = new Uint8Array([2, 2, 2, 2, 1, 1, 1, 1]);

/**
 * Full-resolution, species-aware liquid occupancy with a tight one-cell
 * reconstruction halo. RGB stores the locally supported liquid colour and
 * alpha stores density; ambiguous mixed-species ties remain transparent so a
 * smoothed surface cannot bleed one liquid through another.
 */
export class LiquidDensityField {
  readonly bytes: Uint8Array;
  private readonly seed: Float32Array;
  private readonly horizontal: Float32Array;
  private readonly blurred: Float32Array;
  private readonly speciesSupport = new Uint8Array(256);
  private readonly touchedSpecies = new Uint8Array(8);

  constructor(
    readonly width: number,
    readonly height: number,
    private readonly liquidByMaterial: Uint8Array,
    private readonly colorByMaterial: Uint8Array,
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
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const index = y * this.width + x;
      const density = Math.min(1, Math.max(this.seed[index] * 0.96, this.blurred[index] * EDGE_GAIN));
      const offset = index * 4;
      const exactMaterial = materials[index];
      const liquid = this.liquidByMaterial[exactMaterial]
        ? exactMaterial
        : (density > 0 ? this.supportedLiquid(materials, x, y) : 0);
      if (liquid) {
        const color = liquid * 3;
        this.bytes[offset] = this.colorByMaterial[color];
        this.bytes[offset + 1] = this.colorByMaterial[color + 1];
        this.bytes[offset + 2] = this.colorByMaterial[color + 2];
        this.bytes[offset + 3] = Math.round(density * 255);
      } else {
        this.bytes[offset] = 0;
        this.bytes[offset + 1] = 0;
        this.bytes[offset + 2] = 0;
        this.bytes[offset + 3] = 0;
      }
    }
  }

  get allocatedByteLength(): number {
    return this.bytes.byteLength + this.seed.byteLength + this.horizontal.byteLength + this.blurred.byteLength
      + this.speciesSupport.byteLength + this.touchedSpecies.byteLength;
  }

  /**
   * Writes vertical exact-species optical depth into a caller-owned auxiliary
   * plane. Non-liquid bytes are preserved for phase-local uses such as powder
   * stability, so this adds no persistent allocation.
   */
  writeVerticalOpticalDepth(materials: Uint8Array, target: Uint8Array, walls?: Uint8Array): void {
    if (materials.length !== this.seed.length || target.length !== materials.length
      || (walls !== undefined && walls.length !== materials.length)) {
      throw new Error('Liquid optical depth field size mismatch');
    }
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const index = y * this.width + x;
      const material = materials[index];
      if (!this.liquidByMaterial[material]) continue;
      const above = index - this.width;
      target[index] = y > 0 && (!walls || (walls[index] === 0 && walls[above] === 0))
        && materials[above] === material
        ? Math.min(255, target[index - this.width] + OPTICAL_DEPTH_STEP)
        : 0;
    }
  }

  private supportedLiquid(materials: Uint8Array, x: number, y: number): number {
    let touchedCount = 0;
    for (let neighbour = 0; neighbour < 8; neighbour++) {
      const sampleX = x + NEIGHBOUR_X[neighbour];
      const sampleY = y + NEIGHBOUR_Y[neighbour];
      if (sampleX < 0 || sampleY < 0 || sampleX >= this.width || sampleY >= this.height) continue;
      const material = materials[sampleY * this.width + sampleX];
      if (!this.liquidByMaterial[material]) continue;
      if (this.speciesSupport[material] === 0) this.touchedSpecies[touchedCount++] = material;
      this.speciesSupport[material] += NEIGHBOUR_WEIGHT[neighbour];
    }
    if (touchedCount === 1) {
      const material = this.touchedSpecies[0];
      this.speciesSupport[material] = 0;
      return material;
    }
    let bestMaterial = 0;
    let bestSupport = 0;
    let tied = false;
    for (let touched = 0; touched < touchedCount; touched++) {
      const material = this.touchedSpecies[touched];
      const support = this.speciesSupport[material];
      if (support > bestSupport) {
        bestMaterial = material;
        bestSupport = support;
        tied = false;
      } else if (support === bestSupport) tied = true;
    }
    for (let touched = 0; touched < touchedCount; touched++) {
      this.speciesSupport[this.touchedSpecies[touched]] = 0;
    }
    return tied ? 0 : bestMaterial;
  }

  private blurHorizontal(): void {
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
