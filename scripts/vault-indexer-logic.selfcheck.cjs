// Run with: node scripts/vault-indexer-logic.selfcheck.cjs
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'vault-indexer-logic.js'), 'utf8'), sandbox);
const V = sandbox.window.VaultIndexerLogic;

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`);
    process.exit(1);
  }
}

// --- frontmatter present ---
const withFm = `---
title: "Bodybuilding Overview"
tags:
  - bodybuilding
  - phase-2
created: 2026-06-27
---

# Bodybuilding Overview

## Status
Some body text with a [[Weight History (Recomp 2026)]] link and [[Goals|goal note]].

## Training Split
More text.
`;
const entryWithFm = V.buildEntry('03 - Bodybuilding/Bodybuilding Overview.md', withFm, '2026-06-28T00:00:00.000Z', ['03 - Bodybuilding']);
assertEqual(entryWithFm.title, 'Bodybuilding Overview', 'frontmatter title wins over H1');
assertEqual(entryWithFm.tags, ['bodybuilding', 'phase-2'], 'frontmatter tags list parsed');
assertEqual(entryWithFm.headings, ['Status', 'Training Split'], 'H2 headings extracted in order');
assertEqual(entryWithFm.links, ['Weight History (Recomp 2026)', 'Goals'], 'wikilinks extracted, alias stripped, deduped');
assertEqual(entryWithFm.modified, '2026-06-28T00:00:00.000Z', 'modified date passed through');

// --- frontmatter absent: falls back to H1, then filename ---
const noFmH1 = '# Fallback Title\n\n## Only Heading\ntext';
const entryNoFmH1 = V.buildEntry('04 - Fitness/no-frontmatter.md', noFmH1, '2026-07-01T00:00:00.000Z', ['04 - Fitness']);
assertEqual(entryNoFmH1.title, 'Fallback Title', 'no frontmatter -- falls back to first H1');
assertEqual(entryNoFmH1.tags, [], 'no frontmatter -- tags default to empty array');

const noFmNoH1 = 'just some prose, no heading at all';
const entryNoFmNoH1 = V.buildEntry('04 - Fitness/bare.md', noFmNoH1, '2026-07-01T00:00:00.000Z', ['04 - Fitness']);
assertEqual(entryNoFmNoH1.title, 'bare', 'no frontmatter, no H1 -- falls back to filename');

// --- excluded paths stay excluded ---
assertEqual(V.isAllowed('06 - Psychology & Mindset/some-note.md', ['03 - Bodybuilding', '04 - Fitness']), false, 'path outside allowlist is excluded');
assertEqual(V.isAllowed('03 - Bodybuilding/sub/deep.md', ['03 - Bodybuilding']), true, 'nested path under an allowlisted folder is included');
assertEqual(V.isAllowed('03 - Bodybuilding Extras/note.md', ['03 - Bodybuilding']), false, 'prefix match requires a path separator, not just a string prefix');
assertEqual(V.buildEntry('06 - Psychology & Mindset/note.md', withFm, '2026-06-28T00:00:00.000Z', ['03 - Bodybuilding']), null, 'buildEntry returns null for an excluded path');

// --- stable ordering ---
const unordered = [{ path: 'b.md' }, { path: 'a.md' }, { path: 'c.md' }];
assertEqual(V.sortEntries(unordered).map(e => e.path), ['a.md', 'b.md', 'c.md'], 'sortEntries orders by path');

console.log('All vault-indexer-logic self-checks passed.');
