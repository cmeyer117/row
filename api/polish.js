// Vercel serverless function — proxies the ✨ Polish request to Anthropic
// so the API key stays server-side. Key lives in the Vercel env var
// ANTHROPIC_API_KEY, never in client-shipped JS.
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
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
        model: 'claude-sonnet-4-5',
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
