import { performance } from 'node:perf_hooks';
import { ALL_MATERIALS, Material } from '../src/shared/materials';
import { AtmosphereField } from '../src/renderer/atmosphere-field';
import { shadeCanvasAtmosphere } from '../src/renderer/canvas-atmosphere-relief';
import { shadeCanvasEnergy } from '../src/renderer/canvas-energy-style';
import { lightCanvasSurface } from '../src/renderer/canvas-surface-light';
import { EmissionField } from '../src/renderer/emission-field';
import { LiquidDensityField } from '../src/renderer/liquid-density-field';
import { reconstructLiquidSurface } from '../src/renderer/canvas-liquid-surface';
import { reconstructSolidSurface } from '../src/renderer/canvas-solid-surface';
import { createRenderLookups } from '../src/renderer/render-field-set';
import { RenderProfile } from '../src/renderer/render-profile';

const width = 612;
const height = 384;
const materials = new Uint8Array(width * height);
const { gasByMaterial, liquidByMaterial, emissiveByMaterial, colorByMaterial, styleBytes } = createRenderLookups(ALL_MATERIALS);

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
const liquidSeed = seedPixels(materials, liquidByMaterial);
const liquidPixels = new Uint8ClampedArray(liquidSeed.length);
const atmospherePixels = new Uint8ClampedArray(atmosphere.bytes.length);
const energyCore = new Float32Array(3);
const energyGlow = new Float32Array(3);
const profileEmission = new Uint8Array(emission.bytes.length);
for (let offset = 0; offset < profileEmission.length; offset += 4) {
  profileEmission[offset] = 255;
  profileEmission[offset + 1] = 112;
  profileEmission[offset + 2] = 36;
  profileEmission[offset + 3] = 196;
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
  canvasPresentation: {
    scratchBytes: solidPixels.byteLength + liquidPixels.byteLength,
    atmosphereRelief: sample(() => {
      shadeCanvasAtmosphere(atmospherePixels, atmosphere.bytes, atmosphere.width, atmosphere.height);
    }),
    energyCores: sample(() => {
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        shadeCanvasEnergy(
          energyCore, energyGlow, 32, 224, 255, RenderProfile.Radioactive,
          Material.NEUT, x, y, 1_000, 0.4, 24, -8,
        );
      }
    }),
    solidSurface: sample(() => {
      solidPixels.set(solidSeed);
      reconstructSolidSurface(solidPixels, solidMaterials, styleBytes, width, height);
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
      reconstructLiquidSurface(liquidPixels, materials, liquid.bytes, width, height);
    }),
  },
  combinedAllocatedBytes: atmosphere.allocatedByteLength + liquid.allocatedByteLength + emission.allocatedByteLength,
}, null, 2));
