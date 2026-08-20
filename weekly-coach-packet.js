// weekly-coach-packet.js — formats a locally generated Markdown REVIEW
// packet for Carl/coach: item 9's findings + a training summary +
// adherence signals + item 6's related-note links. Never sent
// automatically to a client, never chat prose, no live external calls.
// Pure string-building function -- caller supplies already-fetched data.
(function () {
  'use strict';

  const SEVERITY_LABEL = { high: 'HIGH', medium: 'MEDIUM', low: 'LOW' };

  function findingsSection(findings) {
    if (!findings || !findings.length) {
      return '_No findings met the evidence threshold this week._';
    }
    return findings.map(function (f) {
      const window = f.evidenceWindow ? `${f.evidenceWindow.start} → ${f.evidenceWindow.end}` : 'n/a';
      return [
        `- **[${SEVERITY_LABEL[f.severity] || f.severity}] ${f.observation}**`,
        `  - Evidence window: ${window}`,
        `  - Confidence: ${f.confidence}`,
        `  - Review question: ${f.reviewQuestion}`,
      ].join('\n');
    }).join('\n');
  }

  function summarySection(summary) {
    if (!summary) return '_No training summary data supplied._';
    const lines = [];
    if (summary.sessionsLogged != null) lines.push(`- Sessions logged: ${summary.sessionsLogged}`);
    if (summary.totalSets != null) lines.push(`- Total hard sets: ${summary.totalSets}`);
    if (summary.exercisesTouched != null) lines.push(`- Exercises touched: ${summary.exercisesTouched}`);
    return lines.length ? lines.join('\n') : '_No training summary data supplied._';
  }

  function adherenceSection(adherence) {
    if (!adherence) return '_No adherence data supplied._';
    const lines = [];
    if (adherence.macroDaysLogged != null) lines.push(`- Macro days logged: ${adherence.macroDaysLogged}/7`);
    if (adherence.sleepNightsLogged != null) lines.push(`- Sleep nights logged: ${adherence.sleepNightsLogged}/7`);
    if (adherence.cardioSessions != null) lines.push(`- Cardio sessions: ${adherence.cardioSessions}`);
    return lines.length ? lines.join('\n') : '_No adherence data supplied._';
  }

  function notesSection(notes) {
    if (!notes || !notes.length) return '_No related notes surfaced this week._';
    return notes.map(function (n) { return `- [${n.title}](${n.path}) — ${n.reason}`; }).join('\n');
  }

  // Anything the caller couldn't supply gets listed explicitly rather than
  // silently omitted -- a coach reading this should know what's missing,
  // not assume "no data" means "nothing happened."
  function missingDataSection(missing) {
    if (!missing || !missing.length) return '_Nothing flagged as missing._';
    return missing.map(function (m) { return `- ${m}`; }).join('\n');
  }

  // input: { weekLabel, findings, summary, adherence, notes, missingData }.
  // findings/notes/missingData default to []; summary/adherence default to
  // null (rendered as "no data supplied").
  function buildWeeklyCoachPacket(input) {
    const data = input || {};
    return [
      `# Weekly Coach Packet — ${data.weekLabel || '(week not specified)'}`,
      '',
      '_This is a review packet for a human coach. It is never sent automatically. Every line below is either a measured fact from Row\'s own logs or an explicitly-labeled inference — nothing here is a diagnosis, a prescription, or an automatic program change._',
      '',
      '## Measured — Training Summary',
      summarySection(data.summary),
      '',
      '## Measured — Adherence Signals',
      adherenceSection(data.adherence),
      '',
      '## Inference — Pattern Findings',
      findingsSection(data.findings),
      '',
      '## Reference — Related Notes',
      notesSection(data.notes),
      '',
      '## Missing Data',
      missingDataSection(data.missingData),
      '',
    ].join('\n');
  }

  const api = { buildWeeklyCoachPacket: buildWeeklyCoachPacket };
  if (typeof window !== 'undefined') window.WeeklyCoachPacket = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
