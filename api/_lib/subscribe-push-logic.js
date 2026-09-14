const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function validateSubscription(body) {
  const { endpoint, keys } = body || {};
  if (!endpoint || typeof endpoint !== 'string' || endpoint.length > 2048) {
    return { ok: false, error: 'Missing or invalid endpoint' };
  }
  try {
    const u = new URL(endpoint);
    if (u.protocol !== 'https:' || !u.hostname) {
      return { ok: false, error: 'Missing or invalid endpoint' };
    }
  } catch {
    return { ok: false, error: 'Missing or invalid endpoint' };
  }
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string' || keys.p256dh.length > 256 || keys.auth.length > 256) {
    return { ok: false, error: 'Missing or invalid subscription keys' };
  }
  return { ok: true, endpoint, keys };
}

export function buildSubscribeUpsertRequest(app, endpoint, keys) {
  return {
    url: SUPABASE_URL + '/rest/v1/push_subscriptions?on_conflict=endpoint',
    options: {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ app, endpoint, p256dh: keys.p256dh, auth: keys.auth }),
    },
  };
}
