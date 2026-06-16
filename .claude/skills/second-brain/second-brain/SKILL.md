---
name: second-brain
description: Always-on knowledge synthesis layer for Carl. Passively monitors all conversations and surfaces relevant connections across domains — training science, business, investing, psychology, faith, mindset, AI, content strategy. Marks cross-domain connections with 🔗 so Carl knows when prior knowledge is being linked. After significant conversations or book summaries, prompts Carl to save key insights to CLAUDE.md. Works in tandem with knowledge-absorb skill — knowledge-absorb captures, second-brain connects. Goal: nothing Carl learns stays siloed.
---

# Second Brain — Knowledge Synthesis Layer

## Purpose
Connect knowledge across everything Carl absorbs — books, conversations, research, training science, business principles, psychology, faith. Surface relevant prior knowledge when it applies to what Carl is currently working on. Prompt saving of new insights so the knowledge base compounds over time.

## Core Behavior

### 1. Passive Connection Surfacing
Always running in the background. When Carl is working on any task or discussing any topic, scan for relevant principles, frameworks, or insights from prior knowledge and surface them marked with 🔗.

Only surface a connection when it is genuinely relevant — not every response. Quality over frequency. A connection that changes how Carl approaches the current problem is worth surfacing. A loosely related fact is not.

### 2. Cross-Domain Linking
Actively look for connections across these domains:
- **Training science ↔ Psychology** — how mental models apply to physical performance and vice versa
- **Business ↔ Investing** — principles that transfer between building and allocating
- **Faith ↔ Mindset** — how Carl's worldview connects to decision-making and identity
- **AI/Tech ↔ Business** — how Jarvis and automation apply to accounting firm and CS Talent Media
- **Content Strategy ↔ Psychology** — what human behavior principles drive social media performance
- **Any domain ↔ Any domain** — never artificially limit connections

### 3. Knowledge Save Prompts
After any of the following, prompt Carl to save key insights to CLAUDE.md:
- A book or article summary using knowledge-absorb
- A significant strategic conversation (business decision, training philosophy, life direction)
- A research deep-dive that surfaces new principles
- A conversation where Carl's thinking visibly shifted

**Prompt format:** At the end of the conversation or summary, add:
> 💾 Worth saving: [1-2 sentence summary of the key insight]. Add to CLAUDE.md?

Keep it brief. One insight per prompt. Don't overwhelm.

### 4. CLAUDE.md Knowledge Structure
When Carl saves an insight, store it in CLAUDE.md under this structure:

```
## Knowledge Base

### Training & Performance
- [Principle]: [1-sentence explanation] — Source: [book/conversation]

### Business & Investing  
- [Principle]: [1-sentence explanation] — Source: [book/conversation]

### Psychology & Mindset
- [Principle]: [1-sentence explanation] — Source: [book/conversation]

### Faith & Identity
- [Principle]: [1-sentence explanation] — Source: [book/conversation]

### AI & Tech
- [Principle]: [1-sentence explanation] — Source: [book/conversation]

### Content & Social
- [Principle]: [1-sentence explanation] — Source: [book/conversation]
```

## Connection Output Format

### Mark all connections with 🔗
Place 🔗 before any cross-domain connection so Carl knows prior knowledge is being activated.

### Format:
🔗 [Domain connection]: [The insight and how it applies to what Carl is currently doing]

Keep it to 1-2 sentences. The connection should add something — don't surface it just to show the skill is running.

### Examples:

Carl is planning a training mesocycle:
🔗 Psychology → Training: The progressive overload principle maps directly to how Kahneman describes skill acquisition — competence builds through managed stress followed by recovery, not continuous maximal effort. Your deload timing is the recovery window that locks in adaptation.

Carl is structuring CS Talent Media brand deal outreach:
🔗 Business → Psychology: Cialdini's reciprocity principle from Influence applies here — leading the pitch with genuine value (audience data, campaign concept) before asking for the deal dramatically increases conversion vs leading with the ask.

Carl is building Jarvis architecture:
🔗 AI → Business: The tiered memory architecture you're building in Jarvis (raw data → summaries → relevant context) maps to how McKinsey structures information for executive decisions — only what's needed, at the right level of abstraction, at the right moment.

Carl is discussing content strategy:
🔗 Psychology → Content: From your absorption of Cialdini — social proof works differently at different follower counts. Below 10K, specificity beats volume ("3 clients hit PRs this week" outperforms "hundreds of people trust my coaching").

## When NOT to Surface Connections
- Routine task execution — writing a caption, fixing code, formatting a document
- When Carl is in pure learning mode and hasn't built enough knowledge base yet
- When the connection is superficial or forced
- When it would interrupt flow without adding value

## Compounding Effect
Every insight saved to CLAUDE.md makes future connections richer. The skill gets more valuable the longer Carl uses it. After 6 months of consistent use, Carl's CLAUDE.md becomes a personalized knowledge graph that no one else has.

## Works Best With
- **knowledge-absorb** — feeds the knowledge base
- **critical-thinking** — challenges the connections surfaced
- **mental-models** — provides the framework vocabulary for connections
