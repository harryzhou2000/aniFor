import { performance } from 'node:perf_hooks';
import { ALL_MATERIALS, Material } from '../src/shared/materials';
import { AtmosphereField } from '../src/renderer/atmosphere-field';
import { shadeCanvasAtmosphere } from '../src/renderer/canvas-atmosphere-relief';
import { shadeCanvasEnergy } from '../src/renderer/canvas-energy-style';
import {
  applyCanvasRenderTraits, CANVAS_RENDER_TRAIT_CLOCK_SIZE, updateCanvasRenderTraitClock,
} from '../src/renderer/canvas-render-traits';
import { lightCanvasSurface } from '../src/renderer/canvas-surface-light';
import { EmissionField } from '../src/renderer/emission-field';
import { LiquidDensityField } from '../src/renderer/liquid-density-field';
import {
  createLiquidSurfaceScratch, reconstructLiquidSurface,
} from '../src/renderer/canvas-liquid-surface';
import { reconstructSolidSurface } from '../src/renderer/canvas-solid-surface';
import { canvasSolidRelief } from '../src/renderer/canvas-solid-relief';
import {
  canvasLiquidContourScale, canvasLiquidFieldRelief, canvasLiquidSurfaceExposure,
} from '../src/renderer/canvas-liquid-light';
import { createRenderLookups } from '../src/renderer/render-field-set';
import { PowderSurfaceField } from '../src/renderer/powder-surface-field';
import { RenderPhase, RenderProfile } from '../src/renderer/render-profile';
import { RenderTrait } from '../src/renderer/render-traits';
import { compositePixel } from '../src/renderer/rgba-composite';

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
const traitClock = new Int32Array(CANVAS_RENDER_TRAIT_CLOCK_SIZE);
updateCanvasRenderTraitClock(traitClock, 1_000);
const traitCompositePixels = new Uint8ClampedArray(width * height * 4);
let traitChecksum = 0;
let solidReliefChecksum = 0;
let liquidLightChecksum = 0;
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
  canvasPresentation: {
    runtimeKnownScratchBytes: solidPixels.byteLength + liquidPixels.byteLength
      + liquidSurfaceScratch.rowBytes.byteLength
      + energyCore.byteLength + energyGlow.byteLength + traitRgb.byteLength + traitClock.byteLength,
    diagnosticScratchBytes: traitCompositePixels.byteLength,
    atmosphereRelief: sample(() => {
      shadeCanvasAtmosphere(atmospherePixels, atmosphere.bytes, atmosphere.width, atmosphere.height);
    }),
    atmosphereFieldLighting: sample(() => {
      shadeCanvasAtmosphere(
        atmospherePixels, atmosphere.bytes, atmosphere.width, atmosphere.height,
        profileAtmosphereLight,
      );
    }),
    energyCores: sample(() => {
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        shadeCanvasEnergy(
          energyCore, energyGlow, 32, 224, 255, RenderProfile.Radioactive,
          styleBytes[Material.NEUT * 4 + 3], Material.NEUT, x, y, 1_000, 0.4, 24, -8,
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
  },
  combinedAllocatedBytes: atmosphere.allocatedByteLength + liquid.allocatedByteLength + emission.allocatedByteLength,
  traitChecksum: Math.round(traitChecksum),
  solidReliefChecksum: Math.round(solidReliefChecksum),
  liquidLightChecksum: Math.round(liquidLightChecksum),
}, null, 2));
