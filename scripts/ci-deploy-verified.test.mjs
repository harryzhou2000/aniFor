import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';

const WORKFLOW_URL = new URL('../.github/workflows/ci.yml', import.meta.url);
const SOURCE_XOR = [
  "(needs.build.result == 'success' && needs.verified_build.result == 'skipped')",
  '||',
  "(needs.build.result == 'skipped' && needs.verified_build.result == 'success')",
].join(' ');

let workflow;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compact = (value) => value.replace(/\s+/g, ' ').trim();

function indentedEntry(source, name, indentation) {
  const prefix = ' '.repeat(indentation);
  const marker = new RegExp(`^${prefix}${escapeRegExp(name)}:\\s*$`, 'm');
  const match = marker.exec(source);
  if (!match) throw new Error(`Missing ${name} entry at indentation ${indentation}`);
  const start = match.index;
  const remainder = source.slice(start + match[0].length);
  const next = new RegExp(`^${prefix}[^ \\n][^:\\n]*:\\s*$`, 'm').exec(remainder);
  return source.slice(start, next ? start + match[0].length + next.index : source.length);
}

function namedStep(job, name) {
  const marker = `      - name: ${name}`;
  const start = job.indexOf(marker);
  if (start < 0) throw new Error(`Missing workflow step ${name}`);
  const remainder = job.slice(start + marker.length);
  const next = /^      - (?:name|uses):/m.exec(remainder);
  return job.slice(start, next ? start + marker.length + next.index : job.length);
}

function permissionEntries(job) {
  const permissions = indentedEntry(job, 'permissions', 4);
  return Object.fromEntries([...permissions.matchAll(/^      ([a-z-]+):\s*(\S+)\s*$/gm)]
    .map(([, name, value]) => [name, value]));
}

describe('deploy-verified CI workflow contract', () => {
  beforeAll(async () => { workflow = await readFile(WORKFLOW_URL, 'utf8'); });

  it('preserves the build controls and adds one exact verified-run input', () => {
    const operation = indentedEntry(workflow, 'operation', 6);
    const choices = [...operation.matchAll(/^          - ([a-z-]+)\s*$/gm)]
      .map(([, choice]) => choice);
    expect(operation).toContain('default: build');
    expect(choices).toEqual(['build', 'build-and-deploy', 'deploy-verified']);

    const sourceRun = indentedEntry(workflow, 'verified_build_run_id', 6);
    expect(sourceRun).toContain('required: false');
    expect(sourceRun).toContain("default: ''");
    expect(sourceRun).toContain('type: string');

    const inputReferences = workflow.match(/\$\{\{\s*inputs\.verified_build_run_id\s*\}\}/g) ?? [];
    expect(inputReferences).toHaveLength(1);
  });

  it('exposes a bounded Visual Lab capture-proof choice without changing its default', () => {
    const captureProof = indentedEntry(workflow, 'visual_lab_capture_proof', 6);
    const choices = [...captureProof.matchAll(/^          - ([a-z-]+)\s*$/gm)]
      .map(([, choice]) => choice);
    expect(captureProof).toContain('description: Evidence proof used by an optional Visual Lab review');
    expect(captureProof).toContain('required: true');
    expect(captureProof).toContain('default: stable-snapshots');
    expect(captureProof).toContain('type: choice');
    expect(choices).toEqual(['stable-snapshots', 'completed-frame-receipt']);

    const inputReferences = workflow.match(
      /\$\{\{\s*inputs\.visual_lab_capture_proof\s*\}\}/g,
    ) ?? [];
    expect(inputReferences).toHaveLength(1);
  });

  it('defaults manual review to the current material-lighting cohort', () => {
    const candidates = indentedEntry(workflow, 'visual_lab_candidates', 6);
    expect(candidates).toContain(
      'description: Comma-separated candidates; clear to run the frozen catalog',
    );
    expect(candidates).toContain(
      'default: material-lighting-atlas,gas-material-lighting-atlas,'
      + 'solid-material-lighting-atlas,source-target-material-lighting-atlas,'
      + 'force-activity-material-lighting-atlas,thermal-source-material-lighting-atlas,'
      + 'opposed-source-material-lighting-atlas',
    );
    expect(candidates).toContain('required: false');
    expect(candidates).toContain('type: string');
  });

  it('restores the nearest ccache lineage and saves each successful commit', () => {
    const build = indentedEntry(workflow, 'build', 2);
    const restore = namedStep(build, 'Restore C++ compiler cache');
    const save = namedStep(build, 'Save C++ compiler cache after successful build');
    expect(restore).toContain('uses: actions/cache/restore@v6');
    expect(restore).toContain("hashFiles('native/**', 'patches/**', 'scripts/build-tpt-wasm.sh',");
    expect(restore).toContain("'scripts/fetch-powder-toy.sh') }}-${{ github.sha }}");
    expect(restore.match(/ccache-\$\{\{ runner\.os \}\}-emsdk-6\.0\.3-/g))
      .toHaveLength(3);
    expect(save).toContain("if: success() && steps.ccache-restore.outputs.cache-hit != 'true'");
    expect(save).toContain('uses: actions/cache/save@v6');
    expect(save).toContain('key: ${{ steps.ccache-restore.outputs.cache-primary-key }}');
    expect(build.indexOf(restore)).toBeLessThan(build.indexOf(save));
  });

  it('makes build and exact-SHA reuse mutually exclusive and resolves provenance first', () => {
    const build = indentedEntry(workflow, 'build', 2);
    const verified = indentedEntry(workflow, 'verified_build', 2);
    expect(build).toContain(
      "if: github.event_name != 'workflow_dispatch' || inputs.operation != 'deploy-verified'",
    );
    expect(verified).toContain(
      "if: github.event_name == 'workflow_dispatch' && inputs.operation == 'deploy-verified'",
    );
    expect(build).not.toContain('verify-pages-artifact-source.mjs');
    expect(verified).not.toContain('npm run build:all');

    const resolve = namedStep(verified, 'Resolve exact successful build artifact');
    const download = namedStep(verified, 'Download exact verified static site');
    expect(verified.indexOf(resolve)).toBeLessThan(verified.indexOf(download));
    expect(resolve).toContain('VERIFIED_BUILD_RUN_ID: ${{ inputs.verified_build_run_id }}');
    expect(resolve).toContain('node scripts/verify-pages-artifact-source.mjs');
    expect(resolve).toContain('--repository="${GITHUB_REPOSITORY}"');
    expect(resolve).toContain('--source-run-id="${VERIFIED_BUILD_RUN_ID}"');
    expect(resolve).toContain('--current-run-id="${GITHUB_RUN_ID}"');
    expect(resolve).toContain('--expected-sha="${GITHUB_SHA}"');
    expect(resolve).not.toContain('--output=');

    expect(download).toContain('uses: actions/download-artifact@v8');
    expect(download).toContain('artifact-ids: ${{ steps.verified-source.outputs.artifact_id }}');
    expect(download).toContain('github-token: ${{ github.token }}');
    expect(download).toContain('repository: ${{ github.repository }}');
    expect(download).toContain('run-id: ${{ steps.verified-source.outputs.source_run_id }}');
    expect(download).toContain('digest-mismatch: error');
    expect(download).toContain('path: ${{ runner.temp }}/anifortpt-static-site');
    expect(download).not.toMatch(/^          name:/m);
  });

  it('verifies the extracted tree before republishing either current-run artifact', () => {
    const verified = indentedEntry(workflow, 'verified_build', 2);
    const localVerify = namedStep(verified, 'Verify reused revision and runtime asset closure');
    const publishSite = namedStep(verified, 'Publish verified static site for current-run consumers');
    const configurePages = namedStep(verified, 'Configure GitHub Pages');
    const uploadPages = namedStep(verified, 'Upload verified GitHub Pages artifact');
    const positions = [localVerify, publishSite, configurePages, uploadPages]
      .map((step) => verified.indexOf(step));
    expect(positions).toEqual([...positions].sort((left, right) => left - right));

    expect(localVerify).toContain('node scripts/verify-pages-artifact.mjs');
    expect(localVerify).toContain('"${RUNNER_TEMP}/anifortpt-static-site"');
    expect(localVerify).toContain('"${GITHUB_SHA}"');
    expect(publishSite).toContain('uses: actions/upload-artifact@v7');
    expect(publishSite).toContain('name: anifortpt-static-site');
    expect(publishSite).toContain('path: ${{ runner.temp }}/anifortpt-static-site');
    expect(publishSite).toContain('if-no-files-found: error');
    expect(configurePages).toContain('uses: actions/configure-pages@v6');
    expect(uploadPages).toContain('uses: actions/upload-pages-artifact@v5');
    expect(uploadPages).toContain('path: ${{ runner.temp }}/anifortpt-static-site');

    expect(permissionEntries(verified)).toEqual({ actions: 'read', contents: 'read' });
    expect(verified).not.toContain('pages: write');
    expect(verified).not.toContain('id-token: write');
  });

  it('uses the same source XOR for optional review and both deployment modes', () => {
    const review = indentedEntry(workflow, 'visual-lab-review', 2);
    const deploy = indentedEntry(workflow, 'deploy', 2);
    expect(compact(review)).toContain(SOURCE_XOR);
    expect(compact(deploy)).toContain(SOURCE_XOR);
    for (const job of [review, deploy]) {
      expect(job).toContain('      - build');
      expect(job).toContain('      - verified_build');
    }
    expect(compact(review)).toContain("inputs.visual_lab_review == true");
    expect(compact(deploy)).toContain("needs.visual-lab-review.result == 'success'");
    expect(compact(deploy)).toContain("needs.visual-lab-review.result == 'skipped'");
    expect(compact(deploy)).toContain(
      "github.event_name == 'push' && github.ref == 'refs/heads/main'",
    );
    expect(compact(deploy)).toContain("inputs.operation == 'build-and-deploy'");
    expect(compact(deploy)).toContain("inputs.operation == 'deploy-verified'");
    expect(compact(deploy)).not.toContain("inputs.operation == 'build'");
    expect(permissionEntries(deploy)).toEqual({ pages: 'write', 'id-token': 'write' });
  });

  it('retains review artifact verification and exact live-revision verification order', () => {
    const review = indentedEntry(workflow, 'visual-lab-review', 2);
    const capture = namedStep(review, 'Capture deterministic Visual Lab review');
    const upload = review.indexOf('Upload Visual Lab review evidence');
    const download = review.indexOf('Download uploaded Visual Lab review evidence');
    const verify = review.indexOf('node scripts/visual-lab-verify.mjs "${verify_args[@]}"');
    expect(upload).toBeGreaterThan(0);
    expect(download).toBeGreaterThan(upload);
    expect(verify).toBeGreaterThan(download);
    expect(review).toContain('name: anifortpt-visual-lab-${{ github.sha }}');
    expect(review).toContain('path: ${{ runner.temp }}/anifortpt-visual-lab-review');
    expect(review).toContain('"--batch-root=${REVIEW_ROOT}"');
    expect(review).not.toContain('Compare with the accepted Visual Lab baseline');
    expect(review).not.toContain('--baseline-root=visual-baselines/accepted-v1');
    expect(review).not.toContain('"--comparison-root=${REVIEW_ROOT}/comparison"');
    expect(review).toContain('--require-complete=1');
    expect(review).toContain('--require-recipe-set=1');
    expect(review).toContain('--require-browser-host-plan=1');
    expect(review).not.toContain('--require-baseline-capture-provenance=1');
    expect(review).toContain('--require-capture-geometry=1');
    expect(review).toContain('--require-execution-tuning-plan=1');
    expect(review).toContain('--require-experiment-response=1');
    expect(review).toContain('--require-region-response=1');
    expect(capture).toContain('--browser-host=shared');
    expect(capture.match(/--browser-host=shared/g)).toHaveLength(1);
    expect(capture).not.toContain('--browser-host=fresh');
    expect(capture).toContain(
      'VISUAL_LAB_CAPTURE_PROOF: ${{ inputs.visual_lab_capture_proof }}',
    );
    expect(capture).toContain('"--capture-proof=${VISUAL_LAB_CAPTURE_PROOF}"');
    expect(capture.match(/--capture-proof=/g)).toHaveLength(1);

    const live = indentedEntry(workflow, 'verify-deployment', 2);
    expect(live).toContain("if: always() && needs.deploy.result == 'success'");
    expect(live).toContain('needs: deploy');
    expect(live).toContain('timeout-minutes: 10');
    expect(live).toContain('uses: actions/setup-node@v7');
    expect(live).toContain('node-version: 22');
    expect(live).toContain('PAGE_URL: ${{ needs.deploy.outputs.page_url }}');
    const staticClosure = live.indexOf(
      'node scripts/verify-live-pages.mjs "${PAGE_URL}" "${GITHUB_SHA}"',
    );
    const functionalSmoke = live.indexOf(
      'node scripts/visual-lab-batch.mjs', staticClosure,
    );
    expect(staticClosure).toBeGreaterThan(0);
    expect(functionalSmoke).toBeGreaterThan(staticClosure);
    expect(live).toContain('--base-url="${PAGE_URL}"');
    expect(live).toContain('--expected-revision="${GITHUB_SHA}"');
    expect(live).toContain('--candidates=water-motion');
    expect(live).toContain('--gpu=swiftshader');
    expect(live).toContain('--capture-proof=completed-frame-receipt');
    expect(live.match(/--capture-proof=completed-frame-receipt/g)).toHaveLength(1);
    expect(live).not.toContain('VISUAL_LAB_CAPTURE_PROOF');
    expect(live).not.toContain('inputs.visual_lab_capture_proof');
    expect(live).toContain('node scripts/visual-lab-verify.mjs');
    expect(live).toContain('--require-capture-geometry=1');
    expect(live).toContain('--require-origin-attestation=1');
    expect(live).toContain('timeout --foreground --kill-after=15s 240s');
    expect(live).toContain('DIAGNOSTIC_DIR: ${{ runner.temp }}/anifortpt-live-visual-lab-diagnostics');
    expect(live).toContain('set -o pipefail');
    expect(live.match(/tail -c 65536/g)).toHaveLength(2);
    expect(live).toContain('tee "${DIAGNOSTIC_DIR}/batch.log"');
    expect(live).toContain('tee "${DIAGNOSTIC_DIR}/verify.log"');
    const portableVerification = live.indexOf(
      'node scripts/visual-lab-verify.mjs', functionalSmoke,
    );
    expect(portableVerification).toBeGreaterThan(functionalSmoke);
    const evidence = namedStep(live, 'Generate deployed Visual Lab smoke evidence');
    const evidenceUpload = namedStep(live, 'Upload deployed Visual Lab smoke evidence');
    const evidenceGeneration = live.indexOf(evidence);
    const evidencePublication = live.indexOf(evidenceUpload);
    expect(evidenceGeneration).toBeGreaterThan(portableVerification);
    expect(evidencePublication).toBeGreaterThan(evidenceGeneration);
    expect(evidence).toContain(
      'SMOKE_DIR: ${{ runner.temp }}/anifortpt-live-visual-lab-smoke',
    );
    expect(evidence).toContain(
      'EVIDENCE_DIR: ${{ runner.temp }}/anifortpt-live-visual-lab-evidence',
    );
    expect(evidence).toContain('node scripts/live-visual-lab-smoke-evidence.mjs');
    expect(evidence).toContain('--batch-root="${SMOKE_DIR}"');
    expect(evidence).toContain('--expected-revision="${GITHUB_SHA}"');
    expect(evidence).toContain('--browser-version="$(google-chrome --product-version)"');
    expect(evidence).toContain('> "${EVIDENCE_DIR}/evidence.json"');
    expect(evidence).toContain('test "$(wc -c < "${EVIDENCE_DIR}/evidence.json")" -le 16384');
    expect(evidenceUpload).toContain('if: success()');
    expect(evidenceUpload).toContain('uses: actions/upload-artifact@v7');
    expect(evidenceUpload).toContain(
      'name: anifortpt-live-visual-lab-evidence-${{ github.run_attempt }}',
    );
    expect(evidenceUpload).toContain(
      'path: ${{ runner.temp }}/anifortpt-live-visual-lab-evidence/evidence.json',
    );
    expect(evidenceUpload).toContain('if-no-files-found: error');
    expect(evidenceUpload).toContain('retention-days: 7');
    expect(evidenceUpload).not.toContain('anifortpt-live-visual-lab-smoke');
    expect(evidenceUpload).not.toContain('anifortpt-live-visual-lab-diagnostics');
    const failureUpload = live.indexOf('Upload deployed Visual Lab failure diagnostics');
    expect(failureUpload).toBeGreaterThan(evidencePublication);
    expect(live.slice(failureUpload)).toContain('if: failure()');
    expect(live.slice(failureUpload)).toContain('actions/upload-artifact@v7');
    expect(live.slice(failureUpload)).toContain(
      'path: ${{ runner.temp }}/anifortpt-live-visual-lab-diagnostics',
    );
    expect(live.slice(failureUpload)).not.toContain(
      'path: ${{ runner.temp }}/anifortpt-live-visual-lab-smoke',
    );
    expect(workflow.indexOf('  verify-deployment:')).toBeGreaterThan(
      workflow.indexOf('  deploy:'),
    );
  });
});
