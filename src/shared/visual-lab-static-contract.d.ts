type NormalHdrExecutionProfile = Readonly<{
  detailScales: readonly [1, 2, 4];
  backend: 'webgl';
  pipeline: 'normal-hdr';
  variantZero: 'pixel-preserving-baseline';
  fallbacks: Readonly<{
    classic: 'disabled-preserve-baseline';
    canvas2d: 'disabled-preserve-baseline';
    hdrUnavailable: 'disabled-preserve-baseline';
    detail8x: 'disabled-preserve-baseline';
  }>;
}>;

type EmptyParameters = Readonly<Record<string, never>>;

export declare const VISUAL_LAB_STATIC_CONTRACT: Readonly<{
  schema: 'anifor.visual-lab.static-contract/v1';
  domainCodes: Readonly<{
    off: 0;
    powder: 1;
    liquid: 2;
    gas: 3;
    emission: 4;
  }>;
  domains: readonly [
    Readonly<{
      name: 'off'; code: 0; implemented: false; targetKind: 'none';
      executionProfile: null; evidence: null; fixedUrlParameters: EmptyParameters;
    }>,
    Readonly<{
      name: 'powder'; code: 1; implemented: false;
      targetKind: 'semantic-material-id'; executionProfile: null;
      evidence: null; fixedUrlParameters: EmptyParameters;
    }>,
    Readonly<{
      name: 'liquid'; code: 2; implemented: true;
      targetKind: 'semantic-material-id'; executionProfile: NormalHdrExecutionProfile;
      evidence: Readonly<{ readerMethod: 'liquidFieldAlpha'; plane: 'liquid-alpha' }>;
      fixedUrlParameters: Readonly<{ liquidBodyVfx: '1'; liquidSurfaceVfx: '1' }>;
    }>,
    Readonly<{
      name: 'gas'; code: 3; implemented: true;
      targetKind: 'propagated-atmosphere-style-byte';
      executionProfile: NormalHdrExecutionProfile;
      evidence: Readonly<{
        readerMethod: 'atmosphereFieldAlpha'; plane: 'atmosphere-alpha';
      }>;
      fixedUrlParameters: EmptyParameters;
    }>,
    Readonly<{
      name: 'emission'; code: 4; implemented: true;
      targetKind: 'semantic-material-id'; executionProfile: NormalHdrExecutionProfile;
      evidence: Readonly<{ readerMethod: 'emissionFieldAlpha'; plane: 'emission-alpha' }>;
      fixedUrlParameters: EmptyParameters;
    }>,
  ];
  captureDomainOrder: readonly ['gas', 'liquid', 'emission'];
  normalHdrExecutionProfile: NormalHdrExecutionProfile;
  fixtures: readonly [
    Readonly<{
      name: 'showcase'; scene: 'showcase';
      constraints: readonly [
        Readonly<{ domain: 'gas'; targets: null }>,
        Readonly<{ domain: 'liquid'; targets: null }>,
        Readonly<{ domain: 'emission'; targets: null }>,
      ];
      preparationReportLabel: null;
      requirement: null;
    }>,
    Readonly<{
      name: 'oil-motion'; scene: 'showcase';
      constraints: readonly [Readonly<{ domain: 'liquid'; targets: readonly [8] }>];
      preparationReportLabel: 'prepareOilMotionVfxFixture';
      requirement: '--domain=liquid --target=8';
    }>,
    Readonly<{
      name: 'water-motion'; scene: 'showcase';
      constraints: readonly [Readonly<{ domain: 'liquid'; targets: readonly [2] }>];
      preparationReportLabel: 'prepareLiquidMotionVfxFixture';
      requirement: '--domain=liquid --target=2';
    }>,
  ];
}>;
