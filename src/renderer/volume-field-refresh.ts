export const VOLUME_FIELD_REFRESH_HZ = 12;
export const VOLUME_FIELD_REFRESH_INTERVAL = 1000 / VOLUME_FIELD_REFRESH_HZ;

export type VolumeFieldKind = 'atmosphere' | 'liquid';

/**
 * Limits expensive full-grid reconstructions and staggers them when both are
 * dirty. Exact material semantics remain independently refreshable every frame.
 */
export class VolumeFieldRefreshSchedule {
  private lastAtmosphere = -Infinity;
  private lastLiquid = -Infinity;

  due(time: number, atmosphereDirty: boolean, liquidDirty: boolean): boolean {
    return this.fieldDue(time, this.lastAtmosphere, atmosphereDirty)
      || this.fieldDue(time, this.lastLiquid, liquidDirty);
  }

  next(time: number, atmosphereDirty: boolean, liquidDirty: boolean): VolumeFieldKind | undefined {
    const atmosphereDue = this.fieldDue(time, this.lastAtmosphere, atmosphereDirty);
    const liquidDue = this.fieldDue(time, this.lastLiquid, liquidDirty);
    if (atmosphereDue && liquidDue) return this.lastAtmosphere <= this.lastLiquid ? 'atmosphere' : 'liquid';
    if (atmosphereDue) return 'atmosphere';
    if (liquidDue) return 'liquid';
    return undefined;
  }

  refreshed(field: VolumeFieldKind, time: number): void {
    if (field === 'atmosphere') this.lastAtmosphere = time;
    else this.lastLiquid = time;
  }

  private fieldDue(time: number, lastRefresh: number, dirty: boolean): boolean {
    return dirty && time - lastRefresh >= VOLUME_FIELD_REFRESH_INTERVAL;
  }
}
