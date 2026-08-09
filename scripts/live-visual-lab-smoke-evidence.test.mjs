import { describe, expect, it } from 'vitest';

import {
  createLiveVisualLabSmokeEvidence,
  generateLiveVisualLabSmokeEvidence,
  LIVE_VISUAL_LAB_SMOKE_EVIDENCE_MAX_BYTES,
  LIVE_VISUAL_LAB_SMOKE_EVIDENCE_SCHEMA,
  parseLiveVisualLabSmokeEvidenceArguments,
  serializeLiveVisualLabSmokeEvidence,
} from './live-visual-lab-smoke-evidence.mjs';
import { createVisualLabResultRecord } from './visual-lab-result.mjs';

const REVISION = '1234567890abcdef1234567890abcdef12345678';
const HASHES = Object.freeze({
  off: 'a'.repeat(64),
  a: 'b'.repeat(64),
  b: 'c'.repeat(64),
});
const SHA = (character) => `sha256:${character.repeat(64)}`;
const VARIANTS = Object.freeze(['off', 'a', 'b']);

const selectionFor = (variant) => ({
  visualLab: variant === 'off' ? 'inactive' : 'active',
  visualLabDomain: 'liquid',
  visualLabVariant: String(VARIANTS.indexOf(variant)),
  visualLabTarget: '2',
  visualLabGain: '1',
});

const deepFrozen = (value) => {
  if (value === null || typeof value !== 'object') return true;
  return Object.isFrozen(value) && Object.values(value).every(deepFrozen);
};

const validVerification = () => {
  const result = createVisualLabResultRecord('water-motion', {
    domain: 'liquid', target: 2, fixture: 'water-motion', gain: 1, renderScale: 2,
  }, HASHES);
  const receipt = { schema: 'anifor.renderer.completed-frame-receipt/v1', state: 'completed' };
  return {
    // These source-only sentinels must never enter the public success artifact.
    batchRoot: '/private/runner/live-smoke',
    timings: { secretTiming: 42 },
    captureSubphases: { secretSubphase: 7 },
    index: {
      complete: true,
      summary: { selected: 1, passed: 1, failed: 0 },
      candidates: [{ candidate: 'water-motion', status: 'passed', result }],
    },
    originAttestation: {
      schema: 'anifor.visual-lab.origin-attestation/v1',
      baseUrl: 'https://private.example/AniforTPT/',
      revision: REVISION,
      postCaptureRevision: REVISION,
      checkedResources: 19,
      resources: ['/AniforTPT/assets/app.js'],
    },
    browserHostPlan: {
      schema: 'anifor.visual-lab.browser-host-plan/v1',
      id: SHA('d'),
      requestedMode: 'fresh',
    },
    executionTuningPlan: {
      schema: 'anifor.visual-lab.execution-tuning-plan/v2',
      id: SHA('e'),
      gpuMode: 'swiftshader',
    },
    captureDiagnostics: [{
      candidate: 'water-motion',
      result,
      reportPath: '/private/runner/report.json',
      execution: {
        captureEntryId: SHA('f'),
        gpu: 'swiftshader',
        executionTuning: {
          schema: 'anifor.visual-lab.execution-tuning-plan/v2',
          planId: SHA('e'),
          entryId: SHA('0'),
        },
      },
      render: { backend: 'webgl', hdrPipeline: 'active', backingSize: '1224x768' },
      invariants: { semantic: true, fieldAlpha: true, framebufferAlpha: true },
      semantic: { hash: 1, occupied: 2, countHash: 3 },
      fieldAlpha: { hash: 4, supportHash: 5, alphaSum: 6, nonzero: 7 },
      framebufferAlpha: { hash: 8, supportHash: 9, alphaSum: 10, nonzero: 11 },
      captures: Object.fromEntries(VARIANTS.map((variant) => [variant, {
        sha256: HASHES[variant],
        bytes: 123,
        width: 612,
        height: 384,
        cssWidth: 612,
        cssHeight: 384,
        clipScale: 1,
        selection: selectionFor(variant),
        completedFrameReceipt: receipt,
      }])),
    }],
  };
};

describe('live Visual Lab smoke evidence', () => {
  it('projects one frozen, canonical, bounded, path-free successful smoke record', () => {
    const verification = validVerification();
    const evidence = createLiveVisualLabSmokeEvidence(verification, {
      expectedRevision: REVISION,
      browserVersion: '123.4567.89.10',
    });
    const serialized = serializeLiveVisualLabSmokeEvidence(evidence);

    expect(evidence).toMatchObject({
      schema: LIVE_VISUAL_LAB_SMOKE_EVIDENCE_SCHEMA,
      revision: REVISION,
      browser: { product: 'chrome', version: '123.4567.89.10' },
      candidate: 'water-motion',
      result: verification.index.candidates[0].result,
      render: {
        backend: 'webgl', hdrPipeline: 'active', backingSize: '1224x768',
        captures: {
          off: { sha256: HASHES.off, completedFrameReceipt: { state: 'completed' } },
          a: { sha256: HASHES.a, completedFrameReceipt: { state: 'completed' } },
          b: { sha256: HASHES.b, completedFrameReceipt: { state: 'completed' } },
        },
      },
    });
    expect(evidence.result).toEqual(createVisualLabResultRecord('water-motion', {
      domain: 'liquid', target: 2, fixture: 'water-motion', gain: 1, renderScale: 2,
    }, HASHES));
    expect(deepFrozen(evidence)).toBe(true);
    expect(serializeLiveVisualLabSmokeEvidence(evidence)).toBe(serialized);
    expect(Buffer.byteLength(serialized, 'utf8')).toBeLessThanOrEqual(
      LIVE_VISUAL_LAB_SMOKE_EVIDENCE_MAX_BYTES,
    );
    for (const forbidden of [
      '/private/', 'https://private.example', 'report.json', 'secretTiming',
      'secretSubphase', 'ticket', 'submission', 'resources', 'batchRoot',
    ]) expect(serialized).not.toContain(forbidden);
  });

  it('uses mandatory verifier flags and rejects tampered or malformed proof data', async () => {
    const verification = validVerification();
    let verificationOptions;
    await expect(generateLiveVisualLabSmokeEvidence({
      batchRoot: '/safe/verified-batch', expectedRevision: REVISION,
      browserVersion: '1.2.3.4',
    }, {
      verifyBatch: async (options) => {
        verificationOptions = options;
        return verification;
      },
    })).resolves.toMatchObject({ revision: REVISION, candidate: 'water-motion' });
    expect(verificationOptions).toEqual({
      batchRoot: '/safe/verified-batch',
      requireBrowserHostPlan: true,
      requireExecutionTuningPlan: true,
      requireOriginAttestation: true,
      requireComplete: true,
      requireRecipeSet: true,
    });

    const cases = [
      ['revision drift', (value) => { value.originAttestation.postCaptureRevision = 'f'.repeat(40); }],
      ['result/hash mismatch', (value) => { value.captureDiagnostics[0].captures.a.sha256 = 'd'.repeat(64); }],
      ['receipt not completed', (value) => { value.captureDiagnostics[0].captures.b.completedFrameReceipt.state = 'pending'; }],
      ['forbidden capture field', (value) => { value.captureDiagnostics[0].captures.off.path = '/private/raw.png'; }],
    ];
    for (const [name, mutate] of cases) {
      const invalid = structuredClone(verification);
      mutate(invalid);
      expect(() => createLiveVisualLabSmokeEvidence(invalid, {
        expectedRevision: REVISION, browserVersion: '1.2.3.4',
      }), name).toThrow();
    }
  });

  it('strictly parses CLI flags and rejects oversized serialized output', () => {
    expect(parseLiveVisualLabSmokeEvidenceArguments([
      '--batch-root=/tmp/batch', `--expected-revision=${REVISION}`, '--browser-version=1.2.3.4',
    ])).toEqual({
      help: false, batchRoot: '/tmp/batch', expectedRevision: REVISION, browserVersion: '1.2.3.4',
    });
    expect(() => parseLiveVisualLabSmokeEvidenceArguments([
      '--batch-root=/tmp/batch', `--expected-revision=${REVISION}`, '--browser-version=1.2.3.4',
      '--browser-version=1.2.3.4',
    ])).toThrow('Unknown or duplicate');
    expect(() => serializeLiveVisualLabSmokeEvidence({ payload: 'x'.repeat(20_000) }))
      .toThrow('16384-byte budget');
  });
});
