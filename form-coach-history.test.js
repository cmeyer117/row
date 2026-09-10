// form-coach-history.test.js — the read-modify-write race on the shared
// row:form-coach-history app_state row (Codex finding, logged 2026-09-03 in
// d8178df, fixed 2026-09-09). A fake supabase-js chain lets a competing
// writer sneak in between our read and our write; the append must notice
// (0 rows matched the updated_at it read) and retry, so no session is lost.
// Loaded as a classic <script> tag in the browser — same vm sandbox as
// form-coach-velocity.test.js.
import assert from 'node:assert'; // loose: arrays built inside the vm sandbox carry a foreign Array prototype
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./form-coach-history.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const { appendSession, HISTORY_KEY, MAX_TRIES } = sandbox.window.FormCoachHistoryStore;

// Minimal supabase-js v2 shape for exactly the calls appendSession makes.
// `store.row` is the single app_state row (or null). `onRead` fires after
// each select so a test can simulate another writer landing mid-flight.
function fakeSupa(store, onRead) {
  function resolve(v) { return Promise.resolve(v); }
  return {
    from: function (table) {
      assert.equal(table, 'app_state');
      return {
        select: function () {
          return { eq: function (col, key) {
            assert.equal(col, 'key'); assert.equal(key, HISTORY_KEY);
            return { maybeSingle: function () {
              const snapshot = store.row ? { data: store.row.data, updated_at: store.row.updated_at } : null;
              if (onRead) onRead(store);
              return resolve({ data: snapshot, error: null });
            } };
          } };
        },
        insert: function (row) {
          if (store.row) return resolve({ data: null, error: { code: '23505', message: 'duplicate key' } });
          store.row = { key: row.key, data: row.data, updated_at: row.updated_at };
          return resolve({ data: null, error: null });
        },
        update: function (patch) {
          return { eq: function (c1, key) {
            assert.equal(c1, 'key'); assert.equal(key, HISTORY_KEY);
            function finish(matches) {
              return { select: function () {
                if (matches) { store.row.data = patch.data; store.row.updated_at = patch.updated_at; }
                return resolve({ data: matches ? [{ key: key }] : [], error: null });
              } };
            }
            return {
              eq: function (c2, seen) { assert.equal(c2, 'updated_at'); return finish(!!store.row && store.row.updated_at === seen); },
              is: function (c2, v) { assert.equal(c2, 'updated_at'); assert.equal(v, null); return finish(!!store.row && store.row.updated_at == null); },
            };
          } };
        },
      };
    },
  };
}

function sessionsOf(store) { return store.row.data.sessions.map(function (s) { return s.id; }); }
function otherWriterAppends(id) {
  return function (store) {
    const sessions = store.row ? store.row.data.sessions.slice() : [];
    sessions.push({ id: id });
    store.row = { key: HISTORY_KEY, data: { sessions: sessions }, updated_at: 'T-other-' + id };
  };
}

// 1. first ever write: no row yet -> insert
{
  const store = { row: null };
  const r = await appendSession(fakeSupa(store), { id: 'a' });
  assert.equal(r.ok, true); assert.equal(r.tries, 1);
  assert.deepEqual(sessionsOf(store), ['a']);
  assert.ok(store.row.updated_at, 'updated_at is set on insert');
}

// 2. uncontended append -> update, one try
{
  const store = { row: { key: HISTORY_KEY, data: { sessions: [{ id: 'a' }] }, updated_at: 'T1' } };
  const r = await appendSession(fakeSupa(store), { id: 'b' });
  assert.equal(r.ok, true); assert.equal(r.tries, 1);
  assert.deepEqual(sessionsOf(store), ['a', 'b']);
  assert.notEqual(store.row.updated_at, 'T1', 'updated_at moves on every write (it is the CAS token)');
}

// 3. THE BUG: another writer lands between our read and our write.
//    Old code: last writer wins, 'x' is lost. New code: CAS misses, re-read, retry.
{
  const store = { row: { key: HISTORY_KEY, data: { sessions: [{ id: 'a' }] }, updated_at: 'T1' } };
  let reads = 0;
  const r = await appendSession(fakeSupa(store, function (s) { if (++reads === 1) otherWriterAppends('x')(s); }), { id: 'b' });
  assert.equal(r.ok, true); assert.equal(r.tries, 2);
  assert.deepEqual(sessionsOf(store), ['a', 'x', 'b'], 'both concurrent sessions survive');
}

// 4. insert race: no row on read, another writer creates it first -> 23505 -> retry as update
{
  const store = { row: null };
  let reads = 0;
  const r = await appendSession(fakeSupa(store, function (s) { if (++reads === 1) otherWriterAppends('x')(s); }), { id: 'b' });
  assert.equal(r.ok, true); assert.equal(r.tries, 2);
  assert.deepEqual(sessionsOf(store), ['x', 'b']);
}

// 5. legacy row with null updated_at still gets a correct CAS (IS NULL, not = NULL)
{
  const store = { row: { key: HISTORY_KEY, data: { sessions: [{ id: 'a' }] }, updated_at: null } };
  const r = await appendSession(fakeSupa(store), { id: 'b' });
  assert.equal(r.ok, true); assert.equal(r.tries, 1);
  assert.deepEqual(sessionsOf(store), ['a', 'b']);
}

// 6. perpetual contention gives up after MAX_TRIES instead of spinning
{
  const store = { row: { key: HISTORY_KEY, data: { sessions: [] }, updated_at: 'T1' } };
  let n = 0;
  await assert.rejects(
    appendSession(fakeSupa(store, function (s) { otherWriterAppends('x' + (++n))(s); }), { id: 'b' }),
    /lost the write race/
  );
  assert.equal(n, MAX_TRIES);
}

console.log('form-coach-history: all 6 passed');
