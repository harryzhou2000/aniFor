import {
  phaseContactCompatible,
  hermiteWeight,
  powderBulkWeight,
  roundGrainCoverage,
  type ContactPhase,
} from './phase-boundary-coverage';
import { Material } from '../shared/materials';
import { RenderPhase } from './render-profile';
import type { FieldOutputScale } from './render-resolution';
import type { PowderRenderStyle } from './powder-render-style';

export const CANVAS_CONTOUR_CHUNK_SIZE = 32;
export const CANVAS_CONTOUR_OUTPUT_SCALE = 2;
const HALO_SIZE = CANVAS_CONTOUR_CHUNK_SIZE + 2;
const EMPTY_PHASE = 255;

export interface CanvasPhaseContourInput {
  readonly materials: Uint8Array;
  /** Straight-alpha, already styled one-pixel-per-world-cell source plane. */
  readonly sourcePixels: Uint8ClampedArray;
  /** Canonical render lookup: phase/profile/emissive/traits by material ID. */
  readonly styleBytes: Uint8Array;
  /** Caller-maintained temporal stability: 0 is moving, 255 is settled. */
  readonly powderStability: Uint8Array;
  /** Optional shared RGBA powder density/gradient/support field. */
  readonly powderSurface?: Uint8Array;
  /** Comparison mode; defaults to the slope-aware smooth presentation. */
  readonly powderStyle?: PowderRenderStyle;
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
 * Reusable supersampled raster scratch for one 32x32 world chunk plus a one-cell
 * semantic halo. Outputs remain class-owned so rasterize() creates no typed
 * views or buffers. The caller consumes only outputWidth * outputHeight pixels.
 */
export class CanvasPhaseContourScratch {
  readonly pixels: Uint8ClampedArray<ArrayBuffer>;
  readonly coverage: Uint8Array;
  readonly ownerMaterials: Uint8Array;

  private readonly haloMaterials = new Uint8Array(HALO_SIZE * HALO_SIZE);
  private readonly haloPhases = new Uint8Array(HALO_SIZE * HALO_SIZE);
  private readonly haloWalls = new Uint8Array(HALO_SIZE * HALO_SIZE);
  private readonly haloStability = new Uint8Array(HALO_SIZE * HALO_SIZE);
  private readonly haloPixels = new Uint8ClampedArray(HALO_SIZE * HALO_SIZE * 4);
  private readonly emptyPowderOwner = {
    material: 0, stability: 0, red: 0, green: 0, blue: 0,
  };
  private usedWidth = 0;
  private usedHeight = 0;

  constructor(readonly outputScale: FieldOutputScale = CANVAS_CONTOUR_OUTPUT_SCALE) {
    const outputSize = CANVAS_CONTOUR_CHUNK_SIZE * outputScale;
    this.pixels = new Uint8ClampedArray(outputSize * outputSize * 4);
    this.coverage = new Uint8Array(outputSize * outputSize);
    this.ownerMaterials = new Uint8Array(outputSize * outputSize);
  }

  get outputWidth(): number { return this.usedWidth; }

  get outputHeight(): number { return this.usedHeight; }

  /** Fixed pixel stride of pixels/coverage/ownerMaterials, including edge chunks. */
  get outputStride(): number { return CANVAS_CONTOUR_CHUNK_SIZE * this.outputScale; }

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
    this.usedWidth = input.chunkWidth * this.outputScale;
    this.usedHeight = input.chunkHeight * this.outputScale;
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
        this.rasterizeCell(cellX, cellY, input);
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

  private rasterizeCell(cellX: number, cellY: number, input: CanvasPhaseContourInput): void {
    const powderStyle = input.powderStyle ?? 'smooth';
    const haloIndex = (cellY + 1) * HALO_SIZE + cellX + 1;
    let material = this.haloMaterials[haloIndex];
    let phase = this.haloPhases[haloIndex];
    let sourceRed = this.haloPixels[haloIndex * 4];
    let sourceGreen = this.haloPixels[haloIndex * 4 + 1];
    let sourceBlue = this.haloPixels[haloIndex * 4 + 2];
    let sourceAlpha = this.haloPixels[haloIndex * 4 + 3];
    let emptyPowderStability = 0;
    let emptyPowderSupport = 0;
    if (material === 0 && powderStyle !== 'grains' && !this.isWallAt(haloIndex)) {
      const owner = this.resolveEmptyPowderOwner(cellX + 1, cellY + 1);
      if (owner.material !== 0) {
        material = owner.material;
        phase = RenderPhase.Powder;
        sourceRed = owner.red;
        sourceGreen = owner.green;
        sourceBlue = owner.blue;
        sourceAlpha = 255;
        emptyPowderStability = owner.stability;
        const worldIndex = (input.chunkY + cellY) * input.worldWidth + input.chunkX + cellX;
        emptyPowderSupport = input.powderSurface
          ? input.powderSurface[worldIndex * 4 + 3] / 255 * 9
          : this.powderSupport3x3(cellX + 1, cellY + 1, material);
      }
    }
    const emptyPowder = this.haloMaterials[haloIndex] === 0 && material !== 0;
    const eligible = !this.isWallAt(haloIndex) && isContourPhase(phase);
    const powderSurfaceDetailGate = phase === RenderPhase.Powder
      && powderStyle === 'smooth' && input.powderSurface
      ? this.powderSurfaceBulkDepth(
        input, input.chunkX + cellX, input.chunkY + cellY, material, emptyPowder,
      )
      : 0;

    for (let subY = 0; subY < this.outputScale; subY++) {
      for (let subX = 0; subX < this.outputScale; subX++) {
        const outputX = cellX * this.outputScale + subX;
        const outputY = cellY * this.outputScale + subY;
        const outputIndex = outputY * this.outputStride + outputX;
        const outputPixel = outputIndex * 4;
        this.ownerMaterials[outputIndex] = material;
        let grainFacet = 0;
        if (phase === RenderPhase.Powder && !emptyPowder) {
          // Preserve a stable 2x2 material facet pattern even when the contour
          // is evaluated at 4x/8x. Higher supersampling refines the silhouette;
          // it must not turn bulk powder into flat paint or pixel-frequency noise.
          const facetX = Math.min(1, Math.floor(subX * 2 / this.outputScale));
          const facetY = Math.min(1, Math.floor(subY * 2 / this.outputScale));
          const facetHash = hash2(cellX * 2 + facetX + material * 17, cellY * 2 + facetY);
          grainFacet = ((facetHash & 15) - 7.5) * 0.72;
        }
        this.pixels[outputPixel] = clampByte(sourceRed + grainFacet);
        this.pixels[outputPixel + 1] = clampByte(sourceGreen + grainFacet);
        this.pixels[outputPixel + 2] = clampByte(sourceBlue + grainFacet);

        if (!eligible) {
          this.coverage[outputIndex] = sourceAlpha === 0 ? 0 : 255;
          this.pixels[outputPixel + 3] = sourceAlpha;
          continue;
        }

        const localX = (subX + 0.5) / this.outputScale;
        const localY = (subY + 0.5) / this.outputScale;
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
          const seed = hash2(cellX + material * 37, cellY + material * 53);
          const offsetX = (((seed & 0xffff) / 0xffff) - 0.5) * 0.15;
          const offsetY = ((((seed >>> 16) & 0xffff) / 0xffff) - 0.5) * 0.15;
          const grain = roundGrainCoverage(localX, localY, offsetX, offsetY);
          if (powderStyle === 'grains') {
            // The comparison mode is the intentionally unsmoothed, TPT-like
            // reference: one occupied semantic powder cell is one exact square.
            // Local and Smooth retain analytic round grains for loose matter.
            amount = emptyPowder ? 0 : 1;
          } else {
            const heapDensity = this.quadraticPowderDensity(
              cellX + 1, cellY + 1, material, localX - 0.5, localY - 0.5,
            );
            const localHeap = smoothstep(0.18, 0.58, heapDensity);
            let surfaceDensity = heapDensity;
            let slopeAware = 0;
            if (powderStyle === 'smooth' && input.powderSurface) {
              const worldX = input.chunkX + cellX + localX;
              const worldY = input.chunkY + cellY + localY;
              const wideDensity = samplePowderByte(
                input.powderSurface, input.worldWidth, input.worldHeight, worldX, worldY, 0,
              ) / 255;
              const gradientX = (samplePowderByte(
                input.powderSurface, input.worldWidth, input.worldHeight, worldX, worldY, 1,
              ) - 128) / 508;
              const gradientY = (samplePowderByte(
                input.powderSurface, input.worldWidth, input.worldHeight, worldX, worldY, 2,
              ) - 128) / 508;
              const verticalShare = Math.abs(gradientY)
                / (Math.abs(gradientX) + Math.abs(gradientY) + 1e-6);
              slopeAware = smoothstep(0.42, 0.70, verticalShare)
                * smoothstep(0.006, 0.030, Math.abs(gradientY))
                * powderSurfaceDetailGate;
              surfaceDensity += (wideDensity - surfaceDensity) * slopeAware;
            }
            const heapStart = 0.18 + (0.40 - 0.18) * slopeAware;
            const heapEnd = 0.58 + (0.60 - 0.58) * slopeAware;
            let heap = smoothstep(heapStart, heapEnd, surfaceDensity);
            // A wide slope estimate may redistribute boundary opacity into a
            // smoother tangent, but every Local-visible occupied subpixel keeps
            // a substantial floor. This prevents holes in columns and ledges
            // without forcing Smooth back to the exact Local staircase.
            if (!emptyPowder) heap = Math.max(heap, localHeap * 0.40);
            if (emptyPowder) {
              amount = emptyPowderStability
                * smoothstep(2.5, 4, emptyPowderSupport)
                * heap;
            } else {
              const support = q00 + q10 + q01 + q11;
              const stability = this.haloStability[haloIndex] / 255;
              const motion = (1 - stability) * 0.10;
              const bulk = powderBulkWeight(support, motion);
              amount = grain + (heap - grain) * bulk;
            }
          }
        } else if (phase === RenderPhase.Liquid) {
          // Retain a fractional 2x edge on an isolated or unlike-species side;
          // exact same-species support reaches the fully opaque interior.
          amount = smoothstep(0.35, 0.75, density);
        } else {
          amount = smoothstep(0.27, 0.57, density);
        }
        const coverage = clampByte(amount * 255);
        this.coverage[outputIndex] = coverage;
        this.pixels[outputPixel + 3] = clampByte(sourceAlpha * amount);
      }
    }
  }

  /**
   * Claims at most one empty cardinal cell for one exact, stable powder owner.
   * Any unlike solid/powder contact is deliberately ambiguous, matching WebGL's
   * nearby-surface selection and preventing presentation ownership overlap.
   */
  private resolveEmptyPowderOwner(
    haloX: number,
    haloY: number,
  ): { material: number; stability: number; red: number; green: number; blue: number } {
    const owner = this.emptyPowderOwner;
    owner.material = 0;
    owner.stability = 0;
    owner.red = 0;
    owner.green = 0;
    owner.blue = 0;
    let material = 0;
    let stability = 0;
    let powderDonors = 0;
    let red = 0;
    let green = 0;
    let blue = 0;
    for (let cardinal = 0; cardinal < 4; cardinal++) {
      const x = haloX + (cardinal === 0 ? -1 : cardinal === 1 ? 1 : 0);
      const y = haloY + (cardinal === 2 ? -1 : cardinal === 3 ? 1 : 0);
      const index = y * HALO_SIZE + x;
      if (this.isWallAt(index)) continue;
      const candidate = this.haloMaterials[index];
      const phase = this.haloPhases[index];
      if (candidate === 0 || (phase !== RenderPhase.Solid && phase !== RenderPhase.Powder)) continue;
      if (material !== 0 && material !== candidate) return owner;
      material = candidate;
      if (phase !== RenderPhase.Powder) continue;
      powderDonors++;
      stability = Math.max(stability, this.haloStability[index] / 255);
      const pixel = index * 4;
      red += this.haloPixels[pixel];
      green += this.haloPixels[pixel + 1];
      blue += this.haloPixels[pixel + 2];
    }
    if (material === 0 || powderDonors === 0 || stability <= 0) return owner;
    owner.material = material;
    owner.stability = stability;
    owner.red = Math.round(red / powderDonors);
    owner.green = Math.round(green / powderDonors);
    owner.blue = Math.round(blue / powderDonors);
    return owner;
  }

  private powderSupport3x3(haloX: number, haloY: number, material: number): number {
    let support = 0;
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
      support += this.compatibleAt(
        haloX + x, haloY + y, material, RenderPhase.Powder,
      );
    }
    return support;
  }

  /**
   * Wide gravity smoothing belongs only to a genuinely deep heap. Requiring
   * two exact stable cells below and an exact horizontal neighbour preserve
   * narrow ridges and branches; an empty projection needs one
   * additional depth cell because it is not itself part of the material.
   * Exact material checks keep unlike powder seams on the local contour.
   */
  private powderSurfaceBulkDepth(
    input: CanvasPhaseContourInput,
    worldX: number,
    worldY: number,
    material: number,
    emptyPowder: boolean,
  ): number {
    const requiredDepth = emptyPowder ? 3 : 2;
    for (let depth = 1; depth <= requiredDepth; depth++) {
      const y = worldY + depth;
      if (y >= input.worldHeight) return 0;
      const index = y * input.worldWidth + worldX;
      if (input.materials[index] !== material
        || input.powderStability[index] < 192
        || (input.walls?.[index] ?? 0) !== 0) return 0;
    }
    if (worldX <= 0 || worldX + 1 >= input.worldWidth) return 0;
    const anchorY = worldY + (emptyPowder ? 1 : 0);
    const anchor = anchorY * input.worldWidth + worldX;
    let lateralSupport = false;
    for (const offset of [-1, 1]) {
      const index = anchor + offset;
      lateralSupport ||= input.materials[index] === material
        && input.powderStability[index] >= 192
        && (input.walls?.[index] ?? 0) === 0;
    }
    return lateralSupport ? 1 : 0;
  }

  private quadraticPowderDensity(
    haloX: number,
    haloY: number,
    material: number,
    offsetX: number,
    offsetY: number,
  ): number {
    const boundedX = Math.max(-0.5, Math.min(0.5, offsetX));
    const boundedY = Math.max(-0.5, Math.min(0.5, offsetY));
    const leftX = 0.5 * (0.5 - boundedX) * (0.5 - boundedX);
    const middleX = 0.75 - boundedX * boundedX;
    const rightX = 0.5 * (0.5 + boundedX) * (0.5 + boundedX);
    const topY = 0.5 * (0.5 - boundedY) * (0.5 - boundedY);
    const middleY = 0.75 - boundedY * boundedY;
    const bottomY = 0.5 * (0.5 + boundedY) * (0.5 + boundedY);
    let density = 0;
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      const weightX = x === 0 ? leftX : x === 1 ? middleX : rightX;
      const weightY = y === 0 ? topY : y === 1 ? middleY : bottomY;
      density += this.compatibleAt(
        haloX + x - 1, haloY + y - 1, material, RenderPhase.Powder,
      ) * weightX * weightY;
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
    || (input.powderSurface !== undefined && input.powderSurface.length !== cells * 4)
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

function samplePowderByte(
  bytes: Uint8Array,
  width: number,
  height: number,
  worldX: number,
  worldY: number,
  channel: number,
): number {
  const gridX = worldX - 0.5;
  const gridY = worldY - 0.5;
  const left = Math.max(0, Math.min(width - 1, Math.floor(gridX)));
  const top = Math.max(0, Math.min(height - 1, Math.floor(gridY)));
  const right = Math.max(0, Math.min(width - 1, left + 1));
  const bottom = Math.max(0, Math.min(height - 1, top + 1));
  const blendX = Math.max(0, Math.min(1, gridX - Math.floor(gridX)));
  const blendY = Math.max(0, Math.min(1, gridY - Math.floor(gridY)));
  const topLeft = bytes[(top * width + left) * 4 + channel];
  const topRight = bytes[(top * width + right) * 4 + channel];
  const bottomLeft = bytes[(bottom * width + left) * 4 + channel];
  const bottomRight = bytes[(bottom * width + right) * 4 + channel];
  const topValue = topLeft + (topRight - topLeft) * blendX;
  const bottomValue = bottomLeft + (bottomRight - bottomLeft) * blendX;
  return topValue + (bottomValue - topValue) * blendY;
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
