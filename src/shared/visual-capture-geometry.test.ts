import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createVisualCaptureGeometryProof,
  VISUAL_CAPTURE_GEOMETRY,
  VISUAL_CAPTURE_GEOMETRY_SCHEMA,
  VISUAL_CAPTURE_LAYOUT_PROFILE,
  visualCaptureLayoutRequested,
} from './visual-capture-geometry.js';

const visitObjects = (value: unknown, visit: (nested: object) => void): void => {
  if (value === null || typeof value !== 'object') return;
  visit(value);
  for (const nested of Object.values(value)) visitObjects(nested, visit);
};

describe('Visual Lab hermetic capture geometry', () => {
  it('pins a recursively frozen, DPR-one desktop frame and centered integer canvas box', () => {
    expect(VISUAL_CAPTURE_GEOMETRY).toEqual({
      schema: 'anifor.visual-capture.geometry/v1',
      profile: 'hermetic-918x576-v1',
      activation: {
        inputAudit: '1',
        auditStage: 'visual-lab',
        visualLabAudit: '1',
      },
      world: { width: 612, height: 384 },
      deviceMetrics: {
        width: 1280,
        height: 600,
        deviceScaleFactor: 1,
        mobile: false,
        screenWidth: 1280,
        screenHeight: 600,
      },
      captureBox: {
        selector: '.semantic-field-canvas',
        left: 181,
        top: 12,
        width: 918,
        height: 576,
        clipScale: 1,
      },
    });
    expect(VISUAL_CAPTURE_GEOMETRY.schema).toBe(VISUAL_CAPTURE_GEOMETRY_SCHEMA);
    expect(VISUAL_CAPTURE_GEOMETRY.profile).toBe(VISUAL_CAPTURE_LAYOUT_PROFILE);
    expect(VISUAL_CAPTURE_GEOMETRY.captureBox.width / VISUAL_CAPTURE_GEOMETRY.captureBox.height)
      .toBe(VISUAL_CAPTURE_GEOMETRY.world.width / VISUAL_CAPTURE_GEOMETRY.world.height);
    expect(VISUAL_CAPTURE_GEOMETRY.captureBox.left * 2 + VISUAL_CAPTURE_GEOMETRY.captureBox.width)
      .toBe(VISUAL_CAPTURE_GEOMETRY.deviceMetrics.width);
    expect(VISUAL_CAPTURE_GEOMETRY.captureBox.top * 2 + VISUAL_CAPTURE_GEOMETRY.captureBox.height)
      .toBe(VISUAL_CAPTURE_GEOMETRY.deviceMetrics.height);
    visitObjects(VISUAL_CAPTURE_GEOMETRY, (nested) => expect(Object.isFrozen(nested)).toBe(true));
  });

  it('builds a frozen proof with the exact backing store at every supported Detail scale', () => {
    const expectedBacking = new Map([
      [1, [612, 384]],
      [2, [1224, 768]],
      [4, [2448, 1536]],
      [8, [4896, 3072]],
    ]);

    for (const [renderScale, [backingWidth, backingHeight]] of expectedBacking) {
      const proof = createVisualCaptureGeometryProof(renderScale);
      expect(proof).toMatchObject({
        schema: VISUAL_CAPTURE_GEOMETRY_SCHEMA,
        profile: VISUAL_CAPTURE_LAYOUT_PROFILE,
        viewport: {
          width: 1280,
          height: 600,
          devicePixelRatio: 1,
          visualScale: 1,
          scrollX: 0,
          scrollY: 0,
        },
        canvas: {
          layoutMarker: VISUAL_CAPTURE_LAYOUT_PROFILE,
          left: 181,
          top: 12,
          width: 918,
          height: 576,
          clipScale: 1,
          backingWidth,
          backingHeight,
        },
      });
      visitObjects(proof, (nested) => expect(Object.isFrozen(nested)).toBe(true));
    }
  });

  it('rejects non-integer and out-of-budget Detail scales', () => {
    for (const renderScale of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 9, '2', null]) {
      expect(() => createVisualCaptureGeometryProof(renderScale as never)).toThrow(TypeError);
    }
  });

  it('activates only for the complete existing Visual Lab input-audit tuple', () => {
    const complete = '?inputAudit=1&auditStage=visual-lab&visualLabAudit=1';
    expect(visualCaptureLayoutRequested(complete)).toBe(true);
    expect(visualCaptureLayoutRequested(
      `${complete}&renderScale=4&scene=showcase&visualLab=gas&variant=b`,
    )).toBe(true);

    for (const ordinaryOrPartialQuery of [
      '',
      '?inputAudit=1',
      '?inputAudit=1&auditStage=visual-lab',
      '?inputAudit=1&visualLabAudit=1',
      '?auditStage=visual-lab&visualLabAudit=1',
      '?inputAudit=1&auditStage=render-lab&visualLabAudit=1',
      '?inputAudit=0&auditStage=visual-lab&visualLabAudit=1',
      '?inputAudit=1&auditStage=visual-lab&visualLabAudit=0',
      '?renderLab=1',
      '?mobile=1',
      '?inputAudit=1&renderLab=1',
    ]) {
      expect(visualCaptureLayoutRequested(ordinaryOrPartialQuery)).toBe(false);
    }
  });

  it('derives the marker and CSS dimensions from the shared contract without changing ordinary selectors', () => {
    const main = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
    const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

    expect(main).toContain("from './shared/visual-capture-geometry.js'");
    expect(main).toContain('visualCaptureLayoutRequested(location.search)');
    expect(main).toContain('root.dataset.visualCaptureLayout = VISUAL_CAPTURE_GEOMETRY.profile');
    expect(main).toContain("'--visual-capture-width', `${VISUAL_CAPTURE_GEOMETRY.captureBox.width}px`");
    expect(main).toContain("'--visual-capture-height', `${VISUAL_CAPTURE_GEOMETRY.captureBox.height}px`");

    expect(styles).toContain('#app[data-visual-capture-layout] .shell');
    expect(styles).toContain('#app[data-visual-capture-layout] .workspace');
    expect(styles).toContain('#app[data-visual-capture-layout] .viewport-frame');
    expect(styles).toContain('#app[data-visual-capture-layout] .field-indicator { display: none; }');
    expect(styles).toContain('grid-template: var(--visual-capture-height) / var(--visual-capture-width)');
    expect(styles).toContain('width: var(--visual-capture-width); height: var(--visual-capture-height)');
    expect(styles).toContain('.shell { position: relative; height: 100%;');
    expect(styles).toContain('.workspace { min-height: 0; display: grid; grid-template-columns:');
    expect(styles).toContain('.viewport-frame { min-width: 0; min-height: 0; display: grid;');
    expect(styles).not.toMatch(/^\.workspace\s*\{[^}]*--visual-capture-/m);
    expect(styles).not.toMatch(/^\.viewport-frame\s*\{[^}]*--visual-capture-/m);
  });
});
