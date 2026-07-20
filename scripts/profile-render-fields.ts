import { performance } from 'node:perf_hooks';
import { ALL_MATERIALS, Material } from '../src/shared/materials';
import { AtmosphereField } from '../src/renderer/atmosphere-field';
import {
  canvasAtmosphereAlphaAtWorldCell, canvasGasSemanticAccentAlpha, shadeCanvasAtmosphere,
} from '../src/renderer/canvas-atmosphere-relief';
import { shadeCanvasEnergy } from '../src/renderer/canvas-energy-style';
import {
  applyCanvasRenderTraits, CANVAS_RENDER_TRAIT_CLOCK_SIZE, updateCanvasRenderTraitClock,
} from '../src/renderer/canvas-render-traits';
import {
  CANVAS_TRANSLUCENT_FIELD_GAIN, canvasTranslucentFieldExposure, lightCanvasSurface,
} from '../src/renderer/canvas-surface-light';
import { EmissionField } from '../src/renderer/emission-field';
import { LiquidDensityField } from '../src/renderer/liquid-density-field';
import {
  createLiquidSurfaceScratch, reconstructLiquidSurface,
} from '../src/renderer/canvas-liquid-surface';
import { reconstructSolidSurface } from '../src/renderer/canvas-solid-surface';
import {
  applyCanvasSolidBodyOptics, applyCanvasSolidLighting,
  applyCanvasTranslucentCaustic, applyCanvasTranslucentLensShell, canvasSolidRelief,
} from '../src/renderer/canvas-solid-relief';
import {
  applyCanvasLiquidBodyOptics, canvasLiquidContourScale, canvasLiquidEmissionExposure,
  canvasLiquidEmissionSurfaceExposure, canvasLiquidFieldRelief, canvasLiquidSurfaceExposure,
} from '../src/renderer/canvas-liquid-light';
import { applyCanvasPowderBulkStyle } from '../src/renderer/canvas-powder-bulk-style';
import { applyCanvasSuspensionStyle } from '../src/renderer/canvas-suspension-style';
import { createRenderLookups } from '../src/renderer/render-field-set';
import { PowderSurfaceField } from '../src/renderer/powder-surface-field';
import { RenderPhase, RenderProfile } from '../src/renderer/render-profile';
import { RenderTrait } from '../src/renderer/render-traits';
import { compositePixel } from '../src/renderer/rgba-composite';
import {
  CANVAS_LIQUID_REFRACTION_LOOKUP_BYTES, writeCanvasLiquidRefractedWallPixel,
  writeCanvasRefractedWallPixel, writeCanvasWallPixel,
} from '../src/renderer/canvas-wall-style';
import { RenderOptics } from '../src/renderer/render-optics';
import { SuspensionField } from '../src/renderer/suspension-field';
import {
  CANVAS_CONTOUR_CHUNK_SIZE, CANVAS_CONTOUR_GEOMETRY_LOOKUP_BYTES,
  CanvasPhaseContourScratch,
} from '../src/renderer/canvas-phase-contour';

const width = 612;
const height = 384;
const materials = new Uint8Array(width * height);
const {
  gasByMaterial, liquidByMaterial, emissiveByMaterial, colorByMaterial, styleBytes, paletteBytes,
} = createRenderLookups(ALL_MATERIALS);

// A deterministic mixed workload with dense, sparse, and interleaved regions.
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const index = y * width + x;
  if (x < width / 3) materials[index] = (x + y) % 7 < 3 ? Material.Smoke : Material.Empty;
  else if (x < width * 2 / 3) materials[index] = (x * 3 + y) % 9 < 5 ? Material.Water : Material.Empty;
  else if (y < height / 2) materials[index] = (x + y * 5) % 13 < 4 ? Material.Oxygen : Material.Oil;
  else materials[index] = (x * 7 + y * 3) % 17 < 3 ? Material.PHOT : Material.Empty;
}

const atmosphere = new AtmosphereField(width, height, gasByMaterial, colorByMaterial);
const liquid = new LiquidDensityField(width, height, liquidByMaterial, colorByMaterial);
const emission = new EmissionField(width, height, emissiveByMaterial, colorByMaterial);
for (let iteration = 0; iteration < 4; iteration++) {
  atmosphere.update(materials);
  liquid.update(materials);
  emission.update(materials);
}

// A settled shallow heap forces the full-width slope reconstruction path. Toggle
// one stability threshold per sample so every timing includes the complete
// state scan, two horizontal box passes, vertical pass, and RGBA packing.
const powderMaterials = new Uint8Array(width * height);
const powderStability = new Uint8Array(width * height);
for (let x = 0; x < width; x++) {
  const surfaceY = Math.floor(height * 0.22 + x * 0.18);
  for (let y = surfaceY; y < height; y++) {
    const index = y * width + x;
    powderMaterials[index] = Material.Sand;
    powderStability[index] = 255;
  }
}
const powderSurface = new PowderSurfaceField(width, height, styleBytes);
const powderToggleIndex = (height - 2) * width + Math.floor(width / 2);
let powderToggle = false;
const updatePowderSurface = (): void => {
  powderToggle = !powderToggle;
  powderStability[powderToggleIndex] = powderToggle ? 191 : 255;
  powderSurface.update(powderMaterials, powderStability);
};
updatePowderSurface();

const suspensionMaterials = new Uint8Array(width * height).fill(Material.Water);
for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
  if ((x + y * 3) % 5 < 2) suspensionMaterials[y * width + x] = Material.Sand;
}
const suspensionLiquid = new LiquidDensityField(
  width, height, liquidByMaterial, colorByMaterial,
);
suspensionLiquid.update(suspensionMaterials);
const suspension = new SuspensionField(width, height, styleBytes, paletteBytes);
// Both real presenters pass a native-wall plane, even when it is empty. Keep
// this profile production-shaped so optional-argument JIT behaviour cannot hide
// a wall-aware suspension regression.
const suspensionWalls = new Uint8Array(width * height);
suspension.update(suspensionMaterials, suspensionLiquid.bytes, suspensionWalls);
const suspensionBasePixels = seedPixels(suspensionMaterials);
const suspensionLiquidPixels = seedPixels(suspensionMaterials, liquidByMaterial);

// Repeating 2x2 Water islands expose every connected liquid cell while keeping
// enough same-species support for the subpixel meniscus path. Profile the same
// full-world chunk traversal with one synthetic trait bit to isolate the added
// RGB-only contour work without changing its coverage reconstruction.
const contourLiquidMaterials = new Uint8Array(width * height);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  if (x % 3 < 2 && y % 3 < 2) contourLiquidMaterials[y * width + x] = Material.Water;
}
const contourLiquidPixels = seedPixels(contourLiquidMaterials);
const contourPowderStability = new Uint8Array(width * height);
const contourFlatStyleBytes = styleBytes.slice();
contourFlatStyleBytes[Material.Water * 4 + 3] = 1;
const contourSolidMaterials = new Uint8Array(width * height);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  if (x % 3 < 2 && y % 3 < 2) contourSolidMaterials[y * width + x] = Material.Metal;
}
const contourSolidPixels = seedPixels(contourSolidMaterials);
const contourPhaseContactMaterials = new Uint8Array(width * height);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  contourPhaseContactMaterials[y * width + x] = x % 2 === 0 ? Material.Water : Material.Metal;
}
const contourPhaseContactPixels = seedPixels(contourPhaseContactMaterials);
const contourScratch = new CanvasPhaseContourScratch();
let contourChecksum = 0;

function profileLiquidContour(styles: Uint8Array): ReturnType<typeof sample> {
  const timing = sample(() => {
    let checksum = 0;
    for (let chunkY = 0; chunkY < height; chunkY += CANVAS_CONTOUR_CHUNK_SIZE) {
      for (let chunkX = 0; chunkX < width; chunkX += CANVAS_CONTOUR_CHUNK_SIZE) {
        contourScratch.rasterize({
          materials: contourLiquidMaterials,
          sourcePixels: contourLiquidPixels,
          powderStability: contourPowderStability,
          styleBytes: styles,
          paletteBytes,
          worldWidth: width,
          worldHeight: height,
          chunkX,
          chunkY,
          chunkWidth: Math.min(CANVAS_CONTOUR_CHUNK_SIZE, width - chunkX),
          chunkHeight: Math.min(CANVAS_CONTOUR_CHUNK_SIZE, height - chunkY),
        });
        checksum += contourScratch.pixels[0]
          + contourScratch.pixels[contourScratch.pixels.length - 4];
      }
    }
    contourChecksum = checksum;
  });
  return timing;
}

function profileSolidContour(surfaceContourLighting: boolean): ReturnType<typeof sample> {
  const timing = sample(() => {
    let checksum = 0;
    for (let chunkY = 0; chunkY < height; chunkY += CANVAS_CONTOUR_CHUNK_SIZE) {
      for (let chunkX = 0; chunkX < width; chunkX += CANVAS_CONTOUR_CHUNK_SIZE) {
        contourScratch.rasterize({
          materials: contourSolidMaterials,
          sourcePixels: contourSolidPixels,
          powderStability: contourPowderStability,
          styleBytes,
          paletteBytes,
          worldWidth: width,
          worldHeight: height,
          chunkX,
          chunkY,
          chunkWidth: Math.min(CANVAS_CONTOUR_CHUNK_SIZE, width - chunkX),
          chunkHeight: Math.min(CANVAS_CONTOUR_CHUNK_SIZE, height - chunkY),
          surfaceContourLighting,
        });
        checksum += contourScratch.pixels[0]
          + contourScratch.pixels[contourScratch.pixels.length - 4];
      }
    }
    contourChecksum = checksum;
  });
  return timing;
}

function profilePhaseContact(phaseContactLighting: boolean): ReturnType<typeof sample> {
  const timing = sample(() => {
    let checksum = 0;
    for (let chunkY = 0; chunkY < height; chunkY += CANVAS_CONTOUR_CHUNK_SIZE) {
      for (let chunkX = 0; chunkX < width; chunkX += CANVAS_CONTOUR_CHUNK_SIZE) {
        contourScratch.rasterize({
          materials: contourPhaseContactMaterials,
          sourcePixels: contourPhaseContactPixels,
          powderStability: contourPowderStability,
          styleBytes,
          paletteBytes,
          worldWidth: width,
          worldHeight: height,
          chunkX,
          chunkY,
          chunkWidth: Math.min(CANVAS_CONTOUR_CHUNK_SIZE, width - chunkX),
          chunkHeight: Math.min(CANVAS_CONTOUR_CHUNK_SIZE, height - chunkY),
          phaseContactLighting,
        });
        checksum += contourScratch.pixels[0]
          + contourScratch.pixels[contourScratch.pixels.length - 4];
      }
    }
    contourChecksum = checksum;
  });
  return timing;
}

function sample(update: () => void): { medianMs: number; p90Ms: number; maximumMs: number } {
  for (let warmup = 0; warmup < 5; warmup++) update();
  const timings: number[] = [];
  for (let iteration = 0; iteration < 30; iteration++) {
    const start = performance.now();
    update();
    timings.push(performance.now() - start);
  }
  timings.sort((left, right) => left - right);
  return {
    medianMs: Number(timings[Math.floor(timings.length / 2)].toFixed(2)),
    p90Ms: Number(timings[Math.floor(timings.length * 0.9)].toFixed(2)),
    maximumMs: Number(timings.at(-1)!.toFixed(2)),
  };
}

const solidMaterials = new Uint8Array(width * height);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const index = y * width + x;
  if ((x + y * 3) % 19 !== 0) solidMaterials[index] = x < width / 2 ? Material.Wood : Material.Metal;
}
const solidSeed = seedPixels(solidMaterials);
const solidPixels = new Uint8ClampedArray(solidSeed.length);
const denseTranslucentMaterials = new Uint8Array(width * height).fill(Material.Glass);
const denseTranslucentSeed = seedPixels(denseTranslucentMaterials);
const denseTranslucentPixels = new Uint8ClampedArray(denseTranslucentSeed.length);
const boundedTwoByTwoMaterials = new Uint8Array(width * height).fill(Material.Wood);
for (let y = 2; y < height - 2; y += 4) for (let x = 2; x < width - 2; x += 4) {
  boundedTwoByTwoMaterials[y * width + x] = Material.Empty;
  boundedTwoByTwoMaterials[y * width + x + 1] = Material.Empty;
  boundedTwoByTwoMaterials[(y + 1) * width + x] = Material.Empty;
  boundedTwoByTwoMaterials[(y + 1) * width + x + 1] = Material.Empty;
}
const boundedTwoByTwoSeed = seedPixels(boundedTwoByTwoMaterials);
const liquidSeed = seedPixels(materials, liquidByMaterial);
const liquidPixels = new Uint8ClampedArray(liquidSeed.length);
const liquidSurfaceScratch = createLiquidSurfaceScratch(liquidPixels, width);
const denseLiquidMaterials = new Uint8Array(width * height).fill(Material.Water);
const splitLiquidMaterials = new Uint8Array(width * height);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  splitLiquidMaterials[y * width + x] = x < width / 2 ? Material.Water : Material.Oil;
}
const denseLiquidField = new LiquidDensityField(width, height, liquidByMaterial, colorByMaterial);
const splitLiquidField = new LiquidDensityField(width, height, liquidByMaterial, colorByMaterial);
denseLiquidField.update(denseLiquidMaterials);
splitLiquidField.update(splitLiquidMaterials);
const denseLiquidSeed = seedPixels(denseLiquidMaterials, liquidByMaterial);
const splitLiquidSeed = seedPixels(splitLiquidMaterials, liquidByMaterial);
const denseLiquidPixels = new Uint8ClampedArray(denseLiquidSeed.length);
const splitLiquidPixels = new Uint8ClampedArray(splitLiquidSeed.length);
const denseLiquidSurfaceScratch = createLiquidSurfaceScratch(denseLiquidPixels, width);
const splitLiquidSurfaceScratch = createLiquidSurfaceScratch(splitLiquidPixels, width);
const atmospherePixels = new Uint8ClampedArray(atmosphere.bytes.length);
const energyCore = new Float32Array(3);
const energyGlow = new Float32Array(3);
const traitRgb = new Float32Array(3);
const translucentCausticRgb = new Float32Array(3);
const translucentLensRgb = new Float32Array(3);
const solidBodyRgb = new Float32Array(3);
const liquidBodyRgb = new Float32Array(3);
const traitClock = new Int32Array(CANVAS_RENDER_TRAIT_CLOCK_SIZE);
updateCanvasRenderTraitClock(traitClock, 1_000);
const traitCompositePixels = new Uint8ClampedArray(width * height * 4);
let traitChecksum = 0;
let solidReliefChecksum = 0;
let solidBodyChecksum = 0;
let powderBulkStyleChecksum = 0;
let liquidBodyChecksum = 0;
let liquidLightChecksum = 0;
let translucentLightChecksum = 0;
let translucentBackdropChecksum = 0;
let translucentCausticChecksum = 0;
let translucentLensChecksum = 0;
let gasSemanticAccentChecksum = 0;
const profileEmission = new Uint8Array(emission.bytes.length);
for (let y = 0; y < emission.height; y++) for (let x = 0; x < emission.width; x++) {
  const offset = (y * emission.width + x) * 4;
  profileEmission[offset] = 255;
  profileEmission[offset + 1] = 112;
  profileEmission[offset + 2] = 36;
  // Stay nonzero everywhere while forcing cardinal gradients throughout the
  // field so the atmosphere-lighting profile pays its normalization path.
  profileEmission[offset + 3] = 96 + ((x * 5 + y * 3) & 127);
}
const profileAtmosphereLight = {
  bytes: profileEmission, width: emission.width, height: emission.height,
} as const;
const localizedEmissionMaterials = new Uint8Array(width * height);
localizedEmissionMaterials[Math.floor(height / 2) * width + Math.floor(width / 2)] = Material.Fire;
const localizedEmission = new EmissionField(width, height, emissiveByMaterial, colorByMaterial);
localizedEmission.update(localizedEmissionMaterials);
const translucentBackdropSeed = new Uint8ClampedArray(width * height * 4);
const translucentBackdropPixels = new Uint8ClampedArray(translucentBackdropSeed.length);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  writeCanvasWallPixel(translucentBackdropSeed, (y * width + x) * 4, 6, x, y);
}

function seedPixels(source: Uint8Array, include = new Uint8Array(256).fill(1)): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(source.length * 4);
  for (let index = 0; index < source.length; index++) {
    const material = source[index];
    if (!material || !include[material]) continue;
    const color = material * 3;
    pixels[index * 4] = colorByMaterial[color];
    pixels[index * 4 + 1] = colorByMaterial[color + 1];
    pixels[index * 4 + 2] = colorByMaterial[color + 2];
    pixels[index * 4 + 3] = 255;
  }
  return pixels;
}

function profileTraitMask(traits: number): ReturnType<typeof sample> {
  const timing = sample(() => {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const index = y * width + x;
      traitRgb[0] = 128; traitRgb[1] = 128; traitRgb[2] = 128;
      applyCanvasRenderTraits(
        traitRgb, traits, RenderPhase.Field,
        Material.SING, x, y, index, traitClock,
      );
    }
  });
  traitChecksum += traitRgb[0] + traitRgb[1] + traitRgb[2];
  return timing;
}

function profileTraitBaseline(): ReturnType<typeof sample> {
  const timing = sample(() => {
    for (let index = 0; index < width * height; index++) {
      traitRgb[0] = 128; traitRgb[1] = 128; traitRgb[2] = 128;
    }
  });
  traitChecksum += traitRgb[0] + traitRgb[1] + traitRgb[2];
  return timing;
}

function profileTraitComposite(traits: number): ReturnType<typeof sample> {
  const timing = sample(() => {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const index = y * width + x;
      traitRgb[0] = 128; traitRgb[1] = 128; traitRgb[2] = 128;
      applyCanvasRenderTraits(
        traitRgb, traits, RenderPhase.Field,
        Material.SING, x, y, index, traitClock,
      );
      compositePixel(
        traitCompositePixels, index * 4, traitRgb[0], traitRgb[1], traitRgb[2], 255,
      );
    }
  });
  for (let offset = 0; offset < traitCompositePixels.length; offset += 4_096) {
    traitChecksum += traitCompositePixels[offset]
      + traitCompositePixels[offset + 1] + traitCompositePixels[offset + 2];
  }
  return timing;
}

function profileTranslucentFieldTransmission(): ReturnType<typeof sample> {
  const optics = paletteBytes[Material.Glass * 4 + 3];
  const exposure = canvasTranslucentFieldExposure(optics, true, false, true);
  const timing = sample(() => {
    denseTranslucentPixels.set(denseTranslucentSeed);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const pixel = (y * width + x) * 4;
      lightCanvasSurface(
        denseTranslucentPixels, pixel, profileEmission, emission.width, emission.height,
        width, height, x, y, RenderProfile.Rigid, exposure, CANVAS_TRANSLUCENT_FIELD_GAIN,
      );
    }
  });
  // Consume sparse output only after the timed production-shaped loop. This
  // keeps the benchmark honest while still preventing dead-code elimination.
  for (let offset = 0; offset < denseTranslucentPixels.length; offset += 4_096) {
    translucentLightChecksum += denseTranslucentPixels[offset]
      + denseTranslucentPixels[offset + 1] + denseTranslucentPixels[offset + 2];
  }
  return timing;
}

function profileLocalizedTranslucentFieldTransmission(): ReturnType<typeof sample> {
  const optics = paletteBytes[Material.Glass * 4 + 3];
  const exposure = canvasTranslucentFieldExposure(optics, true, false, true);
  const timing = sample(() => {
    denseTranslucentPixels.set(denseTranslucentSeed);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (!localizedEmission.mayLightWorldCell(x, y)) continue;
      const pixel = (y * width + x) * 4;
      lightCanvasSurface(
        denseTranslucentPixels, pixel,
        localizedEmission.bytes, localizedEmission.width, localizedEmission.height,
        width, height, x, y, RenderProfile.Rigid, exposure, CANVAS_TRANSLUCENT_FIELD_GAIN,
      );
    }
  });
  for (let offset = 0; offset < denseTranslucentPixels.length; offset += 4_096) {
    translucentLightChecksum += denseTranslucentPixels[offset]
      + denseTranslucentPixels[offset + 1] + denseTranslucentPixels[offset + 2];
  }
  return timing;
}

console.log(JSON.stringify({
  fixture: `${width}x${height}`,
  atmosphere: {
    allocatedBytes: atmosphere.allocatedByteLength,
    update: sample(() => atmosphere.update(materials)),
  },
  liquid: {
    allocatedBytes: liquid.allocatedByteLength,
    update: sample(() => liquid.update(materials)),
  },
  emission: {
    allocatedBytes: emission.allocatedByteLength,
    update: sample(() => emission.update(materials)),
  },
  powderSurface: {
    allocatedBytes: powderSurface.allocatedByteLength,
    update: sample(updatePowderSurface),
  },
  suspension: {
    allocatedBytes: suspension.allocatedByteLength,
    update: sample(() => suspension.update(
      suspensionMaterials, suspensionLiquid.bytes, suspensionWalls,
    )),
    canvasRgbPass: sample(() => applyCanvasSuspensionStyle(
      suspensionBasePixels, suspensionLiquidPixels, suspensionMaterials,
      styleBytes, paletteBytes, suspension, suspensionLiquid.bytes, 'smooth',
    )),
  },
  canvasPresentation: {
    runtimeKnownScratchBytes: solidPixels.byteLength + liquidPixels.byteLength
      + liquidSurfaceScratch.rowBytes.byteLength
      + energyCore.byteLength + energyGlow.byteLength + traitRgb.byteLength + traitClock.byteLength,
    liquidRefractionLookupBytes: CANVAS_LIQUID_REFRACTION_LOOKUP_BYTES,
    diagnosticScratchBytes: traitCompositePixels.byteLength + denseTranslucentPixels.byteLength
      + localizedEmissionMaterials.byteLength + localizedEmission.allocatedByteLength
      + solidBodyRgb.byteLength + liquidBodyRgb.byteLength,
    phaseContour: {
      allocatedBytes: contourScratch.allocatedByteLength,
      sharedGeometryLookupBytes: CANVAS_CONTOUR_GEOMETRY_LOOKUP_BYTES,
      fixture: 'repeating connected 2x2 Water islands',
      flatRgb: profileLiquidContour(contourFlatStyleBytes),
      meniscusRgb: profileLiquidContour(styleBytes),
      solidBevel: {
        fixture: 'repeating connected 2x2 Metal islands',
        flatRgb: profileSolidContour(false),
        bevelRgb: profileSolidContour(true),
      },
      phaseContact: {
        fixture: 'alternating full-height Water and Metal columns',
        flatRgb: profilePhaseContact(false),
        groundedRgb: profilePhaseContact(true),
      },
    },
    atmosphereRelief: sample(() => {
      shadeCanvasAtmosphere(atmospherePixels, atmosphere.bytes, atmosphere.width, atmosphere.height);
    }),
    atmosphereFieldLighting: sample(() => {
      shadeCanvasAtmosphere(
        atmospherePixels, atmosphere.bytes, atmosphere.width, atmosphere.height,
        profileAtmosphereLight,
      );
    }),
    gasSemanticAccentWorstCase: sample(() => {
      let checksum = 0;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const atmosphereAlpha = canvasAtmosphereAlphaAtWorldCell(
          atmosphere.bytes, atmosphere.width, atmosphere.height, width, height, x, y,
        );
        checksum += canvasGasSemanticAccentAlpha(atmosphereAlpha, 8, false);
      }
      gasSemanticAccentChecksum = checksum;
    }),
    energyCoresFlat: sample(() => {
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        shadeCanvasEnergy(
          energyCore, energyGlow, 32, 224, 255, RenderProfile.Radioactive,
          styleBytes[Material.NEUT * 4 + 3], Material.NEUT, x, y, 1_000, 0.4, 24, -8,
          255, false, 18,
        );
      }
    }),
    energyCores: sample(() => {
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        shadeCanvasEnergy(
          energyCore, energyGlow, 32, 224, 255, RenderProfile.Radioactive,
          styleBytes[Material.NEUT * 4 + 3], Material.NEUT, x, y, 1_000, 0.4, 24, -8,
          255, true, 18,
        );
      }
    }),
    traitCores: {
      rgbBaseline: profileTraitBaseline(),
      emitter: profileTraitMask(RenderTrait.Emitter),
      organicFibrous: profileTraitMask(RenderTrait.Organic | RenderTrait.Fibrous),
      sing: profileTraitMask(styleBytes[Material.SING * 4 + 3]),
      syntheticAllBits: profileTraitMask(0xff),
      singWithComposite: profileTraitComposite(styleBytes[Material.SING * 4 + 3]),
    },
    solidSurface: sample(() => {
      solidPixels.set(solidSeed);
      reconstructSolidSurface(solidPixels, solidMaterials, styleBytes, paletteBytes, width, height);
    }),
    solidSurfaceBoundedTwoByTwoWorstCase: sample(() => {
      solidPixels.set(boundedTwoByTwoSeed);
      reconstructSolidSurface(
        solidPixels, boundedTwoByTwoMaterials, styleBytes, paletteBytes, width, height,
      );
    }),
    solidReliefLoopBaseline: sample(() => {
      for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
        const material = solidMaterials[y * width + x];
        if (!material) continue;
        solidReliefChecksum = styleBytes[material * 4 + 1] + paletteBytes[material * 4 + 3];
      }
    }),
    solidReliefInlineWorstCase: sample(() => {
      for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
        const material = solidMaterials[y * width + x];
        if (!material) continue;
        solidReliefChecksum = canvasSolidRelief(
          x, y, material, styleBytes[material * 4 + 1], paletteBytes[material * 4 + 3],
        );
      }
    }),
    solidBodyDepthLoopBaseline: sample(() => {
      const material = Material.Metal;
      const profile = styleBytes[material * 4 + 1];
      const optics = paletteBytes[material * 4 + 3];
      const color = material * 3;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const dense = x > 0 && x < width - 1 && y > 0 && y < height - 1;
        const normalLight = (x === 0 ? 8 : 0) - (x === width - 1 ? 6 : 0)
          + (y === 0 ? 18 : 0) - (y === height - 1 ? 5 : 0);
        const relief = dense ? canvasSolidRelief(x, y, material, profile, optics) : 0;
        solidBodyRgb[0] = colorByMaterial[color];
        solidBodyRgb[1] = colorByMaterial[color + 1];
        solidBodyRgb[2] = colorByMaterial[color + 2];
        applyCanvasSolidLighting(solidBodyRgb, normalLight + relief);
      }
      solidBodyChecksum = solidBodyRgb[0] + solidBodyRgb[1] + solidBodyRgb[2];
    }),
    solidBodyDepthWorstCase: sample(() => {
      const material = Material.Metal;
      const profile = styleBytes[material * 4 + 1];
      const optics = paletteBytes[material * 4 + 3];
      const color = material * 3;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const dense = x > 0 && x < width - 1 && y > 0 && y < height - 1;
        const normalLight = (x === 0 ? 8 : 0) - (x === width - 1 ? 6 : 0)
          + (y === 0 ? 18 : 0) - (y === height - 1 ? 5 : 0);
        const relief = dense ? canvasSolidRelief(x, y, material, profile, optics) : 0;
        solidBodyRgb[0] = colorByMaterial[color];
        solidBodyRgb[1] = colorByMaterial[color + 1];
        solidBodyRgb[2] = colorByMaterial[color + 2];
        applyCanvasSolidBodyOptics(
          solidBodyRgb, normalLight + relief, normalLight, relief, dense, profile, optics,
        );
      }
      solidBodyChecksum = solidBodyRgb[0] + solidBodyRgb[1] + solidBodyRgb[2];
    }),
    powderBulkStyleLoopBaseline: sample(() => {
      const color = Material.Sand * 3;
      for (let index = 0; index < width * height; index++) {
        solidBodyRgb[0] = colorByMaterial[color] + 11;
        solidBodyRgb[1] = colorByMaterial[color + 1] + 7;
        solidBodyRgb[2] = colorByMaterial[color + 2] + 4;
      }
      powderBulkStyleChecksum = solidBodyRgb[0] + solidBodyRgb[1] + solidBodyRgb[2];
    }),
    powderBulkStyleWorstCase: sample(() => {
      const color = Material.Sand * 3;
      for (let index = 0; index < width * height; index++) {
        solidBodyRgb[0] = colorByMaterial[color] + 11;
        solidBodyRgb[1] = colorByMaterial[color + 1] + 7;
        solidBodyRgb[2] = colorByMaterial[color + 2] + 4;
        applyCanvasPowderBulkStyle(
          solidBodyRgb,
          colorByMaterial[color], colorByMaterial[color + 1], colorByMaterial[color + 2],
          255, 255, 148, 164, 255, 1,
        );
      }
      powderBulkStyleChecksum = solidBodyRgb[0] + solidBodyRgb[1] + solidBodyRgb[2];
    }),
    liquidBodyOpticsLoopBaseline: sample(() => {
      const color = Material.Water * 3;
      const oldReliefScale = 1 + 0.18 * 1.35 * 1.08;
      for (let index = 0; index < width * height; index++) {
        liquidBodyRgb[0] = colorByMaterial[color] * oldReliefScale;
        liquidBodyRgb[1] = colorByMaterial[color + 1] * oldReliefScale;
        liquidBodyRgb[2] = colorByMaterial[color + 2] * oldReliefScale;
      }
      liquidBodyChecksum = liquidBodyRgb[0] + liquidBodyRgb[1] + liquidBodyRgb[2];
    }),
    liquidBodyOpticsWorstCase: sample(() => {
      const color = Material.Water * 3;
      for (let index = 0; index < width * height; index++) {
        liquidBodyRgb[0] = colorByMaterial[color];
        liquidBodyRgb[1] = colorByMaterial[color + 1];
        liquidBodyRgb[2] = colorByMaterial[color + 2];
        applyCanvasLiquidBodyOptics(
          liquidBodyRgb, RenderOptics.Aqueous, 255, 8, 0.18, 1,
        );
      }
      liquidBodyChecksum = liquidBodyRgb[0] + liquidBodyRgb[1] + liquidBodyRgb[2];
    }),
    translucentCausticWorstCase: sample(() => {
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        translucentCausticRgb[0] = 120;
        translucentCausticRgb[1] = 150;
        translucentCausticRgb[2] = 180;
        applyCanvasTranslucentCaustic(
          translucentCausticRgb, ((x * 2 + y) & 15) - 7.5, Material.Glass,
        );
      }
      translucentCausticChecksum = translucentCausticRgb[0]
        + translucentCausticRgb[1] + translucentCausticRgb[2];
    }),
    translucentLensShellWorstCase: sample(() => {
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        translucentLensRgb[0] = 120;
        translucentLensRgb[1] = 150;
        translucentLensRgb[2] = 180;
        applyCanvasTranslucentLensShell(
          translucentLensRgb, ((x * 2 + y) & 15) - 7.5,
          ((x - y * 3) & 15) - 7.5, Material.Glass,
        );
      }
      translucentLensChecksum = translucentLensRgb[0]
        + translucentLensRgb[1] + translucentLensRgb[2];
    }),
    surfaceLighting: sample(() => {
      solidPixels.set(solidSeed);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const index = y * width + x;
        const material = solidMaterials[index];
        if (!material) continue;
        let exposed = 0;
        if (x === 0 || solidMaterials[index - 1] !== material) exposed++;
        if (x === width - 1 || solidMaterials[index + 1] !== material) exposed++;
        if (y === 0 || solidMaterials[index - width] !== material) exposed++;
        if (y === height - 1 || solidMaterials[index + width] !== material) exposed++;
        if (!exposed) continue;
        lightCanvasSurface(
          solidPixels, index * 4, profileEmission, emission.width, emission.height,
          width, height, x, y, styleBytes[material * 4 + 1] as RenderProfile, Math.min(1, exposed * 0.34),
        );
      }
    }),
    solidFieldLightingWorstCase: sample(() => {
      solidPixels.set(solidSeed);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const index = y * width + x;
        const material = solidMaterials[index];
        if (!material) continue;
        const leftSolid = x > 0 && solidMaterials[index - 1] !== Material.Empty;
        const rightSolid = x < width - 1 && solidMaterials[index + 1] !== Material.Empty;
        const topSolid = y > 0 && solidMaterials[index - width] !== Material.Empty;
        const bottomSolid = y < height - 1 && solidMaterials[index + width] !== Material.Empty;
        const normalX = Number(!rightSolid) - Number(!leftSolid);
        const normalY = Number(!bottomSolid) - Number(!topSolid);
        if (normalX === 0 && normalY === 0) continue;
        lightCanvasSurface(
          solidPixels, index * 4, profileEmission, emission.width, emission.height,
          width, height, x, y, styleBytes[material * 4 + 1] as RenderProfile,
          Math.min(1, (Math.abs(normalX) + Math.abs(normalY)) * 0.34),
          1, normalX, normalY, 1.25,
        );
      }
    }),
    translucentFieldTransmissionWorstCase: profileTranslucentFieldTransmission(),
    translucentFieldTransmissionLocalizedSource: profileLocalizedTranslucentFieldTransmission(),
    translucentBackdropRefractionWorstCase: sample(() => {
      translucentBackdropPixels.set(translucentBackdropSeed);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        writeCanvasRefractedWallPixel(
          translucentBackdropPixels, (y * width + x) * 4, 6, x, y, Material.Glass,
        );
      }
      translucentBackdropChecksum = translucentBackdropPixels[0]
        + translucentBackdropPixels[translucentBackdropPixels.length - 4];
    }),
    liquidBackdropStraightWorstCase: sample(() => {
      translucentBackdropPixels.set(translucentBackdropSeed);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        writeCanvasWallPixel(
          translucentBackdropPixels, (y * width + x) * 4, 6, x, y,
        );
      }
      translucentBackdropChecksum = translucentBackdropPixels[0]
        + translucentBackdropPixels[translucentBackdropPixels.length - 4];
    }),
    liquidBackdropRefractionWorstCase: sample(() => {
      translucentBackdropPixels.set(translucentBackdropSeed);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const edgeX = (x & 7) === 0 ? 1 : 0;
        const edgeY = (y & 7) === 0 ? 1 : 0;
        writeCanvasLiquidRefractedWallPixel(
          translucentBackdropPixels, (y * width + x) * 4, 6, x, y,
          RenderOptics.Aqueous, edgeX, edgeY,
        );
      }
      translucentBackdropChecksum = translucentBackdropPixels[0]
        + translucentBackdropPixels[translucentBackdropPixels.length - 4];
    }),
    liquidSurface: sample(() => {
      liquidPixels.set(liquidSeed);
      reconstructLiquidSurface(
        liquidPixels, materials, liquid.bytes, liquidByMaterial, colorByMaterial, styleBytes,
        liquidSurfaceScratch, width, height,
      );
    }),
    liquidSurfaceDenseWorstCase: sample(() => {
      denseLiquidPixels.set(denseLiquidSeed);
      reconstructLiquidSurface(
        denseLiquidPixels, denseLiquidMaterials, denseLiquidField.bytes,
        liquidByMaterial, colorByMaterial, styleBytes, denseLiquidSurfaceScratch, width, height,
      );
    }),
    liquidSurfaceSpeciesBoundary: sample(() => {
      splitLiquidPixels.set(splitLiquidSeed);
      reconstructLiquidSurface(
        splitLiquidPixels, splitLiquidMaterials, splitLiquidField.bytes,
        liquidByMaterial, colorByMaterial, styleBytes, splitLiquidSurfaceScratch, width, height,
      );
    }),
    liquidFieldOwnedLightWorstCase: sample(() => {
      let checksum = 0;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const pixel = (y * width + x) * 4;
        checksum += canvasLiquidContourScale(denseLiquidField.bytes[pixel + 3]);
        checksum += canvasLiquidSurfaceExposure(
          denseLiquidField.bytes, width, x, y, true,
        );
        checksum += Math.abs(canvasLiquidFieldRelief(
          denseLiquidField.bytes, width, height, x, y,
        ));
      }
      liquidLightChecksum = checksum;
    }),
    liquidFieldReflectionExposedWorstCase: sample(() => {
      liquidPixels.set(liquidSeed);
      let checksum = 0;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const pixel = (y * width + x) * 4;
        const exposure = canvasLiquidEmissionSurfaceExposure(
          liquid.bytes, width, height, x, y, true, true, true, true,
        );
        if (exposure <= 0) continue;
        const relief = canvasLiquidFieldRelief(liquid.bytes, width, height, x, y);
        const response = canvasLiquidEmissionExposure(exposure, relief);
        lightCanvasSurface(
          liquidPixels, pixel, profileEmission, emission.width, emission.height,
          width, height, x, y, RenderProfile.Neutral, response, 4,
        );
        checksum += liquidPixels[pixel] + liquidPixels[pixel + 1] + liquidPixels[pixel + 2];
      }
      liquidLightChecksum = checksum;
    }),
  },
  combinedAllocatedBytes: atmosphere.allocatedByteLength + liquid.allocatedByteLength
    + emission.allocatedByteLength + powderSurface.allocatedByteLength
    + suspension.allocatedByteLength,
  traitChecksum: Math.round(traitChecksum),
  solidReliefChecksum: Math.round(solidReliefChecksum),
  solidBodyChecksum: Math.round(solidBodyChecksum),
  powderBulkStyleChecksum: Math.round(powderBulkStyleChecksum),
  liquidBodyChecksum: Math.round(liquidBodyChecksum),
  liquidLightChecksum: Math.round(liquidLightChecksum),
  translucentLightChecksum: Math.round(translucentLightChecksum),
  translucentBackdropChecksum: Math.round(translucentBackdropChecksum),
  translucentCausticChecksum: Math.round(translucentCausticChecksum),
  translucentLensChecksum: Math.round(translucentLensChecksum),
  gasSemanticAccentChecksum: Math.round(gasSemanticAccentChecksum),
  contourChecksum: Math.round(contourChecksum),
}, null, 2));
