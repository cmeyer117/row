// vault-indexer-logic.js — pure parsing/filtering for the vault training
// indexer (see build-vault-training-index.mjs for the filesystem-walking
// CLI that uses this). No fs access here so it can be self-checked with
// plain `node` per this repo's testing convention.
(function () {
  'use strict';

  // Minimal frontmatter parser: `key: value` and `key:\n  - item` list
  // blocks only — matches how notes in the vault are actually written
  // (see CLAUDE.md examples), not a full YAML spec.
  function parseFrontmatter(raw) {
    if (typeof raw !== 'string' || !raw.startsWith('---\n')) {
      return { data: null, body: raw || '' };
    }
    const end = raw.indexOf('\n---', 4);
    if (end === -1) return { data: null, body: raw };
    const block = raw.slice(4, end);
    const body = raw.slice(end + 4).replace(/^\r?\n/, '');
    const data = {};
    let currentListKey = null;
    block.split(/\r?\n/).forEach(function (line) {
      const listItem = line.match(/^\s+-\s+(.*)$/);
      if (listItem && currentListKey) {
        data[currentListKey].push(listItem[1].trim().replace(/^"(.*)"$/, '$1'));
        return;
      }
      const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (!kv) return;
      const key = kv[1];
      const value = kv[2].trim();
      if (value === '') {
        data[key] = [];
        currentListKey = key;
      } else {
        data[key] = value.replace(/^"(.*)"$/, '$1');
        currentListKey = null;
      }
    });
    return { data: data, body: body };
  }

  // Prefers frontmatter title, then the first H1, then the filename.
  function extractTitle(data, body, fileName) {
    if (data && data.title) return data.title;
    const h1 = body.match(/^#\s+(.+)$/m);
    if (h1) return h1[1].trim();
    return fileName.replace(/\.md$/i, '');
  }

  // First `max` H2+ headings, in document order, text only.
  function extractHeadings(body, max) {
    const limit = max || 8;
    const out = [];
    const re = /^#{2,6}\s+(.+)$/gm;
    let m;
    while ((m = re.exec(body)) && out.length < limit) {
      out.push(m[1].trim());
    }
    return out;
  }

  // [[Target]] and [[Target|Alias]] wikilinks -> unique target names, in
  // first-seen order.
  function extractLinks(body) {
    const seen = new Set();
    const out = [];
    const re = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g;
    let m;
    while ((m = re.exec(body))) {
      const target = m[1].trim();
      if (target && !seen.has(target)) {
        seen.add(target);
        out.push(target);
      }
    }
    return out;
  }

  // relPath: vault-root-relative path with forward slashes, e.g.
  // '03 - Bodybuilding/Foo.md'. allowlist: array of folder prefixes, e.g.
  // ['03 - Bodybuilding', '07 - Business/Coaching Business']. A note is
  // included only if its path starts with one of them.
  function isAllowed(relPath, allowlist) {
    return (allowlist || []).some(function (prefix) {
      return relPath === prefix || relPath.startsWith(prefix + '/');
    });
  }

  // raw: full file contents. relPath: vault-root-relative, forward slashes.
  // modified: ISO date string (caller supplies from fs.stat, kept out of
  // this module so it stays pure/testable). Returns null when the path
  // isn't in the allowlist -- callers should skip null entries.
  function buildEntry(relPath, raw, modified, allowlist) {
    if (!isAllowed(relPath, allowlist)) return null;
    const fileName = relPath.split('/').pop();
    const parsed = parseFrontmatter(raw);
    return {
      path: relPath,
      title: extractTitle(parsed.data, parsed.body, fileName),
      tags: (parsed.data && Array.isArray(parsed.data.tags)) ? parsed.data.tags : [],
      headings: extractHeadings(parsed.body),
      links: extractLinks(parsed.body),
      modified: modified,
    };
  }

  // Stable, deterministic ordering so the generated JSON diffs cleanly.
  function sortEntries(entries) {
    return entries.slice().sort(function (a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; });
  }

  const api = {
    parseFrontmatter: parseFrontmatter,
    extractTitle: extractTitle,
    extractHeadings: extractHeadings,
    extractLinks: extractLinks,
    isAllowed: isAllowed,
    buildEntry: buildEntry,
    sortEntries: sortEntries,
  };
  if (typeof window !== 'undefined') window.VaultIndexerLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
