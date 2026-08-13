export type RenderOpticsMaterialLightingPhase = 'powder' | 'liquid' | 'gas' | 'solid';

export interface RenderOpticsMaterialLightingPoint {
  readonly x: number;
  readonly y: number;
}

export interface RenderOpticsMaterialLightingRect extends RenderOpticsMaterialLightingPoint {
  readonly width: number;
  readonly height: number;
}

export interface RenderOpticsMaterialLightingCard {
  readonly key: string;
  readonly phase: RenderOpticsMaterialLightingPhase;
  readonly optics: number;
  readonly material: number;
  readonly card: RenderOpticsMaterialLightingRect;
  readonly body: RenderOpticsMaterialLightingRect;
  readonly core: RenderOpticsMaterialLightingRect;
  readonly cavity: RenderOpticsMaterialLightingRect;
  readonly openNotch: RenderOpticsMaterialLightingRect;
  readonly isolated: RenderOpticsMaterialLightingPoint;
  readonly fineControl: RenderOpticsMaterialLightingRect;
  readonly emitter: RenderOpticsMaterialLightingRect;
}

export interface RenderOpticsMaterialLightingContact {
  readonly name: string;
  readonly owner: RenderOpticsMaterialLightingRect;
  readonly neighbour: RenderOpticsMaterialLightingRect;
  readonly ownerMaterial: number;
  readonly neighbourMaterial: number;
}

export interface RenderOpticsMaterialLightingInspectionRegion extends RenderOpticsMaterialLightingRect {
  readonly name: string;
  readonly role: 'response' | 'control';
}

export interface RenderOpticsMaterialLightingAtlasDescriptor {
  readonly grid: Readonly<{
    readonly columns: 5;
    readonly rows: 4;
    readonly origin: RenderOpticsMaterialLightingPoint;
    readonly stride: RenderOpticsMaterialLightingPoint;
  }>;
  readonly cardSize: Readonly<{ readonly width: 112; readonly height: 88 }>;
  readonly materials: Readonly<{ readonly empty: 0; readonly fire: 4 }>;
  readonly conductiveWall: 1;
  readonly cards: readonly RenderOpticsMaterialLightingCard[];
  readonly contacts: readonly RenderOpticsMaterialLightingContact[];
  readonly nativeWall: Readonly<{
    readonly body: RenderOpticsMaterialLightingRect;
    readonly anchor: RenderOpticsMaterialLightingPoint;
  }>;
  readonly guardedBlank: RenderOpticsMaterialLightingRect;
  readonly inspectionRegions: readonly RenderOpticsMaterialLightingInspectionRegion[];
  readonly inspectionPresentation: Readonly<{
    readonly kind: 'material-profile-body-core';
    readonly title: 'RenderOptics profile-to-response matrix';
    readonly phases: readonly [
      Readonly<{ readonly key: 'powder'; readonly label: 'Powder' }>,
      Readonly<{ readonly key: 'liquid'; readonly label: 'Liquid' }>,
      Readonly<{ readonly key: 'gas'; readonly label: 'Gas' }>,
      Readonly<{ readonly key: 'solid'; readonly label: 'Solid' }>,
    ];
    readonly controls: Readonly<{
      readonly key: 'controls';
      readonly label: 'Topology and contact controls';
    }>;
  }>;
}

export declare const RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA:
  'anifor.visual-lab.render-optics-material-lighting-atlas-catalog/v1';

export declare const RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS_CATALOG: Readonly<{
  readonly schema: typeof RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA;
  readonly atlases: readonly Readonly<{
    readonly candidate: 'render-optics-material-lighting-atlas';
    readonly world: Readonly<{ readonly width: 612; readonly height: 384 }>;
    readonly descriptor: RenderOpticsMaterialLightingAtlasDescriptor;
  }>[];
}>;
