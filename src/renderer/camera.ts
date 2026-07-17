import type { Camera } from "../app/contracts";
import type { GridPoint } from "../simulation/contracts";

/** A deliberately small camera: all coordinates passed to it are local to the canvas. */
export class PixelCamera implements Camera {
  private viewportWidth = 1;
  private viewportHeight = 1;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  public constructor(
    private readonly worldWidth: number,
    private readonly worldHeight: number
  ) {}

  public resize(width: number, height: number): void {
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);
    this.fit();
  }

  public fit(): void {
    const nextScale = Math.max(1, Math.floor(Math.min(
      this.viewportWidth / this.worldWidth,
      this.viewportHeight / this.worldHeight
    )));
    this.scale = nextScale;
    this.offsetX = (this.viewportWidth - this.worldWidth * nextScale) / 2;
    this.offsetY = (this.viewportHeight - this.worldHeight * nextScale) / 2;
  }

  public screenToCell(screenX: number, screenY: number): GridPoint {
    return {
      x: Math.floor((screenX - this.offsetX) / this.scale),
      y: Math.floor((screenY - this.offsetY) / this.scale)
    };
  }

  public zoomAt(screenX: number, screenY: number, factor: number): void {
    const cellX = (screenX - this.offsetX) / this.scale;
    const cellY = (screenY - this.offsetY) / this.scale;
    this.scale = Math.min(32, Math.max(0.5, this.scale * factor));
    this.offsetX = screenX - cellX * this.scale;
    this.offsetY = screenY - cellY * this.scale;
  }

  public panBy(deltaX: number, deltaY: number): void {
    this.offsetX += deltaX;
    this.offsetY += deltaY;
  }

  public get transform(): Readonly<{ x: number; y: number; scale: number }> {
    return { x: this.offsetX, y: this.offsetY, scale: this.scale };
  }
}
