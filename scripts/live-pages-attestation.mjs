const REVISION = /^[0-9a-f]{40}$/;

export const LIVE_PAGES_REQUIRED_RESOURCES = Object.freeze([
  'assets/app.js',
  'assets/style.css',
  'wasm/stillroom_core.js',
  'wasm/stillroom_core.wasm',
  'wasm/powder_core.wasm',
]);

const NO_STORE_REQUEST = Object.freeze({
  cache: 'no-store',
  headers: Object.freeze({ 'cache-control': 'no-cache' }),
});

const isHttp = (url) => url.protocol === 'http:' || url.protocol === 'https:';

/**
 * Normalizes one Pages application root.  A page document is deliberately not
 * accepted here: relative asset resolution and containment only have one
 * unambiguous meaning when the supplied URL names the mounted application
 * directory itself.
 */
export function normalizeLivePagesBaseUrl(input) {
  if (typeof input !== 'string' || input.length === 0 || input.trim() !== input) {
    throw new TypeError('Live Pages base URL must be an absolute HTTP(S) URL');
  }
  let url;
  try { url = new URL(input); }
  catch { throw new TypeError('Live Pages base URL must be an absolute HTTP(S) URL'); }
  if (!isHttp(url)) {
    throw new TypeError('Live Pages base URL must use HTTP or HTTPS');
  }
  if (url.username || url.password) {
    throw new TypeError('Live Pages base URL must not include credentials');
  }
  // URL.search/hash are empty for bare delimiters, so inspect the original
  // spelling as well. Attestation roots have one canonical representation.
  if (input.includes('?')) throw new TypeError('Live Pages base URL must not include a query');
  if (input.includes('#')) throw new TypeError('Live Pages base URL must not include a hash');
  if (!url.pathname.endsWith('/')) {
    throw new TypeError('Live Pages base URL must name an application root ending in /');
  }
  return url.href;
}

export function normalizeLivePagesRevision(input) {
  if (typeof input !== 'string' || !REVISION.test(input)) {
    throw new TypeError('Expected deployed revision must be a lowercase 40-hex commit');
  }
  return input;
}

const normalizeFetch = (fetchImplementation) => {
  if (typeof fetchImplementation !== 'function') {
    throw new TypeError('Live Pages verification requires a fetch implementation');
  }
  return fetchImplementation;
};

const withRevision = (url, revision) => {
  const versioned = new URL(url);
  versioned.searchParams.set('revision', revision);
  return versioned;
};

const fetchNoStore = async (fetchImplementation, url) => {
  const response = await fetchImplementation(url, NO_STORE_REQUEST);
  if (!response || typeof response.ok !== 'boolean' || typeof response.text !== 'function') {
    throw new TypeError(`Live Pages fetch for ${url.href} returned an invalid response`);
  }
  if (typeof response.url === 'string' && response.url.length > 0) {
    const finalUrl = new URL(response.url);
    if (finalUrl.origin !== url.origin || finalUrl.pathname !== url.pathname) {
      throw new Error(`Live Pages fetch for ${url.href} redirected to ${finalUrl.href}`);
    }
  }
  return response;
};

/** Checks only the revision marker, so a caller can re-attest it after capture. */
export async function verifyLivePagesRevision(baseUrlInput, revisionInput, options = {}) {
  const baseUrl = normalizeLivePagesBaseUrl(baseUrlInput);
  const revision = normalizeLivePagesRevision(revisionInput);
  const fetchImplementation = normalizeFetch(options.fetch ?? globalThis.fetch);
  const target = withRevision(new URL('revision.txt', baseUrl), revision);
  const response = await fetchNoStore(fetchImplementation, target);
  if (!response.ok) throw new Error(`${target.href} returned HTTP ${response.status}`);
  const deployedRevision = (await response.text()).trim();
  if (deployedRevision !== revision) {
    throw new Error(`deployed revision ${deployedRevision || '<empty>'} does not match ${revision}`);
  }
  return Object.freeze({ baseUrl, revision });
}

const references = (source, kind) => {
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
};

const sourceKind = (url, baseUrl) => {
  if (url.pathname.endsWith('/') || url.pathname === baseUrl.pathname
    || url.pathname.endsWith('.html')) return 'html';
  if (url.pathname.endsWith('.css')) return 'css';
  return 'js';
};

const resolveReference = (reference, owner, baseUrl) => {
  const target = reference.fromRoot
    ? new URL(reference.path.replace(/^\.\//, ''), baseUrl)
    : new URL(reference.path, owner);
  if (target.origin !== baseUrl.origin) return null;
  if (!target.pathname.startsWith(baseUrl.pathname)) {
    throw new Error(`live Pages reference ${target.href} escapes application root ${baseUrl.href}`);
  }
  return target;
};

/**
 * Verifies one exact deployed Pages revision and the bounded same-origin asset
 * closure it exposes.  The returned paths are the deterministic crawl order,
 * with no query string or host data mixed into attestation evidence.
 */
export async function verifyLivePagesDeployment(baseUrlInput, revisionInput, options = {}) {
  const baseUrlText = normalizeLivePagesBaseUrl(baseUrlInput);
  const baseUrl = new URL(baseUrlText);
  const revision = normalizeLivePagesRevision(revisionInput);
  const fetchImplementation = normalizeFetch(options.fetch ?? globalThis.fetch);
  await verifyLivePagesRevision(baseUrlText, revision, { fetch: fetchImplementation });

  const queue = [withRevision(baseUrl, revision)];
  const seen = new Set();
  while (queue.length > 0) {
    const url = queue.shift();
    const key = url.pathname;
    if (seen.has(key)) continue;
    seen.add(key);
    const response = await fetchNoStore(fetchImplementation, url);
    if (!response.ok) throw new Error(`${url.href} returned HTTP ${response.status}`);
    if (url.pathname.endsWith('.wasm')
      && !response.headers?.get?.('content-type')?.includes('application/wasm')) {
      throw new Error(`${url.href} has incorrect WASM content type`);
    }
    if (!/\.(?:html|js|css)$/.test(url.pathname) && url.pathname !== baseUrl.pathname) continue;
    const source = await response.text();
    const owner = new URL(
      url.pathname.endsWith('/') ? 'index.html' : url.pathname.split('/').at(-1),
      url,
    );
    for (const reference of references(source, sourceKind(url, baseUrl))) {
      if (reference.path.endsWith('/')) continue;
      const target = resolveReference(reference, owner, baseUrl);
      if (target) queue.push(withRevision(target, revision));
    }
  }

  for (const required of LIVE_PAGES_REQUIRED_RESOURCES) {
    const target = new URL(required, baseUrl);
    if (!seen.has(target.pathname)) {
      throw new Error(`${required} was not present in the live closure`);
    }
  }
  const resourcePaths = Object.freeze([...seen]);
  return Object.freeze({
    baseUrl: baseUrl.href,
    revision,
    resourcePaths,
    resourceCount: resourcePaths.length,
  });
}
