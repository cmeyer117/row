// =============================================================
// Shared cloud-sync helper. Each page calls initCloudSync({...}).
// Replace the two placeholders with your Supabase project URL +
// publishable key (same ones you used in topbar.js/gym.html).
// =============================================================
(function () {
  'use strict';
  const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';

  // Shallow key-union merge for a plain-object synced value, scoped
  // deliberately narrow -- see
  // docs/superpowers/specs/2026-08-20-object-key-conflict-merge-design.md.
  // Only for object keys with NO delete/removal path anywhere in the app
  // (verified per-key before use, not assumed): a key present on only one
  // side is kept as-is (safe -- there's no delete semantics to resurrect),
  // a key present on both sides with different values is resolved by
  // whichever side's own updated_at is newer (whole-object granularity,
  // not per-key -- this is not a general CRDT). Deliberately does NOT
  // special-case array-typed sub-keys (a from-scratch Codex review caught
  // that "always union" is wrong for e.g. morning_launch's positional slot
  // arrays) -- none of the keys this is currently used for contain arrays
  // at all, so that generalization is left out rather than built unsafely.
  // A key with a real delete path (stack:taken, po_coach_workout_done,
  // po_coach_weights, morning_outcomes_v1) must NOT use this until it has
  // real tombstone semantics -- deferred, not solved here.
  function mergeObjects(remoteObj, localObj) {
    remoteObj = (remoteObj && typeof remoteObj === 'object' && !Array.isArray(remoteObj)) ? remoteObj : {};
    localObj = (localObj && typeof localObj === 'object' && !Array.isArray(localObj)) ? localObj : {};
    const remoteNewer = (remoteObj.updated_at || '') > (localObj.updated_at || '');
    const keys = new Set([...Object.keys(remoteObj), ...Object.keys(localObj)]);
    const merged = {};
    for (const k of keys) {
      const rv = remoteObj[k], lv = localObj[k];
      if (rv === undefined) merged[k] = lv;
      else if (lv === undefined) merged[k] = rv;
      else merged[k] = remoteNewer ? rv : lv;
    }
    return merged;
  }
  window.RowSyncMergeObjects = mergeObjects;

  window.initCloudSync = function (config) {
    const appKey = config && config.appKey;
    const syncedKeys = (config && config.syncedKeys) || [];
    const syncedPrefixes = (config && config.syncedPrefixes) || [];
    // Opt-in list of object-shaped keys that get conflict-aware merge
    // (mergeObjects()) instead of wholesale replacement -- deliberately
    // NOT automatic for every object value. Only keys verified to have no
    // delete/removal path belong here (see mergeObjects()'s own comment).
    const mergeableObjectKeys = (config && config.mergeableObjectKeys) || [];
    const mergeableObjectPrefixes = (config && config.mergeableObjectPrefixes) || [];
    const onApplied = config && config.onApplied;
    if (!appKey || !window.supabase) return;
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    if (SUPABASE_URL.indexOf('PASTE-') === 0 || SUPABASE_KEY.indexOf('PASTE-') === 0) return;

    let supa = null, pushTimer = null, suppressSync = false, lastSyncedJson = null;
    // Status broadcast for topbar.js's sync badge -- see
    // docs/superpowers/specs/2026-08-20-visible-sync-status-design.md.
    // status/lastSyncedAt/retryDelayMs are this instance's own state;
    // retryTimer is the pending backoff retry (if any), cleared on success.
    let status = 'pending', lastSyncedAt = null, retryDelayMs = 0, retryTimer = null;
    const RETRY_DELAYS = [5000, 15000, 30000];
    function broadcastStatus() {
      try {
        window.dispatchEvent(new CustomEvent('row:sync-status', { detail: { appKey, status, lastSyncedAt } }));
      } catch (e) {}
    }
    // Registered into a small shared per-appKey registry so topbar.js's
    // "Retry now" action can force an immediate attempt without sync.js
    // exposing anything broader than this one hook.
    function registerRetryHook(fn) {
      try {
        window.__rowSyncRetry = window.__rowSyncRetry || {};
        window.__rowSyncRetry[appKey] = fn;
      } catch (e) {}
    }
    // Unload handlers (beforeunload/pagehide) can't reliably await an async
    // getSession() call before the page tears down, so the owner's access
    // token is cached here on session init/refresh and read synchronously
    // by flushOnUnload(). Falling back to the anon publishable key here is
    // what silently broke unload writes after the 2026-08-11 RLS lockdown
    // made app_state owner-only -- see row-audit-2026-08-14.md P1 #1.
    let cachedAccessToken = null;
    // Nothing may push until the initial fetch has round-tripped successfully
    // at least once. Without this, a page that never got a chance to pull
    // real data (slow network, tab closed early) could still push its
    // legitimately-empty local state on tab-close and overwrite good remote
    // data with nothing -- this happened for real 2026-07-25 (see SESSION_LOG).
    let syncReady = false;

    function matches(k) {
      if (!k) return false;
      if (syncedKeys.indexOf(k) !== -1) return true;
      for (let i = 0; i < syncedPrefixes.length; i++) {
        if (k.indexOf(syncedPrefixes[i]) === 0) return true;
      }
      return false;
    }
    function isMergeableObjectKey(k) {
      if (mergeableObjectKeys.indexOf(k) !== -1) return true;
      for (let i = 0; i < mergeableObjectPrefixes.length; i++) {
        if (k.indexOf(mergeableObjectPrefixes[i]) === 0) return true;
      }
      return false;
    }
    function listAllKeys() {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (matches(k)) out.push(k);
      }
      return out;
    }
    function collect() {
      const out = {};
      for (const k of listAllKeys()) {
        const v = localStorage.getItem(k);
        if (v == null) continue;
        try { out[k] = JSON.parse(v); } catch (e) { out[k] = v; }
      }
      return out;
    }
    const origSet = localStorage.setItem.bind(localStorage);
    const origRemove = localStorage.removeItem.bind(localStorage);
    localStorage.setItem = function (k, v) {
      origSet(k, v);
      try { if (!suppressSync && matches(k)) schedulePush(); } catch (e) {}
    };
    localStorage.removeItem = function (k) {
      origRemove(k);
      try { if (!suppressSync && matches(k)) schedulePush(); } catch (e) {}
    };
    function mergeArrays(remoteArr, localArr) {
      const byKey = new Map();
      for (const entry of [...remoteArr, ...localArr]) {
        const key = entry && typeof entry === 'object' && 'id' in entry ? entry.id : JSON.stringify(entry);
        const existing = byKey.get(key);
        if (!existing) { byKey.set(key, entry); continue; }
        // A tombstone (entry.deleted) always wins over a non-tombstoned
        // duplicate — a delete that hasn't round-tripped to this side yet
        // shouldn't get merged away.
        const existingDeleted = !!(existing && existing.deleted);
        const entryDeleted = !!(entry && entry.deleted);
        if (entryDeleted && !existingDeleted) { byKey.set(key, entry); continue; }
        if (existingDeleted && !entryDeleted) continue;
        // Otherwise last-write-wins by updated_at (a plain "remote wins"
        // silently clobbered any local edit -- e.g. a favorite toggle --
        // that hadn't round-tripped yet, including from a second writer
        // like the hype-audio-app tab sharing this same key). Missing
        // updated_at (older entries) sorts as oldest.
        const existingTs = (existing && existing.updated_at) || 0;
        const entryTs = (entry && entry.updated_at) || 0;
        if (entryTs > existingTs) byKey.set(key, entry);
      }
      return Array.from(byKey.values());
    }
    function applyRemote(remote) {
      if (!remote || typeof remote !== 'object') return false;
      suppressSync = true;
      let changed = false;
      // Distinct from `changed`: a local-wins merge (the merged result
      // equals what's already stored locally) writes nothing, so `changed`
      // stays false -- but the merged truth still differs from remote's
      // raw payload, and that MUST still push back, or the newer local
      // value never reaches Supabase at all despite "winning" the merge
      // (Codex layered review catch, 2026-08-20: this was the exact case
      // the earlier "push after a merge" fix missed -- it only fired when
      // the merge also happened to change local storage).
      let needsPushBack = false;
      try {
        for (const k of Object.keys(remote)) {
          if (!matches(k)) continue;
          let incomingValue = remote[k];
          const rawRemoteJson = JSON.stringify(incomingValue);
          let merged = false;
          if (Array.isArray(incomingValue)) {
            let localValue = [];
            try { localValue = JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) {}
            if (Array.isArray(localValue)) { incomingValue = mergeArrays(incomingValue, localValue); merged = true; }
          } else if (isMergeableObjectKey(k) && incomingValue && typeof incomingValue === 'object') {
            let localValue = null;
            try { localValue = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) {}
            incomingValue = window.RowSyncMergeObjects(incomingValue, localValue);
            merged = true;
          }
          const incoming = JSON.stringify(incomingValue);
          if (merged && incoming !== rawRemoteJson) needsPushBack = true;
          const local = localStorage.getItem(k);
          if (local !== incoming) { try { origSet(k, incoming); changed = true; } catch (e) {} }
        }
      } finally { suppressSync = false; }
      if (needsPushBack) {
        // A merge (array or object) can produce a result that differs from
        // BOTH the pure-remote and pure-local starting points -- e.g. it
        // kept a local-only entry the remote side never had, or local
        // simply won outright. Using origSet above deliberately avoids
        // re-triggering a push for a value that's already just a straight
        // remote copy, but a genuinely-merged result must round-trip back
        // to Supabase or it can vanish again on a fresh device pull.
        schedulePush();
      } else {
        // Nothing left to push after this apply -- genuinely synced,
        // whether or not anything was written to localStorage. Owning
        // this here (not splitting it with the caller) is what fixes a
        // second self-review bug this same fix introduced: a caller that
        // only checked "is status already 'pending'" after calling
        // applyRemote() would miss the case where nothing needed pushing
        // at all (status untouched, still whatever it defaulted to) --
        // that path used to reach the caller's own 'synced' broadcast, but
        // splitting the responsibility broke it (self-review catch,
        // 2026-08-20).
        lastSyncedAt = new Date().toISOString();
        status = 'synced';
        broadcastStatus();
      }
      if (changed && typeof onApplied === 'function') { try { onApplied(); } catch (e) {} }
      return changed;
    }
    // Once a synced key has ever existed in localStorage, a push where NONE
    // of them exist any more (the key(s) fully removed, not just emptied)
    // is always a stale/corrupted local state, never a legitimate user
    // action -- no consumer of this file has a "delete the whole key"
    // feature, only per-entry edits/deletes that leave the key itself in
    // place. This is the second half of the syncReady fix above: syncReady
    // only guards the window before the first successful sync, but a local
    // clear (e.g. a browser dev-tools command) *after* a successful sync
    // leaves syncReady permanently true while collect() now returns nothing
    // -- confirmed to actually happen, wiping production data a second time
    // on 2026-07-25 even with the syncReady guard already in place.
    // Deliberately NOT checking "is every value's own content empty" (e.g.
    // an array that's legitimately shrunk to zero items) -- that's a real,
    // valid state a consumer's own delete feature can produce.
    function isTrivial(state) { return Object.keys(state).length === 0; }
    // Retry-with-backoff on failure -- previously a bare catch(e){} that
    // silently dropped the write with no durable signal to Carl (Codex
    // review catch, 2026-08-20). retryDelayMs resets to 0 on any success,
    // whether from this timer firing or an unrelated new edit's own
    // schedulePush() landing first -- pushNow() itself is the single
    // choke point both paths go through.
    function scheduleRetry() {
      clearTimeout(retryTimer);
      const delay = RETRY_DELAYS[Math.min(retryDelayMs, RETRY_DELAYS.length - 1)];
      retryDelayMs = Math.min(retryDelayMs + 1, RETRY_DELAYS.length - 1);
      retryTimer = setTimeout(pushNow, delay);
    }
    // In-flight guard -- without this, the 250ms debounce timer and a
    // pending backoff retryTimer could both call pushNow() concurrently.
    // A fresh push succeeding, then an already-in-flight retry finishing
    // AFTER it and overwriting the status back to 'error', would leave a
    // false red badge indefinitely (that retry's own next attempt would
    // then see lastSyncedJson already matching and exit at the line below
    // without ever clearing the error state) -- and concurrent upserts
    // built from two different collect() snapshots could let an older one
    // overwrite a newer one remotely (Codex layered review catch,
    // 2026-08-20). A call that arrives while one is already running just
    // requests a rerun once the current one finishes, rather than firing
    // a second overlapping upsert -- the rerun does a fresh collect(), so
    // any edit that happened during the in-flight window is still picked up.
    let inFlight = false, pendingRerun = false;
    async function pushNow() {
      if (!supa || !syncReady) return;
      if (inFlight) { pendingRerun = true; return; }
      inFlight = true;
      try {
        const state = collect();
        if (isTrivial(state)) return;
        const json = JSON.stringify(state);
        if (json === lastSyncedJson) {
          // Already in sync -- must still confirm 'synced' status, not
          // silently return. applyRemote() now schedules a push whenever
          // ANY key changed (not just a genuine merge divergence), so this
          // path is common: most ordinary remote applies land here with
          // nothing left to push. Without this, status stays stuck at
          // whatever schedulePush() set it to ('pending') since nothing
          // downstream would ever correct it (self-review catch, 2026-08-20).
          if (status !== 'synced') {
            status = 'synced';
            if (!lastSyncedAt) lastSyncedAt = new Date().toISOString();
            broadcastStatus();
          }
          return;
        }
        status = 'pending';
        broadcastStatus();
        try {
          const { error } = await supa.from('app_state').upsert(
            { key: appKey, data: state, updated_at: new Date().toISOString() },
            { onConflict: 'key' }
          );
          if (!error) {
            lastSyncedJson = json;
            lastSyncedAt = new Date().toISOString();
            status = 'synced';
            retryDelayMs = 0;
            clearTimeout(retryTimer);
            broadcastStatus();
          } else {
            status = 'error';
            broadcastStatus();
            scheduleRetry();
          }
        } catch (e) {
          status = 'error';
          broadcastStatus();
          scheduleRetry();
        }
      } finally {
        inFlight = false;
        if (pendingRerun) { pendingRerun = false; pushNow(); }
      }
    }
    registerRetryHook(function forceRetry() { clearTimeout(retryTimer); pushNow(); });
    function schedulePush() {
      status = 'pending';
      broadcastStatus();
      clearTimeout(pushTimer);
      pushTimer = setTimeout(pushNow, 250);
    }
    function flushOnUnload() {
      if (!syncReady || !cachedAccessToken) return;
      const state = collect();
      if (isTrivial(state)) return;
      const json = JSON.stringify(state);
      if (json === lastSyncedJson) return;
      try {
        // Deliberately NOT setting lastSyncedJson here -- a keepalive
        // fetch fired during real page teardown has no readable response
        // in this context, so there was never a real basis for claiming
        // "synced." The old optimistic update meant beforeunload and
        // pagehide firing for one navigation (the common case, not an
        // edge case) would see the second attempt as already-synced and
        // skip it, even if the first genuinely failed (Codex review catch,
        // 2026-08-20). Both events now always genuinely attempt the write;
        // a harmless duplicate upsert is the cost of not silently dropping
        // a real one.
        fetch(SUPABASE_URL + '/rest/v1/app_state?on_conflict=key', {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + cachedAccessToken,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify({ key: appKey, data: state, updated_at: new Date().toISOString() }),
          keepalive: true,
        }).catch(() => {});
      } catch (e) {}
    }
    (async function init() {
      supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      async function refreshToken() {
        try {
          const { data } = await supa.auth.getSession();
          cachedAccessToken = (data && data.session) ? data.session.access_token : null;
        } catch (e) { cachedAccessToken = null; }
      }
      await refreshToken();
      supa.auth.onAuthStateChange(function (_event, session) {
        cachedAccessToken = session ? session.access_token : null;
      });
      try {
        const { data, error } = await supa.from('app_state').select('data').eq('key', appKey).maybeSingle();
        if (!error) {
          syncReady = true;
          if (data && data.data && Object.keys(data.data).length > 0) {
            lastSyncedJson = JSON.stringify(data.data);
            // applyRemote() now owns the resulting status itself (schedules
            // a push and leaves 'pending' if anything still needs to reach
            // Supabase -- including a local-wins merge that writes nothing
            // to localStorage but still differs from remote's raw payload
            // -- or marks 'synced' directly when nothing does). Splitting
            // that decision between here and applyRemote() was tried and
            // was itself buggy twice (self-review + Codex layered review
            // catches, 2026-08-20) -- one function owns it now.
            applyRemote(data.data);
          } else if (Object.keys(collect()).length > 0) {
            schedulePush();
          } else {
            // Nothing to pull, nothing local to push -- genuinely synced
            // (an empty state matching an empty remote), not the default
            // 'pending' the badge would otherwise show forever.
            lastSyncedAt = new Date().toISOString();
            status = 'synced';
            broadcastStatus();
          }
        } else {
          status = 'error';
          broadcastStatus();
        }
      } catch (e) {
        status = 'error';
        broadcastStatus();
      }
      supa.channel('app_state_' + appKey)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'app_state', filter: 'key=eq.' + appKey,
        }, (payload) => {
          if (!payload.new || !payload.new.data) return;
          const incoming = JSON.stringify(payload.new.data);
          if (incoming === lastSyncedJson) return;
          lastSyncedJson = incoming;
          applyRemote(payload.new.data);
        })
        .subscribe();
    })();
    window.addEventListener('beforeunload', flushOnUnload);
    window.addEventListener('pagehide', flushOnUnload);
    window.addEventListener('storage', (e) => { if (e.key && matches(e.key)) schedulePush(); });
  };
})();
