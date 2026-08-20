# Object-Key Conflict-Aware Merge — Design

**Date:** 2026-08-20
**Status:** Approved
**Owner:** Row (`C:\Users\gregm\row`)

## Problem

`sync.js`'s `applyRemote()` merges top-level array-shaped synced values via `mergeArrays()` (ID-based union, tombstone-aware, last-write-wins per entry by `updated_at`), but a plain-object synced value gets wholesale-replaced by whichever side is currently in `remote[k]`, with zero comparison. Two devices editing the same object-shaped key while offline — or a stale realtime push arriving after a local edit hasn't round-tripped yet — silently loses one side's edit.

Codex review 2026-08-20 (Row rank #2). Full enumeration this session (verified against real code, not guessed) found the actual risk surface is narrower than the finding implied — po-coach's existing bespoke merge system (built after a real 2026-08-11 incident) already deep-merges `po_coach_v1`'s `logs`/`jointPain`/`checkins` — but found 8 real touchpoints across two separate sync systems that still get wholesale-replaced:

**Generic `sync.js` path:**
1. `macro_targets` (health appKey — macros.html, health.html)
2. `morning_outcomes_v1` (goals appKey — main.html)
3. `morning_launch:<date>` (goals appKey, prefix — main.html)
4. `routine_checklist:<date>` (goals appKey, prefix — main.html)
5. `stack:taken:<date>` (health appKey, prefix — health.html)

**Bespoke po-coach path (gym.html's own `pcApplyRemote`, separate from sync.js):**
6. `po_coach_weights` — an array, but this path's wholesale-replace branch doesn't apply `mergeArrays()` to it the way the generic path would
7. `po_coach_workout_done`
8. `po_coach_season`

Everything else confirmed array-shaped and already safe: `goals:<date>`, `perfectDay:template`, `hype_audio`, `stack:items`, `stack:low`. `stack:version` is a scalar version number where last-write-wins is correct by nature, not a gap.

## Scope

1. New shared `mergeObjects()` function (added to `sync.js`, exported the same dual-`window`/`module.exports` way `mergeArrays` conceptually works, callable from both sync.js's own `applyRemote()` and gym.html's bespoke `pcApplyRemote`-equivalent).
2. Every writer of the 8 keys above stamps `updated_at: new Date().toISOString()` onto the object before saving locally.
3. `sync.js`'s `applyRemote()` calls `mergeObjects()` for the 5 generic-path keys instead of wholesale-replacing them.
4. gym.html's bespoke merge gains the same `mergeObjects()` call for `po_coach_workout_done`/`po_coach_season`, and `mergeArrays()` (already imported via `GymStateMergeLogic` conventions, but this specifically reuses `sync.js`'s own `mergeArrays`) for `po_coach_weights`.

Out of scope: any change to `po_coach_v1`'s existing logs/jointPain/checkins merge (already correct), any change to array-shaped keys already covered by the generic path's existing `mergeArrays()`, the coach-response closeout feature and weekly-review contract test (separate items).

## `mergeObjects()` design

```js
// Shallow key-union merge for a plain-object synced value. A key present on
// only one side is kept as-is. A key present on both sides with different
// values is resolved by whichever side's own updated_at is newer (WHOLE-
// OBJECT granularity -- this is not a per-key CRDT, just enough to stop a
// wholesale replace from discarding one side's entire edit) -- UNLESS that
// key's own value is itself an array, in which case mergeArrays() unions it
// regardless of which side is "newer" (matches the top-level array
// behavior this mirrors one level down, e.g. morning_outcomes_v1.outcomes).
function mergeObjects(remoteObj, localObj) {
  remoteObj = remoteObj || {};
  localObj = localObj || {};
  const remoteNewer = (remoteObj.updated_at || '') > (localObj.updated_at || '');
  const keys = new Set([...Object.keys(remoteObj), ...Object.keys(localObj)]);
  const merged = {};
  for (const k of keys) {
    const rv = remoteObj[k], lv = localObj[k];
    if (Array.isArray(rv) || Array.isArray(lv)) {
      merged[k] = mergeArrays(Array.isArray(rv) ? rv : [], Array.isArray(lv) ? lv : []);
    } else if (rv === undefined) merged[k] = lv;
    else if (lv === undefined) merged[k] = rv;
    else merged[k] = remoteNewer ? rv : lv;
  }
  return merged;
}
```

String ISO-8601 timestamps compare correctly with `>` (lexicographic order matches chronological order for this format), matching the existing convention `mergeArrays()` already uses for entry-level `updated_at` comparison.

## Writer changes (stamping `updated_at`)

Each of the 8 keys' save function gains one line stamping `updated_at` onto the object immediately before the existing `storeSet`/`localStorage.setItem` call — no other change to these functions' logic or call sites:

- `mlOutcomesSave(o)` (main.html) — stamps `o.updated_at` before `storeSet(ML_OUTCOMES_KEY, o)`.
- The morning-launch session save function (main.html, wherever `mlSessionKey()`'s value is written).
- `rcSaveChecked(date, itemId, checked)` (main.html) — stamps the `saved` object.
- `setTaken(map)` (health.html) — stamps `map.updated_at` (a reserved key name inside what's otherwise an `{id: timestamp}` map — chosen because `updated_at` cannot collide with a real supplement id in practice, matching how `mergeArrays()` already reserves `id`/`updated_at`/`deleted` as structural fields on array entries).
- `macro_targets`'s save function(s) in macros.html and health.html (both write this key — confirm both call through one shared save path or stamp independently in each).
- gym.html's `po_coach_weights`, `po_coach_workout_done`, `po_coach_season` setters.

## Error handling

- A key with no `updated_at` on either side (legacy data predating this change): `remoteNewer` compares `'' > ''` → `false`, so local wins by default on a tie — matches the existing conservative "don't lose local silently" instinct the rest of this codebase already has (e.g. `syncReady` gating, the `isTrivial()` guard).
- `stack:taken:<date>`'s reserved `updated_at` key: `toggleTaken()`/`setTaken()` must never let a real supplement id literally be the string `"updated_at"` — not a realistic collision (ids come from a fixed `STACK_DEFAULTS` list), but worth a selfcheck assertion.
- `mergeObjects()` on two genuinely incompatible shapes (e.g. one side is `null`/not an object) degrades to treating the non-object side as `{}` rather than throwing.

## Testing

- New `sync-merge-objects.selfcheck.cjs` (regex-extracts `mergeObjects` the same way `sync.selfcheck.cjs` already does for `mergeArrays`): key-union preserves both sides' unique keys, a shared key resolves to the newer side by `updated_at`, a shared array-typed key always unions via `mergeArrays()` regardless of which side is newer, missing `updated_at` on both sides defaults to local winning.
- Per-writer regression: each of the 8 setter functions' selfcheck/test coverage (existing or new) asserts the saved object now carries a fresh `updated_at`.
- Browser verification: for at least one key (e.g. `stack:taken:<date>`), simulate a two-device conflict (edit locally, then apply a differently-shaped remote payload via the existing `applyRemote`/`onApplied` path) and confirm both sides' entries survive the merge instead of one clobbering the other.
