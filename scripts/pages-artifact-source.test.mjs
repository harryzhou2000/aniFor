import { describe, expect, it } from 'vitest';

import {
  PAGES_ARTIFACT_NAME,
  PAGES_WORKFLOW_NAME,
  PAGES_WORKFLOW_PATH,
  resolvePagesArtifactSource,
  validatePagesArtifactSource,
} from './pages-artifact-source.mjs';
import {
  createGitHubRequestJson,
  parsePagesArtifactSourceArguments,
  runPagesArtifactSourceCli,
} from './verify-pages-artifact-source.mjs';

const CURRENT_RUN_ID = 94001;
const SOURCE_RUN_ID = 93001;
const WORKFLOW_ID = 417;
const REPOSITORY_ID = 208;
const REPOSITORY = 'anifort/AniforTPT';
const SHA = '1234567890abcdef1234567890abcdef12345678';
const OTHER_SHA = 'a'.repeat(40);
const DIGEST = `sha256:${'b'.repeat(64)}`;

function runRecord({ id, event, status, conclusion }) {
  return {
    id,
    workflow_id: WORKFLOW_ID,
    name: PAGES_WORKFLOW_NAME,
    path: PAGES_WORKFLOW_PATH,
    event,
    status,
    conclusion,
    head_sha: SHA,
    repository: { id: REPOSITORY_ID, full_name: REPOSITORY },
    head_repository: { id: REPOSITORY_ID, full_name: REPOSITORY },
  };
}

function fixture() {
  return {
    currentRunId: CURRENT_RUN_ID,
    sourceRunId: SOURCE_RUN_ID,
    expectedRepository: REPOSITORY,
    expectedSha: SHA,
    currentRun: runRecord({
      id: CURRENT_RUN_ID,
      event: 'workflow_dispatch',
      status: 'in_progress',
      conclusion: null,
    }),
    sourceRun: runRecord({
      id: SOURCE_RUN_ID,
      event: 'push',
      status: 'completed',
      conclusion: 'success',
    }),
    sourceJobs: {
      total_count: 2,
      jobs: [
        {
          id: 781,
          run_id: SOURCE_RUN_ID,
          head_sha: SHA,
          name: 'build',
          status: 'completed',
          conclusion: 'success',
          started_at: '2026-08-12T05:00:00Z',
          completed_at: '2026-08-12T05:04:00Z',
        },
        {
          id: 782,
          run_id: SOURCE_RUN_ID,
          head_sha: SHA,
          name: 'verify-deployment',
          status: 'completed',
          conclusion: 'success',
          started_at: '2026-08-12T05:10:00Z',
          completed_at: '2026-08-12T05:11:00Z',
        },
      ],
    },
    artifacts: {
      total_count: 2,
      artifacts: [
        {
          id: 551,
          name: PAGES_ARTIFACT_NAME,
          expired: false,
          size_in_bytes: 4096,
          digest: DIGEST,
          workflow_run: {
            id: SOURCE_RUN_ID,
            repository_id: REPOSITORY_ID,
            head_repository_id: REPOSITORY_ID,
            head_sha: SHA,
          },
        },
        {
          id: 552,
          name: 'unrelated-diagnostics',
          expired: false,
          size_in_bytes: 16,
          digest: `sha256:${'c'.repeat(64)}`,
          workflow_run: {
            id: SOURCE_RUN_ID,
            repository_id: REPOSITORY_ID,
            head_repository_id: REPOSITORY_ID,
            head_sha: SHA,
          },
        },
      ],
    },
  };
}

function expectMutationRejected(mutator, message) {
  const evidence = fixture();
  mutator(evidence);
  expect(() => validatePagesArtifactSource(evidence)).toThrow(message);
}

function resolverRequest(evidence = fixture()) {
  return {
    options: {
      currentRunId: evidence.currentRunId,
      sourceRunId: evidence.sourceRunId,
      expectedRepository: evidence.expectedRepository,
      expectedSha: evidence.expectedSha,
    },
    payloads: new Map([
      [`/repos/anifort/AniforTPT/actions/runs/${CURRENT_RUN_ID}`, evidence.currentRun],
      [`/repos/anifort/AniforTPT/actions/runs/${SOURCE_RUN_ID}`, evidence.sourceRun],
      [
        `/repos/anifort/AniforTPT/actions/runs/${SOURCE_RUN_ID}`
          + '/jobs?filter=latest&per_page=100',
        evidence.sourceJobs,
      ],
      [
        `/repos/anifort/AniforTPT/actions/runs/${SOURCE_RUN_ID}/artifacts?per_page=100`,
        evidence.artifacts,
      ],
    ]),
  };
}

describe('Pages artifact source provenance', () => {
  it('accepts one same-revision repository-owned successful source build and artifact', () => {
    const evidence = fixture();
    expect(validatePagesArtifactSource(evidence)).toEqual({
      artifactId: 551,
      sourceRunId: SOURCE_RUN_ID,
      artifactDigest: DIGEST,
    });
    expect(Object.isFrozen(validatePagesArtifactSource(evidence))).toBe(true);

    evidence.sourceRun.event = 'workflow_dispatch';
    expect(validatePagesArtifactSource(evidence).artifactId).toBe(551);
  });

  it('accepts a failed aggregate source run when its unique build and artifact passed', () => {
    const evidence = fixture();
    evidence.sourceRun.conclusion = 'failure';
    evidence.sourceJobs.jobs[1].name = 'visual-lab-review';
    evidence.sourceJobs.jobs[1].conclusion = 'failure';
    expect(validatePagesArtifactSource(evidence)).toEqual({
      artifactId: 551,
      sourceRunId: SOURCE_RUN_ID,
      artifactDigest: DIGEST,
    });
  });

  it('accepts a failed post-deploy verification after the exact build and deploy passed', () => {
    const evidence = fixture();
    evidence.sourceRun.conclusion = 'failure';
    evidence.sourceJobs.jobs.push({
      id: 783,
      run_id: SOURCE_RUN_ID,
      head_sha: SHA,
      name: 'deploy',
      status: 'completed',
      conclusion: 'success',
      started_at: '2026-08-12T05:05:00Z',
      completed_at: '2026-08-12T05:06:00Z',
    });
    evidence.sourceJobs.total_count = evidence.sourceJobs.jobs.length;
    evidence.sourceJobs.jobs[1].conclusion = 'failure';
    evidence.sourceJobs.jobs[1].started_at = '2026-08-12T05:07:00Z';
    expect(validatePagesArtifactSource(evidence)).toEqual({
      artifactId: 551,
      sourceRunId: SOURCE_RUN_ID,
      artifactDigest: DIGEST,
    });
  });

  it.each([
    ['failed non-review job', (value) => {
      value.sourceJobs.jobs[1].name = 'unrelated-job';
      value.sourceJobs.jobs[1].conclusion = 'failure';
    }, 'only one failed visual-lab-review or verify-deployment'],
    ['review failed before build completed', (value) => {
      value.sourceJobs.jobs[1].name = 'visual-lab-review';
      value.sourceJobs.jobs[1].conclusion = 'failure';
      value.sourceJobs.jobs[1].started_at = '2026-08-12T05:03:59Z';
    }, 'after the source build completed'],
    ['missing build completion time', (value) => {
      value.sourceJobs.jobs[1].name = 'visual-lab-review';
      value.sourceJobs.jobs[1].conclusion = 'failure';
      delete value.sourceJobs.jobs[0].completed_at;
    }, 'nonempty timestamp'],
    ['failed deployment verification without a successful deploy', (value) => {
      value.sourceJobs.jobs[1].conclusion = 'failure';
    }, 'exactly one successful deploy'],
  ])('rejects unsafe failed-run artifact reuse: %s', (_name, mutate, message) => {
    const evidence = fixture();
    evidence.sourceRun.conclusion = 'failure';
    mutate(evidence);
    expect(() => validatePagesArtifactSource(evidence)).toThrow(message);
  });

  it.each([
    ['nonnumeric current ID', (value) => { value.currentRunId = String(CURRENT_RUN_ID); }, 'safe integer'],
    ['zero source ID', (value) => { value.sourceRunId = 0; }, 'safe integer'],
    ['unsafe source ID', (value) => { value.sourceRunId = Number.MAX_SAFE_INTEGER + 1; }, 'safe integer'],
    ['same IDs', (value) => { value.sourceRunId = CURRENT_RUN_ID; }, 'must be distinct'],
    ['malformed repository', (value) => { value.expectedRepository = 'anifort'; }, 'owner/repository'],
    ['dot-segment repository', (value) => { value.expectedRepository = '../AniforTPT'; }, 'owner/repository'],
    ['noncanonical SHA', (value) => { value.expectedSha = SHA.toUpperCase(); }, 'lowercase 40-hex'],
  ])('rejects invalid request identity: %s', (_name, mutate, message) => {
    expectMutationRejected(mutate, message);
  });

  it.each([
    ['mismatched current run ID', (value) => { value.currentRun.id += 1; }, 'requested run ID'],
    ['wrong current repository', (value) => {
      value.currentRun.repository.full_name = 'other/repository';
    }, 'repository does not match'],
    ['fork-owned current head', (value) => {
      value.currentRun.head_repository.full_name = 'fork/repository';
    }, 'head is not owned'],
    ['different head repository ID', (value) => {
      value.currentRun.head_repository.id += 1;
    }, 'head repository ID'],
    ['different source repository identity', (value) => {
      value.sourceRun.repository.id += 1;
      value.sourceRun.head_repository.id += 1;
    }, 'same repository'],
  ])('rejects untrusted run/repository identity: %s', (_name, mutate, message) => {
    expectMutationRejected(mutate, message);
  });

  it.each([
    ['different workflow IDs', (value) => { value.sourceRun.workflow_id += 1; }, 'same workflow ID'],
    ['wrong current workflow path', (value) => {
      value.currentRun.path = '.github/workflows/other.yml';
    }, 'path must exactly equal'],
    ['wrong source workflow path', (value) => {
      value.sourceRun.path = '.github/workflows/other.yml';
    }, 'path must exactly equal'],
    ['wrong workflow name', (value) => { value.sourceRun.name = 'other'; }, 'name must exactly equal'],
  ])('rejects the wrong workflow: %s', (_name, mutate, message) => {
    expectMutationRejected(mutate, message);
  });

  it.each([
    ['non-dispatch current run', (value) => { value.currentRun.event = 'push'; }, 'workflow_dispatch'],
    ['wrong current SHA', (value) => { value.currentRun.head_sha = OTHER_SHA; }, 'expected commit'],
    ['incomplete source run', (value) => { value.sourceRun.status = 'in_progress'; }, 'completed'],
    ['cancelled source run', (value) => { value.sourceRun.conclusion = 'cancelled'; }, 'success or failure'],
    ['missing source conclusion', (value) => { value.sourceRun.conclusion = null; }, 'success or failure'],
    ['untrusted source event', (value) => { value.sourceRun.event = 'pull_request'; }, 'push or workflow_dispatch'],
    ['wrong source SHA', (value) => { value.sourceRun.head_sha = OTHER_SHA; }, 'exact current expected'],
  ])('rejects an ineligible current/source run: %s', (_name, mutate, message) => {
    expectMutationRejected(mutate, message);
  });

  it.each([
    ['missing jobs array', (value) => { delete value.sourceJobs.jobs; }, 'must be an array'],
    ['incomplete jobs page', (value) => { value.sourceJobs.total_count += 1; }, 'response is incomplete'],
    ['missing build job', (value) => { value.sourceJobs.jobs[0].name = 'reuse'; }, 'exactly one latest build'],
    ['duplicate build jobs', (value) => {
      value.sourceJobs.jobs.push(structuredClone(value.sourceJobs.jobs[0]));
      value.sourceJobs.total_count += 1;
    }, 'exactly one latest build'],
    ['queued build job', (value) => { value.sourceJobs.jobs[0].status = 'queued'; }, 'completed'],
    ['skipped build job', (value) => { value.sourceJobs.jobs[0].conclusion = 'skipped'; }, 'conclusion success'],
    ['foreign build run', (value) => { value.sourceJobs.jobs[0].run_id += 1; }, 'different workflow run'],
    ['stale build commit', (value) => { value.sourceJobs.jobs[0].head_sha = OTHER_SHA; }, 'different commit'],
  ])('rejects an unproven source build job: %s', (_name, mutate, message) => {
    expectMutationRejected(mutate, message);
  });

  it.each([
    ['missing artifacts array', (value) => { delete value.artifacts.artifacts; }, 'must be an array'],
    ['incomplete artifact page', (value) => { value.artifacts.total_count += 1; }, 'response is incomplete'],
    ['missing named artifact', (value) => {
      value.artifacts.artifacts[0].name = 'other-site';
    }, 'exactly one'],
    ['duplicate named artifact', (value) => {
      value.artifacts.artifacts.push(structuredClone(value.artifacts.artifacts[0]));
      value.artifacts.total_count += 1;
    }, 'exactly one'],
    ['expired artifact', (value) => { value.artifacts.artifacts[0].expired = true; }, 'nonexpired'],
    ['empty artifact', (value) => { value.artifacts.artifacts[0].size_in_bytes = 0; }, 'positive size'],
    ['invalid artifact ID', (value) => { value.artifacts.artifacts[0].id = 0; }, 'positive safe integer'],
    ['missing digest', (value) => { value.artifacts.artifacts[0].digest = null; }, 'sha256 digest'],
    ['uppercase digest', (value) => {
      value.artifacts.artifacts[0].digest = `sha256:${'A'.repeat(64)}`;
    }, 'lowercase sha256 digest'],
    ['foreign artifact run', (value) => {
      value.artifacts.artifacts[0].workflow_run.id += 1;
    }, 'different workflow run'],
    ['foreign artifact repository', (value) => {
      value.artifacts.artifacts[0].workflow_run.repository_id += 1;
    }, 'different repository'],
    ['foreign artifact head', (value) => {
      value.artifacts.artifacts[0].workflow_run.head_repository_id += 1;
    }, 'different head repository'],
    ['stale artifact commit', (value) => {
      value.artifacts.artifacts[0].workflow_run.head_sha = OTHER_SHA;
    }, 'different commit'],
  ])('rejects an ineligible artifact: %s', (_name, mutate, message) => {
    expectMutationRejected(mutate, message);
  });

  it('queries current run, source run, latest source jobs, and source artifacts only', async () => {
    const { options, payloads } = resolverRequest();
    const calls = [];
    const result = await resolvePagesArtifactSource(options, {
      requestJson: async (endpoint) => {
        calls.push(endpoint);
        if (!payloads.has(endpoint)) throw new Error(`unexpected endpoint ${endpoint}`);
        return structuredClone(payloads.get(endpoint));
      },
    });

    expect(calls).toEqual([...payloads.keys()]);
    expect(result).toEqual({
      artifactId: 551,
      sourceRunId: SOURCE_RUN_ID,
      artifactDigest: DIGEST,
    });
  });

  it('validates resolver coordinates before I/O and propagates REST failures', async () => {
    const request = resolverRequest();
    let calls = 0;
    request.options.currentRunId = request.options.sourceRunId;
    await expect(resolvePagesArtifactSource(request.options, {
      requestJson: async () => { calls += 1; },
    })).rejects.toThrow('must be distinct');
    expect(calls).toBe(0);

    const valid = resolverRequest();
    await expect(resolvePagesArtifactSource(valid.options, {
      requestJson: async () => { throw new Error('REST unavailable'); },
    })).rejects.toThrow('REST unavailable');
  });
});

describe('Pages artifact source CLI', () => {
  const argv = () => [
    `--current-run-id=${CURRENT_RUN_ID}`,
    `--source-run-id=${SOURCE_RUN_ID}`,
    `--repository=${REPOSITORY}`,
    `--expected-sha=${SHA}`,
  ];

  it('parses exactly one value for every required option', () => {
    expect(parsePagesArtifactSourceArguments(argv())).toEqual({
      help: false,
      currentRunId: CURRENT_RUN_ID,
      sourceRunId: SOURCE_RUN_ID,
      expectedRepository: REPOSITORY,
      expectedSha: SHA,
    });
    expect(parsePagesArtifactSourceArguments(['--help'])).toEqual({ help: true });
    expect(() => parsePagesArtifactSourceArguments(argv().slice(1))).toThrow('is required');
    expect(() => parsePagesArtifactSourceArguments([...argv(), '--repository=again/repo']))
      .toThrow('only be provided once');
    expect(() => parsePagesArtifactSourceArguments([...argv(), '--unknown=value']))
      .toThrow('Unknown option');
    expect(() => parsePagesArtifactSourceArguments(['positional']))
      .toThrow('options use --name=value');
    expect(() => parsePagesArtifactSourceArguments([
      ...argv().slice(0, 1),
      '--source-run-id=01',
      ...argv().slice(2),
    ])).toThrow('positive decimal integer');
  });

  it('resolves without network and appends only validated GitHub outputs', async () => {
    const { payloads } = resolverRequest();
    const writes = [];
    const result = await runPagesArtifactSourceCli(argv(), {
      GITHUB_TOKEN: 'test-token',
      GITHUB_API_URL: 'https://api.github.test',
      GITHUB_OUTPUT: '/runner/output',
    }, {
      requestJson: async (endpoint) => structuredClone(payloads.get(endpoint)),
      appendOutput: async (...values) => { writes.push(values); },
    });

    expect(result).toEqual({
      artifactId: 551,
      sourceRunId: SOURCE_RUN_ID,
      artifactDigest: DIGEST,
    });
    expect(writes).toEqual([[
      '/runner/output',
      `artifact_id=551\nsource_run_id=${SOURCE_RUN_ID}\nartifact_digest=${DIGEST}\n`,
    ]]);
  });

  it.each(['GITHUB_TOKEN', 'GITHUB_API_URL', 'GITHUB_OUTPUT'])(
    'requires %s before resolving',
    async (missing) => {
      const environment = {
        GITHUB_TOKEN: 'token',
        GITHUB_API_URL: 'https://api.github.test',
        GITHUB_OUTPUT: '/runner/output',
      };
      delete environment[missing];
      await expect(runPagesArtifactSourceCli(argv(), environment, {
        requestJson: async () => { throw new Error('must not request'); },
        appendOutput: async () => {},
      })).rejects.toThrow(missing);
    },
  );

  it('builds authenticated repository REST GETs without making a real request', async () => {
    const calls = [];
    const requestJson = createGitHubRequestJson({
      token: 'secret-token',
      apiUrl: 'https://github.example/api/v3/',
      fetchImpl: async (...values) => {
        calls.push(values);
        return { ok: true, json: async () => ({ id: 1 }) };
      },
    });
    await expect(requestJson('/repos/anifort/AniforTPT/actions/runs/1'))
      .resolves.toEqual({ id: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('https://github.example/api/v3/repos/anifort/AniforTPT/actions/runs/1');
    expect(calls[0][1]).toMatchObject({
      method: 'GET',
      redirect: 'error',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer secret-token',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  });
});
