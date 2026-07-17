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
    const surface = page.locator(".canvas-surface");
    const bounds = await surface.boundingBox();
    expect(bounds).toBeTruthy();
    await surface.click({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } });
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
    const surface = page.locator(".canvas-surface");
    const bounds = await surface.boundingBox();
    expect(bounds).toBeTruthy();
    await surface.click({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } });
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
    const surface = page.locator(".canvas-surface");
    const bounds = await surface.boundingBox();
    expect(bounds).toBeTruthy();
    await surface.click({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } });
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
    const surface = page.locator(".canvas-surface");
    const bounds = await surface.boundingBox();
    expect(bounds).toBeTruthy();
    await surface.click({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } });
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
    const start = { x: bounds!.width * 0.25, y: bounds!.height / 2 };
    const end = { x: bounds!.width * 0.75, y: bounds!.height / 2 };
    const midpoint = await page.evaluate(({ x, y, width, height }) => {
      const map = (window as any).__ANIFOR_TEST__.screenToCell;
      return map(width / 2 + x - width / 2, y) ?? map(x, y);
    }, { x: (start.x + end.x) / 2, y: start.y, width: bounds!.width, height: bounds!.height });
    await surface.dispatchEvent("pointerdown", { pointerId: 21, pointerType: "mouse", clientX: bounds!.x + start.x, clientY: bounds!.y + start.y, buttons: 1 });
    for (let step = 1; step <= 12; step += 1) {
      const progress = step / 12;
      await surface.dispatchEvent("pointermove", { pointerId: 21, pointerType: "mouse", clientX: bounds!.x + start.x + (end.x - start.x) * progress, clientY: bounds!.y + start.y, buttons: 1 });
    }
    await surface.dispatchEvent("pointerup", { pointerId: 21, pointerType: "mouse", clientX: bounds!.x + end.x, clientY: bounds!.y + end.y, buttons: 0 });
    expect(midpoint).toBeTruthy();
    expect(await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied)).toBeGreaterThan(0);
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
    await page.waitForTimeout(100);
    const point = (x: number, y: number, id: number) => ({ x: bounds!.x + x, y: bounds!.y + y, id, radiusX: 1, radiusY: 1, force: 1 });
    const centerX = bounds!.width / 2;
    const centerY = bounds!.height / 2;
    const pinchDelta = Math.min(50, bounds!.width / 8);
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(centerX - pinchDelta, centerY, 1)] });
    const afterFirst = await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().nextSequence);
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(centerX - pinchDelta, centerY, 1), point(centerX + pinchDelta, centerY, 2)] });
    const before = await page.evaluate(() => ({ camera: (window as any).__ANIFOR_TEST__.camera(), sequence: (window as any).__ANIFOR_TEST__.state().nextSequence }));
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point(centerX - pinchDelta * 1.5, centerY, 1), point(centerX + pinchDelta * 1.5, centerY, 2)] });
    const after = await page.evaluate(() => ({ camera: (window as any).__ANIFOR_TEST__.camera(), sequence: (window as any).__ANIFOR_TEST__.state().nextSequence }));
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    expect(after.sequence).toBe(afterFirst);
    expect(after.camera).not.toEqual(before.camera);
    const geometry = await page.evaluate(() => (window as any).__ANIFOR_TEST__.geometry());
    const worldRight = geometry.transform.x + 256 * geometry.transform.scale;
    const worldBottom = geometry.transform.y + 192 * geometry.transform.scale;
    expect(geometry.transform.x).toBeLessThanOrEqual(0.5);
    expect(geometry.transform.y).toBeLessThanOrEqual(0.5);
    expect(worldRight).toBeGreaterThanOrEqual(geometry.surface.width - 0.5);
    expect(worldBottom).toBeGreaterThanOrEqual(geometry.surface.height - 0.5);
    await context.close();
  });

  test("keeps the 4:3 world bed and CSS cell mapping exact at corners", async ({ page }) => {
    await page.setViewportSize({ width: 1001, height: 701 });
    await page.goto("/");
    await expect(page.locator(".sandbox-canvas")).toBeVisible();
    const geometry = await page.evaluate(() => (window as any).__ANIFOR_TEST__.geometry());
    expect(Math.abs(geometry.surface.width - geometry.surface.height * 4 / 3)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(geometry.canvas.x - geometry.surface.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(geometry.canvas.y - geometry.surface.y)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(geometry.canvas.width - geometry.surface.width)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(geometry.canvas.height - geometry.surface.height)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(geometry.canvasCss.width - geometry.surface.width)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(geometry.canvasCss.height - geometry.surface.height)).toBeLessThanOrEqual(0.5);
    const resolution = Math.min(geometry.devicePixelRatio, 2);
    expect(Math.abs(geometry.canvasLogical.width - geometry.surface.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.canvasLogical.height - geometry.surface.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.canvasBacking.width - Math.round(geometry.canvasLogical.width * resolution))).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.canvasBacking.height - Math.round(geometry.canvasLogical.height * resolution))).toBeLessThanOrEqual(1);
    expect(geometry.stage.width).toBeGreaterThan(geometry.bed.width);
    expect(geometry.stage.height).toBeGreaterThan(geometry.bed.height);
    const stageBackground = await page.locator(".sandbox-stage").evaluate((element) => getComputedStyle(element).backgroundImage);
    const bedBackground = await page.locator(".world-bed").evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(stageBackground).not.toBe("none");
    expect(stageBackground).not.toBe(bedBackground);

    const points = await page.evaluate(() => {
      const hook = (window as any).__ANIFOR_TEST__;
      const transform = hook.geometry().transform;
      return [
        { x: transform.x + 0.5 * transform.scale, y: transform.y + 0.5 * transform.scale, expected: { x: 0, y: 0 } },
        { x: transform.x + 255.5 * transform.scale, y: transform.y + 191.5 * transform.scale, expected: { x: 255, y: 191 } },
        { x: transform.x, y: transform.y, expected: { x: 0, y: 0 } },
        { x: transform.x + 256 * transform.scale - 0.001, y: transform.y + 192 * transform.scale - 0.001, expected: { x: 255, y: 191 } },
        { x: transform.x + 256 * transform.scale, y: transform.y + 10, expected: null },
        { x: transform.x + 10, y: transform.y + 192 * transform.scale, expected: null },
        { x: -1, y: transform.y + 10, expected: null }
      ].map((point) => ({ ...point, actual: hook.cssToCell(point.x, point.y) }));
    });
    for (const point of points) expect(point.actual).toEqual(point.expected);
  });

  test("keeps mapping and camera fit stable through DPR2 orientation resize", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1001, height: 701 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator(".sandbox-canvas")).toBeVisible();
    expect((await page.evaluate(() => (window as any).__ANIFOR_TEST__.geometry().devicePixelRatio))).toBe(2);
    const assertGeometry = async (): Promise<void> => {
      await page.waitForTimeout(100);
      const geometry = await page.evaluate(() => (window as any).__ANIFOR_TEST__.geometry());
      expect(Math.abs(geometry.surface.width - geometry.surface.height * 4 / 3)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(geometry.canvas.x - geometry.surface.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(geometry.canvas.y - geometry.surface.y)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(geometry.canvas.width - geometry.surface.width)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(geometry.canvas.height - geometry.surface.height)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(geometry.canvasCss.width - geometry.surface.width)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(geometry.canvasCss.height - geometry.surface.height)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(geometry.canvasLogical.width - geometry.surface.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.canvasLogical.height - geometry.surface.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.canvasBacking.width - Math.round(geometry.canvasLogical.width * 2))).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.canvasBacking.height - Math.round(geometry.canvasLogical.height * 2))).toBeLessThanOrEqual(1);
      const center = await page.evaluate(() => (window as any).__ANIFOR_TEST__.cellToCssCenter(128, 96));
      expect(await page.evaluate((point) => (window as any).__ANIFOR_TEST__.cssToCell(point.x, point.y), center)).toEqual({ x: 128, y: 96 });
      const expectedX = geometry.transform.x + 128.5 * geometry.transform.scale;
      const expectedY = geometry.transform.y + 96.5 * geometry.transform.scale;
      expect(Math.abs(center.x - expectedX)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(center.y - expectedY)).toBeLessThanOrEqual(0.5);
      const transform = geometry.transform;
      const points = [
        [transform.x, transform.y],
        [transform.x + 256 * transform.scale - 0.001, transform.y + 192 * transform.scale - 0.001],
        [transform.x + 256 * transform.scale, transform.y],
        [transform.x, transform.y + 192 * transform.scale]
      ];
      const mapped = await page.evaluate((values) => values.map(([x, y]) => (window as any).__ANIFOR_TEST__.cssToCell(x, y)), points);
      expect(mapped[0]).toEqual({ x: 0, y: 0 });
      expect(mapped[1]).toEqual({ x: 255, y: 191 });
      expect(mapped[2]).toBeNull();
      expect(mapped[3]).toBeNull();
    };
    await assertGeometry();
    await page.setViewportSize({ width: 701, height: 1001 });
    await assertGeometry();
    await context.close();
  });

  test("shows the exact radius-three preview only inside the world bed", async ({ page }) => {
    await page.goto("/");
    const surface = page.locator(".canvas-surface");
    const bounds = await surface.boundingBox();
    expect(bounds).toBeTruthy();
    await page.waitForTimeout(100);
    const stateBefore = await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied);
    await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
    await page.mouse.down();
    const preview = await page.evaluate(() => {
      const surface = document.querySelector<HTMLElement>(".canvas-surface")!;
      const hook = (window as any).__ANIFOR_TEST__;
      const geometry = hook.geometry();
      const transform = geometry.transform;
      const point = hook.cssToCell(geometry.surface.width / 2, geometry.surface.height / 2);
      const expected = hook.rasterizeCircle(point.x, point.y, 3).map((cell: { x: number; y: number }) => ({
        x: transform.x + cell.x * transform.scale, y: transform.y + cell.y * transform.scale, size: transform.scale
      }));
      const actual = [...document.querySelectorAll<HTMLElement>(".brush-preview-cell")].map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.left - surface.getBoundingClientRect().left, y: rect.top - surface.getBoundingClientRect().top, size: parseFloat(element.style.width), transform };
      });
      const key = (cell: { x: number; y: number; size: number }) => `${cell.x.toFixed(3)},${cell.y.toFixed(3)}`;
      return { actual, expected: expected.map(key) };
    });
    expect(preview.actual).toHaveLength(29);
    expect(preview.actual.map((cell) => `${cell.x.toFixed(3)},${cell.y.toFixed(3)}`).sort()).toEqual(preview.expected.sort());
    for (const cell of preview.actual) {
      expect(cell.x).toBeGreaterThanOrEqual(cell.transform.x - 0.5);
      expect(cell.y).toBeGreaterThanOrEqual(cell.transform.y - 0.5);
      expect(cell.x + cell.size).toBeLessThanOrEqual(cell.transform.x + 256 * cell.transform.scale + 0.5);
      expect(cell.y + cell.size).toBeLessThanOrEqual(cell.transform.y + 192 * cell.transform.scale + 0.5);
      expect(Math.abs((cell.x - cell.transform.x) / cell.transform.scale - Math.round((cell.x - cell.transform.x) / cell.transform.scale))).toBeLessThanOrEqual(0.01);
      expect(Math.abs(cell.size - cell.transform.scale)).toBeLessThanOrEqual(0.5);
    }
    const paintedBeforeReload = await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied);
    expect(paintedBeforeReload).toBeGreaterThan(stateBefore);
    await page.mouse.up();
    await page.reload();
    await expect(page.locator(".sandbox-canvas")).toBeVisible();
    const painted = await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied);
    const stage = await page.locator(".sandbox-stage").boundingBox();
    expect(stage).toBeTruthy();
    await page.mouse.click(stage!.x + 2, stage!.y + stage!.height / 2);
    expect(await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied)).toBe(painted);
    expect(await page.locator(".brush-preview-cell").count()).toBe(0);
  });

  test("matches the reviewed deterministic empty world-bed baseline", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Pause simulation" }).click();
    await expect(page.locator(".world-bed")).toHaveScreenshot("world-bed-empty-paused.png");
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
    await page.setViewportSize({ width: 844, height: 600 });
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
