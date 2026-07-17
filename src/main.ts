import { createSandboxController } from "./app";
import { mountSandboxExperience } from "./ui/mount";
import { createHalfOccupiedFixture } from "./simulation/fixture";
import { applyBase64, applyBlob, createAutosave, snapshotToBase64, snapshotToBlob } from "./persistence";

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
  const scheduleAutosave = (): void => {
    if (!autosave || saveTimer !== null) return;
    saveTimer = window.setTimeout(() => { saveTimer = null; autosave.save(app.snapshot()); }, AUTOSAVE_DELAY_MS);
  };
  app = createSandboxController({ onRender: (view) => {
    experience?.render(view.simulation);
    // The timer coalesces frequent physics renders into at most one save per debounce window.
    scheduleAutosave();
  }, onAdvance: scheduleAutosave });
  let restoredAutosave = false;
  const saved = autosave?.load();
  if (saved) { try { app.restore(saved); restoredSnapshot = saved; restoredAutosave = true; } catch { /* validated autosave is ignored if the runtime rejects it */ } }
  const syncRecovery = (): void => { experience?.setRecoveryAvailable(app.canRecover); };
  const onAppIntent = (intent: Parameters<typeof app.dispatch>[0]): void => {
    app.dispatch(intent);
    syncRecovery();
    if (intent.type === "clear" || (intent.type === "pause" && intent.paused)) scheduleAutosave();
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
    if (await applyBlob(app, file)) {
      syncRecovery(); scheduleAutosave(); experience?.setStatus("Save file imported.");
    } else experience?.setStatus("Could not import that save file.");
  };
  const onExportText = (): void => { experience?.setSaveText(snapshotToBase64(app.snapshot())); };
  const onImportText = (text: string): void => {
    if (applyBase64(app, text)) {
      syncRecovery(); scheduleAutosave(); experience?.setStatus("Save code imported.");
    } else experience?.setStatus("Could not import that save code.");
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
  if (restoredAutosave) experience.setStatus("Autosave restored.");
  (window as Window & { __ANIFOR_TEST__?: unknown }).__ANIFOR_TEST__ = {
    diagnostics: () => app.scheduler.diagnostics,
    camera: () => experience.renderer?.camera.transform ?? null,
    screenToCell: (x: number, y: number) => experience.renderer?.camera.screenToCell(x, y) ?? null,
    state: (x = 0, y = 0) => {
      const view = app.view().simulation;
      const material = view.material[y * view.width + x];
      return { tick: view.tick, material, occupied: view.material.reduce((count, value) => count + (value === 0 ? 0 : 1), 0), nextSequence: app.snapshot().nextSequence };
    },
    autosave: () => {
      const snapshot = autosave?.load();
      return snapshot ? { tick: snapshot.world.tick, randomState: snapshot.world.randomState } : null;
    },
    restored: () => restoredSnapshot ? { tick: restoredSnapshot.world.tick, randomState: restoredSnapshot.world.randomState } : null,
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
