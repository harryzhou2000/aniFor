import type { MaterialCategory, MaterialPhase } from '../shared/materials';
import { AtmosphereField } from './atmosphere-field';
import { EmissionField } from './emission-field';
import { LiquidDensityField } from './liquid-density-field';
import { renderPhase, renderProfile, RenderPhase } from './render-profile';
import { renderTraits } from './render-traits';
import { VolumeFieldRefreshSchedule, type VolumeFieldKind } from './volume-field-refresh';

export interface RenderMaterialStyle {
  readonly id: number;
  readonly color: string;
  readonly category: MaterialCategory;
  readonly phase?: MaterialPhase;
  readonly emissive?: boolean;
}

export interface RenderLookups {
  readonly paletteBytes: Uint8Array;
  readonly styleBytes: Uint8Array;
  readonly gasByMaterial: Uint8Array;
  readonly liquidByMaterial: Uint8Array;
  readonly emissiveByMaterial: Uint8Array;
  readonly colorByMaterial: Uint8Array;
}

/** Canonical render metadata shared by the WebGL and Canvas2D presenters. */
export function createRenderLookups(materials: readonly RenderMaterialStyle[]): RenderLookups {
  const paletteBytes = new Uint8Array(256 * 4);
  const styleBytes = new Uint8Array(256 * 4);
  const gasByMaterial = new Uint8Array(256);
  const liquidByMaterial = new Uint8Array(256);
  const emissiveByMaterial = new Uint8Array(256);
  const colorByMaterial = new Uint8Array(256 * 3);
  for (const material of materials) {
    const color = Number.parseInt(material.color.slice(1), 16);
    const paletteOffset = material.id * 4;
    const colorOffset = material.id * 3;
    const phase = renderPhase(material);
    paletteBytes[paletteOffset] = color >>> 16;
    paletteBytes[paletteOffset + 1] = (color >>> 8) & 0xff;
    paletteBytes[paletteOffset + 2] = color & 0xff;
    paletteBytes[paletteOffset + 3] = 255;
    styleBytes[paletteOffset] = phase;
    styleBytes[paletteOffset + 1] = renderProfile(material.category);
    const emissive = material.emissive === true || phase === RenderPhase.Energy;
    styleBytes[paletteOffset + 2] = emissive ? 255 : 0;
    styleBytes[paletteOffset + 3] = renderTraits(material);
    gasByMaterial[material.id] = phase === RenderPhase.Gas ? 1 : 0;
    liquidByMaterial[material.id] = phase === RenderPhase.Liquid ? 1 : 0;
    emissiveByMaterial[material.id] = emissive ? 1 : 0;
    colorByMaterial[colorOffset] = color >>> 16;
    colorByMaterial[colorOffset + 1] = (color >>> 8) & 0xff;
    colorByMaterial[colorOffset + 2] = color & 0xff;
  }
  return { paletteBytes, styleBytes, gasByMaterial, liquidByMaterial, emissiveByMaterial, colorByMaterial };
}

/**
 * Bounded full-grid reconstructions shared by both presenters. At most one field
 * is rebuilt per frame, and each field retains the existing 12 Hz ceiling.
 */
export class RenderFieldSet {
  readonly lookups: RenderLookups;
  readonly atmosphere: AtmosphereField;
  readonly liquid: LiquidDensityField;
  readonly emission: EmissionField;
  private readonly schedule = new VolumeFieldRefreshSchedule();
  private atmosphereDirty = true;
  private liquidDirty = true;
  private emissionDirty = true;

  constructor(width: number, height: number, materials: readonly RenderMaterialStyle[]) {
    this.lookups = createRenderLookups(materials);
    this.atmosphere = new AtmosphereField(width, height, this.lookups.gasByMaterial, this.lookups.colorByMaterial);
    this.liquid = new LiquidDensityField(
      width, height, this.lookups.liquidByMaterial, this.lookups.colorByMaterial,
    );
    this.emission = new EmissionField(width, height, this.lookups.emissiveByMaterial, this.lookups.colorByMaterial);
  }

  markDirty(previousMaterial: number, nextMaterial: number): void {
    if (this.lookups.gasByMaterial[previousMaterial] || this.lookups.gasByMaterial[nextMaterial]) this.atmosphereDirty = true;
    if (this.lookups.liquidByMaterial[previousMaterial] || this.lookups.liquidByMaterial[nextMaterial]) this.liquidDirty = true;
    if (this.lookups.emissiveByMaterial[previousMaterial] || this.lookups.emissiveByMaterial[nextMaterial]) this.emissionDirty = true;
  }

  due(time: number): boolean {
    return this.schedule.due(time, this.atmosphereDirty, this.liquidDirty, this.emissionDirty);
  }

  updateNext(materials: Uint8Array, time: number): VolumeFieldKind | undefined {
    const field = this.schedule.next(time, this.atmosphereDirty, this.liquidDirty, this.emissionDirty);
    if (field === 'atmosphere') {
      this.atmosphere.update(materials);
      this.atmosphereDirty = false;
    } else if (field === 'liquid') {
      this.liquid.update(materials);
      this.liquidDirty = false;
    } else if (field === 'emission') {
      this.emission.update(materials);
      this.emissionDirty = false;
    }
    if (field) this.schedule.refreshed(field, time);
    return field;
  }

  get allocatedByteLength(): number {
    return this.lookups.paletteBytes.byteLength
      + this.lookups.styleBytes.byteLength
      + this.lookups.gasByMaterial.byteLength
      + this.lookups.liquidByMaterial.byteLength
      + this.lookups.emissiveByMaterial.byteLength
      + this.lookups.colorByMaterial.byteLength
      + this.atmosphere.allocatedByteLength
      + this.liquid.allocatedByteLength
      + this.emission.allocatedByteLength;
  }
}
