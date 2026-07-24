// Verifies the caller is the signed-in owner via Supabase's auth/v1/user
// endpoint. Returns true only for a confirmed session on the owner email.
// Used to gate the service-role coaching endpoints (no anon caller allowed).
const OWNER_EMAIL = 'carl.meyer.business@gmail.com';

export async function verifyOwner(authHeader, supabaseUrl, anonKey, fetchImpl = fetch) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  let r;
  try {
    r = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: 'Bearer ' + token },
    });
  } catch (e) {
    return false;
  }
  if (!r.ok) return false;
  const user = await r.json();
  return !!user && user.email === OWNER_EMAIL && !!user.email_confirmed_at;
}
