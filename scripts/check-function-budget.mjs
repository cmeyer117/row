// Counts api/*.js (Vercel Hobby serverless functions; api/_lib is excluded by
// the leading underscore) and warns/fails as the 12-function Hobby cap nears.
// Row silently stopped deploying once already after hitting this cap.
import { readdirSync } from 'node:fs';

const CAP = 12;
const WARN_AT = 10;

const count = readdirSync('api').filter((f) => f.endsWith('.js')).length;

console.log(`Row Vercel functions: ${count}/${CAP}`);

if (count >= CAP) {
  console.error(`FAIL: at or over the Hobby plan's ${CAP}-function cap. Consolidate before deploying.`);
  process.exit(1);
}
if (count >= WARN_AT) {
  console.warn(`WARN: ${count}/${CAP} functions — approaching the Hobby cap, plan to consolidate.`);
}
