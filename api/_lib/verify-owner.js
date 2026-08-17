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
  // Async IIFE so a fetchImpl that throws synchronously (not just a
  // rejected promise) still resolves to null here instead of escaping
  // uncaught -- the original code's try/catch covered this case too.
  const r = await withTimeout(
    (async () => {
      try {
        return await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
          headers: { apikey: anonKey, Authorization: 'Bearer ' + token },
          signal: controller.signal,
        });
      } catch {
        return null;
      }
    })(),
    timeoutMs,
    null
  );
  // Best-effort cancellation of the real fetch if we timed out -- NOT
  // guaranteed side-effect-free like the DOM AbortController: Node's
  // implementation can throw synchronously here if the underlying request
  // already settled (confirmed live: crashed this function with an
  // uncaught DOMException/AbortError, 500ing every request). We don't
  // actually need this to succeed -- the timeout already made the caller
  // move on -- so swallow any failure.
  try { controller.abort(); } catch {}
  if (!r || !r.ok) return false;
  const user = await r.json();
  return !!user && user.email === OWNER_EMAIL && !!user.email_confirmed_at;
}
