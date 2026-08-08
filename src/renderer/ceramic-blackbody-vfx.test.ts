import { describe, expect, it } from 'vitest';
import { resolveCeramicBlackbodyVfxEnabled } from './ceramic-blackbody-vfx';

describe('Ceramic blackbody VFX selector', () => {
  it('keeps Classic on its established presentation even when requested', () => {
    expect(resolveCeramicBlackbodyVfxEnabled('classic')).toBe(false);
    expect(resolveCeramicBlackbodyVfxEnabled('classic', '?ceramicBlackbodyVfx=1')).toBe(false);
  });

  it('defaults on for styled looks', () => {
    expect(resolveCeramicBlackbodyVfxEnabled('realistic')).toBe(true);
    expect(resolveCeramicBlackbodyVfxEnabled('neon-lab')).toBe(true);
  });

  it.each(['0', 'off', 'false'])('honours explicit disabled value %s', (value) => {
    expect(resolveCeramicBlackbodyVfxEnabled('realistic', `?ceramicBlackbodyVfx=${value}`)).toBe(false);
  });

  it.each(['1', 'on', 'true'])('honours explicit enabled value %s', (value) => {
    expect(resolveCeramicBlackbodyVfxEnabled('realistic', `?ceramicBlackbodyVfx=${value}`)).toBe(true);
  });

  it('keeps input-audit captures stable unless the effect is explicitly requested', () => {
    expect(resolveCeramicBlackbodyVfxEnabled('realistic', '?inputAudit=1')).toBe(false);
    expect(resolveCeramicBlackbodyVfxEnabled(
      'realistic', '?inputAudit=1&ceramicBlackbodyVfx=1',
    )).toBe(true);
  });
});
