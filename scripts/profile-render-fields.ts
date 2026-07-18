import { performance } from 'node:perf_hooks';
import { ALL_MATERIALS, Material } from '../src/shared/materials';
import { AtmosphereField } from '../src/renderer/atmosphere-field';
import { LiquidDensityField } from '../src/renderer/liquid-density-field';
import { renderPhase, RenderPhase } from '../src/renderer/render-profile';

const width = 612;
const height = 384;
const materials = new Uint8Array(width * height);
const gasByMaterial = new Uint8Array(256);
const liquidByMaterial = new Uint8Array(256);
const colorByMaterial = new Uint8Array(256 * 3);

for (const material of ALL_MATERIALS) {
  const color = Number.parseInt(material.color.slice(1), 16);
  const phase = renderPhase(material);
  gasByMaterial[material.id] = phase === RenderPhase.Gas ? 1 : 0;
  liquidByMaterial[material.id] = phase === RenderPhase.Liquid ? 1 : 0;
  colorByMaterial[material.id * 3] = color >>> 16;
  colorByMaterial[material.id * 3 + 1] = (color >>> 8) & 0xff;
  colorByMaterial[material.id * 3 + 2] = color & 0xff;
}

// A deterministic mixed workload with dense, sparse, and interleaved regions.
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const index = y * width + x;
  if (x < width / 3) materials[index] = (x + y) % 7 < 3 ? Material.Smoke : Material.Empty;
  else if (x < width * 2 / 3) materials[index] = (x * 3 + y) % 9 < 5 ? Material.Water : Material.Empty;
  else materials[index] = (x + y * 5) % 13 < 4 ? Material.Oxygen : Material.Oil;
}

const atmosphere = new AtmosphereField(width, height, gasByMaterial, colorByMaterial);
const liquid = new LiquidDensityField(width, height, liquidByMaterial);
for (let iteration = 0; iteration < 4; iteration++) {
  atmosphere.update(materials);
  liquid.update(materials);
}

function sample(update: () => void): { medianMs: number; p90Ms: number; maximumMs: number } {
  const timings: number[] = [];
  for (let iteration = 0; iteration < 20; iteration++) {
    const start = performance.now();
    update();
    timings.push(performance.now() - start);
  }
  timings.sort((left, right) => left - right);
  return {
    medianMs: Number(timings[10].toFixed(2)),
    p90Ms: Number(timings[18].toFixed(2)),
    maximumMs: Number(timings[19].toFixed(2)),
  };
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
  combinedAllocatedBytes: atmosphere.allocatedByteLength + liquid.allocatedByteLength,
}, null, 2));
