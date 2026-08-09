import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'vitest';

import {
  checkVisualStaticContractDeclarations,
  renderVisualStaticContractDeclarations,
  syncVisualStaticContractDeclarations,
  VISUAL_STATIC_DECLARATION_TARGETS,
} from './visual-static-contract-declarations.mjs';

test('checked-in declarations exactly mirror runtime static contracts', async () => {
  assert.deepEqual(await checkVisualStaticContractDeclarations(), []);
  const generated = renderVisualStaticContractDeclarations();
  for (const target of VISUAL_STATIC_DECLARATION_TARGETS) {
    assert.equal(await readFile(target.path, 'utf8'), generated[target.name]);
  }
});

test('check reports drift and sync replaces it atomically with stable bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'anifor-static-dts-'));
  try {
    const targets = [
      { name: 'visualLab', path: join(root, 'visual-lab.d.ts') },
      { name: 'visualCapture', path: join(root, 'visual-capture.d.ts') },
    ];
    const declarations = renderVisualStaticContractDeclarations();
    await writeFile(targets[0].path, 'stale\n');

    assert.deepEqual(await checkVisualStaticContractDeclarations(targets, declarations), [
      targets[0].path,
      targets[1].path,
    ]);
    await syncVisualStaticContractDeclarations(targets, declarations);
    assert.deepEqual(await checkVisualStaticContractDeclarations(targets, declarations), []);
    assert.equal(await readFile(targets[0].path, 'utf8'), declarations.visualLab);
    assert.equal(await readFile(targets[1].path, 'utf8'), declarations.visualCapture);
    assert.deepEqual((await readdir(root)).sort(), ['visual-capture.d.ts', 'visual-lab.d.ts']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('renderer is deterministic and preserves literal readonly tuples', () => {
  const first = renderVisualStaticContractDeclarations();
  const second = renderVisualStaticContractDeclarations();
  assert.deepEqual(first, second);
  assert.match(first.visualLab, /readonly \[\n[\s\S]*"gas"/);
  assert.match(first.visualLab, /readonly "implemented": false/);
  assert.match(first.visualCapture, /readonly "selection": "grains"/);
  assert.match(first.visualCapture, /Readonly<Record<string, never>>/);
});
