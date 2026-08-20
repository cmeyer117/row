// build-vault-training-index.mjs — dev-time indexer. Reads ONLY the
// allowlisted training/nutrition folders under Carl's Obsidian vault and
// writes a static JSON index (vault-training-index.json) that the deployed
// app reads at runtime -- Vercel can't reach G:\ live, so this file is the
// generated artifact. Read-only: never writes into the vault. Not run in
// CI/postinstall; re-run by hand when vault notes change.
//
// Usage: node scripts/build-vault-training-index.mjs [vaultRoot]
import { readFileSync, statSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const OUT_PATH = join(REPO_ROOT, 'vault-training-index.json');

// vault-indexer-logic.js is a plain-<script>/CJS dual-export IIFE (this
// repo's convention -- see its header comment), which has no ESM export to
// `import`. Same vm-sandbox load the *.selfcheck.cjs files use.
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(__dirname, 'vault-indexer-logic.js'), 'utf8'), sandbox);
const VaultIndexerLogic = sandbox.window.VaultIndexerLogic;

const DEFAULT_VAULT_ROOT = 'G:\\My Drive\\Claude\\Carl Meyer';
const ALLOWLIST = [
  '03 - Bodybuilding',
  '04 - Fitness',
  '07 - Business/Coaching Business',
];

function walkMarkdownFiles(absDir, out) {
  let names;
  try {
    names = readdirSync(absDir);
  } catch {
    return; // missing folder -- skip it, don't blow up the whole build
  }
  for (const name of names) {
    const full = join(absDir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkMarkdownFiles(full, out);
    else if (name.toLowerCase().endsWith('.md')) out.push(full);
  }
}

function build(vaultRoot) {
  const files = [];
  for (const folder of ALLOWLIST) {
    walkMarkdownFiles(join(vaultRoot, folder.replace('/', '\\')), files);
  }
  const entries = [];
  for (const absPath of files) {
    const relPath = relative(vaultRoot, absPath).split('\\').join('/');
    const raw = readFileSync(absPath, 'utf8');
    const modified = statSync(absPath).mtime.toISOString();
    const entry = VaultIndexerLogic.buildEntry(relPath, raw, modified, ALLOWLIST);
    if (entry) entries.push(entry);
  }
  return VaultIndexerLogic.sortEntries(entries);
}

const vaultRoot = process.argv[2] || DEFAULT_VAULT_ROOT;
if (!existsSync(vaultRoot)) {
  console.error(`Vault root not found: ${vaultRoot} -- skipping index build (app degrades gracefully without it).`);
  process.exit(0);
}
const index = build(vaultRoot);
writeFileSync(OUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), allowlist: ALLOWLIST, notes: index }, null, 2) + '\n');
console.log(`Wrote ${index.length} notes to ${OUT_PATH}`);
