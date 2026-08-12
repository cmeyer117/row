// Pure logic for <mini-vision-chat> (mini-vision-chat.js) -- loaded as a
// classic <script> tag like gym-voice-logic.js, so it can't use `export`.
// See docs/superpowers/specs/2026-08-12-mini-vision-chat-bubble-design.md.
window.MiniVisionChatLogic = (function () {
  // Vision's GET /coach/:coachId/history returns turns oldest-first, each
  // { userMessage, assistantResponse, createdAt } (vision/src/turn-store.ts
  // CoachHistoryTurn). Flattens each turn into a user bubble followed by an
  // assistant bubble, preserving order. Skips either side of a turn if
  // that field is empty (defensive -- getCoachHistory filters null
  // assistant_response already, but doesn't guard empty-string).
  function historyToMessages(turns) {
    if (!Array.isArray(turns)) return [];
    var messages = [];
    turns.forEach(function (turn) {
      if (turn && typeof turn.userMessage === 'string' && turn.userMessage) {
        messages.push({ role: 'user', text: turn.userMessage });
      }
      if (turn && typeof turn.assistantResponse === 'string' && turn.assistantResponse) {
        messages.push({ role: 'assistant', text: turn.assistantResponse });
      }
    });
    return messages;
  }

  return { historyToMessages: historyToMessages };
})();
