// Vercel serverless function — proxies the ✨ Polish request to Anthropic
// so the API key stays server-side. Key lives in the Vercel env var
// ANTHROPIC_API_KEY, never in client-shipped JS.
import { verifyOwner } from './_lib/verify-owner.js';

const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    // Quarantined 2026-08-18 -- unapproved real Anthropic API spend found via
    // Codex code review, not previously recorded as approved. Off by default;
    // set POLISH_ENABLED=true in Vercel to re-enable. See
    // project-row-polish-endpoint-approved.md memory before flipping this.
    if (process.env.POLISH_ENABLED !== 'true') {
      res.status(503).json({ error: 'Polish is currently disabled' });
      return;
    }
    // 2026-08-12 audit fix: was a client-visible shared secret guarding a
    // paid Anthropic call, now the real owner session token.
    if (!(await verifyOwner(req.headers['authorization'], SUPABASE_URL, SUPABASE_ANON_KEY))) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      res.status(503).json({ error: 'Polish not configured' });
      return;
    }
    const { text } = req.body || {};
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Missing text' });
      return;
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content:
            'Rewrite this single goal so it is concrete, action-oriented, and under 60 characters. ' +
            'Return ONLY a JSON array with exactly one string, no preamble, no code fences.\n\nGoal: ' + text
        }]
      })
    });

    if (!anthropicRes.ok) {
      res.status(anthropicRes.status).json({ error: 'Anthropic request failed' });
      return;
    }
    const data = await anthropicRes.json();
    const content = (data && data.content && data.content[0] && data.content[0].text) || '';
    res.status(200).json({ content });
  } catch (e) {
    res.status(500).json({ error: 'Polish request failed' });
  }
}
