import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyStaticAssets } from './verify-static-assets.mjs';

const REVISION = /^[0-9a-f]{40}$/;
const LEGACY_SCRIPT_ALIASES = Object.freeze(['index-DqhU2VfC.js', 'index-DsD3cf_4.js']);
const LEGACY_STYLE_ALIASES = Object.freeze(['index-CSuzU66U.css', 'index-40yMQDz6.css']);

export async function verifyPagesArtifact(rootInput, expectedRevision) {
  if (!REVISION.test(expectedRevision)) {
    throw new Error('Expected Pages artifact revision must be a lowercase 40-hex commit');
  }
  const root = path.resolve(rootInput);
  await requireClosedRegularTree(root);
  const revision = await readRegularFile(path.join(root, 'revision.txt'));
  if (revision.toString('utf8') !== `${expectedRevision}\n`) {
    throw new Error(
      `Pages artifact revision ${JSON.stringify(revision.toString('utf8').trim())} `
      + `does not exactly match ${expectedRevision}`,
    );
  }

  const index = (await readRegularFile(path.join(root, 'index.html'))).toString('utf8');
  for (const marker of [
    'src="./assets/app.js"',
    'href="./assets/style.css"',
    'id="boot-status"',
  ]) {
    if (!index.includes(marker)) throw new Error(`Pages artifact index is missing ${marker}`);
  }

  const app = await readRegularFile(path.join(root, 'assets/app.js'));
  const style = await readRegularFile(path.join(root, 'assets/style.css'));
  for (const alias of LEGACY_SCRIPT_ALIASES) {
    await requireIdenticalAlias(path.join(root, 'assets', alias), app, 'script');
  }
  for (const alias of LEGACY_STYLE_ALIASES) {
    await requireIdenticalAlias(path.join(root, 'assets', alias), style, 'style');
  }

  const checked = await verifyStaticAssets(root);
  return Object.freeze({ revision: expectedRevision, checkedResources: checked });
}

async function readRegularFile(filename) {
  const details = await lstat(filename);
  if (!details.isFile() || details.isSymbolicLink()) {
    throw new Error(`Pages artifact entry is not a regular file: ${filename}`);
  }
  const content = await readFile(filename);
  if (content.length === 0) throw new Error(`Pages artifact entry is empty: ${filename}`);
  return content;
}

async function requireIdenticalAlias(filename, canonical, kind) {
  const alias = await readRegularFile(filename);
  if (!alias.equals(canonical)) {
    throw new Error(`Pages artifact legacy ${kind} alias does not match its stable entry: ${filename}`);
  }
}

async function requireClosedRegularTree(root) {
  const rootDetails = await lstat(root);
  if (!rootDetails.isDirectory() || rootDetails.isSymbolicLink()) {
    throw new Error(`Pages artifact root is not a regular directory: ${root}`);
  }
  const pending = [root];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Pages artifact must not contain symbolic links: ${filename}`);
      }
      if (entry.isDirectory()) pending.push(filename);
      else if (!entry.isFile()) {
        throw new Error(`Pages artifact entry is not a regular file or directory: ${filename}`);
      }
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2];
  const revision = process.argv[3];
  if (!root || !revision || process.argv.length !== 4) {
    throw new Error('Usage: node scripts/verify-pages-artifact.mjs <root> <revision>');
  }
  const result = await verifyPagesArtifact(root, revision);
  console.log(
    `Reusable Pages artifact verified at ${result.revision} `
    + `(${result.checkedResources} referenced files)`,
  );
}
