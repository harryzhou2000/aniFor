import { describe, expect, it } from 'vitest';
import {
  VOLUME_FIELD_REFRESH_INTERVAL,
  VolumeFieldRefreshSchedule,
  type VolumeFieldKind,
} from './volume-field-refresh';

describe('volume field refresh schedule', () => {
  it('refreshes a newly dirty field immediately, then enforces the interval', () => {
    const schedule = new VolumeFieldRefreshSchedule();
    expect(schedule.next(0, true, false)).toBe('atmosphere');
    schedule.refreshed('atmosphere', 0);
    expect(schedule.due(VOLUME_FIELD_REFRESH_INTERVAL - 0.01, true, false)).toBe(false);
    expect(schedule.next(VOLUME_FIELD_REFRESH_INTERVAL, true, false)).toBe('atmosphere');
  });

  it('stages simultaneous gas and liquid work over separate frames', () => {
    const schedule = new VolumeFieldRefreshSchedule();
    expect(schedule.next(0, true, true)).toBe('atmosphere');
    schedule.refreshed('atmosphere', 0);
    expect(schedule.next(1, true, true)).toBe('liquid');
    schedule.refreshed('liquid', 1);
    expect(schedule.next(2, true, true)).toBeUndefined();
  });

  it('never schedules more than one rebuild per frame or over 13 of either field per second', () => {
    const schedule = new VolumeFieldRefreshSchedule();
    const counts: Record<VolumeFieldKind, number> = { atmosphere: 0, liquid: 0 };
    for (let time = 0; time <= 1000; time += 1000 / 30) {
      const field = schedule.next(time, true, true);
      if (!field) continue;
      counts[field]++;
      schedule.refreshed(field, time);
    }
    expect(counts.atmosphere).toBeLessThanOrEqual(13);
    expect(counts.liquid).toBeLessThanOrEqual(13);
    expect(Math.abs(counts.atmosphere - counts.liquid)).toBeLessThanOrEqual(1);
  });
});
