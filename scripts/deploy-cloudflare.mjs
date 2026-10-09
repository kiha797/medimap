import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const built = JSON.parse(readFileSync(new URL('../dist/server/wrangler.json', import.meta.url), 'utf8'));
const expected = JSON.parse(readFileSync(new URL('../cloudflare-d1.json', import.meta.url), 'utf8'));
const database = expected.d1_databases[0];
if (!built.d1_databases?.some(binding => binding.binding === database.binding && binding.database_id === database.database_id)) {
  throw new Error('Build database binding does not match medimap-db. Run npm run build first.');
}
const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
function run(args) {
  const result = spawnSync(process.execPath, [wrangler, ...args], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
// Wrangler records applied migrations and only applies new files on later deploys.
run(['d1', 'migrations', 'apply', 'DB', '--remote', '--config', 'cloudflare-d1.json']);
run(['deploy', '--config', 'dist/server/wrangler.json', '--name', 'medimap']);
