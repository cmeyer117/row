// Single entry point for all four cron-triggered push nudges, selected by
// ?type= (workout | morning-launch | macro-drift | coaching-inquiry). Replaced
// four separate serverless functions after Row hit Vercel's Hobby-plan cap of
// 12 Serverless Functions per deployment; the nudges themselves live in
// _lib/nudges.js, which Vercel doesn't count toward that limit.
import { NUDGES } from './_lib/nudges.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const secret = req.headers['authorization']?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const nudge = NUDGES[req.query.type];
  if (!nudge) {
    res.status(400).json({ error: `Unknown nudge type: ${req.query.type ?? '(none)'}` });
    return;
  }
  const { status, body } = await nudge(req.query.force === 'true');
  res.status(status).json(body);
}
