#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
const root = path.resolve(new URL('../../build/tpt-wasm/out/', import.meta.url).pathname);
if (process.argv.includes('--help')) { console.log('Usage: node spikes/tpt/gate-a.mjs\nInventories cold-cache runtime files and prints the Gate A evidence checklist. Browser evidence: node spikes/tpt/browser-gate.mjs (launches serve.mjs with COOP/COEP).'); process.exit(0); }
const files = [];
function walk(dir) { if (!fs.existsSync(dir)) return; for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); e.isDirectory() ? walk(f) : files.push(f); } }
walk(root);
if (files.length === 0) { console.error(`No build output found at ${root}; Gate A transfer and runtime measurements are unavailable.`); process.exit(2); }
let total = 0;
console.log('Gate A transfer inventory (maps reported, not counted):');
for (const f of files) { const b = fs.readFileSync(f); const gz = gzipSync(b, { level: 9 }).length; const br = brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length; const map = f.endsWith('.map'); if (!map) total += br; console.log(`${path.relative(root, f)} raw=${b.length} gzip=${gz} brotli=${br}${map ? ' (map)' : ''}`); }
console.log(`Required cold-cache Brotli total: ${total} bytes (${(total / 1048576).toFixed(2)} MiB), target <= 12 MiB: ${total <= 12 * 1048576 ? 'PASS' : 'FAIL'}`);
console.log('\nRecord with a real header-capable browser run (do not infer success):');
console.log('- crossOriginIsolated === true; worker/pthread load and page errors: none');
console.log('- cold-cache navigation start -> first stable usable frame (desktop <=10s)');
console.log('- performance.measureUserAgentSpecificMemory() peak (<=512 MiB; unavailable means Gate A not passed)');
console.log('- 30 seconds: no crash, worker error, unhandled rejection, or post-start console error');
console.log('- create native TPT save, reload, and verify it persists (not local test data)');
console.log('- harness command: node spikes/tpt/browser-gate.mjs');
