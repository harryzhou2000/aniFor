import { BufferAttribute, BufferGeometry } from 'three';

export interface PowderSupport {
  dense: Uint8Array;
  loose: number[];
  denseCount: number;
}

/** Classify a cropped occupancy grid: 1 = this powder, 2 = another material/wall. */
export function powderSupport(cells: Uint8Array, width: number, height: number): PowderSupport {
  const support = Uint8Array.from(cells, value => Number(value === 1));
  const at = (x: number, y: number): number => x < 0 || y < 0 || x >= width || y >= height ? 0 : support[y * width + x];
  // Close only tiny inter-grain pores. Foreign materials and walls are never
  // swallowed, and the original native fields remain completely untouched.
  for (let pass = 0; pass < 2; pass++) {
    const fill: number[] = [];
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const index = y * width + x;
      if (cells[index] || support[index]) continue;
      let neighbours = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) neighbours += at(x + dx, y + dy);
      if (neighbours >= 5) fill.push(index);
    }
    for (const index of fill) support[index] = 1;
  }
  const visited = new Uint8Array(cells.length), dense = new Uint8Array(cells.length);
  const queue = new Int32Array(cells.length), loose: number[] = [];
  let denseCount = 0;
  for (let start = 0; start < support.length; start++) {
    if (!support[start] || visited[start]) continue;
    let head = 0, tail = 1, hasInterior = false;
    queue[0] = start; visited[start] = 1;
    while (head < tail) {
      const index = queue[head++], x = index % width, y = Math.floor(index / width);
      if (x + 1 < width && y + 1 < height && support[index + 1] && support[index + width] && support[index + width + 1]) hasInterior = true;
      for (const next of [x > 0 ? index - 1 : -1, x + 1 < width ? index + 1 : -1, y > 0 ? index - width : -1, y + 1 < height ? index + width : -1]) {
        if (next >= 0 && support[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; }
      }
    }
    const isBulk = tail >= 12 && hasInterior;
    for (let i = 0; i < tail; i++) {
      const index = queue[i];
      if (isBulk) { dense[index] = 1; denseCount++; }
      else if (cells[index] === 1) loose.push(index);
    }
  }
  return { dense, loose, denseCount };
}

/**
 * A watertight, opaque volume over dense powder support. Depth grows inward
 * from the top and sides, producing a broad base and rounded sloping body.
 * It is a presentation surface; it never changes native particle positions.
 */
export function powderVolumeGeometry(
  support: Uint8Array, width: number, height: number,
  originX: number, originY: number,
): BufferGeometry {
  const clearance = new Float32Array(support.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (support[i]) clearance[i] = 1 + Math.min(x ? clearance[i - 1] : 0, y ? clearance[i - width] : 0);
  }
  for (let y = 0; y < height; y++) for (let x = width - 1; x >= 0; x--) {
    const i = y * width + x;
    if (support[i]) clearance[i] = Math.min(clearance[i], 1 + (x + 1 < width ? clearance[i + 1] : 0));
  }
  // Smooth lattice steps in depth while retaining exact occupied XY support.
  // Bottom boundaries keep their depth, preserving a broad resting footprint.
  const smooth = clearance.slice();
  for (let pass = 0; pass < 8; pass++) {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!support[i]) continue;
      smooth[i] = (clearance[i] * 4 + (x ? clearance[i - 1] : 0)
        + (x + 1 < width ? clearance[i + 1] : 0) + (y ? clearance[i - width] : 0)
        + (y + 1 < height && support[i + width] ? clearance[i + width] : clearance[i])) / 8;
    }
    clearance.set(smooth);
  }
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const vertices = new Int32Array((width + 1) * (height + 1)).fill(-1);
  const occupied = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height && support[y * width + x] !== 0;
  const vertex = (x: number, y: number): number => {
    const key = y * (width + 1) + x;
    if (vertices[key] >= 0) return vertices[key];
    const index = positions.length / 3; vertices[key] = index;
    let distance = 0, count = 0;
    for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
      if (occupied(x + dx, y + dy)) { distance += clearance[(y + dy) * width + x + dx]; count++; }
    }
    // Top and side silhouettes end in a fine lip. A supported bottom retains
    // its full depth so the pile sits on a broad base instead of a sharp ridge.
    const boundary = (!occupied(x - 1, y - 1) && !occupied(x, y - 1))
      || (!occupied(x - 1, y - 1) && !occupied(x - 1, y))
      || (!occupied(x, y - 1) && !occupied(x, y));
    const halfDepth = boundary ? 0.65 : 0.65 + 47.35 * Math.tanh(Math.sqrt(Math.max(0, distance / count - 0.5)) * 7.5 / 47.35);
    const worldX = originX + x, worldY = originY - y;
    for (const z of [halfDepth, -halfDepth]) {
      positions.push(worldX, worldY, z);
      uv.push(worldX / 24, worldY / 24);
    }
    return index;
  };
  const side = (a: number, b: number): void => { indices.push(a, b, a + 1, b, b + 1, a + 1); };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!occupied(x, y)) continue;
    const a = vertex(x, y), b = vertex(x + 1, y), c = vertex(x, y + 1), d = vertex(x + 1, y + 1);
    indices.push(a, c, b, b, c, d, a + 1, b + 1, c + 1, b + 1, d + 1, c + 1);
    if (!occupied(x, y - 1)) side(a, b);
    if (!occupied(x + 1, y)) side(b, d);
    if (!occupied(x, y + 1)) side(d, c);
    if (!occupied(x - 1, y)) side(c, a);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}
