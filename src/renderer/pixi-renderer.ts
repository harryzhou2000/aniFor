import { Application, BufferImageSource, SCALE_MODES, Sprite, Texture } from "pixi.js";
import type { SimulationView } from "../simulation/contracts";
import { PixelCamera } from "./camera";
import { writeCompositedPixel } from "./material-compositor";

export type RendererState = "ready" | "unsupported" | "error";

export interface SandboxRenderer {
  readonly camera: PixelCamera;
  readonly state: RendererState;
  render(view: SimulationView): void;
  resize(): void;
  syncCamera(): void;
  contentRect(): DOMRectReadOnly;
  destroy(): void;
}

export interface RendererMountOptions {
  readonly surface: HTMLElement;
  readonly onStateChange?: (state: RendererState, message?: string) => void;
}

/** WebGL-only, full-buffer Pixi renderer. It never writes to SimulationView arrays. */
export async function mountPixiRenderer(options: RendererMountOptions): Promise<SandboxRenderer | null> {
  if (!supportsWebGl()) {
    options.onStateChange?.("unsupported", "WebGL is required to draw the sandbox.");
    return null;
  }

  try {
    const app = new Application();
    await app.init({
      preference: "webgl",
      antialias: false,
      background: "#141c28",
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2)
    });
    app.canvas.className = "sandbox-canvas";
    app.canvas.setAttribute("aria-hidden", "true");
    // Keep shell-owned overlays (startup state and brush preview) above the canvas.
    options.surface.prepend(app.canvas);

    const camera = new PixelCamera();
    const rgba = new Uint8Array(256 * 192 * 4);
    const source = new BufferImageSource({ resource: rgba, width: 256, height: 192 });
    source.scaleMode = SCALE_MODES.NEAREST;
    const texture = new Texture({ source });
    const sprite = new Sprite(texture);
    app.stage.addChild(sprite);

    const syncCamera = (): void => {
      const transform = camera.transform;
      sprite.position.set(transform.x, transform.y);
      sprite.scale.set(transform.scale);
    };
    const contentRect = (): DOMRectReadOnly => options.surface.getBoundingClientRect();
    const syncLayout = (): void => {
      const rect = contentRect();
      // Use the same fractional CSS rect as input and camera geometry. Pixi's
      // resolution controls backing pixels only; these stay logical CSS pixels.
      app.renderer.resize(rect.width, rect.height);
      app.canvas.style.width = `${rect.width}px`;
      app.canvas.style.height = `${rect.height}px`;
      camera.resize(rect.width, rect.height);
      syncCamera();
    };
    const observer = new ResizeObserver(syncLayout);
    observer.observe(options.surface);
    syncLayout();
    options.onStateChange?.("ready");

    return {
      camera,
      state: "ready",
      render(view): void {
        for (let index = 0; index < view.material.length; index += 1) {
          writeCompositedPixel(view, index, rgba);
        }
        // One packed RGBA upload for the borrowed, complete simulation view.
        source.update();
        syncCamera();
      },
      resize: syncLayout,
      syncCamera,
      contentRect,
      destroy(): void {
        observer.disconnect();
        app.destroy(true, { children: true, texture: true });
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The renderer could not start.";
    options.onStateChange?.("error", message);
    return null;
  }
}

function supportsWebGl(): boolean {
  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
}
