// Contract check for the documented gotcha: the Supabase CDN <script> must be
// loaded (and effectively execute) before sync.js / row-auth.js on every page,
// or the page silently falls back to local-only (row-auth.js returns null when
// window.supabase is missing — no error). Caught a real case on landing:
// row-wrapped.html shipped with no CDN tag at all.
//
// "Effectively execute": synchronous scripts run in document order during
// parse; defer scripts run after ALL synchronous scripts, in document order.
// So a deferred row-auth.js is satisfied by a synchronous CDN tag anywhere in
// the document (cooking.html, form-coach.html do this legitimately).
import { readFileSync, readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CDN = 'cdn.jsdelivr.net/npm/@supabase';
const CONFIG = 'supabase-config.js';
const DEPS = ['sync.js', 'row-auth.js'];
const DEFER_OFFSET = 1e9; // defer scripts run after every synchronous script

// Returns [{src, rank}] in effective execution order terms.
function scriptTags(html) {
  const tags = [];
  const re = /<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g;
  let m;
  let i = 0;
  while ((m = re.exec(html)) !== null) {
    const defer = /\bdefer\b|type="module"/.test(m[0]);
    tags.push({ src: m[1], rank: defer ? DEFER_OFFSET + i : i });
    i++;
  }
  return tags;
}

function findRank(tags, needle) {
  const tag = tags.find((t) => t.src.includes(needle));
  return tag ? tag.rank : null;
}

const cases = [];
const pages = readdirSync(dirname(fileURLToPath(import.meta.url)))
  .filter((f) => f.endsWith('.html'));

cases.push(['found root html pages', pages.length > 0]);

for (const page of pages) {
  const html = readFileSync(new URL(`./${page}`, import.meta.url), 'utf8');
  const tags = scriptTags(html);
  const usedDeps = DEPS.filter((d) => tags.some((t) => t.src.endsWith(d) || t.src === d));
  if (usedDeps.length === 0) continue; // e.g. offline.html, road-to-pro.html

  const cdn = findRank(tags, CDN);
  const cfg = findRank(tags, CONFIG);
  cases.push([`${page}: loads the Supabase CDN script`, cdn !== null]);
  cases.push([`${page}: loads supabase-config.js`, cfg !== null]);
  if (cdn === null || cfg === null) continue;

  for (const dep of usedDeps) {
    const at = findRank(tags, dep);
    cases.push([`${page}: CDN executes before ${dep}`, cdn < at]);
    cases.push([`${page}: supabase-config.js executes before ${dep}`, cfg < at]);
  }
}

let failed = 0;
for (const [label, ok] of cases) {
  if (!ok) { console.error('FAIL:', label); failed++; }
}
if (failed > 0) { console.error(`${failed}/${cases.length} cases failed`); process.exit(1); }
console.log(`page-script-preamble: all ${cases.length} cases pass`);
