import {
  createVisualLabCurrentRegionMeasurements,
  VISUAL_LAB_CURRENT_REGION_APPEARANCE_SCHEMA,
} from './visual-lab-region-measurements.mjs';

export { VISUAL_LAB_CURRENT_REGION_APPEARANCE_SCHEMA };

/** Compatibility projection for consumers that request only appearance data. */
export async function createVisualLabCurrentRegionAppearance(batch, readCapture) {
  return (await createVisualLabCurrentRegionMeasurements(
    batch, readCapture, 'region appearance',
  ))?.appearance ?? null;
}
