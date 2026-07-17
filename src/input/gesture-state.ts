export interface ScreenPoint { readonly x: number; readonly y: number; }
export interface GestureDelta { readonly oldCenter: ScreenPoint; readonly center: ScreenPoint; readonly oldDistance: number; readonly distance: number; }
export type PointerMode = "idle" | "paint" | "gesture";

/** DOM-free pointer ownership state: a gesture cannot return to painting mid-contact. */
export class PointerGestureState {
  private readonly pointers = new Map<number, ScreenPoint>();
  private mode: PointerMode = "idle";
  private centroid: ScreenPoint | null = null;
  private distance = 0;

  public begin(id: number, point: ScreenPoint): "paint" | "cancel-paint" | "none" {
    this.pointers.set(id, point);
    if (this.pointers.size === 1 && this.mode === "idle") { this.mode = "paint"; return "paint"; }
    if (this.pointers.size === 2 && this.mode !== "gesture") { this.mode = "gesture"; this.rebase(); return "cancel-paint"; }
    if (this.mode === "gesture") this.rebase();
    return "none";
  }

  public move(id: number, point: ScreenPoint): "paint" | GestureDelta | null {
    if (!this.pointers.has(id)) return null;
    this.pointers.set(id, point);
    if (this.mode === "paint") return "paint";
    if (this.mode !== "gesture" || this.pointers.size < 2) return null;
    const [a, b] = this.pair();
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    const previous = this.centroid; const oldDistance = this.distance;
    this.centroid = center; this.distance = distance;
    return previous ? { oldCenter: previous, center, oldDistance, distance } : null;
  }

  public end(id: number): void {
    this.pointers.delete(id);
    if (this.pointers.size === 0) { this.mode = "idle"; this.centroid = null; this.distance = 0; return; }
    if (this.mode === "gesture") this.rebase();
  }

  public cancel(): number[];
  public cancel(id: number): void;
  public cancel(id?: number): number[] | void {
    if (id !== undefined) { this.end(id); return; }
    const ids = [...this.pointers.keys()];
    this.pointers.clear(); this.mode = "idle"; this.centroid = null; this.distance = 0;
    return ids;
  }

  public get currentMode(): PointerMode { return this.mode; }

  private rebase(): void {
    if (this.pointers.size < 2) { this.centroid = null; this.distance = 0; return; }
    const [a, b] = this.pair();
    this.centroid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.distance = Math.hypot(b.x - a.x, b.y - a.y);
  }

  private pair(): [ScreenPoint, ScreenPoint] { return [...this.pointers.values()].slice(0, 2) as [ScreenPoint, ScreenPoint]; }
}
