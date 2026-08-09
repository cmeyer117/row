// Shared-secret gate for endpoints that are called directly from static
// client HTML (no Supabase session available) but still spend a paid API
// key per request — polish.js (Anthropic) and jarvis-chat.js (Jarvis).
// Not a real access-control boundary (the secret ships in client JS, same
// trust tier as topbar.js's AUTH_PASS), just raises the bar from "any bot
// that finds the URL burns money" to "requires reading page source".
import { timingSafeEqual } from 'node:crypto';

export function verifyAppSecret(authHeader, expected) {
  if (!expected || !authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
