# Carl Meyer — Context Backup

*Generated as a manual fallback for migrating context to a second Claude Pro account. Paste into Settings → Memory → Import, or drop into a Project's knowledge base, on the new account.*

## Identity & Core Framework

  - Carl Meyer, 28. Economics degree, software minor.
  - Four core lanes that organize all collaboration: competitive bodybuilder, accounting firm co-founder, AI software developer, streaming talent manager.
  - Faith-centered worldview, trusts everything happens for a reason. Ambition: top 1% across physical, financial, mental, and spiritual dimensions.
  - Communication preference: act as an expert, not just agreeable — push back, challenge claims, cite research, cut fluff. Collaborative and iterative thinking over pure execution. Dense practical content over surface-level summaries. Proactive expert guidance so he learns the reasoning, not trial-and-error.

## Active Ventures

  - **Accounting firm**: newly launched, co-founded with an experienced partner.
  - **CS Talent Media**: co-managed with friend Connor. Streaming talent agency representing StableRonaldo, Lacy, Faxuty, and 60+ other streamers; sources brand deals.
  - **Software development**: building AI automation tools, with a long-term goal of automating tax returns and accounting work. Prior professional experience using Alteryx in accounting.
  - **CPA path**: pursuing Florida CPA/PA licensure this summer; New York licensure also under consideration. Econ degree leaves roughly a 30 credit-hour accounting coursework gap. CPACredits.com identified as the fastest accredited self-paced way to close it.

## Bodybuilding / Physical

  - Competitive bodybuilder working with a professional-level coach, actively pursuing a Pro card.
  - Currently in an active cutting phase — 8-week cut started 4/17/2025, with detailed weekly weight averages and push/pull/legs lift logs tracked separately (source data lives outside this summary — pull from wherever the logs/tracking app actually live).
  - Building a Claude Code app to track and visualize cut data.
  - Prefers Claude as a collaborative thinking partner on training questions, not as a substitute coach — his actual coach owns programming decisions.
  - Goal: translate bodybuilding into fitness content and online coaching clients.

## Personal Knowledge Base Project

  - Standalone HTML app, "Iron and Gold" aesthetic, spanning six domains: Bodybuilding, Psychology, Stoicism and Mindset, Faith, CPA and Accounting, Finance and Investing.
  - Bodybuilding domain most developed — draws on exercise science from Schoenfeld/Israetel/Matthews, and coach/pro philosophies from Glass, Meadows, Yates, Bennett, Bumstead, Cutler, with per-muscle-group technique breakdowns.
  - Key saved insight (entry bb19): stretch position under load is the primary hypertrophy signal per 2021–2024 research (Schoenfeld, Pedrosa, Maeo, Kassiano).
  - Studies and pulls from: David Goggins (mental toughness), Jordan Peterson (psychology), Andrew Huberman (science of human performance), Marcus Aurelius/Stoicism, Kobe Bryant, Mike Tyson, Hany Rambod, Milos Sarcev, and pro bodybuilders' own words (Bumstead, Cutler, Ronnie Coleman, Derek Lunsford).

## Jarvis System (Personal AI Assistant Build)

  - Stack: Vapi + ElevenLabs (voice) → Claude (reasoning) → n8n (orchestration) → Mem0 (memory).
  - Mem0 handles semantic retrieval, not full dumps; n8n pre-processes before Claude sees data; tiered memory keeps only relevant context flowing to Claude.
  - Vapi long conversations are the primary token cost risk.
  - Session protocol: enable /plugin enable mem0 at the start of Jarvis sessions, disable with /plugin disable mem0 at the end to cut context overhead.
  - Key architectural priority: Claude-to-Jarvis knowledge bridge — end-of-session summaries → Mem0-ready JSON → n8n webhook → Jarvis memory continuity.

## Claude Code Skill Stack

  - Installed third-party: RTK, Superpowers, karpathy-skills, Context7, mattpocock-skills (Caveman + Grill Me + Handoff), .claudeignore, git-guardrails, stop-slop.
  - Custom-built: token-optimization, deep-research, frontend-design, skill-creator, cc-mastery, critical-thinking, second-brain, pre-task-clarifier, context-guardian, timeout-guard, project-guardian, knowledge-absorb.
  - Caveman compresses code/agent output; stop-slop compresses written content — complementary, not redundant.
  - Design principles: pre-task-clarifier only asks forward-looking design questions, never inventory questions Claude should already know; context-guardian flags at 75% context usage, presents options at 85%, auto-compacts at 90%+; project-guardian proactively initiates session snapshots after any build.
  - Strong standing preference: proactive flagging before significant execution, not post-hoc correction. Skills should use judgment rather than requiring manual triggers.

## CS Talent Media — Operational Specifics

  - Built a sponsorship outreach system targeting 100 companies across Apparel, Energy Drinks, Financial/Other, Gaming Hardware, and Gaming Studios.
  - Diagnosed an email deliverability issue on the cstalentmedia.com domain: missing SPF/DKIM/DMARC, with Microsoft enforcing stricter filtering than Gmail. DKIM flagged as the highest-impact fix; Microsoft SNDS and Sender Support portal registration recommended as follow-up.
  - Built a pitch deck around the Oakley "Beyond the Screen" campaign.

## Tech Stack & Working Style

  - React, Node.js, TypeScript with strict typing and TDD conventions.
  - Prefers backend/automatic tooling over manually invoked commands.
  - Intermediate-level Claude Code developer — onboarded from scratch in early June 2025 on Windows (resolved PowerShell execution policy issues, installed Node.js, authenticated, connected GitHub, completed a full git workflow, installed Superpowers).

## Social Media / Content Strategy

  - Planning a presence across TikTok, Instagram, and YouTube with a daily posting goal.
  - Considering Later/Buffer/Metricool for scheduling.
  - Plans to share platform analytics directly with Claude for interpretation; Supermetrics/Windsor.ai identified as connectors for pulling platform data in.
  - Long-term goal: master social media to land brand deals and grow as a fitness influencer/online coach.

## Standing Notes for Claude

  - Suggest Claude Cowork when a task involves multiple files/folders, Google Drive batch reads, video transcripts, 10+ exchange tasks, or building any knowledge database.
