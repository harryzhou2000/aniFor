import { describe, expect, it } from 'vitest';
import { powderSupport, powderVolumeGeometry } from './powder-volume';

describe('solid powder piles', () => {
  it('merges a dense pile while keeping a sparse falling stream as grains', () => {
    const width = 12, height = 12, cells = new Uint8Array(width * height);
    for (let y = 4; y < 12; y++) for (let x = 0; x < 7; x++) cells[y * width + x] = 1;
    for (let y = 0; y < 12; y++) cells[y * width + 10] = 1;
    const native = cells.slice();
    const result = powderSupport(cells, width, height);
    expect(result.denseCount).toBe(56);
    expect(result.loose).toHaveLength(12);
    expect(cells).toEqual(native);
  });

  it('closes a tiny air pore but preserves foreign materials and larger holes', () => {
    const width = 12, height = 12, cells = new Uint8Array(width * height).fill(1);
    cells[width + 1] = 0;
    cells[width + 8] = 2;
    for (let y = 4; y < 8; y++) for (let x = 4; x < 8; x++) cells[y * width + x] = 0;
    const result = powderSupport(cells, width, height);
    expect(result.dense[width + 1]).toBe(1);
    expect(result.dense[width + 8]).toBe(0);
    expect(result.dense[5 * width + 5]).toBe(0);
  });

  it('builds closed front, back and hole surfaces with a broad volumetric base', () => {
    const width = 20, height = 20, support = new Uint8Array(width * height).fill(1);
    for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) support[y * width + x] = 0;
    const geometry = powderVolumeGeometry(support, width, height, 0, 0);
    const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
    const index = geometry.index!;
    const edges = new Map<string, { count: number; orientation: number }>();
    for (let i = 0; i < index.count; i += 3) for (let j = 0; j < 3; j++) {
      const a = index.getX(i + j), b = index.getX(i + (j + 1) % 3);
      const key = `${Math.min(a, b)}:${Math.max(a, b)}`, edge = edges.get(key) ?? {count: 0, orientation: 0};
      edge.count++; edge.orientation += a < b ? 1 : -1; edges.set(key, edge);
    }
    expect([...edges.values()].every(edge => edge.count === 2 && edge.orientation === 0)).toBe(true);
    let baseDepth = 0, topDepth = 0;
    for (let i = 0; i < position.count; i++) {
      expect(Number.isFinite(normal.getX(i) + normal.getY(i) + normal.getZ(i))).toBe(true);
      if (position.getY(i) === -height) baseDepth = Math.max(baseDepth, position.getZ(i));
      if (position.getY(i) === 0) topDepth = Math.max(topDepth, position.getZ(i));
    }
    expect(baseDepth).toBeGreaterThan(15);
    expect(topDepth).toBeLessThan(1);
    geometry.dispose();
  });
});
