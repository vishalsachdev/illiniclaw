# IlliniClaw

**A replicable blueprint for building AI-powered WhatsApp teaching assistants.**

IlliniClaw is the open architecture spec behind a WhatsApp-based AI teaching assistant built for BADM 554 (Database Management) at the University of Illinois. It connects professors and students through conversational AI, automated broadcasts, drip learning campaigns, and course knowledge base RAG.

## What This Is

This repo contains no application code. It contains a **spec** — a complete architectural blueprint designed to be fed to an AI coding agent (Claude Code, Cursor, Copilot, etc.) that will build the entire working system for you, customized to your course.

## Quick Start

1. Open your AI coding agent in an empty project directory
2. Paste the contents of [`AGENT-PROMPT.md`](AGENT-PROMPT.md) as your prompt
3. Answer the agent's customization questions (your course, topics, persona)
4. The agent builds a working Node.js/Express system with WhatsApp integration
5. Deploy to any VPS

## What Gets Built

```
Professor (Dashboard + WhatsApp) ──► Express Server ──► Clawdbot Gateway ──► WhatsApp ──► Students
         │                              │                                        │
         │ WebSocket                    │ PostgreSQL                              │ AI Auto-reply
         │ (real-time)                  │ (persistence)                           │ (Claude/OpenAI)
         ▼                              ▼                                        ▼
   Live Dashboard              Sessions, Messages,              Socratic TA with
   (broadcasts,               Enrollments, Analytics            knowledge base RAG
    student Qs)
```

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Server | Node.js 20+, Express, ES Modules | REST API + WebSocket hub |
| Messaging | clawdbot CLI + gateway | WhatsApp send/receive/AI agent |
| Student AI | Claude (via clawdbot agent) | Socratic TA with knowledge base |
| Professor AI | OpenAI GPT-4o (direct API) | Admin assistant: analytics, broadcasts |
| Database | PostgreSQL | Professors, students, courses, messages, sessions |
| Dashboard | Express static + WebSocket | Real-time admin interface |
| Auth | JWT + bcrypt | Professor login, API protection |
| Guardrails | Pattern matching | Jailbreak, cheating, off-topic detection |
| Deployment | VPS + PM2 + systemd | Production hosting |

## Key Features

- **Dual AI agents** — Student TA (Socratic, never gives answers) + Professor admin assistant (analytics, drafts broadcasts)
- **WhatsApp native** — Students use their existing WhatsApp; no app install needed
- **Knowledge base RAG** — AI answers grounded in course materials (syllabus, slides, assignments)
- **Drip campaigns** — Scheduled study tip broadcasts with idempotency and crash-safe checkpointing
- **Student guardrails** — Blocks jailbreaks, cheating attempts, and off-topic messages
- **Broadcast confirmation** — Professor must approve every broadcast (YES/NO within 10 min)
- **Canvas LMS integration** — Fetch assignments, send reminders
- **Session isolation** — Per-student conversation context (2-hour TTL)
- **Self-chat mode** — Bot runs on professor's own WhatsApp number

## Files in This Repo

| File | Purpose |
|------|---------|
| `AGENT-PROMPT.md` | **The main spec.** Feed this to your AI coding agent. |
| `CUSTOMIZATION.md` | Guide to what you can customize and how |
| `reference/schema.sql` | PostgreSQL database schema (7 tables) |
| `reference/env.example` | Environment variable template |
| `reference/soul-example.md` | Example AI persona (SOUL.md) for the student TA |
| `reference/drip-campaign-example.js` | Example drip campaign script structure |
| `reference/guardrails-topics.json` | Example course topic keyword list for guardrails |

## Architecture Highlights

### Dual Message Path (Why Two Paths?)
The clawdbot gateway's embedded agent processes WhatsApp messages internally without broadcasting events. The GatewayBridge polls the gateway's log file (via `logs.tail` RPC) to detect inbound messages and route them through enrollment, DB tracking, and dashboard notifications — without duplicating the AI response.

### Professor AI Intent Router
Professor messages go through a two-call LLM pattern: fast intent classification (50 tokens) → full response. Intents route to: analytics (predefined SQL, never raw), broadcast (draft + confirm), drip (generate tip + confirm), or chat.

### Student Guardrails (Defense in Depth)
Three layers run in sequence: (1) jailbreak detection — blocks prompt injection, role manipulation, file operation attempts; (2) cheating prevention — redirects "show answer" to guided hints; (3) off-topic filtering — checks against course keyword list. Blocked messages still get helpful, educational responses.

## Origin

Built by [Vishal Sachdev](https://github.com/vishalsachdev) at the University of Illinois Gies College of Business for BADM 554 (Database Management), Spring 2026. Serving 36 students with 10,000+ WhatsApp interactions.

## Contributors

- [Vishal Sachdev](https://github.com/vishalsachdev)
- [Keshav Dalmia](https://github.com/keshavdalmia10)
- [Ash Castelino](https://github.com/ashcastelinocs124)

## License

MIT
