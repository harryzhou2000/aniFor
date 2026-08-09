import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  verifyLivePagesDeployment,
  verifyLivePagesRevision,
} from './live-pages-attestation.mjs';

export { verifyLivePagesDeployment, verifyLivePagesRevision } from './live-pages-attestation.mjs';

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const pageUrl = process.argv[2];
  const revision = process.argv[3];
  if (!revision) throw new Error('Expected deployed revision argument');
  const attempts = 8;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const checked = await verifyLivePagesDeployment(pageUrl, revision);
      console.log(`Live Pages asset closure verified (${checked.resourceCount} resources, attempt ${attempt})`);
      process.exit(0);
    } catch (error) {
      if (attempt === attempts) throw error;
      console.warn(`Pages verification attempt ${attempt} failed: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}
