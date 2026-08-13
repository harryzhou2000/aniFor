import { describe, expect, it } from 'vitest';

import {
  compileVisualLabCurrentReviewArtifactCatalog,
  projectVisualLabCurrentReviewArtifacts,
  resolveVisualLabCurrentReviewArtifacts,
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
    const valid = {
      key: 'board', batchPathKey: 'boardPath', required: true,
      navigation: { order: 0, label: 'Board', description: 'the board' },
    };
    expect(() => compileVisualLabCurrentReviewArtifactCatalog([valid, { ...valid }]))
      .toThrow('Duplicate');
    expect(() => compileVisualLabCurrentReviewArtifactCatalog([
      { ...valid, key: '../board' },
    ])).toThrow('safe camel case');
    expect(() => compileVisualLabCurrentReviewArtifactCatalog([
      { ...valid, required: 'yes' },
    ])).toThrow('must be boolean');
  });
});
