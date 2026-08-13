import { describe, expect, it } from 'vitest';

import {
  compileVisualLabCurrentEvidencePairCatalog,
  compileVisualLabCurrentReviewArtifactCatalog,
  projectVisualLabCurrentReviewArtifacts,
  resolveVisualLabCurrentReviewArtifactPaths,
  resolveVisualLabCurrentReviewArtifacts,
  visualLabCurrentReviewArtifactInvalidationPaths,
  VISUAL_LAB_CURRENT_EVIDENCE_PAIRS,
  VISUAL_LAB_CURRENT_REVIEW_ARTIFACTS,
} from './visual-lab-review-artifacts.mjs';

describe('Visual Lab current review artifact navigation', () => {
  it('compiles one frozen ordered scripts-owned vocabulary', () => {
    expect(VISUAL_LAB_CURRENT_REVIEW_ARTIFACTS.map(({ key }) => key)).toEqual([
      'index', 'contactSheet', 'response', 'experimentBoard',
      'regionResponse', 'regionResponseBoard', 'regionAppearance', 'regionAppearanceBoard',
    ]);
    expect(Object.isFrozen(VISUAL_LAB_CURRENT_REVIEW_ARTIFACTS)).toBe(true);
    expect(VISUAL_LAB_CURRENT_REVIEW_ARTIFACTS.every(Object.isFrozen)).toBe(true);
    expect(VISUAL_LAB_CURRENT_REVIEW_ARTIFACTS.map(({ fileName, pair, kind }) => (
      [fileName, pair, kind]
    ))).toEqual([
      ['index.json', null, 'json'],
      ['index.html', null, 'html'],
      ['experiment-response.json', 'experimentResponse', 'json'],
      ['experiment-board.html', 'experimentResponse', 'html'],
      ['region-response.json', 'regionResponse', 'json'],
      ['region-response.html', 'regionResponse', 'html'],
      ['region-appearance.json', 'regionAppearance', 'json'],
      ['region-appearance.html', 'regionAppearance', 'html'],
    ]);
    expect(VISUAL_LAB_CURRENT_EVIDENCE_PAIRS).toEqual([
      {
        key: 'experimentResponse', batchValueKey: 'response',
        jsonPathKey: 'responsePath', htmlPathKey: 'experimentBoardPath',
        requirementOptionKey: 'requireExperimentResponse', required: true,
      },
      {
        key: 'regionResponse', batchValueKey: 'regionResponse',
        jsonPathKey: 'regionResponsePath', htmlPathKey: 'regionResponseBoardPath',
        requirementOptionKey: 'requireRegionResponse', required: false,
      },
      {
        key: 'regionAppearance', batchValueKey: 'regionAppearance',
        jsonPathKey: 'regionAppearancePath', htmlPathKey: 'regionAppearanceBoardPath',
        requirementOptionKey: 'requireRegionAppearance', required: false,
      },
    ]);
    expect(Object.isFrozen(VISUAL_LAB_CURRENT_EVIDENCE_PAIRS)).toBe(true);
    expect(VISUAL_LAB_CURRENT_EVIDENCE_PAIRS.every(Object.isFrozen)).toBe(true);
  });

  it('resolves and invalidates the complete declared artifact set', () => {
    const paths = resolveVisualLabCurrentReviewArtifactPaths('/review');
    expect(paths.regionAppearancePath).toBe('/review/region-appearance.json');
    expect(paths.regionAppearanceBoardPath).toBe('/review/region-appearance.html');
    const invalidation = visualLabCurrentReviewArtifactInvalidationPaths('/review');
    expect(invalidation).toContain('/review/region-appearance.json');
    expect(invalidation).toContain('/review/region-appearance.html');
    expect(invalidation).toContain('/review/region-appearance.json.tmp');
    expect(invalidation).toContain('/review/region-appearance.html.tmp');
    expect(new Set(invalidation).size).toBe(VISUAL_LAB_CURRENT_REVIEW_ARTIFACTS.length * 2);
    expect(() => resolveVisualLabCurrentReviewArtifactPaths('relative'))
      .toThrow('root must be absolute');
  });

  it('projects capture path keys into the complete public review batch', () => {
    expect(projectVisualLabCurrentReviewArtifacts({
      indexPath: '/review/index.json',
      contactSheetPath: '/review/index.html',
      responsePath: '/review/experiment-response.json',
      experimentBoardPath: '/review/experiment-board.html',
      regionResponsePath: null,
      regionResponseBoardPath: null,
      regionAppearancePath: null,
      regionAppearanceBoardPath: null,
    })).toEqual({
      index: '/review/index.json',
      contactSheet: '/review/index.html',
      response: '/review/experiment-response.json',
      experimentBoard: '/review/experiment-board.html',
      regionResponse: null,
      regionResponseBoard: null,
      regionAppearance: null,
      regionAppearanceBoard: null,
    });
  });

  it('selects optional artifacts only when produced and keeps canonical order', () => {
    expect(resolveVisualLabCurrentReviewArtifacts({
      contactSheet: '/review/index.html',
      regionResponseBoard: '/review/region-response.html',
      experimentBoard: '/review/experiment-board.html',
    }).map(({ key, path }) => ({ key, path }))).toEqual([
      { key: 'experimentBoard', path: '/review/experiment-board.html' },
      { key: 'regionResponseBoard', path: '/review/region-response.html' },
      { key: 'contactSheet', path: '/review/index.html' },
    ]);
    expect(() => resolveVisualLabCurrentReviewArtifacts({ contactSheet: '/review/index.html' }))
      .toThrow('experiment response board');
  });

  it('rejects duplicate and malformed catalog authority', () => {
    const valid = VISUAL_LAB_CURRENT_REVIEW_ARTIFACTS.map((entry) => ({
      ...entry,
      navigation: entry.navigation === null ? null : { ...entry.navigation },
    }));
    expect(() => compileVisualLabCurrentReviewArtifactCatalog([...valid, { ...valid[0] }]))
      .toThrow('Duplicate');
    expect(() => compileVisualLabCurrentReviewArtifactCatalog([
      { ...valid[0], key: '../board' }, ...valid.slice(1),
    ])).toThrow('safe camel case');
    expect(() => compileVisualLabCurrentReviewArtifactCatalog([
      { ...valid[0], required: 'yes' }, ...valid.slice(1),
    ])).toThrow('must be boolean');
    expect(() => compileVisualLabCurrentReviewArtifactCatalog([
      { ...valid[0], fileName: '../index.json' }, ...valid.slice(1),
    ])).toThrow('filename must be safe and local');
    expect(() => compileVisualLabCurrentReviewArtifactCatalog([
      { ...valid[0], kind: 'html' }, ...valid.slice(1),
    ])).toThrow('kind must match');
    expect(() => compileVisualLabCurrentReviewArtifactCatalog([
      ...valid.slice(0, 4),
      { ...valid[4], pair: 'unknown-pair' },
      ...valid.slice(5),
    ])).toThrow('pair must be safe camel case or null');
    expect(() => compileVisualLabCurrentReviewArtifactCatalog([
      ...valid.slice(0, 5),
      { ...valid[5], pair: 'regionAppearance' },
      ...valid.slice(6),
    ])).toThrow('must contain matching JSON and HTML members');
    expect(() => compileVisualLabCurrentEvidencePairCatalog([
      { ...valid[2], pair: 'responsePair' },
      { ...valid[3], pair: 'otherPair' },
    ])).toThrow('must contain matching JSON and HTML artifacts');
  });
});
