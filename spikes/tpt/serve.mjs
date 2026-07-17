#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../build/tpt-wasm/out');
const spikeRoot = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || 4174);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.data': 'application/octet-stream', '.json': 'application/json', '.map': 'application/json' };
http.createServer((req, res) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  let name = decodeURIComponent((req.url || '/').split('?')[0]);
  if (name === '/') name = '/index.html';
  const file = name === '/harness.html' ? path.resolve(spikeRoot, 'harness.html') : path.resolve(root, `.${name}`);
  const allowed = name === '/harness.html' ? file === path.join(spikeRoot, 'harness.html') : file.startsWith(`${root}${path.sep}`);
  if (!allowed || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('Not found'); return; }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`TPT spike: http://127.0.0.1:${port}/ (root ${root})`));
