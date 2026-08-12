import {
  createVisualLabCurrentRegionMeasurements,
  VISUAL_LAB_CURRENT_REGION_RESPONSE_SCHEMA,
} from './visual-lab-region-measurements.mjs';

export { VISUAL_LAB_CURRENT_REGION_RESPONSE_SCHEMA };

/** Compatibility projection for consumers that request only response data. */
export async function createVisualLabCurrentRegionResponse(batch, readCapture) {
  return (await createVisualLabCurrentRegionMeasurements(
    batch, readCapture, 'region response',
  ))?.response ?? null;
}
