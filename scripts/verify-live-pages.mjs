const pageUrl = new URL(process.argv[2]);
const revision = process.argv[3];
if (!revision) throw new Error('Expected deployed revision argument');
const attempts = 8;

for (let attempt = 1; attempt <= attempts; attempt++) {
  try {
    const checked = await verify();
    console.log(`Live Pages asset closure verified (${checked} resources, attempt ${attempt})`);
    process.exit(0);
  } catch (error) {
    if (attempt === attempts) throw error;
    console.warn(`Pages verification attempt ${attempt} failed: ${error.message}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

async function verify() {
  await verifyRevision();
  const queue = [withRevision(pageUrl)];
  const seen = new Set();
  while (queue.length) {
    const url = queue.shift();
    const key = url.pathname;
    if (seen.has(key)) continue;
    seen.add(key);
    const response = await fetch(url, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
    if (!response.ok) throw new Error(`${url.href} returned HTTP ${response.status}`);
    if (url.pathname.endsWith('.wasm') && !response.headers.get('content-type')?.includes('application/wasm')) {
      throw new Error(`${url.href} has incorrect WASM content type`);
    }
    if (!/\.(?:html|js|css)$/.test(url.pathname) && url.pathname !== pageUrl.pathname) continue;
    const source = await response.text();
    const relativeOwner = new URL(url.pathname.endsWith('/') ? 'index.html' : url.pathname.split('/').at(-1), url);
    const kind = url.pathname.endsWith('/') || url.pathname.endsWith('.html') ? 'html' : url.pathname.endsWith('.css') ? 'css' : 'js';
    for (const reference of references(source, kind)) {
      if (reference.path.endsWith('/')) continue;
      const target = reference.fromRoot ? new URL(reference.path.replace(/^\.\//, ''), pageUrl) : new URL(reference.path, relativeOwner);
      if (target.origin === pageUrl.origin && target.pathname.startsWith(pageUrl.pathname)) queue.push(withRevision(target));
    }
  }
  for (const required of ['assets/app.js', 'assets/style.css', 'wasm/stillroom_core.js', 'wasm/stillroom_core.wasm', 'wasm/powder_core.wasm']) {
    const target = new URL(required, pageUrl);
    if (!seen.has(target.pathname)) throw new Error(`${required} was not present in the live closure`);
  }
  return seen.size;
}

async function verifyRevision() {
  const target = withRevision(new URL('revision.txt', pageUrl));
  const response = await fetch(target, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) throw new Error(`${target.href} returned HTTP ${response.status}`);
  const deployedRevision = (await response.text()).trim();
  if (deployedRevision !== revision) {
    throw new Error(`deployed revision ${deployedRevision || '<empty>'} does not match ${revision}`);
  }
}

function references(source, kind) {
  const found = [];
  if (kind === 'html') collect(/(?:src|href)=["']([^"'#]+)["']/g, false);
  else if (kind === 'css') collect(/url\(\s*["']?([^"')]+)["']?\s*\)/g, false);
  else {
    collect(/(?:from\s*|import\s*\(\s*)["'](\.{1,2}\/[^"']+\.js)["']/g, false);
    collect(/["'](\.\/wasm\/[^"']+\.(?:js|wasm))["']/g, true);
    collect(/["']((?!\.\/wasm\/)(?:\.{1,2}\/)?[^"'/]+\.wasm)["']/g, false);
  }
  return found;

  function collect(pattern, fromRoot) {
    for (const match of source.matchAll(pattern)) found.push({ path: match[1], fromRoot });
  }
}

function withRevision(url) {
  const versioned = new URL(url);
  versioned.searchParams.set('revision', revision);
  return versioned;
}
