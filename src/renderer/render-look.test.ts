import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RENDER_LOOK, resolveLiquidBodyVfxEnabled, resolveRenderLook,
  resolveVolumeVfxEnabled,
} from './render-look';

describe('resolveRenderLook', () => {
  it('retains the established renderer as the experiment control', () => {
    expect(resolveRenderLook('')).toBe(DEFAULT_RENDER_LOOK);
    expect(resolveRenderLook('?renderLook=unknown')).toBe(DEFAULT_RENDER_LOOK);
  });

  it.each(['classic', 'realistic', 'neon-lab'] as const)(
    'accepts the %s preset',
    (look) => expect(resolveRenderLook(`?renderLook=${look}`)).toBe(look),
  );

  it('keeps volume VFX opt-in through an HDR preset and independently switchable', () => {
    expect(resolveVolumeVfxEnabled('classic', '?volumeVfx=on')).toBe(false);
    expect(resolveVolumeVfxEnabled('realistic', '')).toBe(true);
    expect(resolveVolumeVfxEnabled('neon-lab', '?volumeVfx=1')).toBe(true);
    expect(resolveVolumeVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolveVolumeVfxEnabled('neon-lab', '?volumeVfx=off')).toBe(false);
  });

  it('lets liquid-body VFX follow the preset or override broad volume styling', () => {
    expect(resolveLiquidBodyVfxEnabled('classic', '?liquidBodyVfx=on')).toBe(false);
    expect(resolveLiquidBodyVfxEnabled('realistic', '')).toBe(true);
    expect(resolveLiquidBodyVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolveLiquidBodyVfxEnabled(
      'realistic', '?volumeVfx=0&liquidBodyVfx=on',
    )).toBe(true);
    expect(resolveLiquidBodyVfxEnabled(
      'neon-lab', '?volumeVfx=1&liquidBodyVfx=off',
    )).toBe(false);
  });
});
