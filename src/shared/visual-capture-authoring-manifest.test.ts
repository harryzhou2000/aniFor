import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  normalizeVisualCaptureAuthoringManifest,
  VISUAL_CAPTURE_AUTHORING_MANIFEST,
} from './visual-capture-authoring-manifest.js';
import { VISUAL_CAPTURE_INSPECTION_SOURCE_CATALOG } from './visual-capture-inspection-source-catalog.js';
import { VISUAL_CAPTURE_STATIC_CATALOG } from './visual-capture-static-catalog.js';
import { VISUAL_CAPTURE_STATIC_CONTRACT } from './visual-capture-static-contract.js';

const digest = (value: unknown): string => createHash('sha256')
  .update(JSON.stringify(value))
  .digest('hex');

const atlas = (candidate = 'candidate') => ({
  candidate,
  world: { width: 4, height: 3 },
  descriptor: { inspectionRegions: [] },
});
const metadata = () => ({
  domain: 'powder',
  driver: 'powder-render-style',
  preparationReportLabel: 'diagnosticLabel',
});

describe('visual capture authoring manifest', () => {
  it('joins extension capture metadata and declared inspection atlases once', () => {
    expect(VISUAL_CAPTURE_AUTHORING_MANIFEST.map(({ name }) => name)).toEqual([
      'material-showcase',
      'cross-phase', 'gas', 'solid', 'source-target', 'force-activity',
      'thermal-source', 'opposed-source', 'wax', 'powder-style', 'liquid-motion', 'oil-motion',
    ]);
    const entries = VISUAL_CAPTURE_AUTHORING_MANIFEST.flatMap(({ entries }) => entries);
    expect(entries.map(({ atlas: entry }) => entry.candidate)).toEqual([
      'gas-showcase', 'oxygen-showcase',
      'material-lighting-atlas', 'gas-material-lighting-atlas',
      'solid-material-lighting-atlas', 'multi-metal-material-lighting-atlas',
      'source-target-material-lighting-atlas', 'force-activity-material-lighting-atlas',
      'thermal-source-material-lighting-atlas', 'opposed-source-material-lighting-atlas',
      'wax-material-lighting-atlas',
      'powder-style-atlas', 'water-motion', 'oil-motion',
    ]);
    expect(entries.filter(({ capture }) => capture !== null)).toHaveLength(10);
    expect(entries.filter(({ capture }) => capture === null)
      .map(({ atlas: entry }) => entry.candidate)).toEqual([
        'gas-showcase', 'oxygen-showcase', 'water-motion', 'oil-motion',
      ]);
    expect(JSON.parse(JSON.stringify(VISUAL_CAPTURE_AUTHORING_MANIFEST)))
      .toEqual(VISUAL_CAPTURE_AUTHORING_MANIFEST);
    expect(Object.isFrozen(VISUAL_CAPTURE_AUTHORING_MANIFEST)).toBe(true);
    expect(Object.isFrozen(VISUAL_CAPTURE_AUTHORING_MANIFEST[0].entries[0].capture)).toBe(true);
  });

  it('rejects imprecise, empty, duplicate, and malformed authoring data', async () => {
    expect(() => normalizeVisualCaptureAuthoringManifest([])).toThrow('manifest is malformed');
    expect(() => normalizeVisualCaptureAuthoringManifest([{
      name: 'source', entries: [{ atlas: atlas(), capture: null }], extra: true,
    } as never])).toThrow('source is malformed');
    expect(() => normalizeVisualCaptureAuthoringManifest([
      { name: 'source', entries: [{ atlas: atlas(), capture: null }] },
      { name: 'source', entries: [{ atlas: atlas('other'), capture: null }] },
    ])).toThrow('source is malformed');
    expect(() => normalizeVisualCaptureAuthoringManifest([
      { name: 'first', entries: [{ atlas: atlas(), capture: null }] },
      { name: 'second', entries: [{ atlas: atlas(), capture: null }] },
    ])).toThrow('atlas is malformed or duplicated');
    expect(() => normalizeVisualCaptureAuthoringManifest([{
      name: 'source', entries: [{ atlas: atlas(), capture: { ...metadata(), extra: true } as never }],
    }])).toThrow('metadata is malformed');
    expect(() => normalizeVisualCaptureAuthoringManifest([{
      name: 'source', entries: [{
        atlas: atlas(), capture: { ...metadata(), preparationReportLabel: '' },
      }],
    }])).toThrow('metadata is malformed');
    expect(() => normalizeVisualCaptureAuthoringManifest([{
      name: 'source', atlases: [atlas()], capture: null, captureOverrides: { missing: null },
    }])).toThrow('source is malformed');
    const sourceText = await import('node:fs/promises').then(({ readFile }) => (
      readFile(new URL('./visual-capture-authoring-manifest.js', import.meta.url), 'utf8')
    ));
    for (const forbidden of ['browserMethod', 'modulePath', 'arguments:', 'preparer:']) {
      expect(sourceText).not.toContain(forbidden);
    }
  });

  it('expands default capture metadata and bounded per-candidate overrides before export', () => {
    const defaultCapture = metadata();
    const override = { ...metadata(), preparationReportLabel: 'overrideLabel' };
    const normalized = normalizeVisualCaptureAuthoringManifest([{
      name: 'source',
      atlases: [atlas('first'), atlas('second')],
      capture: defaultCapture,
      captureOverrides: { second: override },
    }]);
    expect(normalized).toEqual([{
      name: 'source',
      entries: [
        { atlas: atlas('first'), capture: defaultCapture },
        { atlas: atlas('second'), capture: override },
      ],
    }]);
    expect(JSON.stringify(normalized)).toBe(JSON.stringify([{
      name: 'source',
      entries: [
        { atlas: atlas('first'), capture: defaultCapture },
        { atlas: atlas('second'), capture: override },
      ],
    }]));
  });

  it('preserves every public capture and inspection byte through the migration', () => {
    expect(digest(VISUAL_CAPTURE_STATIC_CONTRACT.fixtures)).toBe(
      'e1a996594c6aa778abc0adccd55456c2b9666a3441a6ceeff86355662f3dcdf0',
    );
    expect(digest(VISUAL_CAPTURE_STATIC_CONTRACT.captureRecipes)).toBe(
      'cabc6da3d727060d6574c8cba65193a1e732cb9bc7f6327de32b300452cdff19',
    );
    expect(digest(VISUAL_CAPTURE_STATIC_CONTRACT)).toBe(
      'c7ab997c69ef9e6de4acd660761abf21882d4d9a5d16daa7985c3a45b426e2ea',
    );
    expect(digest(VISUAL_CAPTURE_STATIC_CATALOG)).toBe(
      'fd8600bdcf675580c11bd8bf5b0a0091c1285208231074352f2cca51510b52aa',
    );
    expect(digest(VISUAL_CAPTURE_INSPECTION_SOURCE_CATALOG)).toBe(
      'b66cb1ed5c0eefa44fc844a21fc9aab69e97e6d43f33baa26041599705757b47',
    );
  });
});
