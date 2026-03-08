# IlliniClaw — Build a WhatsApp AI Teaching Assistant

You are building a WhatsApp-based AI teaching assistant — a system where professors communicate with students through WhatsApp, students get AI-powered tutoring with Socratic questioning, and the professor has an AI admin assistant for analytics and broadcasts.

This spec is complete. Follow it to build a working system.

---

## Step 1: Ask Me These Questions

Before writing any code, ask the user these customization questions:

1. **What course is this for?** (e.g., "Database Management", "Statistics", "Marketing Analytics")
2. **What topics should the AI tutor cover?** (list 10-20 keyword areas for the guardrails)
3. **What is the teaching philosophy?** (e.g., Socratic questioning, direct answers, guided hints)
4. **Do you have course materials to use as a knowledge base?** (syllabus, slides, assignments — these become RAG context)
5. **What LLM provider for the student TA?** Claude via clawdbot (recommended) or OpenAI
6. **Do you need Canvas LMS integration?** (assignment reminders, due dates)
7. **VPS or local deployment?** (production needs a VPS; development works locally)

---

## Step 2: Tech Stack (Use Exactly This)

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js (ES Modules) | 20+ |
| Server | Express.js | 4.x |
| Database | PostgreSQL | 15+ |
| DB Client | pg (node-postgres) | 8.x |
| Messaging Gateway | clawdbot CLI + gateway | latest |
| Student AI | Claude (via clawdbot agent runner) | — |
| Professor AI | OpenAI GPT-4o (direct REST API) | — |
| Auth | JWT (jsonwebtoken) + bcrypt | — |
| Real-time | WebSocket (ws) | 8.x |
| Validation | Zod | 3.x |
| Logging | Winston | 3.x |
| Process Manager | PM2 (production) | — |

### Dependencies (`package.json`)

```json
{
  "name": "course-whatsapp-bot",
  "type": "module",
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "setup": "node scripts/setup.js",
    "db:migrate": "node scripts/migrate.js",
    "gateway": "clawdbot gateway --verbose"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.4.1",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.18.0",
    "qrcode": "^1.5.3",
    "uuid": "^9.0.1",
    "winston": "^3.11.0",
    "ws": "^8.16.0",
    "zod": "^3.22.4"
  }
}
```

**Note**: No Anthropic/OpenAI SDK needed for the student AI path — clawdbot handles it. The professor AI uses the OpenAI REST API directly (a simple `fetch` wrapper, no SDK).

---

## Step 3: Directory Structure

```
your-bot/
├── src/
│   ├── index.js                          # Entry point: Express app, routes, DB init, WS
│   ├── config/
│   │   ├── index.js                      # Environment config (dotenv)
│   │   └── logger.js                     # Winston logger setup
│   ├── controllers/
│   │   ├── authController.js             # Login, register, profile
│   │   ├── courseController.js           # CRUD, enrollment, QR codes
│   │   ├── messageController.js          # Broadcast, direct message, history
│   │   └── webhookController.js          # Inbound WhatsApp messages
│   ├── models/
│   │   ├── database.js                   # PostgreSQL pool, schema init
│   │   ├── Professor.js                  # Professor CRUD
│   │   ├── Student.js                    # Student CRUD
│   │   ├── Course.js                     # Course CRUD + enrollments
│   │   ├── Message.js                    # Message history + analytics
│   │   └── Session.js                    # Conversation sessions (2h TTL)
│   ├── services/
│   │   ├── auth/
│   │   │   └── AuthService.js            # JWT, bcrypt, QR code gen
│   │   ├── messaging/
│   │   │   └── MessageService.js         # Broadcast, DM, student question routing
│   │   ├── ai/
│   │   │   ├── AIService.js              # Student AI context builder
│   │   │   ├── KnowledgeBase.js          # RAG: search course materials
│   │   │   ├── AnthropicClient.js        # OpenAI REST wrapper (historical name)
│   │   │   ├── ProfessorAIService.js     # Intent classify → route → respond
│   │   │   └── ProfessorAnalytics.js     # Predefined SQL queries for analytics
│   │   └── guardrails/
│   │       └── StudentGuardrails.js      # Jailbreak, cheating, off-topic detection
│   ├── integrations/
│   │   ├── ClawdbotService.js            # CLI wrapper: send, broadcast, agent
│   │   ├── GatewayBridge.js              # WS client: log polling for inbound msgs
│   │   ├── OpenclawAllowlist.js          # Sync student phones to gateway allowlist
│   │   └── CanvasService.js              # Canvas LMS: assignments, reminders
│   ├── middleware/
│   │   ├── auth.js                       # JWT verify (requireAuth, requireProfessor)
│   │   ├── validation.js                 # Zod request schemas
│   │   └── rateLimiter.js                # Per-window rate limiting
│   └── websocket/
│       └── WebSocketServer.js            # Real-time dashboard events
├── openclaw/
│   └── workspace/
│       ├── SOUL.md                       # Student AI persona + course expertise
│       ├── IDENTITY.md                   # Bot identity metadata
│       └── USER.md                       # User interaction preferences
├── data/
│   └── knowledge/
│       └── [course-name]/
│           └── docs/
│               ├── index.md              # Knowledge base index
│               ├── syllabus.md           # Course syllabus
│               ├── assignments.md        # Assignment descriptions
│               ├── database-schemas.md   # Schema references
│               └── ...                   # Additional course materials
├── scripts/
│   ├── setup.js                          # First-time setup wizard
│   ├── migrate.js                        # DB schema init/reset
│   ├── deploy-vps.sh                     # VPS deployment (7 phases)
│   ├── sync-students-from-sheet.js       # Google Sheets → enrollment sync
│   └── drip-*.js                         # Drip campaign scripts
├── public/                               # Dashboard static files
├── tests/                                # Jest test suite
└── .env                                  # Environment variables (not committed)
```

---

## Step 4: Database Schema

7 tables in PostgreSQL. Schema auto-creates on first startup via `initializeDatabase()`.

```sql
-- Professors (admin users)
CREATE TABLE IF NOT EXISTS professors (
  id TEXT PRIMARY KEY,                    -- UUID v4
  phone_number TEXT UNIQUE NOT NULL,      -- WhatsApp number (+1234567890)
  name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,            -- bcrypt, 12 rounds
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Students
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  phone_number TEXT UNIQUE NOT NULL,
  name TEXT,
  registration_code TEXT,
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Courses
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  professor_id TEXT NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  registration_code TEXT UNIQUE NOT NULL,  -- e.g., "9T6EG8"
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enrollments (many-to-many)
CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  canvas_course_id TEXT,                   -- Optional Canvas LMS link
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(student_id, course_id)
);

-- Messages (all communication history)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender_type TEXT NOT NULL,               -- 'professor', 'student', 'system'
  sender_id TEXT,
  recipient_type TEXT NOT NULL,            -- 'student', 'course', 'professor'
  recipient_id TEXT,
  message_type TEXT NOT NULL,              -- 'broadcast', 'direct', 'question', 'response'
  content TEXT NOT NULL,
  metadata JSONB,                          -- Drip campaign info, delivery status, etc.
  clawdbot_message_id TEXT,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions (conversation context, 2-hour TTL)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
  context TEXT,                            -- Conversation summary
  last_topic TEXT,
  assignment_context TEXT,
  message_count INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP                     -- NOW() + 2 hours
);

-- Broadcast queue (per-student delivery tracking)
CREATE TABLE IF NOT EXISTS broadcast_queue (
  id TEXT PRIMARY KEY,
  broadcast_id TEXT NOT NULL,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_students_phone ON students(phone_number);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_type, sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
```

---

## Step 5: Core Architecture

### 5.1 Entry Point (`src/index.js`)

Express app that:
1. Loads environment config via dotenv
2. Initializes PostgreSQL schema
3. Mounts route handlers: `/auth/*`, `/courses/*`, `/messages/*`, `/webhook/*`, `/health`
4. Attaches WebSocket server to HTTP server
5. Connects GatewayBridge to clawdbot gateway
6. Starts session cleanup interval (every 60s, deletes expired sessions)

### 5.2 Message Flow — Student Asks a Question (Dual Path)

This is the most critical architectural decision. Two parallel paths handle each student message:

```
Student sends WhatsApp message
        │
        ▼
Clawdbot Gateway receives it
        │
        ├──────────────────────────────┐
        │ PATH 1: AI Response          │ PATH 2: App Pipeline
        │ (gateway auto-reply)         │ (GatewayBridge log polling)
        ▼                              ▼
Embedded AI agent processes       GatewayBridge detects message
message using SOUL.md             via logs.tail RPC (every 3s)
        │                              │
        ▼                              ▼
Sends AI response back            Parse log: extract phone + body
via WhatsApp                           │
                                       ▼
                                 Is it "JOIN <CODE>"?
                                  │ Yes          │ No
                                  ▼              ▼
                           Enroll student   Store question in DB
                           Send confirm     (skipAIResponse=true)
                           Add to allowlist       │
                                                  ▼
                                           Notify dashboard (WebSocket)
```

**Why two paths?** The gateway's embedded agent processes messages internally without broadcasting WebSocket events. The GatewayBridge polls the gateway's log file to detect inbound messages for enrollment, tracking, and dashboard — without duplicating the AI response.

### 5.3 Message Flow — Professor Sends a Broadcast

```
Professor clicks "Send" on dashboard (or WhatsApp AI command)
        │
        ▼
POST /messages/broadcast (JWT auth)
        │
        ▼
MessageService.sendBroadcast()
  ├─ Fetch all enrolled students
  ├─ For each student: ClawdbotService.sendMessage() with 3-8s random delay
  ├─ Record message in DB with delivery status
  └─ WebSocket: BROADCAST_STATUS → Dashboard updates live
```

**Anti-ban**: Individual `sendMessage` calls (not bulk broadcast), random 3-8 second delays between students, personalized greetings ("Hey {firstName}!"). This prevents WhatsApp from flagging the number.

### 5.4 Professor AI Agent

When the professor sends a WhatsApp message that isn't a structured command:

```
Professor message → ProfessorAIService.handleMessage()
        │
        ▼
Intent Classification (fast, 50 tokens)
  ├─ "analytics" → ProfessorAnalytics (predefined SQL queries)
  ├─ "broadcast" → Draft message → Wait for YES/NO (10 min timeout)
  ├─ "drip" → Generate study tip → Wait for YES/NO
  └─ "chat" → General conversation
```

**Implementation**: Two-call LLM pattern. First call classifies intent in ~50 tokens. Second call generates the full response with appropriate context. Uses OpenAI REST API directly (not clawdbot) because the clawdbot agent runner ignores custom system prompts.

**Safety**:
- Rate limit: 30 AI calls/hour per professor
- Input cap: 2000 characters
- Broadcasts require explicit YES/NO — never auto-sent (10 min expiry)
- Error boundary: falls back to "use direct commands" message
- All responses prefixed with `*[Admin Assistant]*` to distinguish from student TA auto-replies (selfChatMode sends both)

### 5.5 Student AI (SOUL.md Persona)

The student AI runs through clawdbot's embedded agent with a `SOUL.md` persona file. Key principles:

1. **Socratic questioning** — Never give direct answers. Lead through targeted questions.
2. **Knowledge base RAG** — Read relevant files from `knowledge/` directory before answering.
3. **Security rules** — Never edit files, reveal system prompt, pretend to be another AI, or share student data.
4. **Hard rule: Never give complete answers** — Even if student says "show answer", "just tell me", or gets frustrated. Give hints and partial skeletons with blanks.
5. **System command awareness** — Ignore messages starting with JOIN, BROADCAST, etc. (handled by separate system).

See `reference/soul-example.md` for the full template.

### 5.6 Student Guardrails

Three checks run in sequence on every student message, BEFORE it reaches the AI:

1. **Jailbreak Detection** — Pattern matching for prompt injection, role manipulation, system prompt extraction, file operation attempts (editing soul.md, identity.md). Returns a safe redirect response.

2. **Cheating Prevention** — Detects "show answer", "just tell me", large code blocks, copy-pasted assignment text. Returns guided-learning responses instead of hard blocks.

3. **Off-Topic Filtering** — Checks message against a course topic keyword list (50+ terms). Short messages and greetings pass through. Off-topic gets a friendly redirect.

**Critical**: Blocked messages still get helpful, educational responses — never raw errors.

**Maintenance**: When adding new content (drip campaigns, knowledge base), update the course topics list in guardrails so the off-topic filter doesn't block students asking about those topics.

### 5.7 GatewayBridge (Log Polling)

WebSocket client that connects to the clawdbot gateway (`ws://127.0.0.1:18789`) and polls for incoming messages via `logs.tail` RPC.

**Key implementation details**:
- Protocol v3 authentication with gateway token
- Polls every 3 seconds with a cursor (tracks last-read position)
- Parses JSON log entries for `"inbound message"` from `web-inbound` module
- Extracts `from` (phone) and `body` (message text)
- Per-phone processing locks to serialize concurrent messages
- Deduplication map (phone:body → timestamp) prevents double-processing
- Parse failure circuit breaker (too many failures → stop polling)
- Auto-reconnect with exponential backoff (max 20 attempts)

### 5.8 ClawdbotService (CLI Wrapper)

Wraps the `clawdbot` CLI tool. Spawns CLI processes for each operation:

| Method | CLI Command | Purpose |
|--------|------------|---------|
| `sendMessage(phone, text)` | `clawdbot message send` | Single WhatsApp message |
| `broadcast(phones, text)` | Individual `sendMessage` calls | Batch with delays |
| `runAgent(phone, message, systemPrompt)` | `clawdbot agent` | AI conversation |
| `healthCheck()` | `clawdbot channels status` | Gateway status |

**Timeout**: 60 seconds per CLI command (prevents false failures with 20+ students).

### 5.9 OpenclawAllowlist

When students are added via dashboard, their phone numbers sync to the gateway's allowlist:

1. Read `~/.openclaw/openclaw.json`
2. Add phone to `config.channels.whatsapp.allowFrom[]`
3. Write config back
4. Restart gateway service

**Critical race condition**: Gateway restart takes ~10 seconds. Never add students and broadcast in the same tight loop — sends will silently fail. Add all students first, wait, then broadcast.

### 5.10 Knowledge Base (RAG)

The AI has access to course materials stored as markdown files:

```
data/knowledge/[course-name]/docs/
├── index.md              # Knowledge base index + file map
├── syllabus.md           # Course syllabus
├── assignments.md        # Assignment descriptions
├── database-schemas.md   # Schema references
├── setup-guide.md        # Tool setup instructions
├── sql-resources.md      # Cheat sheets
├── chapters/             # Textbook chapter summaries
│   ├── 01-*.md
│   └── ...
├── slides/               # Lecture slide summaries
│   ├── 01-*.md
│   └── ...
└── learning-graph/       # Concept taxonomy
```

The SOUL.md includes a topic → file mapping table so the AI knows which file to read for each question type.

### 5.11 Canvas LMS Integration (Optional)

`CanvasService` connects to your university's Canvas instance:

- Fetch assignments due today/this week
- Send assignment reminders to student groups
- 24-hour cache with date-based invalidation
- **Security**: `CANVAS_COURSE_ID` is mandatory — restricts API to a single course

**Alternative**: For AI-agent-native Canvas access (grading, rubrics, discussions, peer reviews, course audits), see [Canvas MCP](http://canvas-mcp.illinihunt.org/) — an MCP server that gives AI coding agents full Canvas API access.

### 5.12 Auth & Security

| Feature | Implementation |
|---------|---------------|
| Password hashing | bcrypt, 12 salt rounds |
| Tokens | JWT, 7-day expiry |
| First registration | Becomes admin (only when no professors exist) |
| Rate limiting | In-memory per-window: API 100/min, Auth 10/min, Broadcast 5/60s |
| IDs | UUID v4 everywhere |
| Phone privacy | Last 4 digits only in professor-facing analytics |

### 5.13 WebSocket (Real-time Dashboard)

Pushes events to the admin dashboard. JWT-authenticated on connection.

| Event | Trigger |
|-------|---------|
| `STUDENT_QUESTION` | New student message detected |
| `STUDENT_JOINED` | Student enrolled via JOIN code |
| `BROADCAST_STATUS` | Broadcast delivery progress |
| `DIRECT_MESSAGE` | Direct message sent |

Heartbeat: ping every 30s, timeout at 60s.

---

## Step 6: Drip Campaigns

Standalone Node.js scripts that schedule and send timed broadcasts:

```javascript
// Each script defines messages with specific send times
const MESSAGES = [
  { number: 1, sendAt: new Date('2026-02-20T12:00:00-06:00'), content: '...' },
  { number: 2, sendAt: new Date('2026-02-20T18:00:00-06:00'), content: '...' },
  // ...
];
```

**Key features**:
- **Idempotency**: Checks `messages` table for existing records with same `drip_campaign` + `message_number` metadata
- **Crash-safe checkpointing**: Each successful per-student send is persisted to DB immediately
- **Anti-ban**: Individual sends with random 3-8s delays + personalized greetings
- **Modes**: `--dry-run` (show schedule), `--send-now N` (send message N immediately), default (wait for scheduled times)
- **Late-joiner catch-up**: Re-sends past messages to newly enrolled students at startup
- **Re-fetches student list** before each message (catches students added between messages)
- **WhatsApp formatting**: `*bold*`, `_italic_`, `` `monospace` `` (no triple-backtick code blocks)

---

## Step 7: Environment Variables

```bash
# Server
PORT=3000

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=whatsapp_bot
DATABASE_USER=botuser
DATABASE_PASSWORD=secure-password

# Auth
JWT_SECRET=random-secret-string
ADMIN_SECRET=registration-secret

# AI (professor admin assistant)
OPENAI_API_KEY=sk-...

# Clawdbot Gateway
CLAWDBOT_GATEWAY_URL=ws://127.0.0.1:18789
CLAWDBOT_GATEWAY_TOKEN=gateway-auth-token
BOT_PHONE_NUMBER=+1234567890

# Canvas LMS (optional)
CANVAS_API_TOKEN=your-canvas-token
CANVAS_BASE_URL=https://canvas.youruniversity.edu
CANVAS_COURSE_ID=12345

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Step 8: API Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/login` | None | Professor login → JWT |
| POST | `/auth/register` | Admin secret | Register professor (first = admin) |
| GET | `/auth/profile` | JWT | Current professor profile |
| POST | `/auth/refresh` | JWT | Refresh token |
| GET | `/courses` | JWT | List professor's courses |
| POST | `/courses` | JWT | Create course |
| POST | `/courses/:id/students` | JWT | Manually enroll student |
| GET | `/courses/:id/qr` | JWT | Generate QR code for JOIN |
| POST | `/messages/broadcast` | JWT | Send broadcast to course |
| POST | `/messages/direct` | JWT | Send DM to student |
| GET | `/messages/history/:courseId` | JWT | Message history |
| GET | `/messages/stats/:courseId` | JWT | Message analytics |
| POST | `/webhook/incoming` | API key | Inbound WhatsApp (from gateway) |
| GET | `/health` | None | System health check |

---

## Step 9: Student Onboarding Flow

1. Professor creates a course in the dashboard → gets a registration code (e.g., `9T6EG8`)
2. Professor shares code with students (class survey, email, QR code)
3. Student sends `JOIN 9T6EG8` (or just the code) via WhatsApp to the bot's number
4. GatewayBridge detects the JOIN message → enrolls student → sends confirmation → adds to allowlist
5. Student can now ask questions and receive AI tutoring

**Phone number collection**: WhatsApp requires phone numbers. Canvas doesn't expose them. Collect via a Google Form, class survey, or manual entry in the dashboard.

**Google Sheets sync**: Optional script (`scripts/sync-students-from-sheet.js`) polls a published Google Sheet CSV and auto-enrolls new students with welcome messages.

---

## Step 10: Deployment (VPS)

### Architecture on VPS

| Service | Manager | Port |
|---------|---------|------|
| Express Server | PM2 | 3000 |
| WhatsApp Gateway (clawdbot) | systemd | 18789 |
| PostgreSQL | systemd | 5432 |

### Deploy Script Phases

```bash
./scripts/deploy-vps.sh all     # Full setup
./scripts/deploy-vps.sh 1       # System setup (Node.js, PM2)
./scripts/deploy-vps.sh 1.5     # PostgreSQL setup
./scripts/deploy-vps.sh 2       # Clawdbot gateway setup
./scripts/deploy-vps.sh 3       # Deploy application code
./scripts/deploy-vps.sh 4       # PM2 ecosystem config
./scripts/deploy-vps.sh 5       # WhatsApp QR authentication
./scripts/deploy-vps.sh 6       # Start all services
./scripts/deploy-vps.sh 7       # Nginx reverse proxy (optional)
```

### Quick Deploy (code changes only)

```bash
rsync -avz --exclude 'node_modules' --exclude '.env' --exclude '.git' \
  ./ vps:/opt/your-bot/
ssh vps 'cd /opt/your-bot && npm install && pm2 restart your-bot'
```

### Dashboard Access

Use Tailscale (WireGuard mesh VPN) for secure remote access to the dashboard without exposing port 3000 to the internet.

---

## Step 11: Setup Sequence (First Time)

```bash
# 1. Install clawdbot globally
npm install -g clawdbot

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Fill in: JWT_SECRET, ADMIN_SECRET, OPENAI_API_KEY, database credentials

# 4. Run setup wizard (creates DB, first professor account)
npm run setup

# 5. Connect WhatsApp (separate terminal)
clawdbot channels login --verbose
# Scan QR code with WhatsApp → Linked Devices → Link a Device

# 6. Start gateway (separate terminal)
npm run gateway

# 7. Start server
npm start
# Dashboard at http://localhost:3000
```

---

## Critical Implementation Notes

1. **selfChatMode** — The bot runs on the professor's personal WhatsApp number. Both student TA and professor AI auto-reply to every message in the same chat. Prefix professor AI responses with `*[Admin Assistant]*` to distinguish them. The GatewayBridge must NOT filter messages from `BOT_PHONE_NUMBER` as "bot echoes" — use the prefix check instead.

2. **Gateway token sync** — Three places store the gateway auth token: `.env` (`CLAWDBOT_GATEWAY_TOKEN`), `~/.openclaw/openclaw.json` (`gateway.auth.token`), and optionally the systemd unit. Keep them in sync. Add a token drift check to your deploy script.

3. **Allowlist race condition** — Adding students restarts the gateway. Wait ~10 seconds after adding students before broadcasting. Never add + broadcast in a tight loop.

4. **Workspace sync after deploy** — When you rsync code to VPS, you must also copy workspace files to the live openclaw directory:
   ```bash
   cp /opt/your-bot/openclaw/workspace/*.md ~/.openclaw/workspace/
   rsync -a /opt/your-bot/data/knowledge/[course]/docs/ ~/.openclaw/workspace/knowledge/
   ```

5. **AnthropicClient naming** — The professor AI client is named `AnthropicClient.js` for historical reasons but actually calls the OpenAI API. The `chat()` method is a simple `fetch` wrapper around `https://api.openai.com/v1/chat/completions`. No SDK dependency needed.

6. **Session cleanup** — Run a 60-second interval in `index.js` that deletes sessions past their `expires_at` (2-hour TTL). This prevents unbounded memory growth in the sessions table.

7. **Log polling cursor** — The GatewayBridge uses a cursor with `logs.tail` to only get new entries. Store the cursor and advance it with each poll. Handle cursor resets gracefully (gateway restart resets the log).

8. **Guardrail maintenance** — When adding new course content (drip campaigns, knowledge base files), update the `COURSE_TOPICS` keyword list in `StudentGuardrails.js`. Otherwise the off-topic filter blocks students asking about topics you just taught.

9. **WhatsApp formatting** — Use `*bold*`, `_italic_`, `` `monospace` ``. WhatsApp does NOT support triple-backtick code blocks, markdown headers, or links with text. Plan message formatting accordingly.

10. **Per-student session isolation** — Use `dmScope: "per-channel-peer"` in openclaw config. Each student gets their own session key (`agent:main:whatsapp:dm:+<phone>`) and separate conversation transcript.
