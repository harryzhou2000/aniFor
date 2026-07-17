import { describe, expect, it } from "vitest";
import { WORLD_HEIGHT, WORLD_WIDTH, WorldBedGeometry, clampOffset, fitScale } from "../../src/renderer/camera";
import { buildBrushPreview, toBedLocalPoint } from "../../src/input/controller";

describe("WorldBedGeometry", () => {
  it("maps fractional 4:3 CSS beds with exclusive world bounds", () => {
    const camera = new WorldBedGeometry();
    camera.resize(401.5, 301.125);
    expect(camera.cellScale).toBeCloseTo(401.5 / 256, 12);
    expect(camera.cssToCell(0, 0)).toEqual({ x: 0, y: 0 });
    expect(camera.cssToCell(401.5 - .001, 301.125 - .001)).toEqual({ x: 255, y: 191 });
    expect(camera.cssToCell(401.5, 100)).toBeNull();
    expect(camera.cssToCell(100, 301.125)).toBeNull();
    expect(camera.cellToCssCenter(0, 0)).toEqual({ x: camera.cellScale / 2, y: camera.cellScale / 2 });
  });

  it("uses one fractional content rect for local input and camera geometry", () => {
    const rect = { left: 10.25, top: 20.5, width: 401.5, height: 301.125 };
    const local = toBedLocalPoint(10.25 + 401.5 - .01, 20.5 + 301.125 - .01, rect);
    const camera = new WorldBedGeometry(); camera.resize(rect.width, rect.height);
    expect(local.x).toBeCloseTo(401.49, 12); expect(local.y).toBeCloseTo(301.115, 12);
    expect(camera.cssToCell(local.x, local.y)).toEqual({ x: 255, y: 191 });
  });

  it("keeps CSS geometry independent of DPR and clamps fit, pan, and zoom", () => {
    expect(fitScale(512, 384)).toBe(2);
    expect(clampOffset(100, 512, 512)).toBe(0);
    const camera = new WorldBedGeometry(); camera.resize(512, 384);
    camera.panBy(99, -99);
    expect(camera.transform).toMatchObject({ x: 0, y: 0, scale: 2 });
    camera.zoomAt(256, 192, 100);
    expect(camera.cellScale).toBe(16);
    expect(camera.transform.x).toBeLessThanOrEqual(0);
    expect(camera.transform.x).toBeGreaterThanOrEqual(512 - WORLD_WIDTH * 16);
    expect(camera.transform.y).toBeLessThanOrEqual(0);
    expect(camera.transform.y).toBeGreaterThanOrEqual(384 - WORLD_HEIGHT * 16);
  });

  it("uses one atomic pinch transform around the old centroid", () => {
    const camera = new WorldBedGeometry(); camera.resize(512, 384);
    camera.pinch({ oldCenter: { x: 256, y: 192 }, center: { x: 300, y: 200 }, oldDistance: 100, distance: 200 });
    expect(camera.transform).toEqual({ x: -212, y: -184, scale: 4 });
  });

  it("preserves fractional world center on resize", () => {
    const camera = new WorldBedGeometry(); camera.resize(640, 480); camera.zoomAt(213.25, 177.75, 2.35); camera.panBy(17.4, -9.6);
    const before = center(camera, 640, 480); camera.resize(391, 293.25); const after = center(camera, 391, 293.25);
    expect(after.x).toBeCloseTo(before.x, 12); expect(after.y).toBeCloseTo(before.y, 12);
  });
});

describe("exact brush preview", () => {
  it("uses the same clipped circle mask as the brush", () => {
    const camera = new WorldBedGeometry(); camera.resize(256, 192);
    const preview = buildBrushPreview(camera, { x: 0, y: 0 }, 1)!;
    expect(preview.cells).toHaveLength(3);
    expect(preview.cells.map((cell) => [cell.x, cell.y])).toEqual([[0, 0], [1, 0], [0, 1]]);
    expect(buildBrushPreview(camera, null, 3)).toBeNull();
  });
});

function center(camera: WorldBedGeometry, width: number, height: number): { x: number; y: number } {
  const { x, y, scale } = camera.transform;
  return { x: (width / 2 - x) / scale, y: (height / 2 - y) / scale };
}
