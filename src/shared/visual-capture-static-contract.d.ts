import type { VISUAL_LAB_STATIC_CONTRACT } from './visual-lab-static-contract.js';

type NormalHdrExecutionProfile = typeof VISUAL_LAB_STATIC_CONTRACT.normalHdrExecutionProfile;

export declare const VISUAL_CAPTURE_STATIC_CONTRACT: Readonly<{
  schema: 'anifor.visual-capture.static-contract/v1';
  evidencePlanes: readonly [
    'atmosphere-alpha', 'liquid-alpha', 'emission-alpha', 'powder-surface-alpha',
  ];
  drivers: readonly [
    Readonly<{
      name: 'normal-hdr';
      domains: readonly ['gas', 'liquid', 'emission'];
      framebufferAlphaPolicy: 'exact';
      variants: readonly [
        Readonly<{ name: 'off'; selection: 0; label: 'OFF' }>,
        Readonly<{ name: 'a'; selection: 1; label: 'A' }>,
        Readonly<{ name: 'b'; selection: 2; label: 'B' }>,
      ];
    }>,
    Readonly<{
      name: 'powder-render-style';
      domains: readonly ['powder'];
      framebufferAlphaPolicy: 'style-owned-nonempty';
      variants: readonly [
        Readonly<{ name: 'off'; selection: 'smooth'; label: 'Smooth' }>,
        Readonly<{ name: 'a'; selection: 'local'; label: 'Local' }>,
        Readonly<{ name: 'b'; selection: 'grains'; label: 'Grains' }>,
      ];
    }>,
  ];
  extensionDomains: readonly [Readonly<{
    name: 'powder';
    targetKind: 'none';
    driver: 'powder-render-style';
    executionProfile: NormalHdrExecutionProfile;
    evidence: Readonly<{
      plane: 'powder-surface-alpha';
    }>;
    fixedUrlParameters: Readonly<Record<string, never>>;
  }>];
  fixtures: readonly [Readonly<{
    name: 'powder-style-atlas';
    scene: 'showcase';
    driver: 'powder-render-style';
    constraints: readonly [Readonly<{ domain: 'powder'; targets: readonly [0] }>];
    preparationReportLabel: 'preparePowderStyleAtlasFixture';
    requirement: '--domain=powder --target=0';
  }>];
  captureRecipes: readonly [Readonly<{
    name: 'powder-style-atlas'; domain: 'powder'; target: 0;
    fixture: 'powder-style-atlas'; gain: 1; renderScale: 2;
  }>];
}>;

export type VisualCaptureEvidencePlane = (
  typeof VISUAL_CAPTURE_STATIC_CONTRACT.evidencePlanes[number]
);
