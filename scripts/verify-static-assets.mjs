import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'dist');
const required = ['assets/app.js', 'assets/style.css', 'wasm/stillroom_core.js', 'wasm/stillroom_core.wasm', 'wasm/powder_core.wasm'];
const queue = ['index.html', ...required];
const seen = new Set();
const failures = [];

while (queue.length) {
  const relative = queue.shift();
  if (!relative || seen.has(relative)) continue;
  seen.add(relative);
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(root + path.sep) && absolute !== root) {
    failures.push(`${relative}: escapes static root`);
    continue;
  }
  let details;
  try { details = await stat(absolute); }
  catch { failures.push(`${relative}: missing`); continue; }
  if (!details.isFile() || details.size === 0) {
    failures.push(`${relative}: empty or not a file`);
    continue;
  }
  if (!/\.(?:html|js|css)$/i.test(relative)) continue;
  const source = await readFile(absolute, 'utf8');
  for (const reference of references(source, relative)) {
    const resolved = resolveReference(relative, reference.path, reference.fromRoot);
    if (resolved) queue.push(resolved);
  }
}

if (failures.length) {
  console.error(`Static asset verification failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
  process.exit(1);
}
console.log(`Static asset closure verified (${seen.size} referenced files)`);

function references(source, relative) {
  const found = [];
  if (relative.endsWith('.html')) {
    collect(/(?:src|href)=["']([^"'#]+)["']/g, false);
  } else if (relative.endsWith('.css')) {
    collect(/url\(\s*["']?([^"')]+)["']?\s*\)/g, false);
  } else {
    collect(/(?:from\s*|import\s*\(\s*)["'](\.{1,2}\/[^"']+\.js)["']/g, false);
    collect(/["'](\.\/wasm\/[^"']+\.(?:js|wasm))["']/g, true);
    collect(/["']((?!\.\/wasm\/)(?:\.{1,2}\/)?[^"'/]+\.wasm)["']/g, false);
  }
  return found;

  function collect(pattern, fromRoot) {
    for (const match of source.matchAll(pattern)) found.push({ path: match[1], fromRoot });
  }
}

function resolveReference(owner, reference, fromRoot) {
  if (/^(?:[a-z]+:|\/\/|#|data:)/i.test(reference)) return undefined;
  const clean = reference.split(/[?#]/, 1)[0];
  if (!clean || clean.endsWith('/')) return undefined;
  const resolved = path.posix.normalize(fromRoot ? clean.replace(/^\.\//, '') : path.posix.join(path.posix.dirname(owner), clean));
  return resolved.startsWith('../') || path.posix.isAbsolute(resolved) ? undefined : resolved;
}
