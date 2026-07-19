import { describe, expect, it, vi } from 'vitest';
import { PixiFieldPresenter } from './pixi-field-presenter';
import { powderRenderStyleValue } from './powder-render-style';

interface PresenterHarness {
  readonly uniforms: { readonly uniforms: Record<string, number> };
  readonly app: {
    readonly canvas: { readonly style: { transform: string }; readonly dataset: Record<string, string> };
    readonly render: ReturnType<typeof vi.fn>;
  };
  configurePresentation: PixiFieldPresenter['configurePresentation'];
  setGasFieldLightingEnabled: PixiFieldPresenter['setGasFieldLightingEnabled'];
  setTransform: PixiFieldPresenter['setTransform'];
}

function presenterHarness(): PresenterHarness {
  const presenter = Object.create(PixiFieldPresenter.prototype) as PresenterHarness;
  Object.assign(presenter, {
    uniforms: { uniforms: {} },
    app: {
      canvas: { style: { transform: '' }, dataset: {} },
      render: vi.fn(),
    },
  });
  return presenter;
}

describe('Pixi presenter startup configuration', () => {
  it('seeds all presentation uniforms without submitting intermediate frames', () => {
    const presenter = presenterHarness();

    presenter.configurePresentation(
      false, true, false, true, false, true, false, true, false, 'grains',
    );

    expect(presenter.uniforms.uniforms).toMatchObject({
      uGasFieldLighting: 0,
      uLiquidFieldLighting: 1,
      uTranslucentFieldTransmission: 0,
      uTranslucentBackdropRefraction: 1,
      uSolidContactDepth: 0,
      uTranslucentLensShell: 1,
      uSolidCurvatureDepth: 0,
      uThermalMaterialStyling: 1,
      uEnergyCoreRelief: 0,
      uPowderStyle: powderRenderStyleValue('grains'),
    });
    expect(presenter.app.render).not.toHaveBeenCalled();
  });

  it('keeps CSS camera transforms render-free while public style toggles redraw', () => {
    const presenter = presenterHarness();

    presenter.setTransform(1.25, 12, -8);
    expect(presenter.app.canvas.style.transform).toBe('translate3d(12px, -8px, 0) scale(1.25)');
    expect(presenter.app.render).not.toHaveBeenCalled();

    presenter.setGasFieldLightingEnabled(true);
    expect(presenter.app.render).toHaveBeenCalledOnce();
  });
});
