import assert from 'node:assert';
import { verifyAppSecret } from './verify-app-secret.js';

const cases = [
  ['no header', undefined, 'right', false],
  ['non-bearer', 'Basic right', 'right', false],
  ['wrong secret', 'Bearer wrong', 'right', false],
  ['no expected secret configured', 'Bearer right', undefined, false],
  ['matching secret', 'Bearer right', 'right', true],
];

for (const [label, header, expected, result] of cases) {
  assert.equal(verifyAppSecret(header, expected), result, label);
}
console.log('verify-app-secret: all cases pass');
