import { describe, expect, it } from 'vitest';
import {
  normalizeLivePagesBaseUrl,
  verifyLivePagesDeployment,
  verifyLivePagesRevision,
} from './live-pages-attestation.mjs';

const BASE_URL = 'https://example.test/anifor/';
const REVISION = '1234567890abcdef1234567890abcdef12345678';

const response = (body, {
  status = 200,
  contentType = 'text/plain; charset=utf-8',
  url,
} = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => name.toLowerCase() === 'content-type' ? contentType : null },
  text: async () => body,
  ...(url === undefined ? {} : { url }),
});

const fixtureFetch = (overrides = {}) => {
  const resources = new Map(Object.entries({
    '/anifor/revision.txt': response(`${REVISION}\n`),
    '/anifor/': response([
      '<link href="./assets/style.css" rel="stylesheet">',
      '<script src="./assets/app.js"></script>',
    ].join('')),
    '/anifor/assets/style.css': response('body { color: white; }'),
    '/anifor/assets/app.js': response([
      'const chunk = import("./chunk.js");',
      'const wasm = "./wasm/stillroom_core.js";',
      'const powder = "./wasm/powder_core.wasm";',
    ].join('\n')),
    '/anifor/assets/chunk.js': response('export const chunk = true;'),
    '/anifor/wasm/stillroom_core.js': response('const module = "./stillroom_core.wasm";'),
    '/anifor/wasm/stillroom_core.wasm': response('', { contentType: 'application/wasm' }),
    '/anifor/wasm/powder_core.wasm': response('', { contentType: 'application/wasm' }),
    ...overrides,
  }));
  const calls = [];
  const fetch = async (url, options) => {
    const target = new URL(url);
    calls.push({ href: target.href, options });
    return resources.get(target.pathname) ?? response('missing', { status: 404 });
  };
  return { fetch, calls, resources };
};

describe('live Pages attestation', () => {
  it('attests an exact no-store same-origin closure and returns frozen evidence', async () => {
    const fixture = fixtureFetch();
    const result = await verifyLivePagesDeployment(BASE_URL, REVISION, { fetch: fixture.fetch });
    expect(result).toEqual({
      baseUrl: BASE_URL,
      revision: REVISION,
      resourcePaths: [
        '/anifor/', '/anifor/assets/style.css', '/anifor/assets/app.js',
        '/anifor/assets/chunk.js', '/anifor/wasm/stillroom_core.js',
        '/anifor/wasm/powder_core.wasm', '/anifor/wasm/stillroom_core.wasm',
      ],
      resourceCount: 7,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.resourcePaths)).toBe(true);
    expect(fixture.calls).toHaveLength(8);
    expect(fixture.calls.every(({ options }) => options.cache === 'no-store'
      && options.headers['cache-control'] === 'no-cache')).toBe(true);
  });

  it('rejects wrong revisions and observes a revision change in a later stability check', async () => {
    const stale = fixtureFetch({ '/anifor/revision.txt': response(`${'a'.repeat(40)}\n`) });
    await expect(verifyLivePagesDeployment(BASE_URL, REVISION, { fetch: stale.fetch }))
      .rejects.toThrow('does not match');

    let revisionReads = 0;
    const changing = fixtureFetch({
      '/anifor/revision.txt': {
        ok: true,
        status: 200,
        headers: { get: () => 'text/plain' },
        text: async () => `${revisionReads++ === 0 ? REVISION : 'a'.repeat(40)}\n`,
      },
    });
    await expect(verifyLivePagesRevision(BASE_URL, REVISION, { fetch: changing.fetch }))
      .resolves.toEqual({ baseUrl: BASE_URL, revision: REVISION });
    await expect(verifyLivePagesRevision(BASE_URL, REVISION, { fetch: changing.fetch }))
      .rejects.toThrow('does not match');
    await expect(verifyLivePagesRevision(BASE_URL, REVISION.toUpperCase(), { fetch: changing.fetch }))
      .rejects.toThrow('lowercase 40-hex');
  });

  it('rejects malformed, non-HTTP(S), credentialled, queried, hashed, and document URLs', () => {
    for (const value of [
      'not a url', ` ${BASE_URL}`, 'file:///tmp/site/', 'ftp://example.test/anifor/',
      'https://user:pass@example.test/anifor/', 'https://example.test/anifor/?x=1',
      'https://example.test/anifor/?', 'https://example.test/anifor/#',
      'https://example.test/anifor/#fragment', 'https://example.test/anifor/index.html',
    ]) {
      expect(() => normalizeLivePagesBaseUrl(value)).toThrow();
    }
    expect(normalizeLivePagesBaseUrl(BASE_URL)).toBe(BASE_URL);
  });

  it('ignores cross-origin references but rejects a same-origin reference escaping the app root', async () => {
    const external = fixtureFetch({
      '/anifor/': response('<script src="https://cdn.example.test/app.js"></script>'
        + '<script src="./assets/app.js"></script><link href="./assets/style.css">'),
    });
    await expect(verifyLivePagesDeployment(BASE_URL, REVISION, { fetch: external.fetch }))
      .resolves.toMatchObject({ resourceCount: 7 });
    expect(external.calls.some(({ href }) => href.includes('cdn.example.test'))).toBe(false);

    const escaped = fixtureFetch({
      '/anifor/': response('<script src="../outside.js"></script>'),
    });
    await expect(verifyLivePagesDeployment(BASE_URL, REVISION, { fetch: escaped.fetch }))
      .rejects.toThrow('escapes application root');

    const redirected = fixtureFetch({
      '/anifor/revision.txt': response(`${REVISION}\n`, {
        url: 'https://other.example.test/revision.txt',
      }),
    });
    await expect(verifyLivePagesDeployment(BASE_URL, REVISION, { fetch: redirected.fetch }))
      .rejects.toThrow('redirected');
  });

  it('rejects required-resource omissions and bad WebAssembly MIME types', async () => {
    const missing = fixtureFetch({
      '/anifor/assets/app.js': response('export const noWasm = true;'),
    });
    await expect(verifyLivePagesDeployment(BASE_URL, REVISION, { fetch: missing.fetch }))
      .rejects.toThrow('wasm/stillroom_core.js was not present');

    const wrongMime = fixtureFetch({
      '/anifor/wasm/powder_core.wasm': response('', { contentType: 'application/octet-stream' }),
    });
    await expect(verifyLivePagesDeployment(BASE_URL, REVISION, { fetch: wrongMime.fetch }))
      .rejects.toThrow('incorrect WASM content type');
  });
});
