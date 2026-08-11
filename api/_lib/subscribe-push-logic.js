const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
