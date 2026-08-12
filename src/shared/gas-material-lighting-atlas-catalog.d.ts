export interface GasMaterialLightingPoint {
  readonly x: number;
  readonly y: number;
}

export interface GasMaterialLightingRect extends GasMaterialLightingPoint {
  readonly width: number;
  readonly height: number;
}

export interface GasMaterialLightingEllipse extends GasMaterialLightingPoint {
  readonly radiusX: number;
  readonly radiusY: number;
}

export interface GasMaterialLightingCloud {
  readonly bounds: GasMaterialLightingRect;
  readonly probe: GasMaterialLightingPoint;
  readonly lobes: readonly GasMaterialLightingEllipse[];
}

export interface GasMaterialLightingAtlasDescriptor {
  readonly materials: Readonly<{
    readonly empty: number;
    readonly sooty: number;
    readonly clean: number;
    readonly warmEmitter: number;
    readonly coolEmitter: number;
    readonly solidContactOwner: number;
    readonly liquidContactOwner: number;
    readonly foreignGas: number;
    readonly foreignGasNeighbour: number;
    readonly emissiveGas: number;
  }>;
  readonly conductiveWall: number;
  readonly sooty: GasMaterialLightingCloud;
  readonly clean: GasMaterialLightingCloud;
  readonly sootyHole: GasMaterialLightingRect;
  readonly cleanChannel: GasMaterialLightingRect;
  readonly warmEmitter: GasMaterialLightingRect;
  readonly coolEmitter: GasMaterialLightingRect;
  readonly sparseSooty: readonly GasMaterialLightingPoint[];
  readonly sparseClean: readonly GasMaterialLightingPoint[];
  readonly solidContact: Readonly<{
    readonly gas: GasMaterialLightingRect;
    readonly solid: GasMaterialLightingRect;
    readonly probe: GasMaterialLightingPoint;
  }>;
  readonly liquidContact: Readonly<{
    readonly gas: GasMaterialLightingRect;
    readonly liquid: GasMaterialLightingRect;
    readonly probe: GasMaterialLightingPoint;
  }>;
  readonly foreignGasContact: Readonly<{
    readonly gas: GasMaterialLightingRect;
    readonly foreignGas: GasMaterialLightingRect;
    readonly gasProbe: GasMaterialLightingPoint;
    readonly foreignProbe: GasMaterialLightingPoint;
  }>;
  readonly nativeWall: Readonly<{
    readonly gas: GasMaterialLightingRect;
    readonly anchor: GasMaterialLightingPoint;
  }>;
  readonly emissiveGas: Readonly<{
    readonly body: GasMaterialLightingRect;
    readonly probe: GasMaterialLightingPoint;
  }>;
  readonly guardedBlank: GasMaterialLightingRect;
}

export interface GasMaterialLightingAtlasCatalogEntry {
  readonly candidate: string;
  readonly world: Readonly<{ readonly width: number; readonly height: number }>;
  readonly descriptor: GasMaterialLightingAtlasDescriptor;
}

export declare const GAS_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA:
  'anifor.visual-lab.gas-material-lighting-atlas-catalog/v1';

export declare const GAS_MATERIAL_LIGHTING_ATLAS_CATALOG: Readonly<{
  readonly schema: typeof GAS_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA;
  readonly atlases: readonly Readonly<GasMaterialLightingAtlasCatalogEntry>[];
}>;
