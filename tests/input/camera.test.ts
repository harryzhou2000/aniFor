import { describe, expect, it } from "vitest";
import { PixelCamera } from "../../src/renderer/camera";

function visibleCenter(camera: PixelCamera, width: number, height: number): { x: number; y: number } {
  const { x, y, scale } = camera.transform;
  return { x: (width / 2 - x) / scale, y: (height / 2 - y) / scale };
}

describe("PixelCamera resize", () => {
  it("retains the fractional visible world center after pan, zoom, and resize", () => {
    const camera = new PixelCamera(256, 192);
    camera.resize(640, 480);
    camera.zoomAt(213.25, 177.75, 2.35);
    camera.panBy(17.4, -9.6);
    const before = visibleCenter(camera, 640, 480);
    camera.resize(391, 844);
    const after = visibleCenter(camera, 391, 844);
    expect(after.x).toBeCloseTo(before.x, 12);
    expect(after.y).toBeCloseTo(before.y, 12);
  });
});
