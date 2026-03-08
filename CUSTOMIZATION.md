# Customization Guide

Everything in the system is customizable. Here's what to change and where.

## 1. AI Persona — SOUL.md (Required)

The SOUL.md file defines your student AI tutor's personality, expertise, and behavior rules.

**Location**: `openclaw/workspace/SOUL.md`

| Section | What It Controls |
|---------|-----------------|
| Security Rules | What the AI can/cannot do (file access, prompt reveal, etc.) |
| System Commands | Which message prefixes to ignore (JOIN, BROADCAST, etc.) |
| Knowledge Base Mapping | Topic → file routing table |
| Teaching Philosophy | Socratic, direct, guided — your pedagogical approach |
| Expertise Areas | What subjects the AI is qualified to discuss |
| Response Style | Tone, length, formatting (WhatsApp-optimized) |
| Hard Rules | "Never give complete answers" or your equivalent |
| Exam Prep Guidance | Commonly misunderstood areas to emphasize |

See `reference/soul-example.md` for the full template.

## 2. Knowledge Base (Required)

Course materials the AI uses for RAG-grounded answers.

**Location**: `data/knowledge/[course-name]/docs/`

| File | Purpose |
|------|---------|
| `index.md` | Master index with file descriptions |
| `syllabus.md` | Course policies, grading, schedule |
| `assignments.md` | Lab and assignment descriptions |
| `database-schemas.md` | Any reference schemas students work with |
| `setup-guide.md` | Tool setup instructions |
| `chapters/*.md` | Textbook chapter summaries |
| `slides/*.md` | Lecture slide summaries |

**Tips**:
- Convert PDFs to markdown for best AI consumption
- Include examples and practice problems (the AI can reference them)
- Update after each lecture with new material
- Keep files focused — one topic per file for better RAG retrieval

## 3. Student Guardrails (Required)

**Location**: `src/services/guardrails/StudentGuardrails.js`

| What to Customize | How |
|-------------------|-----|
| Course topics | Update `COURSE_TOPICS` array with your subject keywords |
| Jailbreak patterns | Rarely need changes — generic patterns work across courses |
| Cheating patterns | Add course-specific patterns (e.g., "show the proof", "solve this integral") |
| Off-topic threshold | Adjust how strictly off-topic messages are filtered |

See `reference/guardrails-topics.json` for the topic list format.

## 4. Professor AI System Prompt (Recommended)

**Location**: `src/services/ai/ProfessorAIService.js` → `PROFESSOR_SYSTEM_PROMPT`

Update the course name, capabilities description, and any course-specific context. The intent classifier (`INTENT_CLASSIFIER_PROMPT`) rarely needs changes.

## 5. Drip Campaigns (Optional)

**Location**: `scripts/drip-*.js`

Each campaign is a standalone script with:
- `MESSAGES` array: content + scheduled send times
- `CAMPAIGN_ID`: unique identifier for idempotency
- Student list fetched from DB at runtime

**Tips**:
- 6-12 messages per campaign is the sweet spot
- Space messages 4-8 hours apart
- Use career-relevant hooks ("In industry, this is how Netflix uses...")
- Always include `--dry-run` mode for testing
- WhatsApp formatting: `*bold*`, `_italic_`, `` `monospace` `` only

## 6. Canvas LMS (Optional)

**Location**: `src/integrations/CanvasService.js` + environment variables

```bash
CANVAS_API_TOKEN=your-token
CANVAS_BASE_URL=https://canvas.youruniversity.edu
CANVAS_COURSE_ID=12345  # REQUIRED: restricts API to this course only
```

## 7. Student Sync (Optional)

**Location**: `scripts/sync-students-from-sheet.js`

Polls a published Google Sheet CSV for new students. Customize:
- Sheet URL
- Column mapping (phone number, name, email)
- Welcome message text
- Sync frequency (default: hourly cron)

## 8. Branding

The dashboard (`public/`) uses standard HTML/CSS/JS. Update colors, logos, and course name to match your institution.

## 9. Deployment

The deploy script (`scripts/deploy-vps.sh`) is parameterized. Update:
- VPS SSH alias
- Application path (default: `/opt/your-bot/`)
- Domain name (for Nginx, if used)
- PM2 app name
