// Verifies the caller is the signed-in owner via Supabase's auth/v1/user
// endpoint. Returns true only for a confirmed session on the owner email.
// Used to gate the service-role coaching endpoints (no anon caller allowed).
const OWNER_EMAIL = 'carl.meyer.business@gmail.com';

// Bounds the Supabase call so a slow/stalled network path can't hang this
// serverless function indefinitely -- same reasoning as row-auth.js's own
// withTimeout() around supa.auth.getSession() (2026-08-13 fix for the
// gym.html debrief hang, same class of bug, different call site: that one
// bounds the CLIENT's session read, this bounds the SERVER's token check).
function withTimeout(promise, ms, fallback) {
  return new Promise(function (resolve) {
    let settled = false;
    const timer = setTimeout(function () {
      if (!settled) { settled = true; resolve(fallback); }
    }, ms);
    promise.then(function (v) {
      if (!settled) { settled = true; clearTimeout(timer); resolve(v); }
    }, function () {
      if (!settled) { settled = true; clearTimeout(timer); resolve(fallback); }
    });
  });
}

export async function verifyOwner(authHeader, supabaseUrl, anonKey, fetchImpl = fetch, timeoutMs = 6000) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const controller = new AbortController();
  // Tracks whether the real fetch has already settled (success OR its own
  // catch) BEFORE we might call controller.abort() below. The previous fix
  // (221a37c) wrapped abort() in try/catch assuming Node throws
  // synchronously here -- confirmed live 2026-08-18 that's wrong on
  // Vercel's runtime: aborting an already-settled request/controller
  // crashed this function again with an uncaught DOMException/AbortError,
  // the exact same 500-every-request symptom, escaping straight past that
  // try/catch (stack trace still points at the abort() line). Root cause
  // is simpler than "catch harder": abort() was being called
  // UNCONDITIONALLY, even on the normal fast-success path where the real
  // fetch already fully completed -- not just when the timeout raced
  // ahead of it. Only aborting when the request is confirmed still
  // in-flight removes the crash-triggering call entirely, independent of
  // whether the underlying throw is sync or async.
  let settled = false;
  // Async IIFE so a fetchImpl that throws synchronously (not just a
  // rejected promise) still resolves to null here instead of escaping
  // uncaught -- the original code's try/catch covered this case too.
  const r = await withTimeout(
    (async () => {
      try {
        const res = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
          headers: { apikey: anonKey, Authorization: 'Bearer ' + token },
          signal: controller.signal,
        });
        settled = true;
        return res;
      } catch {
        settled = true;
        return null;
      }
    })(),
    timeoutMs,
    null
  );
  // Only cancel the real fetch if it's still genuinely in flight (the
  // timeout won the race) -- never on an already-settled request. Still
  // best-effort/non-fatal either way, since a timed-out fetch that somehow
  // can't be cancelled costs nothing beyond finishing in the background.
  if (!settled) { try { controller.abort(); } catch {} }
  if (!r || !r.ok) return false;
  const user = await r.json();
  return !!user && user.email === OWNER_EMAIL && !!user.email_confirmed_at;
}
