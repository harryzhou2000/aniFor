import { describe, expect, it, vi } from 'vitest';
import {
  MATERIAL_CANDIDATE_SURVEY_ATLAS_CATALOG,
} from '../shared/material-candidate-survey-atlas-catalog.js';
import { VISUAL_CAPTURE_AUTHORING_MANIFEST } from '../shared/visual-capture-authoring-manifest.js';
import {
  prepareMaterialCandidateSurveyAtlas,
  type MaterialCandidateSurveyPlotter,
} from './material-candidate-survey-atlas-authoring';

const plotter = (): MaterialCandidateSurveyPlotter => ({
  roundedRect: vi.fn(), eraseRect: vi.fn(), wallPatternRect: vi.fn(), rect: vi.fn(),
});

describe('material candidate-survey atlas authoring', () => {
  it('dispatches the frozen six-card scene without granting capture registration', () => {
    const plot = plotter();
    prepareMaterialCandidateSurveyAtlas(
      plot,
      MATERIAL_CANDIDATE_SURVEY_ATLAS_CATALOG.commands,
    );
    expect(plot.wallPatternRect).toHaveBeenCalledWith(248, 168, 116, 48, 6);
    expect(plot.roundedRect).toHaveBeenCalledWith(50, 40, 120, 128, 22, 32);
    expect(plot.rect).toHaveBeenCalledWith(499, 344, 6, 14, 29, 1, 0);
    expect(Object.isFrozen(MATERIAL_CANDIDATE_SURVEY_ATLAS_CATALOG)).toBe(true);
    expect(Object.isFrozen(MATERIAL_CANDIDATE_SURVEY_ATLAS_CATALOG.audit.regions)).toBe(true);
    expect(VISUAL_CAPTURE_AUTHORING_MANIFEST.some(
      ({ name }) => name === 'material-candidate-survey',
    )).toBe(false);
  });

  it('retains the exact semantic and review contract in shared data', () => {
    const { audit } = MATERIAL_CANDIDATE_SURVEY_ATLAS_CATALOG;
    expect(audit.semantic).toMatchObject({ hash: 2_255_453_673, occupied: 115_368 });
    expect(audit.regions).toHaveLength(6);
    expect(audit.sharedContext.contactProbes).toHaveLength(6);
    expect(audit.sharedContext.wallProbes).toEqual([{ x: 252, y: 180 }, { x: 360, y: 204 }]);
  });

  it('rejects empty, malformed, and unknown command streams', () => {
    expect(() => prepareMaterialCandidateSurveyAtlas(plotter(), []))
      .toThrow('authoring is malformed');
    expect(() => prepareMaterialCandidateSurveyAtlas(plotter(), [{ kind: 'callback' }]))
      .toThrow('Unknown material candidate-survey command');
    expect(() => prepareMaterialCandidateSurveyAtlas(plotter(), [
      { kind: 'rect', x: 1 },
    ])).toThrow('invalid y');
  });
});
