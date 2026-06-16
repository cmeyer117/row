---
name: knowledge-absorb
description: >
  Trigger this skill whenever the user wants to learn from, summarize, or extract principles
  from ANY source of knowledge. Includes: uploaded book PDFs, pasted articles or excerpts,
  book/author names ("teach me How to Win Friends", "explain Jordan Peterson's philosophy"),
  CPA/textbook material, psychology texts, business books, fitness literature, or any domain.
  Also triggers for: "break this down", "key takeaways from X", "summarize and teach me",
  "what does [author] say about Z", "chapter by chapter breakdown", "give me the principles",
  "I want to study Y", or any learning-oriented request. Use aggressively — if the user
  is trying to LEARN or ABSORB anything, this skill should be active.
---

# Knowledge Absorb — Expert Summarizer & Teacher

Turn any source into retained knowledge. The standard is not a summary —
it is teaching. The user should finish understanding the material deeply enough
to explain it and apply it.

---

## Step 1: Identify Input Type

| Input | Examples | Action |
|---|---|---|
| PDF / upload | Textbook chapter, book PDF | Use file-reading skill to extract, then proceed |
| Pasted text | Copied excerpt, article body | Work directly from the text |
| Book / author name | "Atomic Habits", "Jordan Peterson" | Pull from knowledge; web search if needed |
| Topic / concept | "Cognitive dissonance", "GAAP matching principle" | Teach from expert sourcing |
| URL | Article link | Web fetch, then extract |

If unclear, ask ONE question: "What do you want to walk away being able to do with this?"

---

## Step 2: Select Depth Level

Present options or infer from context. Default to **Level 3** unless the user signals otherwise.

| Level | Name | What You Get | Best For |
|---|---|---|---|
| **L1** | Flash | Core thesis + 3 principles + 1 application | Quick orientation, unknown topic |
| **L2** | Overview | Thesis + all key principles + stories + application | Most books and articles |
| **L3** | Deep Dive | Full L2 + contrarian takes + retention tools + go-deeper guide | Books worth mastering |
| **L4** | Chapter Map | Chapter-by-chapter breakdown, then synthesized principles | Textbooks, dense nonfiction |
| **L5** | Curriculum | Multi-source synthesis across a whole subject area | Building expertise in a domain |

---

## Step 3: Output Structure by Level

---

### L1 — FLASH

**Thesis:** One sentence. What is the central claim?

**Top 3 Principles:**
1. [Name] — one-sentence definition + one concrete example
2.
3.

**Apply It:** One specific action the reader can take this week.

---

### L2 — OVERVIEW

**Source Brief**
- Title / Author / Domain
- Core Thesis (1 sentence)
- Why it matters: what problem does this solve or question does it answer?

**Key Principles** (all major ones — typically 5–10)
For each:
```
**[PRINCIPLE NAME]**
What it means: ...
Best example from the source: ...
Real-world application: ...
```

**The Best Story / Illustration**
The single most memorable example or case study from the source.
The thing a reader would retell at dinner.

**Apply It — 3 Actions**
Three specific things to do in the next 7 days. Concrete, not vague.
Not "think about X" — actual behaviors, decisions, or experiments.

---

### L3 — DEEP DIVE

Everything in L2, plus:

**Contrarian Takes**
What do credible critics say? Where does this source overgeneralize or fall short?
Name the critics and their argument. Never present any author as infallible.

**Retention Hooks**
- Mental model: a 1-sentence frame that captures the whole idea
- Analogy: connects the idea to something the reader already knows cold
- Mantra: a phrase to carry — from the source or constructed

**Go Deeper**
- Best follow-up book in the same domain
- Best contrasting perspective (challenges the author's view)
- Best practitioner who applies this in the real world

---

### L4 — CHAPTER MAP

**Part 1: Chapter-by-Chapter Breakdown**

For each chapter:
```
**Chapter [N]: [Title or Topic]**
Core argument: ...
Key concept introduced: ...
Best example/story: ...
One-sentence takeaway: ...
```

**Part 2: Synthesized Principles**
After mapping all chapters, pull out the 5–10 principles that run across the whole book.
These are the ideas worth keeping forever, distilled from the full structure.

**Part 3: The Author's Arc**
How does the argument build from first chapter to last?
What does the reader know at the end that they couldn't know at the beginning?

---

### L5 — CURRICULUM

Used when studying a full subject (e.g., all CPA exam sections, all of behavioral psychology, 
the history of investing philosophy).

**Domain Map**
What are the major sub-fields or branches of this subject?

**Source Stack** (ranked)
The 5–10 sources a serious student of this domain must know.
For each: what it covers, what it's best for, what it misses.

**Core Principles Across Sources**
Where do all the best thinkers agree? That's bedrock.

**Live Debates**
Where do the best thinkers *disagree*? That's where real thinking happens.

**Recommended Sequence**
In what order should the user study these sources, and why?

---

## Step 4: Teaching Standards

### Truth Over Comfort
If an author is wrong or overstates, say so. If a principle sounds compelling but lacks 
evidence or has failed in practice, name that. The user's job is to evaluate, not just absorb.

### Challenge the Reader
End every session with one uncomfortable question the material raises:
"Here's the hard question this leaves on the table: ..."
Make it specific to the source, not generic.

### Expertise Standard
Teach like the best professor in that domain. Reference the broader intellectual conversation —
who agrees, who disagrees, what the data says. Pull from great-thinkers.md when teaching
from memory. Read domains.md before going deep in a specialized field.

### Compression
After a full breakdown, always offer a compression:
"If you could only remember one thing from this, it's: ..."
This forces synthesis and gives the user something durable.

---

## Reference Files

- `references/quiz-templates.md` — Question formats for testing retention (L1–L5 difficulty)
- `references/domains.md` — Expert sourcing standards per subject area
- `references/great-thinkers.md` — Key figures per domain, their best work, and who challenges them

Read the relevant reference file before going deep in any specialized domain.
