import { describe, expect, it } from "vitest";
import { MaterialId, WORLD_HEIGHT, WORLD_WIDTH, type SimulationView } from "../../src/simulation/contracts";
import { sampleCompositedPixel, writeCompositedPixel } from "../../src/renderer/material-compositor";

function view(): SimulationView {
  return { width: WORLD_WIDTH, height: WORLD_HEIGHT, tick: 0, material: new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT), lifetime: new Uint16Array(WORLD_WIDTH * WORLD_HEIGHT), temperature: new Int16Array(WORLD_WIDTH * WORLD_HEIGHT).fill(200) };
}
function set(world: SimulationView, x: number, y: number, material: MaterialId, life = 0, temperature = 200): void {
  const index = y * WORLD_WIDTH + x;
  (world.material as Uint8Array)[index] = material; (world.lifetime as Uint16Array)[index] = life; (world.temperature as Int16Array)[index] = temperature;
}

describe("material compositor", () => {
  it("has deterministic defined empty-world color and does not mutate borrowed state", () => {
    const world = view(); const before = [world.material.slice(), world.lifetime.slice(), world.temperature.slice()];
    expect(sampleCompositedPixel(world, 4, 5)).toEqual([20, 28, 40, 255]);
    expect(sampleCompositedPixel(world, 4, 5)).toEqual([20, 28, 40, 255]);
    writeCompositedPixel(world, 5 * WORLD_WIDTH + 4, new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT * 4));
    expect(world.material).toEqual(before[0]); expect(world.lifetime).toEqual(before[1]); expect(world.temperature).toEqual(before[2]);
  });

  it("responds to local exposed edges without changing the source", () => {
    const world = view(); set(world, 10, 10, MaterialId.Water); const edge = sampleCompositedPixel(world, 10, 10);
    set(world, 9, 10, MaterialId.Water); set(world, 11, 10, MaterialId.Water); set(world, 10, 9, MaterialId.Water); set(world, 10, 11, MaterialId.Water);
    expect(sampleCompositedPixel(world, 10, 10)).not.toEqual(edge);
  });

  it("has exact deterministic samples for textured wall and heat-aware fire", () => {
    const world = view();
    set(world, 1, 1, MaterialId.Wall);
    set(world, 4, 4, MaterialId.Fire, 90, 1400);
    expect(sampleCompositedPixel(world, 1, 1)).toEqual([111, 97, 74, 255]);
    expect(sampleCompositedPixel(world, 4, 4)).toEqual([250, 159, 25, 255]);
  });

  it("covers every v2 material with stable sampled colors", () => {
    const world = view(); const colors: number[][] = [];
    for (let material = MaterialId.Wall; material <= MaterialId.Acid; material += 1) {
      set(world, material, 20, material as MaterialId, 90, material === MaterialId.Fire ? 1400 : material === MaterialId.Steam ? 1050 : 500);
      colors.push([...sampleCompositedPixel(world, material, 20)]);
    }
    expect(colors).toHaveLength(10); expect(new Set(colors.map((color) => color.join(","))).size).toBeGreaterThan(7);
    const packed = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT * 4); writeCompositedPixel(world, 20 * WORLD_WIDTH + MaterialId.Fire, packed);
    expect([...packed.slice((20 * WORLD_WIDTH + MaterialId.Fire) * 4, (20 * WORLD_WIDTH + MaterialId.Fire + 1) * 4)]).toEqual(colors[MaterialId.Fire - 1]);
  });
});
