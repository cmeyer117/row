// form-coach-history.js — the one writer for the shared
// 'row:form-coach-history' app_state row. Both form-coach.html (lift) and
// posing.html (posing) call appendSession; they used to each carry an
// identical select->push->upsert, which is a read-modify-write race: two
// concurrent writers (two coach.html tabs/devices, one on Posing one on Form)
// silently lost one session (Codex finding, logged 2026-09-03 in d8178df).
//
// Fix: optimistic concurrency. Read data + updated_at, write conditioned on
// updated_at still being what we read (`.eq('updated_at', seen)`); if 0 rows
// matched, someone else wrote in between -- re-read and retry. First-ever
// write is an insert; a 23505 there means we lost that race too, retry.
// No Postgres function, no new grant: the owner policy on app_state already
// allows this. updated_at is set on every write because it IS the CAS token.
//
// Dual export like form-coach-logic.js: plain <script> in the browser,
// vm-sandboxed in form-coach-history.test.js.
(function () {
  var HISTORY_KEY = 'row:form-coach-history';
  var MAX_TRIES = 4; // ponytail: bounded retry, no backoff -- contention is two humans tapping "end session" within the same ~200ms

  function appendSession(supa, record, tries) {
    tries = tries || 1;
    function retry() {
      if (tries >= MAX_TRIES) throw new Error('lost the write race ' + tries + ' times');
      return appendSession(supa, record, tries + 1);
    }
    return supa.from('app_state').select('data, updated_at').eq('key', HISTORY_KEY).maybeSingle()
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        var row = res.data;
        var sessions = (row && row.data && Array.isArray(row.data.sessions)) ? row.data.sessions.slice() : [];
        sessions.push(record);
        var data = { sessions: sessions };
        var now = new Date().toISOString();

        if (!row) {
          return supa.from('app_state').insert({ key: HISTORY_KEY, data: data, updated_at: now }).then(function (r) {
            if (r.error && r.error.code === '23505') return retry();
            if (r.error) throw new Error(r.error.message);
            return { ok: true, tries: tries };
          });
        }

        var q = supa.from('app_state').update({ data: data, updated_at: now }).eq('key', HISTORY_KEY);
        q = row.updated_at == null ? q.is('updated_at', null) : q.eq('updated_at', row.updated_at);
        return q.select('key').then(function (r) {
          if (r.error) throw new Error(r.error.message);
          if (r.data && r.data.length) return { ok: true, tries: tries };
          return retry();
        });
      });
  }

  var api = { appendSession: appendSession, HISTORY_KEY: HISTORY_KEY, MAX_TRIES: MAX_TRIES };
  if (typeof window !== 'undefined') window.FormCoachHistoryStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
