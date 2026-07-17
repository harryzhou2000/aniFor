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
    await page.locator(".canvas-surface").click({ position: { x: 640, y: 400 } });
    const after = await page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied);
    expect(after).toBeGreaterThan(before);
    await page.getByRole("button", { name: "Advance one step" }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__ANIFOR_TEST__.state().tick)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Clear" }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__ANIFOR_TEST__.state().occupied)).toBe(0);
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
