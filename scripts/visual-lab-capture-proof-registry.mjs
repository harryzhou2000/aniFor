import {
  visualCaptureExecutionCapabilitiesForCaptureOrder,
  visualCaptureExecutionV2CapabilitiesForCaptureOrder,
  visualCaptureExecutionV3CapabilitiesForCaptureOrder,
  visualCaptureExecutionV4CapabilitiesForCaptureOrder,
  visualCaptureExecutionV5CapabilitiesForCaptureOrder,
  visualCaptureExecutionV6CapabilitiesForCaptureOrder,
  visualCaptureExecutionV7CapabilitiesForCaptureOrder,
  visualCaptureExecutionV8CapabilitiesForCaptureOrder,
  visualCaptureExecutionV9CapabilitiesForCaptureOrder,
} from './visual-capture-execution-capabilities.mjs';
import {
  createVisualLabExecutionTuningPlanForSchema,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V3_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V4_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V5_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V6_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V7_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V8_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V9_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_SCHEMAS,
} from './visual-lab-execution-tuning-plan.mjs';

const COMPLETED_FRAME_RECEIPT_SCHEMA = 'anifor.renderer.completed-frame-receipt/v1';

/**
 * Closed scripts-side routing metadata. This does not enter browser contracts,
 * portable plan JSON, capture identities, or static authoring manifests.
 */
export const VISUAL_LAB_CAPTURE_PROOF_REGISTRY = Object.freeze([
  Object.freeze({
    mode: 'stable-snapshots', schema: VISUAL_LAB_EXECUTION_TUNING_PLAN_SCHEMA,
    capabilitiesForCaptureOrder: visualCaptureExecutionCapabilitiesForCaptureOrder,
  }),
  Object.freeze({
    mode: 'completed-frame-receipt', schema: VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA,
    receiptSchema: COMPLETED_FRAME_RECEIPT_SCHEMA,
    capabilitiesForCaptureOrder: visualCaptureExecutionV2CapabilitiesForCaptureOrder,
  }),
  Object.freeze({
    mode: 'readiness-completed-frame-receipt', schema: VISUAL_LAB_EXECUTION_TUNING_PLAN_V3_SCHEMA,
    receiptSchema: COMPLETED_FRAME_RECEIPT_SCHEMA,
    capabilitiesForCaptureOrder: visualCaptureExecutionV3CapabilitiesForCaptureOrder,
  }),
  Object.freeze({
    mode: 'selection-owned-frame-receipt', schema: VISUAL_LAB_EXECUTION_TUNING_PLAN_V4_SCHEMA,
    receiptSchema: COMPLETED_FRAME_RECEIPT_SCHEMA,
    capabilitiesForCaptureOrder: visualCaptureExecutionV4CapabilitiesForCaptureOrder,
  }),
  Object.freeze({
    mode: 'fixture-activation-generation', schema: VISUAL_LAB_EXECUTION_TUNING_PLAN_V5_SCHEMA,
    receiptSchema: COMPLETED_FRAME_RECEIPT_SCHEMA,
    capabilitiesForCaptureOrder: visualCaptureExecutionV5CapabilitiesForCaptureOrder,
  }),
  Object.freeze({
    mode: 'fixture-activation-work-generation', schema: VISUAL_LAB_EXECUTION_TUNING_PLAN_V6_SCHEMA,
    receiptSchema: COMPLETED_FRAME_RECEIPT_SCHEMA,
    readinessCapability: 'renderer-fixture-activation-generation/v2',
    capabilitiesForCaptureOrder: visualCaptureExecutionV6CapabilitiesForCaptureOrder,
  }),
  Object.freeze({
    mode: 'fixture-activation-render-field-generation', schema: VISUAL_LAB_EXECUTION_TUNING_PLAN_V7_SCHEMA,
    receiptSchema: COMPLETED_FRAME_RECEIPT_SCHEMA,
    readinessCapability: 'renderer-fixture-activation-generation/v3',
    capabilitiesForCaptureOrder: visualCaptureExecutionV7CapabilitiesForCaptureOrder,
  }),
  Object.freeze({
    mode: 'selection-owned-frame-receipt-and-alpha-readback', schema: VISUAL_LAB_EXECUTION_TUNING_PLAN_V8_SCHEMA,
    receiptSchema: COMPLETED_FRAME_RECEIPT_SCHEMA,
    capabilitiesForCaptureOrder: visualCaptureExecutionV8CapabilitiesForCaptureOrder,
  }),
  Object.freeze({
    mode: 'fixture-activation-render-field-generation-and-selection-owned-alpha-readback',
    schema: VISUAL_LAB_EXECUTION_TUNING_PLAN_V9_SCHEMA,
    receiptSchema: COMPLETED_FRAME_RECEIPT_SCHEMA,
    readinessCapability: 'renderer-fixture-activation-generation/v3',
    capabilitiesForCaptureOrder: visualCaptureExecutionV9CapabilitiesForCaptureOrder,
  }),
]);

export const VISUAL_LAB_CAPTURE_PROOF_MODES = Object.freeze(
  VISUAL_LAB_CAPTURE_PROOF_REGISTRY.map(({ mode }) => mode),
);

const registeredSchemas = VISUAL_LAB_CAPTURE_PROOF_REGISTRY.map(({ schema }) => schema);
if (new Set(VISUAL_LAB_CAPTURE_PROOF_MODES).size !== VISUAL_LAB_CAPTURE_PROOF_MODES.length
  || new Set(registeredSchemas).size !== registeredSchemas.length
  || registeredSchemas.length !== VISUAL_LAB_EXECUTION_TUNING_PLAN_SCHEMAS.length
  || registeredSchemas.some((schema, index) => (
    schema !== VISUAL_LAB_EXECUTION_TUNING_PLAN_SCHEMAS[index]
  ))) {
  throw new TypeError('Visual Lab capture-proof registry must cover each tuning schema exactly once');
}

export const resolveVisualLabCaptureProof = (mode) => {
  const descriptor = VISUAL_LAB_CAPTURE_PROOF_REGISTRY.find((entry) => entry.mode === mode);
  if (descriptor === undefined) {
    throw new TypeError(`Unsupported Visual Lab capture proof ${String(mode)}`);
  }
  return descriptor;
};

export const visualLabCaptureProofForTuningSchema = (schema) => {
  const descriptor = VISUAL_LAB_CAPTURE_PROOF_REGISTRY.find((entry) => entry.schema === schema);
  if (descriptor === undefined) {
    throw new TypeError(`Unsupported Visual Lab execution-tuning schema ${String(schema)}`);
  }
  return descriptor.mode;
};

/** Creates the exact existing sibling plan for one closed proof mode. */
export const createVisualLabExecutionTuningPlanForCaptureProof = (
  captureExecutionPlan,
  driverOrder,
  mode,
) => {
  const descriptor = resolveVisualLabCaptureProof(mode);
  return createVisualLabExecutionTuningPlanForSchema(
    descriptor.schema,
    captureExecutionPlan,
    descriptor.capabilitiesForCaptureOrder(driverOrder),
  );
};
