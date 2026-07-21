import {
  phaseContactCompatible,
  hermiteSecondDerivative,
  hermiteWeight,
  implicitContourCurvature,
  powderBulkWeight,
  roundGrainCoverage,
  type ContactPhase,
} from './phase-boundary-coverage';
import { Material } from '../shared/materials';
import { RenderPhase, RenderProfile } from './render-profile';
import { isGranularOptics, RenderOptics } from './render-optics';
import { applyCanvasSurfaceChroma, canvasSurfaceChromaResponse } from './solid-surface-chroma';
import type { FieldOutputScale } from './render-resolution';
import type { PowderRenderStyle } from './powder-render-style';

export const CANVAS_CONTOUR_CHUNK_SIZE = 32;
export const CANVAS_CONTOUR_OUTPUT_SCALE = 2;
const HALO_SIZE = CANVAS_CONTOUR_CHUNK_SIZE + 2;
const EMPTY_PHASE = 255;
const LIQUID_LIGHT_X = 0.48;
const LIQUID_LIGHT_Y = 0.68;
const FULL_COMPATIBILITY_MASK = 0x1ff;

interface SubpixelAxisGeometry {
  readonly local: Float64Array;
  readonly side: Uint8Array;
  readonly weight: Float64Array;
  readonly derivative: Float64Array;
  readonly secondDerivative: Float64Array;
  readonly quadraticLeft: Float64Array;
  readonly quadraticMiddle: Float64Array;
  readonly quadraticRight: Float64Array;
  /** RGB tone for each 4-bit contact-corner pattern and subpixel coordinate. */
  readonly phaseContactTone: Float64Array;
}

function createSubpixelAxisGeometry(scale: FieldOutputScale): SubpixelAxisGeometry {
  const local = new Float64Array(scale);
  const side = new Uint8Array(scale);
  const weight = new Float64Array(scale);
  const derivative = new Float64Array(scale);
  const secondDerivative = new Float64Array(scale);
  const quadraticLeft = new Float64Array(scale);
  const quadraticMiddle = new Float64Array(scale);
  const quadraticRight = new Float64Array(scale);
  for (let subpixel = 0; subpixel < scale; subpixel++) {
    const position = (subpixel + 0.5) / scale;
    const contourPosition = position < 0.5 ? position + 0.5 : position - 0.5;
    const powderOffset = Math.max(-0.5, Math.min(0.5, position - 0.5));
    local[subpixel] = position;
    side[subpixel] = position < 0.5 ? 0 : 1;
    weight[subpixel] = hermiteWeight(contourPosition);
    derivative[subpixel] = 6 * contourPosition * (1 - contourPosition);
    secondDerivative[subpixel] = hermiteSecondDerivative(contourPosition);
    quadraticLeft[subpixel] = 0.5 * (0.5 - powderOffset) * (0.5 - powderOffset);
    quadraticMiddle[subpixel] = 0.75 - powderOffset * powderOffset;
    quadraticRight[subpixel] = 0.5 * (0.5 + powderOffset) * (0.5 + powderOffset);
  }
  // Contact density is categorical and therefore has only sixteen possible
  // four-corner patterns. Cache that tiny, shared geometry result once instead
  // of repeating smoothsteps and a square root for every contacted output
  // sample. This is 10,880 bytes across all four render scales, not a world-
  // sized field, and preserves the exact scalar helper's Float64 result.
  const phaseContactTone = new Float64Array(16 * scale * scale);
  for (let pattern = 0; pattern < 16; pattern++) {
    const q00 = pattern & 1;
    const q10 = (pattern >>> 1) & 1;
    const q01 = (pattern >>> 2) & 1;
    const q11 = (pattern >>> 3) & 1;
    for (let subY = 0; subY < scale; subY++) for (let subX = 0; subX < scale; subX++) {
      const weightX = weight[subX];
      const weightY = weight[subY];
      const top = q00 + (q10 - q00) * weightX;
      const bottom = q01 + (q11 - q01) * weightX;
      const density = top + (bottom - top) * weightY;
      const gradientX = ((q10 - q00) * (1 - weightY)
        + (q11 - q01) * weightY) * derivative[subX];
      const gradientY = ((q01 - q00) * (1 - weightX)
        + (q11 - q10) * weightX) * derivative[subY];
      phaseContactTone[(pattern * scale + subY) * scale + subX] = canvasPhaseContactTone(
        density, gradientX, gradientY,
      );
    }
  }
  return {
    local, side, weight, derivative, secondDerivative,
    quadraticLeft, quadraticMiddle, quadraticRight, phaseContactTone,
  };
}

const SUBPIXEL_AXIS_GEOMETRY: Record<FieldOutputScale, SubpixelAxisGeometry> = {
  1: createSubpixelAxisGeometry(1),
  2: createSubpixelAxisGeometry(2),
  4: createSubpixelAxisGeometry(4),
  8: createSubpixelAxisGeometry(8),
};

/** Typed payload of the shared 1×/2×/4×/8× axis lookup; object headers are engine-owned. */
export const CANVAS_CONTOUR_GEOMETRY_LOOKUP_BYTES = (1 + 2 + 4 + 8)
  * (8 * Float64Array.BYTES_PER_ELEMENT + Uint8Array.BYTES_PER_ELEMENT)
  + (1 * 1 + 2 * 2 + 4 * 4 + 8 * 8) * 16 * Float64Array.BYTES_PER_ELEMENT;

export interface CanvasPhaseContourInput {
  readonly materials: Uint8Array;
  /** Straight-alpha, already styled one-pixel-per-world-cell source plane. */
  readonly sourcePixels: Uint8ClampedArray;
  /** Canonical render lookup: phase/profile/emissive/traits by material ID. */
  readonly styleBytes: Uint8Array;
  /** Canonical palette lookup; alpha stores the optical-response class. */
  readonly paletteBytes?: Uint8Array;
  /** Caller-maintained temporal stability: 0 is moving, 255 is settled. */
  readonly powderStability: Uint8Array;
  /** Optional shared RGBA powder density/gradient/support field. */
  readonly powderSurface?: Uint8Array;
  /** Optional exact border-connected air classification from the shared powder field. */
  readonly powderExteriorAir?: Uint8Array;
  /** Optional shared full-resolution species-aware liquid RGBA field. */
  readonly liquidField?: Uint8Array;
  /** Comparison mode; defaults to the slope-aware smooth presentation. */
  readonly powderStyle?: PowderRenderStyle;
  /** Optional native wall occupancy. Walls pass through but never support contours. */
  readonly walls?: Uint8Array;
  /** Audit-only A/B switch; defaults to the signed exact-solid contact bevel. */
  readonly solidContactDepth?: boolean;
  /** Audit-only A/B switch; defaults to bounded analytic solid curvature. */
  readonly solidCurvatureDepth?: boolean;
  /** Audit-only A/B switch; defaults to contour-local solid lighting. */
  readonly surfaceContourLighting?: boolean;
  /** Audit-only A/B switch; defaults to bounded liquid/matter contact lighting. */
  readonly phaseContactLighting?: boolean;
  /** Audit-only A/B switch; defaults to connected liquid-shore cohesion. */
  readonly liquidSilhouetteCohesion?: boolean;
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly chunkX: number;
  readonly chunkY: number;
  readonly chunkWidth: number;
  readonly chunkHeight: number;
}

/**
 * Family-coloured reflection/transmission shell for one already-qualified
 * liquid/air contour sample. The Hermite boundary already supplies density and
 * its analytic normal; this changes RGB only, allocates nothing, and remains an
 * exact no-op for dense interiors and molten liquids.
 */
export function applyCanvasLiquidFresnelShell(
  pixels: Uint8ClampedArray,
  offset: number,
  density: number,
  gradientX: number,
  gradientY: number,
  optics: number,
): void {
  if (optics === RenderOptics.Molten || density <= 0.08 || density >= 0.92) return;
  const gradientLengthSquared = gradientX * gradientX + gradientY * gradientY;
  if (gradientLengthSquared <= 1e-8) return;
  // Split the meniscus into two stable optical zones. The outer band catches
  // the environment like a thin reflected lip; the inner band absorbs through
  // a little more liquid before the dense core becomes an exact no-op. Keeping
  // both bands density-owned avoids animated highlights when the liquid rests.
  const contourBand = smoothstep(0.08, 0.46, density)
    * (1 - smoothstep(0.54, 0.92, density));
  const outerBand = contourBand
    * (1 - smoothstep(0.42, 0.78, density) * 0.42);
  const innerBand = contourBand * smoothstep(0.36, 0.70, density);
  if (outerBand <= 0 && innerBand <= 0) return;
  const directional = Math.max(-1, Math.min(1,
    (gradientX * LIQUID_LIGHT_X + gradientY * LIQUID_LIGHT_Y)
      / Math.sqrt(gradientLengthSquared),
  ));
  const grazing = 1 - Math.abs(directional);
  const reflection = outerBand * (0.032 + grazing * 0.042);
  const key = Math.max(0, directional) * outerBand * 0.080 + reflection;
  const outerShadow = Math.max(0, -directional) * outerBand * 0.024;
  const innerTransmission = Math.max(0, directional) * innerBand * 0.018;
  const absorption = innerBand * (0.014 + Math.max(0, -directional) * 0.030);

  let keyRed = 0.65, keyGreen = 0.82, keyBlue = 1.0;
  let shadowRed = 0.72, shadowGreen = 0.64, shadowBlue = 0.50;
  let absorptionRed = 0.76, absorptionGreen = 0.54, absorptionBlue = 0.34;
  if (optics === RenderOptics.Aqueous) {
    keyRed = 0.18; keyGreen = 0.84; keyBlue = 1.0;
    shadowRed = 1.0; shadowGreen = 0.62; shadowBlue = 0.36;
    absorptionRed = 1.0; absorptionGreen = 0.42; absorptionBlue = 0.16;
  } else if (optics === RenderOptics.Oily) {
    keyRed = 1.0; keyGreen = 0.72; keyBlue = 0.28;
    shadowRed = 0.20; shadowGreen = 0.28; shadowBlue = 0.42;
    absorptionRed = 0.18; absorptionGreen = 0.48; absorptionBlue = 1.0;
  } else if (optics === RenderOptics.Corrosive) {
    keyRed = 0.44; keyGreen = 1.0; keyBlue = 0.68;
    shadowRed = 0.72; shadowGreen = 0.38; shadowBlue = 0.62;
    absorptionRed = 0.82; absorptionGreen = 0.20; absorptionBlue = 0.66;
  } else if (optics === RenderOptics.CryogenicLiquid) {
    keyRed = 0.62; keyGreen = 0.90; keyBlue = 1.0;
    shadowRed = 0.78; shadowGreen = 0.86; shadowBlue = 1.0;
    absorptionRed = 1.0; absorptionGreen = 0.50; absorptionBlue = 0.26;
  } else if (optics === RenderOptics.MetallicLiquid) {
    keyRed = 1.0; keyGreen = 0.98; keyBlue = 0.94;
    shadowRed = 0.58; shadowGreen = 0.62; shadowBlue = 0.70;
    absorptionRed = 0.58; absorptionGreen = 0.62; absorptionBlue = 0.70;
  } else if (optics === RenderOptics.ViscousLiquid) {
    keyRed = 0.82; keyGreen = 0.92; keyBlue = 1.0;
    shadowRed = 0.70; shadowGreen = 0.64; shadowBlue = 0.58;
    absorptionRed = 0.85; absorptionGreen = 0.60; absorptionBlue = 0.35;
  }

  const originalRed = pixels[offset];
  const originalGreen = pixels[offset + 1];
  const originalBlue = pixels[offset + 2];
  const familyKeyGain = optics === RenderOptics.Aqueous ? 1.65
    : optics === RenderOptics.CryogenicLiquid ? 1.25
    : optics === RenderOptics.MetallicLiquid ? 1.4
    : optics === RenderOptics.ViscousLiquid ? 1.1 : 1;
  const keyResponse = (key + innerTransmission) * familyKeyGain;
  const red = originalRed + (255 - originalRed) * keyRed * keyResponse
    - originalRed * (shadowRed * outerShadow + absorptionRed * absorption);
  const green = originalGreen + (255 - originalGreen) * keyGreen * keyResponse
    - originalGreen * (shadowGreen * outerShadow + absorptionGreen * absorption);
  const blue = originalBlue + (255 - originalBlue) * keyBlue * keyResponse
    - originalBlue * (shadowBlue * outerShadow + absorptionBlue * absorption);
  pixels[offset] = clampByte(Math.max(originalRed - 18, Math.min(originalRed + 18, red)));
  pixels[offset + 1] = clampByte(
    Math.max(originalGreen - 18, Math.min(originalGreen + 18, green)),
  );
  pixels[offset + 2] = clampByte(
    Math.max(originalBlue - 18, Math.min(originalBlue + 18, blue)),
  );
}

/**
 * Signed RGB-only grounding at an authoritative liquid/matter contact. The
 * contact mask belongs to the other phase, so its gradient points through the
 * interface without changing either phase's analytic support.
 */
export function canvasPhaseContactTone(
  density: number,
  gradientX: number,
  gradientY: number,
): number {
  if (density <= 0.08 || density >= 0.92) return 0;
  const gradientLengthSquared = gradientX * gradientX + gradientY * gradientY;
  if (gradientLengthSquared <= 1e-8) return 0;
  const contactBand = smoothstep(0.08, 0.46, density)
    * (1 - smoothstep(0.54, 0.92, density));
  if (contactBand <= 0) return 0;
  const directional = Math.max(-1, Math.min(1,
    (-gradientX * LIQUID_LIGHT_X - gradientY * LIQUID_LIGHT_Y)
      / Math.sqrt(gradientLengthSquared),
  ));
  // The 2x straight-edge samples land near density 0.156/0.844, where the
  // narrow band is intentionally small. A bounded 12-byte pre-clamp gain keeps
  // that canonical contact visible after Uint8 rounding without dark seams.
  return Math.max(-6, Math.min(6, directional * contactBand * 12));
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
  private readonly axisGeometry: SubpixelAxisGeometry;
  private usedWidth = 0;
  private usedHeight = 0;

  constructor(readonly outputScale: FieldOutputScale = CANVAS_CONTOUR_OUTPUT_SCALE) {
    this.axisGeometry = SUBPIXEL_AXIS_GEOMETRY[outputScale];
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
    const worldIndex = (input.chunkY + cellY) * input.worldWidth + input.chunkX + cellX;
    const exteriorPowderAir = input.powderExteriorAir === undefined
      || input.powderExteriorAir[worldIndex] !== 0;
    if (material === 0 && powderStyle !== 'grains' && !this.isWallAt(haloIndex)
      && exteriorPowderAir) {
      const owner = this.resolveEmptyPowderOwner(cellX + 1, cellY + 1);
      if (owner.material !== 0) {
        material = owner.material;
        phase = RenderPhase.Powder;
        sourceRed = owner.red;
        sourceGreen = owner.green;
        sourceBlue = owner.blue;
        sourceAlpha = 255;
        emptyPowderStability = owner.stability;
      }
    }
    const emptyPowder = this.haloMaterials[haloIndex] === 0 && material !== 0;
    // Presentation-only reconstruction may prefill sourcePixels for a semantic
    // empty cell. Only a resolved powder owner may turn that payload into
    // coverage; otherwise a non-zero source alpha must not claim the cell.
    if (material === 0 && sourceAlpha !== 0) return;
    // The output planes were cleared once for the chunk. A truly empty source
    // with no projected powder owner therefore has no per-supersample work.
    if (material === 0 && sourceRed === 0 && sourceGreen === 0
      && sourceBlue === 0 && sourceAlpha === 0) return;
    const eligible = !this.isWallAt(haloIndex) && isContourPhase(phase);
    // Every supersample around one semantic cell draws from this same 3x3
    // categorical stencil. Classify it once, then bit-extract the four corners
    // needed by each quadrant instead of repeating halo/phase/wall checks.
    const phaseContactEligible = (input.phaseContactLighting ?? true)
      && this.haloMaterials[haloIndex] !== 0
      && input.styleBytes[material * 4 + 2] === 0
      && input.styleBytes[material * 4 + 3] === 0
      && (phase === RenderPhase.Solid || phase === RenderPhase.Liquid
        || (phase === RenderPhase.Powder && !emptyPowder && powderStyle !== 'grains'
          && this.haloStability[haloIndex] >= 192));
    // Contact lighting and contour coverage classify the same 3x3 halo. Pack
    // both masks in one traversal when contact lighting is eligible, avoiding a
    // second nine-neighbour scan on every cell along a mixed-phase interface.
    const packedMasks = eligible
      ? phaseContactEligible
        ? this.compatibilityAndContactMasks(cellX + 1, cellY + 1, material, phase, input)
        : this.compatibilityMask(cellX + 1, cellY + 1, material, phase)
      : 0;
    const compatibilityMask = packedMasks & FULL_COMPATIBILITY_MASK;
    let emptyPowderSupport = 0;
    if (emptyPowder) {
      emptyPowderSupport = input.powderSurface
        ? input.powderSurface[worldIndex * 4 + 3] / 255 * 9
        : bitCount(compatibilityMask);
    }
    // Reject uniform solid interiors once per world cell. At 8x, entering the
    // subpixel path unconditionally would repeat four semantic classifications
    // 64 times even though their signed contact derivative must be zero.
    const differentSolidMask = (input.solidContactDepth ?? true)
      && this.haloMaterials[haloIndex] !== 0 && phase === RenderPhase.Solid
      ? this.differentSolidMask(cellX + 1, cellY + 1, material) : 0;
    const exactSolidContact = differentSolidMask !== 0;
    const materialOptics = input.paletteBytes?.[material * 4 + 3] ?? RenderOptics.Default;
    let curvatureGain = 0;
    let solidCurvatureDepth = false;
    if ((input.solidCurvatureDepth ?? true)
      && this.haloMaterials[haloIndex] !== 0 && phase === RenderPhase.Solid
      && input.styleBytes[material * 4 + 2] === 0
      && compatibilityMask !== FULL_COMPATIBILITY_MASK) {
      curvatureGain = solidCurvatureGain(
        input.styleBytes[material * 4 + 1] ?? RenderProfile.Neutral,
        materialOptics,
      );
      solidCurvatureDepth = curvatureGain > 0;
    }
    const liquidMeniscus = (input.surfaceContourLighting ?? true)
      && this.haloMaterials[haloIndex] !== 0
      && phase === RenderPhase.Liquid
      && input.styleBytes[material * 4 + 2] === 0
      && input.styleBytes[material * 4 + 3] === 0
      && materialOptics !== RenderOptics.Molten
      && this.isExposedConnectedLiquid(cellX + 1, cellY + 1, material);
    const liquidSilhouetteCohesion = (input.liquidSilhouetteCohesion ?? true)
      && input.liquidField !== undefined
      && input.paletteBytes !== undefined
      && this.haloMaterials[haloIndex] !== 0
      && phase === RenderPhase.Liquid
      && input.styleBytes[material * 4 + 2] === 0
      && input.styleBytes[material * 4 + 3] === 0
      && materialOptics !== RenderOptics.Molten
      && this.isConnectedLiquidAirShore(cellX + 1, cellY + 1, material);
    const solidSurfaceBevel = (input.surfaceContourLighting ?? true)
      && this.haloMaterials[haloIndex] !== 0
      && phase === RenderPhase.Solid
      && input.styleBytes[material * 4 + 2] === 0
      && input.styleBytes[material * 4 + 3] === 0;
    const phaseContactMask = phaseContactEligible ? packedMasks >>> 9 : 0;
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
        if (grainFacet === 0) {
          this.pixels[outputPixel] = sourceRed;
          this.pixels[outputPixel + 1] = sourceGreen;
          this.pixels[outputPixel + 2] = sourceBlue;
        } else {
          this.pixels[outputPixel] = clampByte(sourceRed + grainFacet);
          this.pixels[outputPixel + 1] = clampByte(sourceGreen + grainFacet);
          this.pixels[outputPixel + 2] = clampByte(sourceBlue + grainFacet);
        }

        if (!eligible) {
          this.coverage[outputIndex] = sourceAlpha === 0 ? 0 : 255;
          this.pixels[outputPixel + 3] = sourceAlpha;
          continue;
        }

        const localX = this.axisGeometry.local[subX];
        const localY = this.axisGeometry.local[subY];
        const stencilOrigin = this.axisGeometry.side[subY] * 3
          + this.axisGeometry.side[subX];
        const q00 = (compatibilityMask >>> stencilOrigin) & 1;
        const q10 = (compatibilityMask >>> (stencilOrigin + 1)) & 1;
        const q01 = (compatibilityMask >>> (stencilOrigin + 3)) & 1;
        const q11 = (compatibilityMask >>> (stencilOrigin + 4)) & 1;
        // Inline the shared Hermite reference's scalar density so the hot loop
        // does not allocate its small diagnostic result object per subpixel.
        const weightX = this.axisGeometry.weight[subX];
        const weightY = this.axisGeometry.weight[subY];
        const top = q00 + (q10 - q00) * weightX;
        const bottom = q01 + (q11 - q01) * weightX;
        const density = top + (bottom - top) * weightY;
        let derivativeX = 0;
        let derivativeY = 0;
        if (solidCurvatureDepth || exactSolidContact || liquidMeniscus
          || solidSurfaceBevel || phaseContactMask !== 0) {
          derivativeX = this.axisGeometry.derivative[subX];
          derivativeY = this.axisGeometry.derivative[subY];
        }
        if (liquidMeniscus) {
          const gradientX = ((q10 - q00) * (1 - weightY)
            + (q11 - q01) * weightY) * derivativeX;
          const gradientY = ((q01 - q00) * (1 - weightX)
            + (q11 - q10) * weightX) * derivativeY;
          applyCanvasLiquidFresnelShell(
            this.pixels, outputPixel, density, gradientX, gradientY, materialOptics,
          );
        }
        let solidCross = 0;
        let solidHorizontal = 0;
        let solidVertical = 0;
        let solidGradientX = 0;
        let solidGradientY = 0;
        if (solidSurfaceBevel || solidCurvatureDepth) {
          solidCross = q11 - q10 - q01 + q00;
          solidHorizontal = q10 - q00 + solidCross * weightY;
          solidVertical = q01 - q00 + solidCross * weightX;
          solidGradientX = solidHorizontal * derivativeX;
          solidGradientY = solidVertical * derivativeY;
        }
        if (solidSurfaceBevel) {
          const response = canvasSurfaceChromaResponse(
            density,
            solidGradientX,
            solidGradientY,
            materialOptics,
          );
          applyCanvasSurfaceChroma(this.pixels, outputPixel, response, materialOptics);
        }
        if (solidCurvatureDepth && density > 0.08 && density < 0.92) {
          const curvature = implicitContourCurvature(
            solidGradientX,
            solidGradientY,
            solidHorizontal * this.axisGeometry.secondDerivative[subX],
            solidCross * derivativeX * derivativeY,
            solidVertical * this.axisGeometry.secondDerivative[subY],
          );
          const response = Math.max(-0.045, Math.min(0.045, curvature * 0.045 * curvatureGain));
          this.pixels[outputPixel] = clampByte(this.pixels[outputPixel] * (1 + response));
          this.pixels[outputPixel + 1] = clampByte(this.pixels[outputPixel + 1] * (1 + response));
          this.pixels[outputPixel + 2] = clampByte(this.pixels[outputPixel + 2] * (1 + response));
        }
        if (exactSolidContact) {
          const d00 = (differentSolidMask >>> stencilOrigin) & 1;
          const d10 = (differentSolidMask >>> (stencilOrigin + 1)) & 1;
          const d01 = (differentSolidMask >>> (stencilOrigin + 3)) & 1;
          const d11 = (differentSolidMask >>> (stencilOrigin + 4)) & 1;
          const contactX = ((d10 - d00) * (1 - weightY)
            + (d11 - d01) * weightY) * derivativeX;
          const contactY = ((d01 - d00) * (1 - weightX)
            + (d11 - d10) * weightX) * derivativeY;
          const contactTone = Math.max(-6, Math.min(7, (-contactX * 0.55 - contactY * 0.80) * 7));
          const optics = input.paletteBytes?.[material * 4 + 3] ?? RenderOptics.Default;
          const lensAccent = optics === RenderOptics.TranslucentRigid
            ? Math.max(0, contactTone) * 0.35 : 0;
          this.pixels[outputPixel] = clampByte(
            this.pixels[outputPixel] + contactTone - lensAccent * 0.20,
          );
          this.pixels[outputPixel + 1] = clampByte(
            this.pixels[outputPixel + 1] + contactTone + lensAccent * 0.35,
          );
          this.pixels[outputPixel + 2] = clampByte(
            this.pixels[outputPixel + 2] + contactTone + lensAccent * 0.70,
          );
        }
        if (phaseContactMask !== 0) {
          const p00 = (phaseContactMask >>> stencilOrigin) & 1;
          const p10 = (phaseContactMask >>> (stencilOrigin + 1)) & 1;
          const p01 = (phaseContactMask >>> (stencilOrigin + 3)) & 1;
          const p11 = (phaseContactMask >>> (stencilOrigin + 4)) & 1;
          const pattern = p00 | (p10 << 1) | (p01 << 2) | (p11 << 3);
          const contactTone = this.axisGeometry.phaseContactTone[
            (pattern * this.outputScale + subY) * this.outputScale + subX
          ];
          if (contactTone !== 0) {
            this.pixels[outputPixel] = clampByte(this.pixels[outputPixel] + contactTone);
            this.pixels[outputPixel + 1] = clampByte(this.pixels[outputPixel + 1] + contactTone);
            this.pixels[outputPixel + 2] = clampByte(this.pixels[outputPixel + 2] + contactTone);
          }
        }
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
              compatibilityMask, subX, subY,
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
              if (!emptyPowder && (input.surfaceContourLighting ?? true)
                && this.haloStability[haloIndex] >= 192
                && input.styleBytes[material * 4 + 2] === 0
                && input.styleBytes[material * 4 + 3] === 0
                && powderSurfaceDetailGate > 0 && heapDensity < 0.92) {
                const response = canvasSurfaceChromaResponse(
                  surfaceDensity, gradientX, gradientY, materialOptics,
                ) * powderSurfaceDetailGate;
                applyCanvasSurfaceChroma(this.pixels, outputPixel, response, materialOptics);
              }
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
          if (liquidSilhouetteCohesion) {
            const worldX = input.chunkX + cellX + localX;
            const worldY = input.chunkY + cellY + localY;
            const palette = material * 4;
            const fieldDensity = sampleSpeciesLiquidDensity(
              input.liquidField!, input.worldWidth, input.worldHeight, worldX, worldY,
              input.paletteBytes![palette], input.paletteBytes![palette + 1],
              input.paletteBytes![palette + 2],
            );
            // The shared field supplies a stable curved shore, but it may only
            // trim the existing categorical fringe. Real semantic cells keep
            // their centre, and Canvas never claims an empty owner cell.
            const fieldAmount = smoothstep(0.58, 0.90, fieldDensity);
            if (fieldAmount < amount) amount += (fieldAmount - amount) * 0.62;
          }
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
    // Three or four cardinal donors identify a concave authored void rather
    // than exterior air. Keep that pore/notch empty; convex exterior shoulders
    // still have at most two donors and remain eligible for rounded projection.
    if (material === 0 || powderDonors === 0 || powderDonors > 2 || stability <= 0) return owner;
    owner.material = material;
    owner.stability = stability;
    owner.red = Math.round(red / powderDonors);
    owner.green = Math.round(green / powderDonors);
    owner.blue = Math.round(blue / powderDonors);
    return owner;
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
    compatibilityMask: number,
    subX: number,
    subY: number,
  ): number {
    const leftX = this.axisGeometry.quadraticLeft[subX];
    const middleX = this.axisGeometry.quadraticMiddle[subX];
    const rightX = this.axisGeometry.quadraticRight[subX];
    const topY = this.axisGeometry.quadraticLeft[subY];
    const middleY = this.axisGeometry.quadraticMiddle[subY];
    const bottomY = this.axisGeometry.quadraticRight[subY];
    let density = 0;
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      const weightX = x === 0 ? leftX : x === 1 ? middleX : rightX;
      const weightY = y === 0 ? topY : y === 1 ? middleY : bottomY;
      density += ((compatibilityMask >>> (y * 3 + x)) & 1) * weightX * weightY;
    }
    return density;
  }

  private compatibilityMask(
    centreX: number,
    centreY: number,
    ownerMaterial: number,
    ownerPhase: number,
  ): number {
    const ownerContactPhase = contactPhase(ownerPhase);
    let mask = 0;
    let bit = 1;
    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      for (let offsetX = -1; offsetX <= 1; offsetX++, bit <<= 1) {
        const index = (centreY + offsetY) * HALO_SIZE + centreX + offsetX;
        if (this.isWallAt(index)) continue;
        const candidateMaterial = this.haloMaterials[index];
        const candidatePhase = this.haloPhases[index];
        if (candidateMaterial === 0 || !isContourPhase(candidatePhase)) continue;
        if (ownerPhase === RenderPhase.Liquid) {
          if (candidatePhase === RenderPhase.Liquid && candidateMaterial === ownerMaterial) {
            mask |= bit;
          }
        } else if (phaseContactCompatible(ownerContactPhase, contactPhase(candidatePhase))) {
          mask |= bit;
        }
      }
    }
    return mask;
  }

  private differentSolidMask(
    centreX: number,
    centreY: number,
    ownerMaterial: number,
  ): number {
    let mask = 0;
    let bit = 1;
    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      for (let offsetX = -1; offsetX <= 1; offsetX++, bit <<= 1) {
        const index = (centreY + offsetY) * HALO_SIZE + centreX + offsetX;
        if (this.isWallAt(index)) continue;
        const candidate = this.haloMaterials[index];
        if (candidate !== 0 && candidate !== ownerMaterial
          && this.haloPhases[index] === RenderPhase.Solid) mask |= bit;
      }
    }
    return mask;
  }

  /**
   * Marks only direct liquid/solid or liquid/stable-powder contacts. Diagonal
   * proximity alone cannot ground an interface, and semantic traits/emission
   * remain legible because either decorated side rejects the whole candidate.
   */
  private compatibilityAndContactMasks(
    centreX: number,
    centreY: number,
    ownerMaterial: number,
    ownerPhase: number,
    input: CanvasPhaseContourInput,
  ): number {
    let compatibilityMask = 0;
    let contactMask = 0;
    let bit = 1;
    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      for (let offsetX = -1; offsetX <= 1; offsetX++, bit <<= 1) {
        const index = (centreY + offsetY) * HALO_SIZE + centreX + offsetX;
        if (this.isWallAt(index)) continue;
        const candidate = this.haloMaterials[index];
        const candidatePhase = this.haloPhases[index];
        if (candidate === 0 || !isContourPhase(candidatePhase)) continue;
        if (ownerPhase === RenderPhase.Liquid) {
          if (candidatePhase === RenderPhase.Liquid && candidate === ownerMaterial) {
            compatibilityMask |= bit;
          }
        } else if (ownerPhase === RenderPhase.Solid
          ? candidatePhase === RenderPhase.Solid
          : candidatePhase === RenderPhase.Powder || candidatePhase === RenderPhase.Solid) {
          compatibilityMask |= bit;
        }
        if (input.styleBytes[candidate * 4 + 2] !== 0
          || input.styleBytes[candidate * 4 + 3] !== 0) continue;
        const liquidMatterContact = ownerPhase === RenderPhase.Solid
          ? candidatePhase === RenderPhase.Liquid
          : ownerPhase === RenderPhase.Liquid
            ? candidatePhase === RenderPhase.Solid
              || (candidatePhase === RenderPhase.Powder && this.haloStability[index] >= 192)
            : ownerPhase === RenderPhase.Powder
              && (candidatePhase === RenderPhase.Liquid || candidatePhase === RenderPhase.Solid);
        if (liquidMatterContact) contactMask |= bit;
      }
    }
    const cardinalMask = (1 << 1) | (1 << 3) | (1 << 5) | (1 << 7);
    if ((contactMask & cardinalMask) === 0) contactMask = 0;
    return compatibilityMask | (contactMask << 9);
  }

  /**
   * A meniscus needs same-species continuity and a real cardinal free surface.
   * Unlike liquid, solids, and native walls are contacts rather than air rims.
   * This classification happens once per world cell, never per subpixel.
   */
  private isExposedConnectedLiquid(
    haloX: number,
    haloY: number,
    ownerMaterial: number,
  ): boolean {
    let sameSpecies = false;
    let exposed = false;
    for (let direction = 0; direction < 4; direction++) {
      const x = haloX + (direction === 0 ? -1 : direction === 1 ? 1 : 0);
      const y = haloY + (direction === 2 ? -1 : direction === 3 ? 1 : 0);
      const index = y * HALO_SIZE + x;
      if (this.isWallAt(index)) continue;
      const candidate = this.haloMaterials[index];
      const candidatePhase = this.haloPhases[index];
      if (candidate === ownerMaterial && candidatePhase === RenderPhase.Liquid) {
        sameSpecies = true;
      } else if (candidate !== 0 && candidatePhase === RenderPhase.Liquid) {
        return false;
      } else if (candidate === 0 || candidatePhase === RenderPhase.Gas) {
        exposed = true;
      }
    }
    return sameSpecies && exposed;
  }

  /**
   * Cohesion is restricted to a two-dimensional exact-species body beside
   * actual air/gas. Any contact or one-axis filament keeps categorical pixels.
   */
  private isConnectedLiquidAirShore(
    haloX: number,
    haloY: number,
    ownerMaterial: number,
  ): boolean {
    let horizontalSupport = false;
    let verticalSupport = false;
    let exposed = false;
    for (let direction = 0; direction < 4; direction++) {
      const horizontal = direction < 2;
      const x = haloX + (direction === 0 ? -1 : direction === 1 ? 1 : 0);
      const y = haloY + (direction === 2 ? -1 : direction === 3 ? 1 : 0);
      const index = y * HALO_SIZE + x;
      if (this.isWallAt(index)) return false;
      const candidate = this.haloMaterials[index];
      const candidatePhase = this.haloPhases[index];
      if (candidate === ownerMaterial && candidatePhase === RenderPhase.Liquid) {
        if (horizontal) horizontalSupport = true;
        else verticalSupport = true;
      } else if (candidate === 0 || candidatePhase === RenderPhase.Gas) {
        exposed = true;
      } else {
        // Unlike liquid, solid, powder, energy, and field contacts are not an
        // air shore and must not borrow the liquid field's silhouette.
        return false;
      }
    }
    return horizontalSupport && verticalSupport && exposed;
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

function solidCurvatureGain(profile: number, optics: number): number {
  if (isGranularOptics(optics) || profile === RenderProfile.Granular) return 0;
  if (optics === RenderOptics.SmoothRigid || optics === RenderOptics.Cellular
    || profile === RenderProfile.Rigid) return 1;
  if (optics === RenderOptics.Device || profile === RenderProfile.Device) return 0.82;
  if (optics === RenderOptics.Radioactive || profile === RenderProfile.Radioactive) return 0.70;
  if (optics === RenderOptics.TranslucentRigid) return 0.62;
  if (optics === RenderOptics.Organic || profile === RenderProfile.Organic) return 0.58;
  return 0.72;
}

function validateInput(input: CanvasPhaseContourInput): void {
  const cells = input.worldWidth * input.worldHeight;
  if (!Number.isInteger(input.worldWidth) || !Number.isInteger(input.worldHeight)
    || input.worldWidth <= 0 || input.worldHeight <= 0
    || input.materials.length !== cells
    || input.sourcePixels.length !== cells * 4
    || input.powderStability.length !== cells
    || (input.powderSurface !== undefined && input.powderSurface.length !== cells * 4)
    || (input.powderExteriorAir !== undefined && input.powderExteriorAir.length !== cells)
    || (input.liquidField !== undefined && input.liquidField.length !== cells * 4)
    || input.styleBytes.length < 256 * 4
    || (input.paletteBytes !== undefined && input.paletteBytes.length < 256 * 4)
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

function sampleSpeciesLiquidDensity(
  bytes: Uint8Array,
  width: number,
  height: number,
  worldX: number,
  worldY: number,
  red: number,
  green: number,
  blue: number,
): number {
  const gridX = worldX - 0.5;
  const gridY = worldY - 0.5;
  const floorX = Math.floor(gridX);
  const floorY = Math.floor(gridY);
  const left = Math.max(0, Math.min(width - 1, floorX));
  const top = Math.max(0, Math.min(height - 1, floorY));
  const right = Math.max(0, Math.min(width - 1, left + 1));
  const bottom = Math.max(0, Math.min(height - 1, top + 1));
  const blendX = Math.max(0, Math.min(1, gridX - floorX));
  const blendY = Math.max(0, Math.min(1, gridY - floorY));
  const topLeft = (top * width + left) * 4;
  const topRight = (top * width + right) * 4;
  const bottomLeft = (bottom * width + left) * 4;
  const bottomRight = (bottom * width + right) * 4;
  const q00 = speciesLiquidAlpha(bytes, topLeft, red, green, blue);
  const q10 = speciesLiquidAlpha(bytes, topRight, red, green, blue);
  const q01 = speciesLiquidAlpha(bytes, bottomLeft, red, green, blue);
  const q11 = speciesLiquidAlpha(bytes, bottomRight, red, green, blue);
  const topDensity = q00 + (q10 - q00) * blendX;
  const bottomDensity = q01 + (q11 - q01) * blendX;
  return (topDensity + (bottomDensity - topDensity) * blendY) / 255;
}

function speciesLiquidAlpha(
  bytes: Uint8Array,
  offset: number,
  red: number,
  green: number,
  blue: number,
): number {
  return bytes[offset] === red && bytes[offset + 1] === green && bytes[offset + 2] === blue
    ? bytes[offset + 3] : 0;
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

function bitCount(value: number): number {
  let count = 0;
  for (let remaining = value; remaining !== 0; remaining &= remaining - 1) count++;
  return count;
}

function hash2(x: number, y: number): number {
  let value = Math.imul(x ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(y, 0xc2b2ae35);
  value ^= value >>> 13;
  return (Math.imul(value, 0x27d4eb2d) ^ (value >>> 15)) >>> 0;
}
