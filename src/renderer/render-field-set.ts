import type { MaterialCategory, MaterialPhase } from '../shared/materials';
import { AtmosphereField } from './atmosphere-field';
import { GAS_IDENTITY_STYLE_BY_MATERIAL } from './canvas-gas-identity-style';
import { EmissionField } from './emission-field';
import { LiquidDensityField } from './liquid-density-field';
import { renderOptics } from './render-optics';
import { renderPhase, renderProfile, RenderPhase } from './render-profile';
import { renderTraits } from './render-traits';
import { PowderSurfaceField } from './powder-surface-field';
import { SuspensionField } from './suspension-field';
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
  readonly gasIdentityStyleByMaterial: Uint8Array;
  readonly liquidByMaterial: Uint8Array;
  readonly emissiveByMaterial: Uint8Array;
  readonly colorByMaterial: Uint8Array;
}

/** Suspension is a soft visual volume and can trail exact semantics slightly. */
export const SUSPENSION_FIELD_REFRESH_INTERVAL = 1000 / 6;

export const enum RenderFieldDirtyLane {
  Atmosphere = 1,
  Liquid = 2,
  Emission = 4,
  Suspension = 8,
}

/** Canonical render metadata shared by the WebGL and Canvas2D presenters. */
export function createRenderLookups(materials: readonly RenderMaterialStyle[]): RenderLookups {
  const paletteBytes = new Uint8Array(256 * 4);
  const styleBytes = new Uint8Array(256 * 4);
  const gasByMaterial = new Uint8Array(256);
  const gasIdentityStyleByMaterial = new Uint8Array(GAS_IDENTITY_STYLE_BY_MATERIAL);
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
    paletteBytes[paletteOffset + 3] = renderOptics(material);
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
  return {
    paletteBytes, styleBytes, gasByMaterial, gasIdentityStyleByMaterial,
    liquidByMaterial, emissiveByMaterial, colorByMaterial,
  };
}

/**
 * Bounded full-grid reconstructions shared by both presenters. At most one
 * atmosphere/liquid/emission field is rebuilt per frame at the existing 12 Hz
 * ceiling; the independently dirtied powder surface has its own lower cadence.
 */
export class RenderFieldSet {
  readonly lookups: RenderLookups;
  readonly atmosphere: AtmosphereField;
  readonly liquid: LiquidDensityField;
  readonly emission: EmissionField;
  readonly powderSurface: PowderSurfaceField;
  readonly suspension: SuspensionField;
  private readonly schedule = new VolumeFieldRefreshSchedule();
  private atmosphereDirty = true;
  private liquidDirty = true;
  private emissionDirty = true;
  private suspensionDirty = true;
  private atmosphereOwner = 0;
  private liquidOwner = 0;
  private emissionOwner = 0;
  private suspensionOwner = 0;
  private lastSuspensionRefresh = -Infinity;

  constructor(width: number, height: number, materials: readonly RenderMaterialStyle[]) {
    this.lookups = createRenderLookups(materials);
    this.atmosphere = new AtmosphereField(
      width, height, this.lookups.gasByMaterial, this.lookups.colorByMaterial,
      this.lookups.gasIdentityStyleByMaterial,
    );
    this.liquid = new LiquidDensityField(
      width, height, this.lookups.liquidByMaterial, this.lookups.paletteBytes,
    );
    this.emission = new EmissionField(
      width, height, this.lookups.emissiveByMaterial, this.lookups.colorByMaterial,
      this.lookups.styleBytes,
    );
    this.powderSurface = new PowderSurfaceField(width, height, this.lookups.styleBytes);
    this.suspension = new SuspensionField(
      width, height, this.lookups.styleBytes, this.lookups.paletteBytes,
    );
  }

  /** Allocates and hydrates the normal-WebGL-only long-range lighting carrier. */
  enableLongRangeEmissionTransport(): void {
    if (this.emission.longRangeTransportEnabled) return;
    this.emission.enableLongRangeTransport();
    this.emissionDirty = true;
  }

  markDirty(previousMaterial: number, nextMaterial: number, index = -1, owner = 0): number {
    let lanes = 0;
    if (this.lookups.gasByMaterial[previousMaterial] || this.lookups.gasByMaterial[nextMaterial]
      || this.atmosphere.mayHaveIdentityNearWorldIndex(index)) {
      this.atmosphereDirty = true; lanes |= RenderFieldDirtyLane.Atmosphere;
      if (owner > 0) this.atmosphereOwner = owner;
    }
    if (this.lookups.liquidByMaterial[previousMaterial] || this.lookups.liquidByMaterial[nextMaterial]) {
      this.liquidDirty = true; lanes |= RenderFieldDirtyLane.Liquid;
      if (owner > 0) this.liquidOwner = owner;
    }
    if (this.lookups.emissiveByMaterial[previousMaterial]
      || this.lookups.emissiveByMaterial[nextMaterial]
      || this.emission.canMaterialEmitThermally(previousMaterial)
      || this.emission.canMaterialEmitThermally(nextMaterial)) {
      this.emissionDirty = true; lanes |= RenderFieldDirtyLane.Emission;
      if (owner > 0) this.emissionOwner = owner;
    }
    const previousPhase = this.lookups.styleBytes[previousMaterial * 4];
    const nextPhase = this.lookups.styleBytes[nextMaterial * 4];
    if (previousPhase === RenderPhase.Powder || previousPhase === RenderPhase.Liquid
      || nextPhase === RenderPhase.Powder || nextPhase === RenderPhase.Liquid) {
      this.suspensionDirty = true; lanes |= RenderFieldDirtyLane.Suspension;
      if (owner > 0) this.suspensionOwner = owner;
    }
    return lanes;
  }

  markAtmosphereBlockerDirty(index: number, owner = 0): void {
    if (this.atmosphere.mayHaveIdentityNearWorldIndex(index)) {
      this.atmosphereDirty = true;
      if (owner > 0) this.atmosphereOwner = owner;
    }
    // Native walls are also discontinuities in the caller-owned vertical
    // liquid optical-depth plane. Reuse the bounded liquid cadence so a wall
    // edit cannot leave stale depth even when liquid semantics did not change.
    this.liquidDirty = true;
    if (owner > 0) this.liquidOwner = owner;
    // The half-resolution suspension field rejects native-wall ownership while
    // deriving and packing its supported powder/liquid clusters. A wall-only
    // edit must therefore refresh that shared field too; otherwise valid bytes
    // can survive behind a newly placed wall until an unrelated material edit.
    this.suspensionDirty = true;
    if (owner > 0) this.suspensionOwner = owner;
    if (this.emission.longRangeTransportEnabled) {
      this.emissionDirty = true;
      if (owner > 0) this.emissionOwner = owner;
    }
  }

  /** Reuses the existing atmosphere cadence when only native gas flow changed. */
  markAtmosphereMotionDirty(owner = 0): void {
    if (this.atmosphere.hasVolume) {
      this.atmosphereDirty = true;
      if (owner > 0) this.atmosphereOwner = owner;
    }
  }

  /** Queues temperature-derived light through the existing bounded field cadence. */
  markThermalEmissionDirty(owner = 0): void {
    if (this.emission.hasThermalCandidate) {
      this.emissionDirty = true;
      if (owner > 0) this.emissionOwner = owner;
    }
  }

  due(time: number): boolean {
    return this.schedule.due(time, this.atmosphereDirty, this.liquidDirty, this.emissionDirty)
      || (this.suspensionDirty
        && time - this.lastSuspensionRefresh >= SUSPENSION_FIELD_REFRESH_INTERVAL);
  }

  /** Audit scheduling state, independent of each field's bounded cadence. */
  get hasPendingRefresh(): boolean {
    return this.atmosphereDirty || this.liquidDirty || this.emissionDirty || this.suspensionDirty;
  }

  hasPendingRefreshFor(owner: number): boolean {
    return owner > 0 && (this.atmosphereOwner === owner || this.liquidOwner === owner
      || this.emissionOwner === owner || this.suspensionOwner === owner);
  }

  updateNext(
    materials: Uint8Array, time: number, walls?: Uint8Array, velocities?: Int8Array,
    temperatures?: Uint16Array,
  ): VolumeFieldKind | undefined {
    const field = this.schedule.next(time, this.atmosphereDirty, this.liquidDirty, this.emissionDirty);
    if (field === 'atmosphere') {
      this.atmosphere.update(materials, walls, velocities);
      this.atmosphereDirty = false;
      this.atmosphereOwner = 0;
    } else if (field === 'liquid') {
      const owner = this.liquidOwner;
      this.liquid.update(materials);
      this.liquidDirty = false;
      this.suspensionDirty = true;
      this.liquidOwner = 0;
      if (owner > 0) this.suspensionOwner = owner;
    } else if (field === 'emission') {
      this.emission.update(materials, temperatures, walls);
      this.emissionDirty = false;
      this.emissionOwner = 0;
    }
    if (field) this.schedule.refreshed(field, time);
    return field;
  }

  /**
   * Audit-only CPU convergence for one explicit fixture-activation owner.
   * Ordinary owner-zero rendering retains `updateNext`'s one-volume-per-frame
   * cadence; this never consumes another owner's outstanding work.
   */
  drainActivationOwned(
    owner: number,
    materials: Uint8Array,
    time: number,
    walls?: Uint8Array,
    velocities?: Int8Array,
    temperatures?: Uint16Array,
  ): number {
    if (owner <= 0) return 0;
    let lanes = 0;
    if (this.atmosphereDirty && this.atmosphereOwner === owner) {
      this.atmosphere.update(materials, walls, velocities);
      this.atmosphereDirty = false;
      this.atmosphereOwner = 0;
      this.schedule.refreshed('atmosphere', time);
      lanes |= RenderFieldDirtyLane.Atmosphere;
    }
    if (this.liquidDirty && this.liquidOwner === owner) {
      this.liquid.update(materials);
      this.liquidDirty = false;
      this.liquidOwner = 0;
      this.schedule.refreshed('liquid', time);
      // Keep the established liquid reconstruction consequence exact: the
      // shared suspension field becomes owned by the liquid mutation.
      this.suspensionDirty = true;
      this.suspensionOwner = owner;
      lanes |= RenderFieldDirtyLane.Liquid;
    }
    if (this.emissionDirty && this.emissionOwner === owner) {
      this.emission.update(materials, temperatures, walls);
      this.emissionDirty = false;
      this.emissionOwner = 0;
      this.schedule.refreshed('emission', time);
      lanes |= RenderFieldDirtyLane.Emission;
    }
    // Liquid may have just authored this owner, so suspension is deliberately
    // last. Its normal cadence remains unchanged outside this explicit drain.
    if (this.suspensionDirty && this.suspensionOwner === owner) {
      this.updateSuspension(materials, walls);
      this.suspensionDirty = false;
      this.suspensionOwner = 0;
      this.lastSuspensionRefresh = time;
      lanes |= RenderFieldDirtyLane.Suspension;
    }
    return lanes;
  }

  /** Rebuilds the RGB-only powder-in-liquid presentation field. */
  updateSuspension(materials: Uint8Array, walls?: Uint8Array): boolean {
    return this.suspension.update(materials, this.liquid.bytes, walls);
  }

  /** Refreshes the soft suspension body at a bounded 6 Hz cadence. */
  refreshSuspension(
    materials: Uint8Array, time: number, walls?: Uint8Array,
  ): boolean | undefined {
    if (!this.suspensionDirty
      || time - this.lastSuspensionRefresh < SUSPENSION_FIELD_REFRESH_INTERVAL) return undefined;
    const changed = this.updateSuspension(materials, walls);
    this.suspensionDirty = false;
    this.suspensionOwner = 0;
    this.lastSuspensionRefresh = time;
    return changed;
  }

  get allocatedByteLength(): number {
    return this.lookups.paletteBytes.byteLength
      + this.lookups.styleBytes.byteLength
      + this.lookups.gasByMaterial.byteLength
      + this.lookups.gasIdentityStyleByMaterial.byteLength
      + this.lookups.liquidByMaterial.byteLength
      + this.lookups.emissiveByMaterial.byteLength
      + this.lookups.colorByMaterial.byteLength
      + this.atmosphere.allocatedByteLength
      + this.liquid.allocatedByteLength
      + this.emission.allocatedByteLength
      + this.powderSurface.allocatedByteLength
      + this.suspension.allocatedByteLength;
  }
}
