import { describe, expect, it } from 'vitest';
import { renderProfile, RenderProfile } from './render-profile';

describe('render profiles', () => {
  it('groups toolbox categories into stable visual surface families', () => {
    expect(renderProfile('powders')).toBe(RenderProfile.Granular);
    expect(renderProfile('explosives')).toBe(RenderProfile.Granular);
    expect(renderProfile('solids')).toBe(RenderProfile.Rigid);
    expect(renderProfile('life')).toBe(RenderProfile.Organic);
    expect(renderProfile('radioactive')).toBe(RenderProfile.Radioactive);
    expect(renderProfile('electronics')).toBe(RenderProfile.Device);
    expect(renderProfile('powered')).toBe(RenderProfile.Device);
    expect(renderProfile('sensors')).toBe(RenderProfile.Device);
    expect(renderProfile('force')).toBe(RenderProfile.Field);
  });

  it('leaves fluid and atmospheric phase styling neutral', () => {
    expect(renderProfile('liquids')).toBe(RenderProfile.Neutral);
    expect(renderProfile('gases')).toBe(RenderProfile.Neutral);
    expect(renderProfile('energy')).toBe(RenderProfile.Neutral);
  });
});
