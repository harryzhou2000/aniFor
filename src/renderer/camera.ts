import type { GridPoint } from "../simulation/contracts";

export interface CssPoint { readonly x: number; readonly y: number; }
export interface PinchSample { readonly oldCenter: CssPoint; readonly center: CssPoint; readonly oldDistance: number; readonly distance: number; }
export const WORLD_WIDTH = 256;
export const WORLD_HEIGHT = 192;

export function fitScale(width: number, height: number): number { return Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT); }
export function clampOffset(offset: number, span: number, bedSpan: number): number {
  return span <= bedSpan ? (bedSpan - span) / 2 : Math.min(0, Math.max(bedSpan - span, offset));
}

/** The only CSS-space geometry owner for the 256×192 world bed. */
export class WorldBedGeometry {
  private width = 1; private height = 1; private scale = 1; private offsetX = 0; private offsetY = 0; private initialized = false;

  public resize(width: number, height: number): void {
    const center = this.worldAt(this.width / 2, this.height / 2);
    this.width = Math.max(1, width); this.height = Math.max(1, height);
    if (!this.initialized) { this.initialized = true; this.fit(); return; }
    this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale));
    this.offsetX = this.width / 2 - center.x * this.scale;
    this.offsetY = this.height / 2 - center.y * this.scale;
    this.clamp();
  }

  public get minScale(): number { return fitScale(this.width, this.height); }
  public get maxScale(): number { return this.minScale * 8; }
  public get cellScale(): number { return this.scale; }
  public fit(): void { this.scale = this.minScale; this.offsetX = (this.width - WORLD_WIDTH * this.scale) / 2; this.offsetY = (this.height - WORLD_HEIGHT * this.scale) / 2; this.clamp(); }
  public panBy(deltaX: number, deltaY: number): void { this.offsetX += deltaX; this.offsetY += deltaY; this.clamp(); }
  public zoomAt(x: number, y: number, factor: number): void { this.pinch({ oldCenter: { x, y }, center: { x, y }, oldDistance: 1, distance: factor }); }
  public pinch(sample: PinchSample): void {
    const anchor = this.worldAt(sample.oldCenter.x, sample.oldCenter.y);
    const zoom = sample.oldDistance > 0 ? sample.distance / sample.oldDistance : 1;
    this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * zoom));
    this.offsetX = sample.center.x - anchor.x * this.scale;
    this.offsetY = sample.center.y - anchor.y * this.scale;
    this.clamp();
  }
  public cssToCell(x: number, y: number): GridPoint | null {
    if (x < this.offsetX || y < this.offsetY || x >= this.offsetX + WORLD_WIDTH * this.scale || y >= this.offsetY + WORLD_HEIGHT * this.scale) return null;
    return { x: Math.floor((x - this.offsetX) / this.scale), y: Math.floor((y - this.offsetY) / this.scale) };
  }
  public screenToCell(x: number, y: number): GridPoint | null { return this.cssToCell(x, y); }
  public cellToCssCenter(x: number, y: number): CssPoint | null {
    if (x < 0 || y < 0 || x >= WORLD_WIDTH || y >= WORLD_HEIGHT) return null;
    return { x: this.offsetX + (x + .5) * this.scale, y: this.offsetY + (y + .5) * this.scale };
  }
  public get transform(): Readonly<{ x: number; y: number; scale: number }> { return { x: this.offsetX, y: this.offsetY, scale: this.scale }; }
  private worldAt(x: number, y: number): CssPoint { return { x: (x - this.offsetX) / this.scale, y: (y - this.offsetY) / this.scale }; }
  private clamp(): void { this.offsetX = clampOffset(this.offsetX, WORLD_WIDTH * this.scale, this.width); this.offsetY = clampOffset(this.offsetY, WORLD_HEIGHT * this.scale, this.height); }
}
export { WorldBedGeometry as PixelCamera };
