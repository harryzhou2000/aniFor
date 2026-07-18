import { describe, expect, it } from 'vitest';
import { DirtyChunkGrid } from './dirty-chunk-grid';

describe('DirtyChunkGrid', () => {
  it('coalesces adjacent dirty chunks into row runs', () => {
    const chunks = new DirtyChunkGrid(70, 40, 32, 0);
    chunks.markRect(5, 3, 55, 4);
    expect(chunks.consume()).toEqual([{ x: 0, y: 0, width: 64, height: 32 }]);
    expect(chunks.consume()).toEqual([]);
  });

  it('invalidates filter neighbours across a chunk boundary', () => {
    const chunks = new DirtyChunkGrid(64, 64, 32, 2);
    chunks.markCell(31 + 31 * 64);
    expect(chunks.consume()).toEqual([
      { x: 0, y: 0, width: 64, height: 32 },
      { x: 0, y: 32, width: 64, height: 32 },
    ]);
  });

  it('clips partial edge chunks to the field', () => {
    const chunks = new DirtyChunkGrid(70, 40, 32, 0);
    chunks.markAll();
    expect(chunks.consume()).toEqual([
      { x: 0, y: 0, width: 70, height: 32 },
      { x: 0, y: 32, width: 70, height: 8 },
    ]);
  });
});
