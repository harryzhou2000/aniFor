import { createSandboxController } from "./app";
import { mountSandboxExperience } from "./ui/mount";
import { createHalfOccupiedFixture } from "./simulation/fixture";
import { rasterizeCircle } from "./simulation/raster";
import { worldHash } from "./simulation/hash";
import { applyBase64Result, applyBlobResult, createAutosave, snapshotToBase64, snapshotToBlob } from "./persistence";

const AUTOSAVE_KEY = "anifor.autosave.v1";
const AUTOSAVE_DELAY_MS = 500;

async function start(): Promise<void> {
  const target = document.querySelector<HTMLElement>("#app");
  if (!target) throw new Error("Sandbox mount target #app was not found.");
  let experience: Awaited<ReturnType<typeof mountSandboxExperience>>;
  const autosave = (() => { try { return createAutosave(window.localStorage, AUTOSAVE_KEY); } catch { return null; } })();
  let saveTimer: number | null = null;
  let app: ReturnType<typeof createSandboxController>;
  let restoredSnapshot: ReturnType<typeof app.snapshot> | null = null;
  let unsupportedAutosave = false;
  const scheduleAutosave = (): void => {
    if (!autosave || unsupportedAutosave || saveTimer !== null) return;
    saveTimer = window.setTimeout(() => { saveTimer = null; autosave.save(app.snapshot()); }, AUTOSAVE_DELAY_MS);
  };
  app = createSandboxController({ onRender: (view) => {
    experience?.render(view.simulation);
    // The timer coalesces frequent physics renders into at most one save per debounce window.
    scheduleAutosave();
  }, onAdvance: scheduleAutosave });
  let restoredAutosave = false;
  const autosaveResult = autosave?.loadResult();
  const autosaveUnavailable = autosaveResult && !autosaveResult.ok && autosaveResult.error.message === "Autosave storage is unavailable";
  if (autosaveResult && !autosaveResult.ok) {
    if (autosaveResult.error.kind === "corrupt" && !autosaveUnavailable) autosave?.load();
    if (autosaveResult.error.kind === "unsupported-version") unsupportedAutosave = true;
  }
  const saved = autosaveResult?.ok ? autosaveResult.value : null;
  if (saved) { try { app.restore(saved); restoredSnapshot = saved; restoredAutosave = true; } catch { /* validated autosave is ignored if the runtime rejects it */ } }
  const syncRecovery = (): void => { experience?.setRecoveryAvailable(app.canRecover); };
  const onAppIntent = (intent: Parameters<typeof app.dispatch>[0]): void => {
    app.dispatch(intent);
    syncRecovery();
    if (intent.type === "clear") {
      // Clear is an explicit resolution for a save we could not read.
      if (unsupportedAutosave) { unsupportedAutosave = false; autosave?.clear(); }
      scheduleAutosave();
    } else if (intent.type === "pause" && intent.paused) scheduleAutosave();
  };
  const onRecover = (): void => {
    if (app.recover()) {
      experience?.setRecoveryAvailable(false);
      experience?.setStatus("Recovered the garden.");
      scheduleAutosave();
    } else {
      experience?.setStatus("No recovery is available.");
    }
  };
  const onExportFile = (): void => {
    const url = URL.createObjectURL(snapshotToBlob(app.snapshot()));
    const link = document.createElement("a");
    link.href = url; link.download = "anifor-save.anif"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    experience?.setStatus("Save file exported.");
  };
  const onImportFile = async (file: File): Promise<void> => {
    const result = await applyBlobResult(app, file);
    if (result.ok) {
      unsupportedAutosave = false;
      autosave?.clear();
      syncRecovery(); scheduleAutosave(); experience?.setStatus("Save file imported.");
    } else if (result.error.kind === "unsupported-version") experience?.setStatus("Could not import that save file: newer/unsupported save version.");
    else if (result.error.kind === "corrupt") experience?.setStatus("Could not import that save file: corrupt save.");
    else experience?.setStatus("Could not import that save file: invalid save.");
  };
  const onExportText = (): void => { experience?.setSaveText(snapshotToBase64(app.snapshot())); };
  const onImportText = (text: string): void => {
    const result = applyBase64Result(app, text);
    if (result.ok) {
      unsupportedAutosave = false;
      autosave?.clear();
      syncRecovery(); scheduleAutosave(); experience?.setStatus("Save code imported.");
    } else if (result.error.kind === "unsupported-version") experience?.setStatus("Could not import that save code: newer/unsupported save version.");
    else if (result.error.kind === "corrupt") experience?.setStatus("Could not import that save code: corrupt save.");
    else experience?.setStatus("Could not import that save code: invalid save.");
  };
  experience = await mountSandboxExperience({
    target,
    onAppIntent,
    onPaint: app.paint,
    onStep: app.step,
    onRecover, onExportFile, onImportFile, onExportText, onImportText
  });
  experience.setPaused(app.paused);
  experience.setRecoveryAvailable(app.canRecover);
  experience.render(app.view().simulation);
  app.scheduler.start();
  if (autosaveUnavailable) experience.setStatus("Autosave is unavailable; continuing without persistence.");
  else if (unsupportedAutosave) experience.setStatus("Autosave version is newer/unsupported; the stored save was retained and not loaded.");
  else if (restoredAutosave) experience.setStatus("Autosave restored.");
  (window as Window & { __ANIFOR_TEST__?: unknown }).__ANIFOR_TEST__ = {
    diagnostics: () => app.scheduler.diagnostics,
    camera: () => experience.renderer?.camera.transform ?? null,
    screenToCell: (x: number, y: number) => experience.renderer?.camera.screenToCell(x, y) ?? null,
    geometry: () => {
      const rect = (selector: string) => {
        const element = target.querySelector<HTMLElement>(selector);
        if (!element) return null;
        const value = element.getBoundingClientRect();
        return { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom };
      };
      const canvas = target.querySelector<HTMLCanvasElement>(".sandbox-canvas");
      const canvasStyle = canvas ? getComputedStyle(canvas) : null;
      const camera = experience.renderer?.camera;
      return {
        stage: rect(".sandbox-stage"), bed: rect(".world-bed"), surface: rect(".canvas-surface"),
        canvas: rect(".sandbox-canvas"),
        canvasCss: canvasStyle ? { width: parseFloat(canvasStyle.width), height: parseFloat(canvasStyle.height) } : null,
        canvasLogical: canvas ? { width: canvas.clientWidth, height: canvas.clientHeight } : null,
        canvasBacking: canvas ? { width: canvas.width, height: canvas.height } : null,
        transform: camera?.transform ?? null,
        devicePixelRatio: window.devicePixelRatio
      };
    },
    cssToCell: (x: number, y: number) => experience.renderer?.camera.cssToCell(x, y) ?? null,
    cellToCssCenter: (x: number, y: number) => experience.renderer?.camera.cellToCssCenter(x, y) ?? null,
    rasterizeCircle: (x: number, y: number, radius: number) => rasterizeCircle(x, y, radius, 256, 192),
    state: (x = 0, y = 0) => {
      const view = app.view().simulation;
      const material = view.material[y * view.width + x];
      const snapshot = app.snapshot();
      return { tick: view.tick, randomState: snapshot.world.randomState, temperature: view.temperature[y * view.width + x], material, occupied: view.material.reduce((count, value) => count + (value === 0 ? 0 : 1), 0), nextSequence: snapshot.nextSequence };
    },
    autosave: (x = 0, y = 0) => {
      const snapshot = autosave?.load();
      return snapshot ? { tick: snapshot.world.tick, randomState: snapshot.world.randomState, temperature: snapshot.world.temperature[y * snapshot.world.width + x] } : null;
    },
    restored: (x = 0, y = 0) => restoredSnapshot ? { tick: restoredSnapshot.world.tick, randomState: restoredSnapshot.world.randomState, temperature: restoredSnapshot.world.temperature[y * restoredSnapshot.world.width + x] } : null,
    snapshotHash: (): string => worldHash(app.snapshot().world),
    renderCurrent: (repetitions = 1): void => {
      const view = app.view().simulation;
      for (let index = 0; index < Math.max(0, Math.floor(repetitions)); index += 1) experience.render(view);
    },
    benchmark: (): { p95: number; max: number } => {
      const simulation = createHalfOccupiedFixture(0x6d2b79f5);
      for (let index = 0; index < 60; index += 1) simulation.advanceTick();
      const durations: number[] = [];
      for (let index = 0; index < 300; index += 1) {
        const started = performance.now();
        simulation.advanceTick();
        durations.push(performance.now() - started);
      }
      const sorted = durations.slice().sort((a, b) => a - b);
      return { p95: sorted[Math.ceil(sorted.length * 0.95) - 1], max: Math.max(...durations) };
    },
    rendererBenchmark: (): { p95: number; max: number; samples: number } => {
      const view = createHalfOccupiedFixture(0x6d2b79f5).view();
      const durations: number[] = [];
      for (let index = 0; index < 10; index += 1) experience.render(view);
      for (let index = 0; index < 120; index += 1) {
        const started = performance.now();
        experience.render(view);
        durations.push(performance.now() - started);
      }
      const sorted = durations.slice().sort((a, b) => a - b);
      return { p95: sorted[Math.ceil(sorted.length * 0.95) - 1], max: Math.max(...durations), samples: durations.length };
    },
    normalSchedule: (): { catchUpCapHits: number; droppedTicks: number } => {
      const callbacks: Array<(time: number) => void> = [];
      const testApp = createSandboxController({
        scheduler: {
          requestFrame: (callback) => { callbacks.push(callback); return callbacks.length - 1; },
          cancelFrame: () => {}, isHidden: () => false
        }
      });
      testApp.scheduler.start();
      for (let frame = 0; frame <= 600; frame += 1) callbacks.shift()?.(frame * (1000 / 60));
      const result = { catchUpCapHits: testApp.scheduler.diagnostics.catchUpCapHits, droppedTicks: testApp.scheduler.diagnostics.droppedTicks };
      testApp.dispose();
      return result;
    }
  };
  window.addEventListener("beforeunload", () => { if (saveTimer !== null) window.clearTimeout(saveTimer); app.dispose(); experience.destroy(); }, { once: true });
}

start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup failure.";
  const status = document.querySelector<HTMLElement>("#status");
  if (status) status.textContent = `Sandbox failed to start: ${message}`;
  else document.body.textContent = `Sandbox failed to start: ${message}`;
});
