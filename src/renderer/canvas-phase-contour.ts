import {
  phaseContactCompatible,
  hermiteWeight,
  powderBulkWeight,
  quadraticCoverageWeights,
  roundGrainCoverage,
  type ContactPhase,
} from './phase-boundary-coverage';
import { Material } from '../shared/materials';
import { RenderPhase } from './render-profile';

export const CANVAS_CONTOUR_CHUNK_SIZE = 32;
export const CANVAS_CONTOUR_OUTPUT_SCALE = 2;
const HALO_SIZE = CANVAS_CONTOUR_CHUNK_SIZE + 2;
const OUTPUT_SIZE = CANVAS_CONTOUR_CHUNK_SIZE * CANVAS_CONTOUR_OUTPUT_SCALE;
const EMPTY_PHASE = 255;

export interface CanvasPhaseContourInput {
  readonly materials: Uint8Array;
  /** Straight-alpha, already styled one-pixel-per-world-cell source plane. */
  readonly sourcePixels: Uint8ClampedArray;
  /** Canonical render lookup: phase/profile/emissive/traits by material ID. */
  readonly styleBytes: Uint8Array;
  /** Caller-maintained temporal stability: 0 is moving, 255 is settled. */
  readonly powderStability: Uint8Array;
  /** Optional native wall occupancy. Walls pass through but never support contours. */
  readonly walls?: Uint8Array;
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly chunkX: number;
  readonly chunkY: number;
  readonly chunkWidth: number;
  readonly chunkHeight: number;
}

/**
 * Reusable fixed-2x raster scratch for one 32x32 world chunk plus a one-cell
 * semantic halo. Outputs remain class-owned so rasterize() creates no typed
 * views or buffers. The caller consumes only outputWidth * outputHeight pixels.
 */
export class CanvasPhaseContourScratch {
  readonly pixels = new Uint8ClampedArray(OUTPUT_SIZE * OUTPUT_SIZE * 4);
  readonly coverage = new Uint8Array(OUTPUT_SIZE * OUTPUT_SIZE);
  readonly ownerMaterials = new Uint8Array(OUTPUT_SIZE * OUTPUT_SIZE);

  private readonly haloMaterials = new Uint8Array(HALO_SIZE * HALO_SIZE);
  private readonly haloPhases = new Uint8Array(HALO_SIZE * HALO_SIZE);
  private readonly haloWalls = new Uint8Array(HALO_SIZE * HALO_SIZE);
  private readonly haloStability = new Uint8Array(HALO_SIZE * HALO_SIZE);
  private readonly haloPixels = new Uint8ClampedArray(HALO_SIZE * HALO_SIZE * 4);
  private usedWidth = 0;
  private usedHeight = 0;

  get outputWidth(): number { return this.usedWidth; }

  get outputHeight(): number { return this.usedHeight; }

  /** Fixed pixel stride of pixels/coverage/ownerMaterials, including edge chunks. */
  get outputStride(): number { return OUTPUT_SIZE; }

  get allocatedByteLength(): number {
    return this.pixels.byteLength
      + this.coverage.byteLength
      + this.ownerMaterials.byteLength
      + this.haloMaterials.byteLength
      + this.haloPhases.byteLength
      + this.haloWalls.byteLength
      + this.haloStability.byteLength
      + this.haloPixels.byteLength;
  }

  rasterize(input: CanvasPhaseContourInput): void {
    validateInput(input);
    this.usedWidth = input.chunkWidth * CANVAS_CONTOUR_OUTPUT_SCALE;
    this.usedHeight = input.chunkHeight * CANVAS_CONTOUR_OUTPUT_SCALE;
    this.pixels.fill(0);
    this.coverage.fill(0);
    this.ownerMaterials.fill(0);
    this.haloMaterials.fill(0);
    this.haloPhases.fill(EMPTY_PHASE);
    this.haloWalls.fill(0);
    this.haloStability.fill(0);
    this.haloPixels.fill(0);
    this.copyHalo(input);

    for (let cellY = 0; cellY < input.chunkHeight; cellY++) {
      for (let cellX = 0; cellX < input.chunkWidth; cellX++) {
        this.rasterizeCell(cellX, cellY);
      }
    }
  }

  private copyHalo(input: CanvasPhaseContourInput): void {
    const haloWidth = input.chunkWidth + 2;
    const haloHeight = input.chunkHeight + 2;
    for (let haloY = 0; haloY < haloHeight; haloY++) {
      const worldY = input.chunkY + haloY - 1;
      if (worldY < 0 || worldY >= input.worldHeight) continue;
      for (let haloX = 0; haloX < haloWidth; haloX++) {
        const worldX = input.chunkX + haloX - 1;
        if (worldX < 0 || worldX >= input.worldWidth) continue;
        const worldIndex = worldY * input.worldWidth + worldX;
        const haloIndex = haloY * HALO_SIZE + haloX;
        const material = input.materials[worldIndex];
        this.haloMaterials[haloIndex] = material;
        this.haloPhases[haloIndex] = material === 0
          ? EMPTY_PHASE
          : input.styleBytes[material * 4];
        this.haloWalls[haloIndex] = input.walls?.[worldIndex] ?? 0;
        this.haloStability[haloIndex] = input.powderStability[worldIndex];
        const source = worldIndex * 4;
        const target = haloIndex * 4;
        this.haloPixels[target] = input.sourcePixels[source];
        this.haloPixels[target + 1] = input.sourcePixels[source + 1];
        this.haloPixels[target + 2] = input.sourcePixels[source + 2];
        this.haloPixels[target + 3] = input.sourcePixels[source + 3];
      }
    }
  }

  private rasterizeCell(cellX: number, cellY: number): void {
    const haloIndex = (cellY + 1) * HALO_SIZE + cellX + 1;
    const material = this.haloMaterials[haloIndex];
    const phase = this.haloPhases[haloIndex];
    const source = haloIndex * 4;
    const eligible = !this.isWallAt(haloIndex) && isContourPhase(phase);

    for (let subY = 0; subY < CANVAS_CONTOUR_OUTPUT_SCALE; subY++) {
      for (let subX = 0; subX < CANVAS_CONTOUR_OUTPUT_SCALE; subX++) {
        const outputX = cellX * CANVAS_CONTOUR_OUTPUT_SCALE + subX;
        const outputY = cellY * CANVAS_CONTOUR_OUTPUT_SCALE + subY;
        const outputIndex = outputY * OUTPUT_SIZE + outputX;
        const outputPixel = outputIndex * 4;
        this.ownerMaterials[outputIndex] = material;
        this.pixels[outputPixel] = this.haloPixels[source];
        this.pixels[outputPixel + 1] = this.haloPixels[source + 1];
        this.pixels[outputPixel + 2] = this.haloPixels[source + 2];

        if (!eligible) {
          const alpha = this.haloPixels[source + 3];
          this.coverage[outputIndex] = alpha === 0 ? 0 : 255;
          this.pixels[outputPixel + 3] = alpha;
          continue;
        }

        const localX = (subX + 0.5) / CANVAS_CONTOUR_OUTPUT_SCALE;
        const localY = (subY + 0.5) / CANVAS_CONTOUR_OUTPUT_SCALE;
        const originX = cellX + (localX < 0.5 ? 0 : 1);
        const originY = cellY + (localY < 0.5 ? 0 : 1);
        const blendX = localX < 0.5 ? localX + 0.5 : localX - 0.5;
        const blendY = localY < 0.5 ? localY + 0.5 : localY - 0.5;
        const q00 = this.compatibleAt(originX, originY, material, phase);
        const q10 = this.compatibleAt(originX + 1, originY, material, phase);
        const q01 = this.compatibleAt(originX, originY + 1, material, phase);
        const q11 = this.compatibleAt(originX + 1, originY + 1, material, phase);
        // Inline the shared Hermite reference's scalar density so the hot loop
        // does not allocate its small diagnostic result object per subpixel.
        const weightX = hermiteWeight(blendX);
        const weightY = hermiteWeight(blendY);
        const top = q00 + (q10 - q00) * weightX;
        const bottom = q01 + (q11 - q01) * weightX;
        const density = top + (bottom - top) * weightY;
        let amount: number;
        if (phase === RenderPhase.Powder) {
          const support = q00 + q10 + q01 + q11;
          const stability = this.haloStability[haloIndex] / 255;
          const motion = (1 - stability) * 0.10;
          const bulk = powderBulkWeight(support, motion);
          const seed = hash2(cellX + material * 37, cellY + material * 53);
          const offsetX = (((seed & 0xffff) / 0xffff) - 0.5) * 0.15;
          const offsetY = ((((seed >>> 16) & 0xffff) / 0xffff) - 0.5) * 0.15;
          const grain = roundGrainCoverage(localX, localY, offsetX, offsetY);
          const heapDensity = this.quadraticPowderDensity(
            cellX + 1, cellY + 1, material, localX - 0.5, localY - 0.5,
          );
          const heap = smoothstep(0.18, 0.58, heapDensity);
          amount = grain + (heap - grain) * bulk;
        } else if (phase === RenderPhase.Liquid) {
          // Retain a fractional 2x edge on an isolated or unlike-species side;
          // exact same-species support reaches the fully opaque interior.
          amount = smoothstep(0.35, 0.75, density);
        } else {
          amount = smoothstep(0.27, 0.57, density);
        }
        const coverage = clampByte(amount * 255);
        this.coverage[outputIndex] = coverage;
        this.pixels[outputPixel + 3] = clampByte(this.haloPixels[source + 3] * amount);
      }
    }
  }

  private quadraticPowderDensity(
    haloX: number,
    haloY: number,
    material: number,
    offsetX: number,
    offsetY: number,
  ): number {
    const weightsX = quadraticCoverageWeights(offsetX);
    const weightsY = quadraticCoverageWeights(offsetY);
    let density = 0;
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      density += this.compatibleAt(
        haloX + x - 1, haloY + y - 1, material, RenderPhase.Powder,
      ) * weightsX[x] * weightsY[y];
    }
    return density;
  }

  private compatibleAt(
    haloX: number,
    haloY: number,
    ownerMaterial: number,
    ownerPhase: number,
  ): number {
    if (haloX < 0 || haloY < 0 || haloX >= HALO_SIZE || haloY >= HALO_SIZE) return 0;
    const index = haloY * HALO_SIZE + haloX;
    if (this.isWallAt(index)) return 0;
    const candidateMaterial = this.haloMaterials[index];
    const candidatePhase = this.haloPhases[index];
    if (candidateMaterial === 0 || !isContourPhase(candidatePhase)) return 0;
    if (ownerPhase === RenderPhase.Liquid) {
      return candidatePhase === RenderPhase.Liquid && candidateMaterial === ownerMaterial ? 1 : 0;
    }
    return phaseContactCompatible(
      contactPhase(ownerPhase), contactPhase(candidatePhase),
    ) ? 1 : 0;
  }

  private isWallAt(index: number): boolean {
    return this.haloWalls[index] !== 0 || this.haloMaterials[index] === Material.Wall;
  }
}

function isContourPhase(phase: number): boolean {
  return phase === RenderPhase.Solid || phase === RenderPhase.Powder || phase === RenderPhase.Liquid;
}

function contactPhase(phase: number): ContactPhase {
  if (phase === RenderPhase.Powder) return 'powder';
  if (phase === RenderPhase.Liquid) return 'liquid';
  return 'solid';
}

function validateInput(input: CanvasPhaseContourInput): void {
  const cells = input.worldWidth * input.worldHeight;
  if (!Number.isInteger(input.worldWidth) || !Number.isInteger(input.worldHeight)
    || input.worldWidth <= 0 || input.worldHeight <= 0
    || input.materials.length !== cells
    || input.sourcePixels.length !== cells * 4
    || input.powderStability.length !== cells
    || input.styleBytes.length < 256 * 4
    || (input.walls !== undefined && input.walls.length !== cells)
    || !Number.isInteger(input.chunkX) || !Number.isInteger(input.chunkY)
    || !Number.isInteger(input.chunkWidth) || !Number.isInteger(input.chunkHeight)
    || input.chunkX < 0 || input.chunkY < 0
    || input.chunkWidth <= 0 || input.chunkHeight <= 0
    || input.chunkWidth > CANVAS_CONTOUR_CHUNK_SIZE
    || input.chunkHeight > CANVAS_CONTOUR_CHUNK_SIZE
    || input.chunkX + input.chunkWidth > input.worldWidth
    || input.chunkY + input.chunkHeight > input.worldHeight) {
    throw new Error('Canvas phase contour size mismatch');
  }
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hash2(x: number, y: number): number {
  let value = Math.imul(x ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(y, 0xc2b2ae35);
  value ^= value >>> 13;
  return (Math.imul(value, 0x27d4eb2d) ^ (value >>> 15)) >>> 0;
}
