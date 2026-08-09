import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parsePositiveRunId,
  resolvePagesArtifactSource,
} from './pages-artifact-source.mjs';

const MODULE_PATH = fileURLToPath(import.meta.url);
const OPTION_NAMES = new Set([
  'current-run-id',
  'source-run-id',
  'repository',
  'expected-sha',
]);

const HELP = `Usage:
  node scripts/verify-pages-artifact-source.mjs \\
    --current-run-id=<running-workflow-run-id> \\
    --source-run-id=<completed-workflow-run-id> \\
    --repository=<owner/repository> \\
    --expected-sha=<lowercase-40-hex-commit>

Validates one prior-run anifortpt-static-site artifact through the GitHub REST
API and appends artifact_id, source_run_id, and artifact_digest to GITHUB_OUTPUT.`;

function requireNonemptyEnvironment(environment, name) {
  const value = environment[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} must be set and nonempty`);
  }
  return value;
}

function normalizeApiUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('GITHUB_API_URL must be an absolute HTTP(S) URL');
  }
  if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
      || parsed.username.length > 0
      || parsed.password.length > 0
      || parsed.search.length > 0
      || parsed.hash.length > 0) {
    throw new Error('GITHUB_API_URL must be an absolute HTTP(S) URL without credentials or query');
  }
  return parsed.href.replace(/\/+$/, '');
}

export function parsePagesArtifactSourceArguments(argv) {
  if (!Array.isArray(argv)) throw new TypeError('arguments must be an array');
  if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
    return Object.freeze({ help: true });
  }

  const values = new Map();
  for (const argument of argv) {
    if (typeof argument !== 'string' || !argument.startsWith('--') || !argument.includes('=')) {
      throw new Error(`Unknown argument ${JSON.stringify(argument)}; options use --name=value`);
    }
    const separator = argument.indexOf('=');
    const name = argument.slice(2, separator);
    if (!OPTION_NAMES.has(name)) throw new Error(`Unknown option --${name}`);
    if (values.has(name)) throw new Error(`Option --${name} may only be provided once`);
    const value = argument.slice(separator + 1);
    if (value.length === 0) throw new Error(`--${name} must not be empty`);
    values.set(name, value);
  }

  for (const name of OPTION_NAMES) {
    if (!values.has(name)) throw new Error(`--${name} is required`);
  }

  return Object.freeze({
    help: false,
    currentRunId: parsePositiveRunId(values.get('current-run-id'), '--current-run-id'),
    sourceRunId: parsePositiveRunId(values.get('source-run-id'), '--source-run-id'),
    expectedRepository: values.get('repository'),
    expectedSha: values.get('expected-sha'),
  });
}

export function createGitHubRequestJson({ token, apiUrl, fetchImpl = globalThis.fetch }) {
  if (typeof token !== 'string' || token.length === 0 || /[\r\n]/.test(token)) {
    throw new Error('GITHUB_TOKEN must be set, nonempty, and contain no line break');
  }
  const baseUrl = normalizeApiUrl(apiUrl);
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');

  return async (endpoint) => {
    if (typeof endpoint !== 'string' || !endpoint.startsWith('/repos/')) {
      throw new Error('GitHub REST endpoint must be a repository-relative /repos/ path');
    }
    const response = await fetchImpl(`${baseUrl}${endpoint}`, {
      method: 'GET',
      redirect: 'error',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'AniforTPT-pages-artifact-source-verifier',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (response === null || typeof response !== 'object') {
      throw new Error(`GitHub REST returned no response for ${endpoint}`);
    }
    if (!response.ok) {
      let detail = '';
      try {
        detail = (await response.text()).slice(0, 500).replace(/[\r\n]+/g, ' ');
      } catch {
        // The status and endpoint remain sufficient when the error body is unreadable.
      }
      throw new Error(
        `GitHub REST ${response.status ?? 'error'} for ${endpoint}${
          detail.length === 0 ? '' : `: ${detail}`}`,
      );
    }
    try {
      return await response.json();
    } catch {
      throw new Error(`GitHub REST returned invalid JSON for ${endpoint}`);
    }
  };
}

export async function runPagesArtifactSourceCli(
  argv,
  environment = process.env,
  dependencies = {},
) {
  const options = parsePagesArtifactSourceArguments(argv);
  if (options.help) return options;
  if (environment === null || typeof environment !== 'object' || Array.isArray(environment)) {
    throw new TypeError('environment must be an object');
  }

  const token = requireNonemptyEnvironment(environment, 'GITHUB_TOKEN');
  const apiUrl = requireNonemptyEnvironment(environment, 'GITHUB_API_URL');
  const outputPath = requireNonemptyEnvironment(environment, 'GITHUB_OUTPUT');
  const requestJson = dependencies.requestJson ?? createGitHubRequestJson({
    token,
    apiUrl,
    fetchImpl: dependencies.fetchImpl,
  });
  if (typeof requestJson !== 'function') {
    throw new TypeError('dependencies.requestJson must be a function');
  }

  const { help: _help, ...request } = options;
  const result = await resolvePagesArtifactSource(request, { requestJson });
  const output = [
    `artifact_id=${result.artifactId}`,
    `source_run_id=${result.sourceRunId}`,
    `artifact_digest=${result.artifactDigest}`,
    '',
  ].join('\n');
  const appendOutput = dependencies.appendOutput
    ?? ((filename, content) => appendFile(filename, content, 'utf8'));
  if (typeof appendOutput !== 'function') {
    throw new TypeError('dependencies.appendOutput must be a function');
  }
  await appendOutput(outputPath, output);
  return result;
}

const main = async () => {
  try {
    const result = await runPagesArtifactSourceCli(process.argv.slice(2));
    if (result.help) {
      process.stdout.write(`${HELP}\n`);
      return;
    }
    process.stdout.write(`${JSON.stringify({
      tool: 'pages-artifact-source-verifier-v1',
      ok: true,
      ...result,
    })}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      tool: 'pages-artifact-source-verifier-v1',
      ok: false,
      error: error?.stack ?? String(error),
    })}\n`);
    process.exitCode = 1;
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === MODULE_PATH) void main();
