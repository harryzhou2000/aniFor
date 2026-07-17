import { test, expect } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";

if (typeof process === "undefined" || !process.env.VITEST) test.describe("sandbox walking skeleton", () => {
  test("starts ready and exposes the walking-skeleton controls", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Powder garden" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pause simulation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Advance one step" })).toBeVisible();
  });

  test("supports pause, step, clear, and mobile layout", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator(".sandbox-canvas")).toBeVisible();
    await page.getByRole("button", { name: "Pause simulation" }).click();
    await expect(page.getByRole("button", { name: "Play simulation" })).toBeVisible();
    await page.getByRole("button", { name: "Advance one step" }).click();
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByRole("button", { name: "Play simulation" })).toBeVisible();
  });

  test("paints, steps, and clears observable world state", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.getByRole("button", { name: "Pause simulation" }).click();
    const before = await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied);
    const paintSurface = page.locator(".canvas-surface");
    const paintBounds = await paintSurface.boundingBox();
    expect(paintBounds).toBeTruthy();
    await paintSurface.click({ position: { x: paintBounds!.width / 2, y: paintBounds!.height / 2 } });
    const after = await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied);
    expect(after).toBeGreaterThan(before);
    await page.getByRole("button", { name: "Advance one step" }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__ANIFOR_TEST__.state().tick)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Clear" }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied)).toBe(0);
  });

  test("round-trips a save code through the visible persistence panel", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Pause simulation" }).click();
    await page.locator(".canvas-surface").click({ position: { x: 620, y: 320 } });
    const painted = await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied);
    await page.locator('[data-action="persistence"]').click();
    await page.locator('[data-action="export-text"]').click();
    const code = await page.locator("#save-code").inputValue();
    expect(code.length).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Clear" }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied)).toBe(0);
    await page.locator("#save-code").fill(code);
    await page.locator('[data-action="import-text"]').click();
    await expect.poll(() => page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied)).toBe(painted);
  });

  test("round-trips a downloaded file through the native file input", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Pause simulation" }).click();
    await page.locator(".canvas-surface").click({ position: { x: 620, y: 320 } });
    const painted = await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied);
    await page.locator('[data-action="persistence"]').click();
    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-action="export-file"]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("anifor-save.anif");
    await page.getByRole("button", { name: "Clear" }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied)).toBe(0);
    await page.locator("[data-save-file]").setInputFiles(await download.path());
    await expect.poll(() => page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied)).toBe(painted);
  });

  test("restores autosave on reload and removes corrupt entries", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Pause simulation" }).click();
    await page.locator(".canvas-surface").click({ position: { x: 620, y: 320 } });
    const painted = await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied);
    await page.waitForTimeout(700);
    await page.reload();
    await expect.poll(() => page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied)).toBe(painted);
    await page.evaluate(() => localStorage.setItem("anifor.autosave.v1", "corrupt"));
    await page.reload();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("anifor.autosave.v1"))).not.toBe("corrupt");
  });

  test("autosaves a running paint without pause or lifecycle action", async ({ page }) => {
    await page.goto("/");
    const surface = page.locator(".canvas-surface");
    const bounds = await surface.boundingBox();
    expect(bounds).toBeTruthy();
    await surface.click({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } });
    await expect.poll(() => page.evaluate(() => (window as any).__ANIFOR_TEST__.state().nextSequence)).toBe(1);
    await page.waitForTimeout(700);
    await page.reload();
    await expect.poll(() => page.evaluate(() => (window as any).__ANIFOR_TEST__.state().nextSequence)).toBe(1);
    expect(await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied)).toBeGreaterThan(0);
  });

  test("autosaves an unchanged running world and restores its authoritative timeline", async ({ page }) => {
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => (window as any).__ANIFOR_TEST__.state().tick)).toBeGreaterThan(0);
    await page.waitForTimeout(700);
    const saved = await page.evaluate(() => (window as any).__ANIFOR_TEST__.autosave());
    expect(saved).toBeTruthy();
    expect(saved.tick).toBeGreaterThan(0);
    const current = await page.evaluate(() => (window as any).__ANIFOR_TEST__.state());
    expect(current.tick).toBeGreaterThan(saved.tick);
    await page.reload();
    await expect.poll(() => page.evaluate(() => (window as any).__ANIFOR_TEST__.restored())).toEqual(saved);
  });

  test("failed text and file imports leave the world intact", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Pause simulation" }).click();
    await page.locator(".canvas-surface").click({ position: { x: 620, y: 320 } });
    const painted = await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied);
    await page.locator('[data-action="persistence"]').click();
    await page.locator("#save-code").fill("not a save");
    await page.locator('[data-action="import-text"]').click();
    await expect(page.locator(".status")).toContainText("Could not import");
    expect(await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied)).toBe(painted);
    await page.locator("[data-save-file]").setInputFiles({ name: "bad.anif", mimeType: "application/octet-stream", buffer: Buffer.from([1, 2, 3]) });
    await expect(page.locator(".status")).toContainText("Could not import");
    expect(await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied)).toBe(painted);
  });

  test("native mouse drag paints the deterministic intermediate cell", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".sandbox-canvas")).toBeVisible();
    await page.getByRole("button", { name: "Pause simulation" }).click();
    const surface = page.locator(".canvas-surface");
    const bounds = await surface.boundingBox();
    expect(bounds).toBeTruthy();
    const start = { x: 300, y: bounds!.height / 2 };
    const end = { x: Math.min(bounds!.width - 80, 760), y: bounds!.height / 2 };
    const midpoint = await page.evaluate(({ x, y, width, height }) => {
      const map = (window as any).__ANIFOR_TEST__.screenToCell;
      return map(width / 2 + x - width / 2, y) ?? map(x, y);
    }, { x: (start.x + end.x) / 2, y: start.y, width: bounds!.width, height: bounds!.height });
    await page.mouse.move(bounds!.x + start.x, bounds!.y + start.y);
    await page.mouse.down();
    await page.mouse.move(bounds!.x + end.x, bounds!.y + end.y, { steps: 12 });
    await page.mouse.up();
    expect(midpoint).toBeTruthy();
    expect(await page.evaluate(({ x, y }) => (window as any).__ANIFOR_TEST__.state(x, y).material, midpoint)).not.toBe(0);
  });

  test("native stroke cancellation stops subsequent painting", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".sandbox-canvas")).toBeVisible();
    const surface = page.locator(".canvas-surface");
    const bounds = await surface.boundingBox();
    expect(bounds).toBeTruthy();
    await page.mouse.move(bounds!.x + 180, bounds!.y + 180);
    await page.mouse.down();
    const afterDown = await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().nextSequence);
    await page.keyboard.press("Escape");
    await page.mouse.move(bounds!.x + 420, bounds!.y + 180, { steps: 5 });
    expect(await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().nextSequence)).toBe(afterDown);
    await page.mouse.up();
  });

  test("selects tools, shows the brush preview, and recovers a clear", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".sandbox-canvas")).toBeVisible();
    await page.getByRole("button", { name: "Pause simulation" }).click();
    await page.getByRole("button", { name: "Water" }).click();
    await expect(page.getByRole("button", { name: "Water" })).toHaveAttribute("aria-pressed", "true");
    const surface = page.locator(".canvas-surface");
    const preview = page.locator(".brush-preview");
    await expect(preview).toHaveCount(1);
    const bounds = await surface.boundingBox();
    expect(bounds).toBeTruthy();
    const x = bounds!.x + bounds!.width / 2;
    const y = bounds!.y + bounds!.height / 2;
    await surface.dispatchEvent("pointerdown", { pointerId: 3, pointerType: "mouse", clientX: x, clientY: y, buttons: 1 });
    await expect(preview).toHaveClass(/is-visible/);
    await surface.dispatchEvent("pointerup", { pointerId: 3, pointerType: "mouse", clientX: x, clientY: y });
    const painted = await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied);
    expect(painted).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByRole("button", { name: "Recover" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied)).toBe(0);
    await page.getByRole("button", { name: "Recover" }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied)).toBe(painted);
    await expect(page.getByRole("button", { name: "Recover" })).toBeHidden();
  });

  test("does not paint on the second pointer or cancelled gesture", async ({ page }) => {
    await page.goto("/");
    const surface = page.locator(".canvas-surface");
    await surface.dispatchEvent("pointerdown", { pointerId: 11, pointerType: "touch", clientX: 100, clientY: 100, buttons: 1 });
    const afterFirst = await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().nextSequence);
    await surface.dispatchEvent("pointerdown", { pointerId: 12, pointerType: "touch", clientX: 130, clientY: 100, buttons: 1 });
    await surface.dispatchEvent("pointermove", { pointerId: 11, pointerType: "touch", clientX: 90, clientY: 100, buttons: 1 });
    await surface.dispatchEvent("pointercancel", { pointerId: 11, pointerType: "touch" });
    await surface.dispatchEvent("pointercancel", { pointerId: 12, pointerType: "touch" });
    expect(await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().nextSequence)).toBe(afterFirst);
  });

  test("Chrome CDP touch pinch changes camera without replay painting", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 }, hasTouch: true });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator(".sandbox-canvas")).toBeVisible();
    const surface = page.locator(".canvas-surface");
    const bounds = await surface.boundingBox();
    expect(bounds).toBeTruthy();
    const client = await context.newCDPSession(page);
    const point = (x: number, y: number, id: number) => ({ x: bounds!.x + x, y: bounds!.y + y, id, radiusX: 1, radiusY: 1, force: 1 });
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(250, 220, 1)] });
    const afterFirst = await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().nextSequence);
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(250, 220, 1), point(350, 220, 2)] });
    const before = await page.evaluate(() => ({ camera: (window as any).__ANIFOR_TEST__.camera(), sequence: (window as any).__ANIFOR_TEST__.state().nextSequence }));
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point(220, 220, 1), point(380, 220, 2)] });
    const after = await page.evaluate(() => ({ camera: (window as any).__ANIFOR_TEST__.camera(), sequence: (window as any).__ANIFOR_TEST__.state().nextSequence }));
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    expect(after.sequence).toBe(afterFirst);
    expect(after.camera).not.toEqual(before.camera);
    await context.close();
  });

  test("preserves the shell under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator(".sandbox-shell")).toBeVisible();
    await expect(page.locator(".canvas-surface")).toBeVisible();
    const duration = await page.locator(".brush-preview").evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(parseFloat(duration)).toBeLessThanOrEqual(0.01);
  });

  test("supports keyboard traversal across canvas, materials, and actions", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.locator(".canvas-surface")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Wall" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Sand", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Water" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Fire" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Erase" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator("#brush-size")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /Pause|Play/ })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Advance one step" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Clear" })).toBeFocused();
  });

  test("opens the persistence panel by keyboard and skips its native file input", async ({ page }) => {
    await page.goto("/");
    for (let index = 0; index < 11; index += 1) await page.keyboard.press("Tab");
    const toggle = page.getByRole("button", { name: "Save / load" });
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-controls", "persistence-panel");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await page.keyboard.press("Enter");
    const panel = page.locator("#persistence-panel");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Export file" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Import file" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator("#save-code")).toBeFocused();
    await expect(page.locator('input[data-save-file][tabindex="-1"]')).not.toBeFocused();
  });

  test("mobile DPR2 remains usable after viewport resize", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator(".canvas-surface")).toBeVisible();
    await page.getByRole("button", { name: "Pause simulation" }).click();
    const bounds = await page.locator(".canvas-surface").boundingBox();
    expect(bounds).toBeTruthy();
    await page.locator(".canvas-surface").click({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } });
    expect(await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied)).toBeGreaterThan(0);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator(".canvas-surface")).toBeVisible();
    await context.close();
  });

  test("keeps the deterministic simulation benchmark within its budget", async ({ page }) => {
    await page.goto("/");
    const metrics = await page.evaluate(() => (window as Window & { __ANIFOR_TEST__?: { benchmark: () => { p95: number; max: number } } }).__ANIFOR_TEST__?.benchmark());
    expect(metrics).toBeTruthy();
    console.log(`benchmark p95=${metrics!.p95.toFixed(3)}ms max=${metrics!.max.toFixed(3)}ms`);
    expect(metrics!.p95).toBeLessThan(16.7);
    expect(metrics!.max).toBeLessThan(33.3);
  });

  test("measures renderer CPU conversion and upload submission separately", async ({ page }) => {
    await page.goto("/");
    const metrics = await page.evaluate(() => (window as any).__ANIFOR_TEST__.rendererBenchmark());
    console.log(`renderer CPU conversion/upload submission p95=${metrics.p95.toFixed(3)}ms max=${metrics.max.toFixed(3)}ms samples=${metrics.samples}`);
    expect(metrics.samples).toBe(120);
    expect(metrics.p95).toBeLessThan(16.7);
    expect(metrics.max).toBeLessThan(33.3);
  });

  test("normal 60Hz scheduling runs ten seconds without catch-up", async ({ page }) => {
    await page.goto("/");
    const diagnostics = await page.evaluate(() => (window as any).__ANIFOR_TEST__.normalSchedule());
    expect(diagnostics).toEqual({ catchUpCapHits: 0, droppedTicks: 0 });
  });

  test("actual browser scheduler runs for ten seconds without catch-up", async ({ page }) => {
    test.setTimeout(25_000);
    await page.goto("/");
    await page.waitForTimeout(1_000);
    const before = await page.evaluate(() => (window as any).__ANIFOR_TEST__.diagnostics());
    await page.waitForTimeout(10_000);
    const after = await page.evaluate(() => (window as any).__ANIFOR_TEST__.diagnostics());
    expect(after.catchUpCapHits - before.catchUpCapHits).toBe(0);
    expect(after.droppedTicks - before.droppedTicks).toBe(0);
  });

  test("interactive ten-second run records long tasks and scheduler health", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto("/");
    await page.evaluate(() => {
      const entries: PerformanceEntry[] = [];
      const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
      observer.observe({ type: "longtask", buffered: true });
      (window as any).__ANIFOR_LONGTASKS__ = { entries, observer };
    });
    await page.waitForTimeout(1_000);
    const before = await page.evaluate(() => (window as any).__ANIFOR_TEST__.diagnostics());
    await page.evaluate(() => new Promise<void>((resolve) => {
      const surface = document.querySelector<HTMLElement>(".canvas-surface")!;
      const buttons = [
        document.querySelector<HTMLButtonElement>('[data-tool="water"]')!,
        document.querySelector<HTMLButtonElement>('[data-tool="sand"]')!
      ];
      const rect = surface.getBoundingClientRect();
      const start = performance.now();
      let frame = 0;
      let pointerId = 100;
      const event = (type: string, x: number, y: number): void => {
        surface.dispatchEvent(new PointerEvent(type, {
          bubbles: true, pointerId, pointerType: "mouse", clientX: rect.left + x, clientY: rect.top + y,
          buttons: type === "pointerup" ? 0 : 1
        }));
      };
      const stroke = (): void => {
        buttons[(frame / 15) % 2 | 0].click();
        pointerId += 1;
        event("pointerdown", 120, 120);
        event("pointermove", 220, 140);
        event("pointermove", 320, 160);
        event("pointerup", 320, 160);
      };
      const tick = (now: number): void => {
        if (now - start >= 10_000) { resolve(); return; }
        if (frame % 15 === 0) stroke();
        frame += 1;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }));
    const evidence = await page.evaluate(() => {
      const hook = (window as any).__ANIFOR_LONGTASKS__;
      hook.observer.disconnect();
      const durations = hook.entries.map((entry: PerformanceEntry) => entry.duration);
      return { count: durations.length, max: Math.max(0, ...durations), diagnostics: (window as any).__ANIFOR_TEST__.diagnostics() };
    });
    console.log(`interactive 10s long tasks count=${evidence.count} max=${evidence.max.toFixed(3)}ms; attribution is unavailable for same-page app ownership`);
    expect(evidence.diagnostics.catchUpCapHits - before.catchUpCapHits).toBe(0);
    expect(evidence.diagnostics.droppedTicks - before.droppedTicks).toBe(0);
  });

  test("loads the built application from a nested base", async ({ browser }) => {
    const environment = { ...process.env, VITE_BASE: "/nested/" };
    const build = spawnSync("npm", ["run", "build"], { env: environment, stdio: "pipe" });
    expect(build.status, build.stderr.toString()).toBe(0);
    const server = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", "4174"], { env: environment, stdio: "ignore" });
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const context = await browser.newContext({ baseURL: "http://127.0.0.1:4174" });
      const page = await context.newPage();
      await page.goto("/nested/");
      await expect(page.getByRole("heading", { name: "Powder garden" })).toBeVisible();
      await context.close();
    } finally {
      server.kill();
    }
  });
});
