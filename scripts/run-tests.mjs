// Discovers and runs every *.selfcheck.cjs / *.test.js file via plain `node`,
// matching this repo's no-framework testing convention (see CLAUDE.md).
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git']);

function findTestFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      findTestFiles(full, out);
    } else if (/\.(selfcheck\.cjs|test\.js)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const files = findTestFiles(process.cwd()).sort();
let failed = 0;

for (const file of files) {
  const result = spawnSync(process.execPath, [file], { encoding: 'utf8' });
  if (result.status === 0) {
    console.log(`PASS ${file}`);
  } else {
    failed++;
    console.log(`FAIL ${file} (exit ${result.status})`);
    console.log(result.stdout);
    console.log(result.stderr);
  }
}

console.log(`\n${files.length - failed}/${files.length} passed`);
process.exit(failed > 0 ? 1 : 0);
