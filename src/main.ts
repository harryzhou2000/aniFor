import { createSandboxController } from "./app";
import { mountSandboxExperience } from "./ui/mount";
import { createHalfOccupiedFixture } from "./simulation/fixture";

async function start(): Promise<void> {
  const target = document.querySelector<HTMLElement>("#app");
  if (!target) throw new Error("Sandbox mount target #app was not found.");
  let experience: Awaited<ReturnType<typeof mountSandboxExperience>>;
  const app = createSandboxController({ onRender: (view) => experience?.render(view.simulation) });
  const syncRecovery = (): void => { experience?.setRecoveryAvailable(app.canRecover); };
  const onAppIntent = (intent: Parameters<typeof app.dispatch>[0]): void => {
    app.dispatch(intent);
    syncRecovery();
  };
  const onRecover = (): void => {
    if (app.recover()) {
      experience?.setRecoveryAvailable(false);
      experience?.setStatus("Recovered the garden.");
    } else {
      experience?.setStatus("No recovery is available.");
    }
  };
  experience = await mountSandboxExperience({
    target,
    onAppIntent,
    onPaint: app.paint,
    onStep: app.step,
    onRecover
  });
  experience.setPaused(app.paused);
  experience.setRecoveryAvailable(app.canRecover);
  experience.render(app.view().simulation);
  app.scheduler.start();
  (window as Window & { __ANIFOR_TEST__?: unknown }).__ANIFOR_TEST__ = {
    diagnostics: () => app.scheduler.diagnostics,
    camera: () => experience.renderer?.camera.transform ?? null,
    screenToCell: (x: number, y: number) => experience.renderer?.camera.screenToCell(x, y) ?? null,
    state: (x = 0, y = 0) => {
      const view = app.view().simulation;
      const material = view.material[y * view.width + x];
      return { tick: view.tick, material, occupied: view.material.reduce((count, value) => count + (value === 0 ? 0 : 1), 0), nextSequence: app.snapshot().nextSequence };
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
  window.addEventListener("beforeunload", () => { app.dispose(); experience.destroy(); }, { once: true });
}

start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup failure.";
  const status = document.querySelector<HTMLElement>("#status");
  if (status) status.textContent = `Sandbox failed to start: ${message}`;
  else document.body.textContent = `Sandbox failed to start: ${message}`;
});
