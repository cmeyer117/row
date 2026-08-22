// Server-side proxy for coaching-log.html. Replaces direct anon RPC calls
// (get_coaching_client_logs/get_coaching_plan/log_coaching_exercise/
// upsert_coaching_weight), which were callable by anyone holding a
// client's log-link UUID with no auth check -- see
// docs/superpowers/plans/2026-08-22-coaching-rls-hardening.md. Every
// request must carry the client's opaque access_token; this checks it
// with a constant-time compare before calling the RPC with the
// service-role key (the RPCs themselves now revoke anon/authenticated
// execute, so this is the only path that can reach them).
import { timingSafeEqual } from 'crypto';

const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';

export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function restFetch(path, options) {
  const res = await fetch(SUPABASE_URL + path, {
    ...options,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      ...(options && options.headers),
    },
  });
  return res;
}

async function loadClientToken(id) {
  const res = await restFetch(`/rest/v1/coaching_clients?id=eq.${encodeURIComponent(id)}&select=access_token`);
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0].access_token : null;
}

async function callRpc(fn, args) {
  const res = await restFetch(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export default async function handler(req, res) {
  const { action } = req.query;
  const id = req.method === 'GET' ? req.query.id : req.body && req.body.id;
  const token = req.method === 'GET' ? req.query.token : req.body && req.body.token;

  if (!id || !token) {
    res.status(400).json({ error: 'id and token are required' });
    return;
  }

  const realToken = await loadClientToken(id);
  if (!realToken || !safeEqual(token, realToken)) {
    res.status(401).json({ error: 'Invalid client token' });
    return;
  }

  try {
    if (req.method === 'GET' && action === 'plan') {
      const { ok, data } = await callRpc('get_coaching_plan', { p_id: id });
      res.status(ok ? 200 : 502).json({ data });
      return;
    }
    if (req.method === 'GET' && action === 'logs') {
      const exercise = req.query.exercise;
      if (!exercise) { res.status(400).json({ error: 'exercise is required' }); return; }
      const { ok, data } = await callRpc('get_coaching_client_logs', { p_id: id, p_exercise: exercise });
      res.status(ok ? 200 : 502).json({ data });
      return;
    }
    if (req.method === 'POST' && action === 'log-exercise') {
      const { exercise, weight, reps, isBodyweight } = req.body || {};
      if (!exercise || !Number.isFinite(weight) || !Number.isInteger(reps)) {
        res.status(400).json({ error: 'exercise, weight, reps are required' });
        return;
      }
      const { ok } = await callRpc('log_coaching_exercise', {
        p_id: id, p_exercise: exercise, p_weight: weight, p_reps: reps, p_is_bodyweight: !!isBodyweight,
      });
      res.status(ok ? 200 : 502).json({ ok });
      return;
    }
    if (req.method === 'POST' && action === 'upsert-weight') {
      const { weight } = req.body || {};
      if (!Number.isFinite(weight)) { res.status(400).json({ error: 'weight is required' }); return; }
      const { ok } = await callRpc('upsert_coaching_weight', { p_id: id, p_weight: weight });
      res.status(ok ? 200 : 502).json({ ok });
      return;
    }
    res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Supabase' });
  }
}
