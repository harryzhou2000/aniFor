import type { GridPoint } from "./contracts";

export function rasterizeCircle(cx: number, cy: number, radius: number, width: number, height: number): GridPoint[] {
  const result: GridPoint[] = [];
  const r = Math.max(0, Math.floor(radius));
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r && x >= 0 && y >= 0 && x < width && y < height) result.push({ x, y });
  }
  return result;
}

export function rasterizeSegment(a: GridPoint, b: GridPoint): GridPoint[] {
  const result: GridPoint[] = [];
  let x = a.x, y = a.y;
  const dx = Math.abs(b.x - a.x), sx = a.x < b.x ? 1 : -1;
  const dy = -Math.abs(b.y - a.y), sy = a.y < b.y ? 1 : -1;
  let error = dx + dy;
  while (true) {
    result.push({ x, y });
    if (x === b.x && y === b.y) break;
    const twice = 2 * error;
    if (twice >= dy) { error += dy; x += sx; }
    if (twice <= dx) { error += dx; y += sy; }
  }
  return result;
}
