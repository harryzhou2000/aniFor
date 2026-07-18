export interface FieldRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Allocation-light invalidation for field renderers. A small halo makes each
 * changed sample invalidate neighbouring chunks whose filters read that cell.
 */
export class DirtyChunkGrid {
  private readonly columns: number;
  private readonly rows: number;
  private readonly dirty: Uint8Array;

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly chunkSize = 32,
    private readonly halo = 2,
  ) {
    if (width <= 0 || height <= 0 || chunkSize <= 0 || halo < 0) throw new Error('Invalid chunk grid dimensions');
    this.columns = Math.ceil(width / chunkSize);
    this.rows = Math.ceil(height / chunkSize);
    this.dirty = new Uint8Array(this.columns * this.rows);
  }

  markCell(index: number): void {
    if (index < 0 || index >= this.width * this.height) return;
    const x = index % this.width;
    const y = Math.floor(index / this.width);
    this.markRect(x, y, 1, 1);
  }

  markRect(x: number, y: number, width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    const left = Math.max(0, x - this.halo);
    const top = Math.max(0, y - this.halo);
    const right = Math.min(this.width - 1, x + width - 1 + this.halo);
    const bottom = Math.min(this.height - 1, y + height - 1 + this.halo);
    if (right < left || bottom < top) return;
    const firstColumn = Math.floor(left / this.chunkSize);
    const lastColumn = Math.floor(right / this.chunkSize);
    const firstRow = Math.floor(top / this.chunkSize);
    const lastRow = Math.floor(bottom / this.chunkSize);
    for (let row = firstRow; row <= lastRow; row++) {
      this.dirty.fill(1, row * this.columns + firstColumn, row * this.columns + lastColumn + 1);
    }
  }

  markAll(): void { this.dirty.fill(1); }

  /** Returns row-coalesced chunk rectangles and clears the invalidation set. */
  consume(): readonly FieldRect[] {
    const rectangles: FieldRect[] = [];
    for (let row = 0; row < this.rows; row++) {
      let column = 0;
      while (column < this.columns) {
        const offset = row * this.columns + column;
        if (!this.dirty[offset]) { column++; continue; }
        const first = column;
        while (column < this.columns && this.dirty[row * this.columns + column]) {
          this.dirty[row * this.columns + column] = 0;
          column++;
        }
        const x = first * this.chunkSize;
        const y = row * this.chunkSize;
        rectangles.push({
          x,
          y,
          width: Math.min(this.width, column * this.chunkSize) - x,
          height: Math.min(this.chunkSize, this.height - y),
        });
      }
    }
    return rectangles;
  }
}
