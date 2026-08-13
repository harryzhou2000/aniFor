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
      'cross-phase', 'gas', 'solid', 'source-target', 'force-activity',
      'thermal-source', 'opposed-source', 'powder-style', 'liquid-motion', 'oil-motion',
    ]);
    const entries = VISUAL_CAPTURE_AUTHORING_MANIFEST.flatMap(({ entries }) => entries);
    expect(entries.map(({ atlas: entry }) => entry.candidate)).toEqual([
      'material-lighting-atlas', 'gas-material-lighting-atlas',
      'solid-material-lighting-atlas', 'multi-metal-material-lighting-atlas',
      'source-target-material-lighting-atlas', 'force-activity-material-lighting-atlas',
      'thermal-source-material-lighting-atlas', 'opposed-source-material-lighting-atlas',
      'powder-style-atlas', 'water-motion', 'oil-motion',
    ]);
    expect(entries.filter(({ capture }) => capture !== null)).toHaveLength(9);
    expect(entries.filter(({ capture }) => capture === null)
      .map(({ atlas: entry }) => entry.candidate)).toEqual(['water-motion', 'oil-motion']);
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
    const sourceText = await import('node:fs/promises').then(({ readFile }) => (
      readFile(new URL('./visual-capture-authoring-manifest.js', import.meta.url), 'utf8')
    ));
    for (const forbidden of ['browserMethod', 'modulePath', 'arguments:', 'preparer:']) {
      expect(sourceText).not.toContain(forbidden);
    }
  });

  it('preserves every public capture and inspection byte through the migration', () => {
    expect(digest(VISUAL_CAPTURE_STATIC_CONTRACT.fixtures)).toBe(
      'fd4960aa920cc6dd64f3a9dbad5b8af807944e6c8ce600d767c8260b82cbadbd',
    );
    expect(digest(VISUAL_CAPTURE_STATIC_CONTRACT.captureRecipes)).toBe(
      '557d7d29dcafe1aea3ac78bd78909914d285bc2a3618ee48c3d32947f6973221',
    );
    expect(digest(VISUAL_CAPTURE_STATIC_CONTRACT)).toBe(
      'ed04ce4484272e44cd9515eb37a590f8e049007fb5aa1dcbca19f88085a7b854',
    );
    expect(digest(VISUAL_CAPTURE_STATIC_CATALOG)).toBe(
      'b9dd73c7695853fc41cf52f6cc703a94a491a8d482fb9433833e4d027d3be3bb',
    );
    expect(digest(VISUAL_CAPTURE_INSPECTION_SOURCE_CATALOG)).toBe(
      '7ad61fe01474846627a53bcca8baf1fff6359a0ee2c080680484c0bb6eb5cc0b',
    );
  });
});
