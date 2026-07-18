export const VOLUME_FIELD_REFRESH_HZ = 12;
export const VOLUME_FIELD_REFRESH_INTERVAL = 1000 / VOLUME_FIELD_REFRESH_HZ;

export type VolumeFieldKind = 'atmosphere' | 'liquid' | 'emission';

/**
 * Limits expensive full-grid reconstructions and staggers them when both are
 * dirty. Exact material semantics remain independently refreshable every frame.
 */
export class VolumeFieldRefreshSchedule {
  private lastAtmosphere = -Infinity;
  private lastLiquid = -Infinity;
  private lastEmission = -Infinity;

  due(time: number, atmosphereDirty: boolean, liquidDirty: boolean, emissionDirty = false): boolean {
    return this.fieldDue(time, this.lastAtmosphere, atmosphereDirty)
      || this.fieldDue(time, this.lastLiquid, liquidDirty)
      || this.fieldDue(time, this.lastEmission, emissionDirty);
  }

  next(time: number, atmosphereDirty: boolean, liquidDirty: boolean, emissionDirty = false): VolumeFieldKind | undefined {
    let selected: VolumeFieldKind | undefined;
    let oldest = Infinity;
    if (this.fieldDue(time, this.lastAtmosphere, atmosphereDirty) && this.lastAtmosphere < oldest) {
      selected = 'atmosphere';
      oldest = this.lastAtmosphere;
    }
    if (this.fieldDue(time, this.lastLiquid, liquidDirty) && this.lastLiquid < oldest) {
      selected = 'liquid';
      oldest = this.lastLiquid;
    }
    if (this.fieldDue(time, this.lastEmission, emissionDirty) && this.lastEmission < oldest) selected = 'emission';
    return selected;
  }

  refreshed(field: VolumeFieldKind, time: number): void {
    if (field === 'atmosphere') this.lastAtmosphere = time;
    else if (field === 'liquid') this.lastLiquid = time;
    else this.lastEmission = time;
  }

  private fieldDue(time: number, lastRefresh: number, dirty: boolean): boolean {
    return dirty && time - lastRefresh >= VOLUME_FIELD_REFRESH_INTERVAL;
  }
}
