import "../styles/sandbox.css";
import { mountInputController } from "../input";
import type { PaintIntent } from "../input";
import { mountPixiRenderer } from "../renderer";
import type { SandboxRenderer } from "../renderer";
import type { AppIntent } from "../app/contracts";
import type { SimulationView } from "../simulation/contracts";
import { mountSandboxShell } from "./shell";

export interface SandboxExperienceOptions {
  readonly target: HTMLElement;
  readonly onAppIntent: (intent: AppIntent) => void;
  readonly onPaint: (intent: PaintIntent) => void;
  readonly onStep?: () => void;
  readonly onRecover?: () => void;
}

export interface SandboxExperience {
  readonly renderer: SandboxRenderer | null;
  render(view: SimulationView): void;
  setPaused(paused: boolean): void;
  setStatus(message: string): void;
  setRecoveryAvailable(available: boolean): void;
  destroy(): void;
}

/** Phase 1D's single visual entry point. It has no simulation, clock, or sequence ownership. */
export async function mountSandboxExperience(options: SandboxExperienceOptions): Promise<SandboxExperience> {
  const shell = mountSandboxShell({
    target: options.target,
    onAppIntent: options.onAppIntent,
    onAction: (action) => { if (action === "step") options.onStep?.(); if (action === "recover") options.onRecover?.(); }
  });
  const renderer = await mountPixiRenderer({
    surface: shell.surface,
    onStateChange: shell.setRendererState
  });
  const input = renderer ? mountInputController({
    surface: shell.surface,
    camera: renderer.camera,
    getTool: shell.getTool,
    getBrushRadius: shell.getBrushRadius,
    onPaint: options.onPaint,
    onCameraChange: renderer.syncCamera,
    getCellScale: () => renderer.camera.cellScale,
    onBrushPreview: shell.setBrushPreview
  }) : null;
  return {
    renderer,
    render(view): void { renderer?.render(view); },
    setPaused: shell.setPaused,
    setStatus: shell.setStatus,
    setRecoveryAvailable: shell.setRecoveryAvailable,
    destroy(): void { input?.destroy(); renderer?.destroy(); shell.destroy(); }
  };
}
