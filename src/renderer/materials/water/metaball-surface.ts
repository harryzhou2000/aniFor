import { Material } from '../../../shared/materials';

export interface SurfacePoint { readonly x: number; readonly y: number }
export type SurfacePolygon = readonly SurfacePoint[];

const ISO_LEVEL = 0.52;
const KERNEL_FALLOFF = 0.9;

/**
 * Reconstructs a smooth scalar field from cellular water, then clips two
 * triangles per grid square against the iso-level. Physics never sees this.
 */
export function buildWaterSurface(cells: Uint8Array, width: number, height: number): readonly SurfacePolygon[] {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let index = 0; index < cells.length; index++) {
    if (cells[index] !== Material.Water) continue;
    const x = index % width, y = Math.floor(index / width);
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (maxX < 0) return [];

  const stride = width + 1;
  const density = new Float32Array((width + 1) * (height + 1));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (cells[y * width + x] !== Material.Water) continue;
      for (let vy = Math.max(0, y - 1); vy <= Math.min(height, y + 2); vy++) {
        for (let vx = Math.max(0, x - 1); vx <= Math.min(width, x + 2); vx++) {
          const dx = vx - x - 0.5, dy = vy - y - 0.5;
          density[vy * stride + vx] += Math.exp(-(dx * dx + dy * dy) * KERNEL_FALLOFF);
        }
      }
    }
  }

  const polygons: SurfacePolygon[] = [];
  const x0 = Math.max(0, minX - 2), x1 = Math.min(width - 1, maxX + 2);
  const y0 = Math.max(0, minY - 2), y1 = Math.min(height - 1, maxY + 2);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const tl = sample(x, y), tr = sample(x + 1, y);
      const br = sample(x + 1, y + 1), bl = sample(x, y + 1);
      pushClipped(polygons, [tl, tr, br]);
      pushClipped(polygons, [tl, br, bl]);
    }
  }
  return polygons;

  function sample(x: number, y: number): FieldPoint { return { x, y, value: density[y * stride + x] }; }
}

interface FieldPoint extends SurfacePoint { readonly value: number }

function pushClipped(output: SurfacePolygon[], triangle: readonly FieldPoint[]): void {
  const polygon: FieldPoint[] = [];
  for (let index = 0; index < triangle.length; index++) {
    const current = triangle[index];
    const next = triangle[(index + 1) % triangle.length];
    const currentInside = current.value >= ISO_LEVEL;
    const nextInside = next.value >= ISO_LEVEL;
    if (currentInside && nextInside) polygon.push(next);
    else if (currentInside && !nextInside) polygon.push(intersection(current, next));
    else if (!currentInside && nextInside) polygon.push(intersection(current, next), next);
  }
  if (polygon.length >= 3 && polygonArea(polygon) > 0.0001) output.push(polygon);
}

function intersection(a: FieldPoint, b: FieldPoint): FieldPoint {
  const span = b.value - a.value;
  const amount = Math.abs(span) < 1e-8 ? 0.5 : (ISO_LEVEL - a.value) / span;
  return {
    x: a.x + (b.x - a.x) * amount,
    y: a.y + (b.y - a.y) * amount,
    value: ISO_LEVEL,
  };
}

export function polygonArea(points: readonly SurfacePoint[]): number {
  let doubled = 0;
  for (let index = 0; index < points.length; index++) {
    const next = points[(index + 1) % points.length];
    doubled += points[index].x * next.y - next.x * points[index].y;
  }
  return Math.abs(doubled) / 2;
}
