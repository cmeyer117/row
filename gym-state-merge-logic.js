// gym-state-merge-logic.js — pure merge logic for po_coach_v1's `logs`,
// `jointPain`, and `checkins`. No DOM, no Supabase.
//
// po_coach_v1 is pushed as a full-object replace on every save (like every
// other PC_SYNCED_KEYS entry that isn't po_coach_weights/po_coach_photos --
// those two already have union-merge protection after a prior incident,
// per the comment on po_coach_weights's merge in gym.html). `logs`,
// `jointPain`, and `checkins` are the irreplaceable-history parts of
// po_coach_v1 (the rest -- exercises, days, gyms, settings -- is current
// config, fine to let the remote value win outright). Without this, any
// client that pushes a stale/reduced local copy permanently wipes real
// history for every other device, with nothing to detect or undo it.
(function () {
  'use strict';

  // Two log entries are "the same" if every field matches exactly -- entries
  // have no id field, unlike weights (dateKey) or photos (id), so exact
  // structural equality via a stable JSON key is the merge identity.
  function stableKey(entry) {
    return JSON.stringify(entry, Object.keys(entry).sort());
  }

  // remoteLogs/localLogs: { [exerciseId]: [{weight, reps, date, ...}, ...] }
  // Returns a new logs object with every remote entry, plus any local-only
  // entry (per exercise) that isn't already present remotely.
  function mergeLogs(remoteLogs, localLogs) {
    remoteLogs = remoteLogs || {};
    localLogs = localLogs || {};
    const merged = {};
    const allExIds = new Set([...Object.keys(remoteLogs), ...Object.keys(localLogs)]);
    for (const exId of allExIds) {
      const remoteArr = Array.isArray(remoteLogs[exId]) ? remoteLogs[exId] : [];
      const localArr = Array.isArray(localLogs[exId]) ? localLogs[exId] : [];
      const seen = new Set(remoteArr.map(stableKey));
      const localOnly = localArr.filter((e) => !seen.has(stableKey(e)));
      merged[exId] = [...remoteArr, ...localOnly];
    }
    return merged;
  }

  // jointPain entries have no id field -- two entries are "the same" if
  // every field matches exactly, same identity approach as mergeLogs.
  // Flat array (not keyed by exercise id like logs), so the merge is a
  // single set-union rather than per-key.
  function mergeJointPain(remoteArr, localArr) {
    remoteArr = Array.isArray(remoteArr) ? remoteArr : [];
    localArr = Array.isArray(localArr) ? localArr : [];
    const seen = new Set(remoteArr.map(stableKey));
    const localOnly = localArr.filter((e) => !seen.has(stableKey(e)));
    return [...remoteArr, ...localOnly];
  }

  // checkins is a plain object keyed by dateKey, one entry per day
  // ({pain, recovery, pump, steps}) -- unlike logs/jointPain there's no
  // array of independent entries to union, so a whole-object union can't
  // protect against the real failure mode here: two devices both writing
  // *different fields* for the *same day* (e.g. device A saves pain from a
  // post-workout check-in, device B later saves steps from an evening
  // re-open). A field-by-field merge per date, remote-wins-on-genuine-
  // conflict but never letting a null on either side erase a real value
  // from the other, closes that gap without needing per-field timestamps.
  function mergeCheckins(remoteObj, localObj) {
    remoteObj = remoteObj || {};
    localObj = localObj || {};
    const merged = {};
    const allDates = new Set([...Object.keys(remoteObj), ...Object.keys(localObj)]);
    const FIELDS = ['pain', 'recovery', 'pump', 'steps'];
    for (const dk of allDates) {
      const r = remoteObj[dk] || {};
      const l = localObj[dk] || {};
      const entry = {};
      for (const field of FIELDS) {
        entry[field] = r[field] != null ? r[field] : (l[field] != null ? l[field] : null);
      }
      merged[dk] = entry;
    }
    return merged;
  }

  // Total logged-set count across all exercises, for the push-time
  // shrink tripwire (mirrors pcWarnIfShrinking's weights check).
  function totalLogCount(logs) {
    logs = logs || {};
    return Object.values(logs).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
  }

  if (typeof window !== 'undefined') {
    window.GymStateMergeLogic = { mergeLogs: mergeLogs, mergeJointPain: mergeJointPain, mergeCheckins: mergeCheckins, totalLogCount: totalLogCount };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { mergeLogs: mergeLogs, mergeJointPain: mergeJointPain, mergeCheckins: mergeCheckins, totalLogCount: totalLogCount };
  }
})();
