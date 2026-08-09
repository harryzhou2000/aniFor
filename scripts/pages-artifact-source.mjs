const POSITIVE_INTEGER = /^[1-9][0-9]*$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const REVISION = /^[0-9a-f]{40}$/;
const ARTIFACT_DIGEST = /^sha256:[0-9a-f]{64}$/;

export const PAGES_ARTIFACT_NAME = 'anifortpt-static-site';
export const PAGES_WORKFLOW_NAME = 'verify-static-game';
export const PAGES_WORKFLOW_PATH = '.github/workflows/ci.yml';

const SOURCE_EVENTS = new Set(['push', 'workflow_dispatch']);

function requireObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer`);
  }
  return value;
}

function validateRequestIdentity({
  currentRunId,
  sourceRunId,
  expectedRepository,
  expectedSha,
}) {
  requirePositiveInteger(currentRunId, 'currentRunId');
  requirePositiveInteger(sourceRunId, 'sourceRunId');
  if (currentRunId === sourceRunId) {
    throw new Error('currentRunId and sourceRunId must be distinct');
  }
  const repositoryParts = typeof expectedRepository === 'string'
    ? expectedRepository.split('/')
    : [];
  if (!REPOSITORY.test(expectedRepository ?? '')
      || repositoryParts.some((part) => part === '.' || part === '..')) {
    throw new TypeError('expectedRepository must be an owner/repository name');
  }
  if (typeof expectedSha !== 'string' || !REVISION.test(expectedSha)) {
    throw new TypeError('expectedSha must be a lowercase 40-hex commit');
  }
}

function validateRepositoryOwnedRun(run, label, expectedRepository) {
  const repository = requireObject(run.repository, `${label}.repository`);
  const headRepository = requireObject(run.head_repository, `${label}.head_repository`);
  const repositoryId = requirePositiveInteger(repository.id, `${label}.repository.id`);
  const headRepositoryId = requirePositiveInteger(
    headRepository.id,
    `${label}.head_repository.id`,
  );

  if (repository.full_name !== expectedRepository) {
    throw new Error(`${label} repository does not match expectedRepository`);
  }
  if (headRepository.full_name !== expectedRepository) {
    throw new Error(`${label} head is not owned by expectedRepository`);
  }
  if (repositoryId !== headRepositoryId) {
    throw new Error(`${label} head repository ID does not match its repository ID`);
  }

  return Object.freeze({ repositoryId, headRepositoryId });
}

function validateCommonRun(runInput, label, expectedId, expectedRepository) {
  const run = requireObject(runInput, label);
  if (requirePositiveInteger(run.id, `${label}.id`) !== expectedId) {
    throw new Error(`${label}.id does not match the requested run ID`);
  }
  const repositoryIds = validateRepositoryOwnedRun(run, label, expectedRepository);
  const workflowId = requirePositiveInteger(run.workflow_id, `${label}.workflow_id`);
  if (run.path !== PAGES_WORKFLOW_PATH) {
    throw new Error(`${label}.path must exactly equal ${PAGES_WORKFLOW_PATH}`);
  }
  if (run.name !== PAGES_WORKFLOW_NAME) {
    throw new Error(`${label}.name must exactly equal ${PAGES_WORKFLOW_NAME}`);
  }

  return Object.freeze({ run, workflowId, ...repositoryIds });
}

function validateArtifactResponse(
  responseInput,
  sourceRunId,
  expectedSha,
  repositoryIds,
) {
  const response = requireObject(responseInput, 'artifacts');
  if (!Array.isArray(response.artifacts)) {
    throw new TypeError('artifacts.artifacts must be an array');
  }
  if (!Number.isSafeInteger(response.total_count) || response.total_count < 0) {
    throw new TypeError('artifacts.total_count must be a nonnegative safe integer');
  }
  if (response.total_count !== response.artifacts.length) {
    throw new Error('source artifact response is incomplete; exact uniqueness is unprovable');
  }

  for (const [index, artifact] of response.artifacts.entries()) {
    requireObject(artifact, `artifacts.artifacts[${index}]`);
    if (typeof artifact.name !== 'string' || artifact.name.length === 0) {
      throw new TypeError(`artifacts.artifacts[${index}].name must be a nonempty string`);
    }
  }

  const matches = response.artifacts.filter(({ name }) => name === PAGES_ARTIFACT_NAME);
  if (matches.length !== 1) {
    throw new Error(`source run must contain exactly one ${PAGES_ARTIFACT_NAME} artifact`);
  }

  const [artifact] = matches;
  const artifactId = requirePositiveInteger(artifact.id, 'source artifact id');
  if (artifact.expired !== false) {
    throw new Error('source artifact must be explicitly nonexpired');
  }
  if (!Number.isSafeInteger(artifact.size_in_bytes) || artifact.size_in_bytes <= 0) {
    throw new Error('source artifact must have a positive size_in_bytes');
  }
  if (typeof artifact.digest !== 'string' || !ARTIFACT_DIGEST.test(artifact.digest)) {
    throw new Error('source artifact digest must be a lowercase sha256 digest');
  }

  const workflowRun = requireObject(artifact.workflow_run, 'source artifact workflow_run');
  if (requirePositiveInteger(workflowRun.id, 'source artifact workflow_run.id') !== sourceRunId) {
    throw new Error('source artifact is linked to a different workflow run');
  }
  if (requirePositiveInteger(
    workflowRun.repository_id,
    'source artifact workflow_run.repository_id',
  ) !== repositoryIds.repositoryId) {
    throw new Error('source artifact is linked to a different repository');
  }
  if (requirePositiveInteger(
    workflowRun.head_repository_id,
    'source artifact workflow_run.head_repository_id',
  ) !== repositoryIds.headRepositoryId) {
    throw new Error('source artifact is linked to a different head repository');
  }
  if (workflowRun.head_sha !== expectedSha) {
    throw new Error('source artifact is linked to a different commit');
  }

  return Object.freeze({ artifactId, artifactDigest: artifact.digest });
}

function validateSourceJobs(responseInput, sourceRunId, expectedSha) {
  const response = requireObject(responseInput, 'sourceJobs');
  if (!Array.isArray(response.jobs)) {
    throw new TypeError('sourceJobs.jobs must be an array');
  }
  if (!Number.isSafeInteger(response.total_count) || response.total_count < 0) {
    throw new TypeError('sourceJobs.total_count must be a nonnegative safe integer');
  }
  if (response.total_count !== response.jobs.length) {
    throw new Error('source jobs response is incomplete; exact build-job uniqueness is unprovable');
  }

  for (const [index, job] of response.jobs.entries()) {
    requireObject(job, `sourceJobs.jobs[${index}]`);
    if (typeof job.name !== 'string' || job.name.length === 0) {
      throw new TypeError(`sourceJobs.jobs[${index}].name must be a nonempty string`);
    }
  }
  const matches = response.jobs.filter(({ name }) => name === 'build');
  if (matches.length !== 1) {
    throw new Error('source run must contain exactly one latest build job');
  }

  const [build] = matches;
  if (requirePositiveInteger(build.run_id, 'source build job run_id') !== sourceRunId) {
    throw new Error('source build job is linked to a different workflow run');
  }
  if (build.head_sha !== expectedSha) {
    throw new Error('source build job is linked to a different commit');
  }
  if (build.status !== 'completed' || build.conclusion !== 'success') {
    throw new Error('source build job must be completed with conclusion success');
  }
}

/**
 * Validate already-fetched GitHub Actions run and artifact records without I/O.
 */
export function validatePagesArtifactSource({
  currentRunId,
  sourceRunId,
  expectedRepository,
  expectedSha,
  currentRun: currentRunInput,
  sourceRun: sourceRunInput,
  sourceJobs,
  artifacts,
}) {
  validateRequestIdentity({ currentRunId, sourceRunId, expectedRepository, expectedSha });

  const current = validateCommonRun(
    currentRunInput,
    'currentRun',
    currentRunId,
    expectedRepository,
  );
  const source = validateCommonRun(
    sourceRunInput,
    'sourceRun',
    sourceRunId,
    expectedRepository,
  );

  if (current.repositoryId !== source.repositoryId
      || current.headRepositoryId !== source.headRepositoryId) {
    throw new Error('current and source runs do not identify the same repository');
  }
  if (current.workflowId !== source.workflowId) {
    throw new Error('current and source runs do not identify the same workflow ID');
  }
  if (current.run.event !== 'workflow_dispatch') {
    throw new Error('current run must be a workflow_dispatch run');
  }
  if (current.run.head_sha !== expectedSha) {
    throw new Error('current run does not use the expected commit');
  }
  if (source.run.status !== 'completed' || source.run.conclusion !== 'success') {
    throw new Error('source run must be completed with conclusion success');
  }
  if (!SOURCE_EVENTS.has(source.run.event)) {
    throw new Error('source run event must be push or workflow_dispatch');
  }
  if (source.run.head_sha !== expectedSha || source.run.head_sha !== current.run.head_sha) {
    throw new Error('source run must use the exact current expected commit');
  }

  validateSourceJobs(sourceJobs, sourceRunId, expectedSha);

  const artifact = validateArtifactResponse(
    artifacts,
    sourceRunId,
    expectedSha,
    source,
  );
  return Object.freeze({
    artifactId: artifact.artifactId,
    sourceRunId,
    artifactDigest: artifact.artifactDigest,
  });
}

/**
 * Resolve and validate one prior-run Pages artifact through an injected REST reader.
 */
export async function resolvePagesArtifactSource(options, dependencies = {}) {
  const request = requireObject(options, 'options');
  const requestJson = dependencies.requestJson;
  if (typeof requestJson !== 'function') {
    throw new TypeError('dependencies.requestJson must be a function');
  }
  validateRequestIdentity(request);

  const [owner, repository] = request.expectedRepository.split('/');
  const runsPath = `/repos/${encodeURIComponent(owner)}/${
    encodeURIComponent(repository)}/actions/runs`;
  const [currentRun, sourceRun, sourceJobs, artifacts] = await Promise.all([
    requestJson(`${runsPath}/${request.currentRunId}`),
    requestJson(`${runsPath}/${request.sourceRunId}`),
    requestJson(`${runsPath}/${request.sourceRunId}/jobs?filter=latest&per_page=100`),
    requestJson(`${runsPath}/${request.sourceRunId}/artifacts?per_page=100`),
  ]);

  return validatePagesArtifactSource({
    ...request,
    currentRun,
    sourceRun,
    sourceJobs,
    artifacts,
  });
}

export function parsePositiveRunId(value, label) {
  if (typeof value !== 'string' || !POSITIVE_INTEGER.test(value)) {
    throw new TypeError(`${label} must be a positive decimal integer`);
  }
  const parsed = Number(value);
  return requirePositiveInteger(parsed, label);
}
