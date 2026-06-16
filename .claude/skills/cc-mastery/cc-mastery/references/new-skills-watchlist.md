# New Skills Watchlist

High-value skills worth installing. Prioritized for Carl's specific stack.

---

## 🔴 Install Soon (High Impact)

### Karpathy Guidelines
- ⭐ 101k stars
- Type: Encoded Preference
- What: Prevents 3 biggest CC failure modes — silent wrong assumptions,
  over-engineering, touching code it shouldn't touch
- Why it matters: Multi-agent systems like Jarvis are especially vulnerable to these.
  One wrong assumption in an n8n workflow = silent broken automation
- Install: single SKILL.md file, zero runtime dependencies

### Caveman
- ⭐ 27.9k stars
- Type: Encoded Preference
- What: Cuts output tokens 65% by removing narration, keeping every technical fact
- Why it matters: Pairs directly with token-optimization skill. Compound effect.
- Note: Makes agent responses feel terse — that's intentional and correct

### Handoff
- Type: Capability Uplift
- What: Compresses session into markdown doc. Resume with `/handoff resume`
- Why it matters: Jarvis and accounting system are multi-session builds.
  Re-explaining context every session wastes 1,000–3,000 tokens each time.
- Use: run at end of every significant build session

### Context Mode
- Type: Capability Uplift
- What: Filters shell output noise, restores session state when agent resets
- Why it matters: n8n, Vapi, and API calls generate messy terminal output that
  bloats context fast. This cleans it automatically.

---

## 🟡 Install When Relevant

### Vercel React Best Practices
- ⭐ high community adoption
- Type: Encoded Preference
- What: 57 performance rules for React/Next.js
- When: Start of coaching dashboard build

### Vercel Composition Patterns
- Type: Encoded Preference
- What: Compound component patterns, eliminates boolean prop hell
- When: When coaching dashboard component architecture gets complex

### Firecrawl
- Type: Capability Uplift
- What: Web scraping, search, browser automation from within CC
- When: Content system build, competitor research automation

### Document Skills (the web app version already active)
- Type: Capability Uplift
- What: Creates/parses PDF, DOCX, XLSX, PPTX natively
- When: Accounting firm document generation (tax returns, client reports)

### Webapp Testing
- Type: Capability Uplift
- What: Tests local app in real browser via Playwright
- When: Coaching dashboard reaches MVP, before client-facing deployment

---

## 🟢 Niche / Later

### Trail of Bits Security
- Type: Capability Uplift
- What: CodeQL + Semgrep security scanning
- When: Accounting firm system handles real client financial data — install before launch

### Grill Me
- Type: Encoded Preference
- What: Interviews you about a plan before writing any code
- When: Starting any major new feature where requirements aren't fully clear

### Remotion Best Practices
- Skip — video generation not in current project stack

---

## How to Evaluate Any New Skill

Before installing anything new, ask:
1. Capability Uplift or Encoded Preference?
2. Does it conflict with an existing skill?
3. What's the token cost when it activates?
4. Which of my 4 projects does it serve?
5. Will it ever activate accidentally on tasks it shouldn't?
