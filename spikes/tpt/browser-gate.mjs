#!/usr/bin/env node
import http from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

if (process.argv.includes('--help')) {
  console.log('Usage: TPT_GATE_PORT=45001 node spikes/tpt/browser-gate.mjs\nLaunches the isolated COOP/COEP server and records Chrome browser Gate A evidence.');
  process.exit(0);
}
const port = Number(process.env.TPT_GATE_PORT || 4174);
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['spikes/tpt/serve.mjs', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = '';
server.stdout.on('data', (b) => { serverOutput += b; });
server.stderr.on('data', (b) => { serverOutput += b; });
async function ready() {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/harness.html`)).ok) return; } catch {} await delay(50); }
  throw new Error(`server did not start: ${serverOutput}`);
}
const evidence = { headers: {}, requests: [], responses: [], errors: [], workerErrors: [], crashes: 0, pageClosed: false, requestFailures: [], console: [], saveReload: 'not attempted: harness exposes no native save proof UI' };
try {
  await ready();
  const response = await fetch(`${base}/harness.html`);
  for (const name of ['cross-origin-opener-policy', 'cross-origin-embedder-policy', 'cross-origin-resource-policy']) evidence.headers[name] = response.headers.get(name);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const started = Date.now();
  page.on('console', (msg) => { evidence.console.push(`${msg.type()}: ${msg.text()}`); });
  page.on('request', (request) => { if (/powder|harness|wasm/.test(request.url())) evidence.requests.push(`${request.method()} ${request.url()}`); });
  page.on('response', (response) => { if (response.status() >= 400) evidence.responses.push(`${response.status()} ${response.url()}`); });
  page.on('pageerror', (error) => evidence.errors.push(String(error)));
  page.on('requestfailed', (request) => evidence.requestFailures.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('crash', () => { evidence.crashes++; });
  page.on('close', () => { evidence.pageClosed = true; });
  page.on('worker', (worker) => worker.on('close', () => {}));
  await page.goto(`${base}/harness.html`, { waitUntil: 'commit' });
  let state;
  try { await page.waitForFunction(() => window.__gateState?.firstFrame > 0, null, { timeout: 15000 }); state = await page.evaluate(() => ({ ...window.__gateState })); }
  catch (error) { evidence.errors.push(`usable frame timeout: ${error.message}`); state = await page.evaluate(() => ({ ...window.__gateState })); }
  const stableAt = Date.now();
  await delay(30000);
  try {
    evidence.runtime = await page.evaluate(async () => {
      let memory = 'unavailable';
      if (performance.measureUserAgentSpecificMemory) {
        try { memory = await performance.measureUserAgentSpecificMemory(); }
        catch (error) { memory = `unavailable: ${error.message}`; }
      }
      return { crossOriginIsolated, ...window.__gateState, status: document.querySelector('#status')?.textContent, memory };
    });
  } catch (error) {
    evidence.errors.push(`runtime sample unavailable after stability interval: ${error.message}`);
    evidence.runtime = { ...state, memory: 'unavailable: page closed' };
  }
  evidence.stability30s = { durationMs: Date.now() - stableAt, pageErrors: evidence.errors.length, consoleMessages: evidence.console.length, consoleErrors: evidence.console.filter((line) => line.startsWith('error:')).length, requestFailures: evidence.requestFailures.length, crashes: evidence.crashes };
  console.log(JSON.stringify(evidence, null, 2));
  await Promise.race([browser.close(), delay(1000)]);
} finally { server.kill('SIGTERM'); }
