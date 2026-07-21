import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { shadeCanvasMaterial } from './canvas-material-style';
import {
  applyCanvasSolidBodyOptics, canvasSolidInteriorCohesion, canvasSolidRelief,
} from './canvas-solid-relief';
import { canvasSolidBodyFieldExposure } from './canvas-surface-light';
import { RenderOptics } from './render-optics';
import { RenderPhase, RenderProfile } from './render-profile';
import { canvasSurfaceChromaResponse } from './solid-surface-chroma';
import { thermalOpticsGain } from './thermal-material-style';

describe('Cellular optics baseline', () => {
  it('inherits the complete prior SmoothRigid Canvas body response before its motif', () => {
    const rigid = new Float32Array([84, 132, 46]);
    const cellular = new Float32Array(rigid);
    shadeCanvasMaterial(
      rigid, 84, 132, 46, RenderProfile.Neutral, RenderOptics.SmoothRigid,
      Material.LIFE_GOL, 37, 29, 94, 640,
    );
    shadeCanvasMaterial(
      cellular, 84, 132, 46, RenderProfile.Neutral, RenderOptics.Cellular,
      Material.LIFE_GOL, 37, 29, 94, 640,
    );
    expect(cellular).toEqual(rigid);

    expect(canvasSolidRelief(
      37, 29, Material.LIFE_GOL, RenderProfile.Neutral, RenderOptics.Cellular,
    )).toBe(canvasSolidRelief(
      37, 29, Material.LIFE_GOL, RenderProfile.Neutral, RenderOptics.SmoothRigid,
    ));
    expect(canvasSolidInteriorCohesion(RenderProfile.Neutral, RenderOptics.Cellular))
      .toBe(canvasSolidInteriorCohesion(RenderProfile.Neutral, RenderOptics.SmoothRigid));

    const rigidBody = new Float32Array([84, 132, 46]);
    const cellularBody = new Float32Array(rigidBody);
    applyCanvasSolidBodyOptics(
      rigidBody, 4, 11, 2.5, true, RenderProfile.Neutral,
      RenderOptics.SmoothRigid, 120, true,
    );
    applyCanvasSolidBodyOptics(
      cellularBody, 4, 11, 2.5, true, RenderProfile.Neutral,
      RenderOptics.Cellular, 120, true,
    );
    expect(cellularBody).toEqual(rigidBody);
  });

  it('inherits prior SmoothRigid contour, field-light, and thermal gains', () => {
    expect(canvasSurfaceChromaResponse(0.5, 0.4, 0.5, RenderOptics.Cellular))
      .toBe(canvasSurfaceChromaResponse(0.5, 0.4, 0.5, RenderOptics.SmoothRigid));
    expect(canvasSolidBodyFieldExposure(
      RenderPhase.Solid, RenderProfile.Neutral, RenderOptics.Cellular,
      0, false, true, false, 120, 2.5, true,
    )).toBe(canvasSolidBodyFieldExposure(
      RenderPhase.Solid, RenderProfile.Neutral, RenderOptics.SmoothRigid,
      0, false, true, false, 120, 2.5, true,
    ));
    expect(thermalOpticsGain(RenderOptics.Cellular))
      .toBe(thermalOpticsGain(RenderOptics.SmoothRigid));
  });
});
