import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyPagesArtifact } from './verify-pages-artifact.mjs';

const REVISION = '1234567890abcdef1234567890abcdef12345678';
const roots = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('reusable Pages artifact verifier', () => {
  it('accepts one exact-revision closed production-shaped site', async () => {
    const root = await fixture();
    await expect(verifyPagesArtifact(root, REVISION)).resolves.toEqual({
      revision: REVISION,
      checkedResources: 6,
    });
  });

  it('rejects a stale or noncanonical embedded revision', async () => {
    const root = await fixture();
    await writeFile(path.join(root, 'revision.txt'), `${'a'.repeat(40)}\n`);
    await expect(verifyPagesArtifact(root, REVISION)).rejects.toThrow('does not exactly match');
    await expect(verifyPagesArtifact(root, REVISION.toUpperCase()))
      .rejects.toThrow('lowercase 40-hex');
  });

  it('rejects missing boot/stable entry markers and an open asset closure', async () => {
    const root = await fixture();
    await writeFile(path.join(root, 'index.html'), '<main id="boot-status"></main>');
    await expect(verifyPagesArtifact(root, REVISION)).rejects.toThrow('assets/app.js');
    await writeFile(path.join(root, 'index.html'), indexHtml());
    await rm(path.join(root, 'wasm/powder_core.wasm'));
    await expect(verifyPagesArtifact(root, REVISION)).rejects.toThrow('powder_core.wasm: missing');
  });

  it('requires every legacy migration alias to be a byte-identical regular file', async () => {
    const root = await fixture();
    await writeFile(path.join(root, 'assets/index-DqhU2VfC.js'), 'tampered');
    await expect(verifyPagesArtifact(root, REVISION)).rejects.toThrow(
      'legacy script alias does not match its stable entry',
    );
    await rm(path.join(root, 'assets/index-DqhU2VfC.js'));
    await expect(verifyPagesArtifact(root, REVISION)).rejects.toThrow('ENOENT');
  });

  it('rejects an unreferenced symlink before Pages packaging can dereference it', async () => {
    const root = await fixture();
    await symlink('/etc/passwd', path.join(root, 'unreferenced-link'));
    await expect(verifyPagesArtifact(root, REVISION))
      .rejects.toThrow('must not contain symbolic links');
  });
});

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'anifor-pages-artifact-'));
  roots.push(root);
  await mkdir(path.join(root, 'assets'), { recursive: true });
  await mkdir(path.join(root, 'wasm'), { recursive: true });
  await writeFile(path.join(root, 'index.html'), indexHtml());
  await writeFile(path.join(root, 'revision.txt'), `${REVISION}\n`);
  await writeFile(path.join(root, 'assets/app.js'), 'export const ready = true;\n');
  await writeFile(path.join(root, 'assets/style.css'), 'body { color: white; }\n');
  for (const alias of ['index-DqhU2VfC.js', 'index-DsD3cf_4.js']) {
    await cp(path.join(root, 'assets/app.js'), path.join(root, 'assets', alias));
  }
  for (const alias of ['index-CSuzU66U.css', 'index-40yMQDz6.css']) {
    await cp(path.join(root, 'assets/style.css'), path.join(root, 'assets', alias));
  }
  await writeFile(path.join(root, 'wasm/stillroom_core.js'), 'export {};\n');
  await writeFile(path.join(root, 'wasm/stillroom_core.wasm'), new Uint8Array([0, 97, 115, 109]));
  await writeFile(path.join(root, 'wasm/powder_core.wasm'), new Uint8Array([0, 97, 115, 109]));
  return root;
}

function indexHtml() {
  return '<link href="./assets/style.css" rel="stylesheet">'
    + '<main id="boot-status"></main><script src="./assets/app.js"></script>';
}
