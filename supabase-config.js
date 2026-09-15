// Shared Supabase connection config -- single source of truth so a
// publishable-key rotation is a one-file edit instead of a repo-wide
// find/replace. Not a secret: the publishable/anon key is designed to be
// public in client code, RLS is what protects the data.
window.SUPABASE_CONFIG = {
  URL: 'https://vikpcejlyxieguorwysf.supabase.co',
  KEY: 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv',
};

// fix (2026-09-15, finding L8): gym.html and health.html each had their own
// copy of the 'health' appKey's syncedKeys list, which must match EXACTLY
// (initCloudSync replaces the whole app_state row on push using only the
// keys it's told to watch) -- a drift silently drops whichever field the
// out-of-sync copy forgot. One shared source instead.
window.HEALTH_SYNC_KEYS = ['stack:items', 'stack:version', 'stack:low', 'macro_targets', 'custom_meals', 'health:vitals', 'health:labs', 'health:measurements', 'health:sleep', 'health:cardio'];
