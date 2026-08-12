// mini-vision-chat-logic.js is loaded in the browser as a classic
// (non-module) <script> tag, so it can't use `export`. Mirrors the vm-sandbox
// pattern in gym-state-merge-logic.test.js.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./mini-vision-chat-logic.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const { historyToMessages } = sandbox.window.MiniVisionChatLogic;

const cases = [];

{
  const result = historyToMessages([]);
  cases.push(['empty array returns []', Array.isArray(result) && result.length === 0]);
}

{
  const result = historyToMessages(null);
  cases.push(['null returns []', Array.isArray(result) && result.length === 0]);
}

{
  const turns = [
    { userMessage: 'Log 3 sets of squats', assistantResponse: 'Got it, logged.', createdAt: '2026-08-12T10:00:00Z' },
  ];
  const result = historyToMessages(turns);
  cases.push(['single turn produces 2 messages', result.length === 2]);
  cases.push(['first message is user role', result[0].role === 'user' && result[0].text === 'Log 3 sets of squats']);
  cases.push(['second message is assistant role', result[1].role === 'assistant' && result[1].text === 'Got it, logged.']);
}

{
  const turns = [
    { userMessage: 'first', assistantResponse: 'reply one', createdAt: '2026-08-12T10:00:00Z' },
    { userMessage: 'second', assistantResponse: 'reply two', createdAt: '2026-08-12T10:05:00Z' },
  ];
  const result = historyToMessages(turns);
  cases.push(['two turns produce 4 messages in order', result.length === 4 &&
    result[0].text === 'first' && result[1].text === 'reply one' &&
    result[2].text === 'second' && result[3].text === 'reply two']);
}

{
  const turns = [{ userMessage: '', assistantResponse: 'reply only', createdAt: '2026-08-12T10:00:00Z' }];
  const result = historyToMessages(turns);
  cases.push(['empty userMessage is skipped', result.length === 1 && result[0].role === 'assistant']);
}

let failed = 0;
for (const [label, ok] of cases) {
  if (!ok) { console.error('FAIL:', label); failed++; }
}
if (failed > 0) { console.error(`${failed}/${cases.length} cases failed`); process.exit(1); }
console.log(`mini-vision-chat-logic: all ${cases.length} cases pass`);
