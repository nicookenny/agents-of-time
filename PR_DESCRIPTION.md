# Phase 1: Email Triage System 🎯

Implements an intelligent email triage pipeline that **analyzes and categorizes** incoming emails WITHOUT taking automated actions.

## What This Does ✅

**Intelligent Email Analysis:**
- Analyzes incoming Gmail emails in real-time via webhooks
- Uses local Ollama LLM (llama3.2:3b) for privacy-friendly processing
- Extracts structured metadata:
  - 📝 Summary (1-2 sentences)
  - ✅ Actionable items (list of tasks)
  - ⚡ Needs action flag (true/false)
  - 🤖 Actionable by (human/ai/null)
  - 😊 Sentiment, category, priority
  - 👤 Key entities (people, orgs, dates, locations)
  - 🏷️ Suggested Gmail labels

**Data & APIs:**
- Stores analysis in `processed_emails` PostgreSQL table
- Provides query endpoints:
  - `GET /api/email-processing/status` - Health monitoring
  - `GET /api/emails/processed` - Query with filters (needsAction, actionableBy)

**Infrastructure:**
- 🐳 Plug-and-play Docker setup with automatic Ollama model download
- Complete docker-compose orchestration (PostgreSQL + Ollama + App)
- Automatic database migrations during container build
- Health checks and graceful degradation

## What This Does NOT Do ❌

**Important:** This is a **triage-only system**. It does NOT automatically:
- ❌ Create calendar events
- ❌ Send email replies
- ❌ Execute tasks or take actions
- ❌ Modify or move emails in Gmail
- ❌ Trigger automated workflows

**This is intentional.** Phase 1 establishes the intelligent categorization layer. Phase 2 (future work) will add action agents.

## Example Workflow

1. 📧 Email arrives: *"Can we meet Tuesday at 2pm?"*
2. 🤖 System analyzes and stores:
   ```json
   {
     "summary": "Meeting request for Tuesday 2pm",
     "actionables": ["Schedule meeting for Tuesday 2pm"],
     "needsAction": true,
     "actionableBy": "human"
   }
   ```
3. 👀 **Human** queries `/api/emails/processed?needsAction=true`
4. 🧑 **Human** decides to create calendar event

## Quick Start 🚀

```bash
# Copy environment template
cp .env.example .env.local

# Add Google OAuth credentials to .env.local

# Start everything (first time: ~3-5 min for model download)
docker-compose up -d

# Check status
curl http://localhost:3000/api/email-processing/status

# Query emails needing action
curl http://localhost:3000/api/emails/processed?needsAction=true
```

**Subsequent startups:** 10-15 seconds (model cached in Docker volume)

## Technical Implementation

### Backend
- **Database:** PostgreSQL with Drizzle ORM
  - New `processed_emails` table with indexes
  - Enums: `actionable_by` (human/ai)
  - Full relations and type safety

- **AI Processing:**
  - Ollama client wrapper (`src/lib/ai/ollama-client.ts`)
  - Email processor service (`src/lib/services/email-processor.ts`)
  - Structured extraction with Zod schemas
  - Error handling with retry capability

- **Gmail Integration:**
  - Updated webhook (`src/app/api/webhooks/gmail/route.ts`)
  - Real-time processing parallel to existing agent system
  - Graceful degradation when Ollama unavailable

### Infrastructure
- **Docker:**
  - Multi-stage Dockerfile with standalone Next.js build
  - Ollama service with auto model download
  - Health checks and proper orchestration
  - Persistent volumes for database and models

- **APIs:**
  - Status endpoint with health monitoring
  - Query endpoint with filtering and pagination

### Files Changed
- **Created (12 files):** Ollama client, email processor, API endpoints, Docker config
- **Modified (5 files):** Schema, webhook, docker-compose, next.config, gmail tools

## Tech Stack

- **AI:** Ollama (llama3.2:3b) - local, privacy-friendly, $0 API costs
- **Database:** PostgreSQL with Drizzle ORM
- **Deployment:** Docker with automated setup
- **Framework:** Next.js 16 with App Router
- **Language:** TypeScript with full type safety

## Fixes from Code Review ✅

This PR addresses automated code review feedback:
- ✅ **Fixed P1 (Critical):** Moved database migrations to Docker build stage
  - Migrations now run during `docker-compose build`, not at runtime
  - Fixes "drizzle-kit: command not found" error in production
  - Ensures schema is validated before image ships

- ✅ **Fixed P2 (Important):** Updated email skip logic to allow retrying failed emails
  - Only skips successfully processed emails (`WHERE processing_error IS NULL`)
  - Failed emails are automatically retried after 1-hour cooldown
  - Enables recovery from transient Ollama/network failures

## Future: Phase 2 - Action Agents 🔮

After validating the triage system, Phase 2 will add intelligent agents that:
- ✨ Auto-create calendar events based on user preferences
- 💬 Send templated replies for routine requests
- ⚙️ Execute tasks identified as `actionableBy: "ai"`
- 🎯 Make decisions with human escalation for complex/sensitive items

**Phase 1 establishes the foundation.** Phase 2 will build the automation layer on top.

---

## Verification

```bash
# Health check
curl http://localhost:3000/api/email-processing/status

# Should return:
# {
#   "ollama": { "available": true, "model": "llama3.2:3b" },
#   "stats": { "total": N, "needsAction": N, ... },
#   "status": "healthy"
# }

# Test Docker migration fix
docker-compose down -v
docker-compose build --no-cache 2>&1 | grep -i migration
# Should see migrations run during build

# Test retry logic
docker-compose exec postgres psql -U agents -d agents_of_life -c "
INSERT INTO processed_emails
(message_id, sender, received_date, processing_error, needs_action, connected_account_id)
VALUES ('test-retry', 'test@test.com', NOW(), 'Simulated error', false,
(SELECT id FROM connected_accounts LIMIT 1));
"
# Trigger same email again - should be retried after 1 hour
```

---

See implementation details in:
- `/root/.claude/plans/smooth-jumping-sparkle.md` - Original implementation plan
- `/root/.claude/plans/pr-review-fixes.md` - Code review fixes
