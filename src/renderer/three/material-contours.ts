/** Connected cell boundaries; exact material ownership, including holes and diagonal contacts. */
export interface ContourPoint { x: number; y: number }
export interface MaterialContour { points: ContourPoint[]; area: number }
interface Edge { x: number; y: number; endX: number; endY: number; direction: number; used: boolean }

export function materialContours(
  cells: Uint8Array, width: number, height: number, material: number,
  walls?: Uint8Array,
): MaterialContour[] {
  const edges: Edge[] = [];
  const starts = new Map<number, number[]>();
  const stride = width + 1;
  const occupied = (x: number, y: number): boolean => x >= 0 && x < width && y >= 0 && y < height
    && cells[y * width + x] === material && !walls?.[y * width + x];
  const add = (x: number, y: number, endX: number, endY: number, direction: number): void => {
    const key = y * stride + x;
    const list = starts.get(key) ?? [];
    list.push(edges.length); starts.set(key, list);
    edges.push({x, y, endX, endY, direction, used: false});
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!occupied(x, y)) continue;
    if (!occupied(x, y - 1)) add(x, y, x + 1, y, 0);
    if (!occupied(x + 1, y)) add(x + 1, y, x + 1, y + 1, 1);
    if (!occupied(x, y + 1)) add(x + 1, y + 1, x, y + 1, 2);
    if (!occupied(x - 1, y)) add(x, y + 1, x, y, 3);
  }
  const contours: MaterialContour[] = [];
  for (const first of edges) {
    if (first.used) continue;
    const points: ContourPoint[] = [];
    let edge = first;
    for (;;) {
      edge.used = true;
      points.push({x: edge.x, y: edge.y});
      if (edge.endX === first.x && edge.endY === first.y) break;
      const candidates = (starts.get(edge.endY * stride + edge.endX) ?? [])
        .map(index => edges[index]).filter(candidate => !candidate.used);
      // Turn around the occupied cell at a diagonal contact, keeping islands separate.
      const rank = (candidate: Edge): number => [1, 0, 3, 2][(candidate.direction - edge.direction + 4) % 4];
      candidates.sort((a, b) => rank(a) - rank(b));
      if (!candidates.length) throw new Error('Open material contour');
      edge = candidates[0];
    }
    const simplified = points.filter((point, index) => {
      const before = points[(index + points.length - 1) % points.length];
      const after = points[(index + 1) % points.length];
      return (point.x - before.x) * (after.y - point.y) !== (point.y - before.y) * (after.x - point.x);
    });
    const area = simplified.reduce((sum, point, index) => {
      const next = simplified[(index + 1) % simplified.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2;
    if (simplified.length >= 3) contours.push({points: simplified, area});
  }
  return contours;
}

export function contourContains(points: readonly ContourPoint[], point: ContourPoint): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
