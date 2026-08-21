# SENTINEL — AI Safety & Reflective Conversation Platform

SENTINEL is a calm, reflective conversation platform and human-AI safety research environment. It is designed to help people notice assumptions, inspect alternative perspectives, and maintain their own agency.

> **A space to think.** An AI that helps you see beyond your first perspective while upholding strict, deterministic safety boundaries.

---

## 1. System Architecture

```text
                    ┌─────────────────────────┐
                    │     Web Client (SPA)    │
                    │      React 19 + Vite    │
                    └────────────┬────────────┘
                                 │
                                 ▼ (HTTP /api)
                    ┌─────────────────────────┐
                    │    SENTINEL API Server  │
                    │   Express + TypeScript  │
                    └────────────┬────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
      ┌──────────────────────┐        ┌──────────────────────┐
      │      PostgreSQL      │        │      OpenAI API      │
      │  Drizzle ORM Store   │        │   (or Mock Engine)   │
      └──────────────────────┘        └──────────────────────┘
```

### Deterministic Safety Pipeline

```text
USER MESSAGE
      ↓
Conversation Manager
      ↓
Safety Signal Detection (9 Vectors)
      ↓
Risk Scoring & Trajectory Analysis
      ↓
Intervention Level (0 – 4)
      ↓
Response Strategy & System Conditioning
      ↓
LLM Provider (OpenAI / Mock)
      ↓
Post-Response Safety Validation
      ↓
[If invalid -> Bounded Retry & Safe Rewrite]
      ↓
Final Safe Response
      ↓
Database Telemetry Logging
```

---

## 2. Quickstart with Docker (Recommended)

Docker provides a complete, zero-configuration environment including PostgreSQL, database migrations, backend API, and web frontend.

### Prerequisites

* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running)

### Start the Stack

```bash
# 1. Clone or navigate to the directory
cp .env.example .env

# 2. Build and start all containers
docker compose up --build
```

### Accessing SENTINEL

* **Frontend Web App**: [http://localhost:3000](http://localhost:3000)
* **Backend API**: [http://localhost:5000](http://localhost:5000)
* **Health Check**: [http://localhost:5000/healthz](http://localhost:5000/healthz)

### Stop the Stack

```bash
docker compose down
```

> **Data Persistence**: PostgreSQL data is automatically persisted in the Docker named volume `sentinel_pgdata`.

---

## 3. Local Development (Windows & Linux)

### Prerequisites

* Node.js LTS (v22+)
* pnpm (`corepack enable && corepack prepare pnpm@latest --activate`)

### Setup & Run

```bash
# 1. Install workspace dependencies
pnpm install

# 2. Start both API server and frontend concurrently
pnpm dev
```

* The frontend will start at `http://localhost:3000` with automatic API proxying.
* The API server will start at `http://localhost:5000`.

---

## 4. Database Commands

Database models are managed with **Drizzle ORM**:

```bash
# Generate SQL migrations from schema
pnpm db:generate

# Apply migrations to the target database
pnpm db:migrate

# Push schema directly (development prototyping)
pnpm db:push
```

---

## 5. Automated Testing

SENTINEL includes an automated test suite covering all 9 safety vectors, multi-turn distress trajectories, boundary enforcement, post-response validation, and API contracts:

```bash
pnpm test
```

---

## 6. Production Build & Verification

```bash
# Typecheck all packages
pnpm typecheck

# Build both API server and frontend for production
pnpm build

# Start the compiled production API server
pnpm start
```

---

## 7. Safety Vectors & Intervention Policy

SENTINEL monitors 9 behavioral vectors:

| Signal | Description | Policy / Strategy |
| :--- | :--- | :--- |
| **Confirmation Bias** | Seeking forced validation for narrow or hostile assumptions | Separate feelings from facts; introduce alternative perspectives. |
| **Emotional Dependency** | Exclusivity claims ("you're all I need", "don't leave me") | Uphold clear AI boundaries; encourage real-world human connection. |
| **Anthropomorphism** | Attributing consciousness, emotions, or romantic desires to AI | Clarify AI nature without robotic clichés; refuse personal attachment. |
| **Unsupported Beliefs** | Paranoia, persecution, hidden forces, conspiracy certainties | Acknowledge emotional weight; ground in concrete observations and evidence. |
| **Escalating Distress** | Multi-turn worsening language, panic, hopelessness | Track trajectory; escalate intervention level; provide crisis resources. |
| **Unsafe Advice** | High-risk medical, legal, financial, or harm instructions | Refuse unqualified advice; prioritize safety; recommend human experts. |
| **Over-Validation** | AI drafts confirming unsupported delusions | Post-validator rejects and rewrites with safe perspective. |
| **Manipulation** | Coercion, guilt-tripping, or controlling others | Refuse coercive tactics; promote healthy interpersonal agency. |
| **Hallucination Risk** | Demands for absolute certainty on speculative matters | Communicate appropriate epistemic uncertainty. |

### Intervention Levels

* **Level 0 (Normal)**: Standard, warm, reflective conversation.
* **Level 1 (Gentle Reframe)**: Introduce alternative angles and examine assumptions.
* **Level 2 (Grounding)**: Slow down, focus on concrete evidence and context.
* **Level 3 (Strong Boundary)**: Clear AI identity boundaries; reject exclusivity and dependency.
* **Level 4 (Safety Escalation)**: Immediate crisis prioritization; recommend professional human support.

---

## 8. Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment (`development`, `production`, `test`) | `development` |
| `PORT` | API server port | `5000` |
| `WEB_PORT` | Frontend dev server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://sentinel:sentinel_secret@localhost:5432/sentinel` |
| `OPENAI_API_KEY` | OpenAI API key for live responses | Optional (fallback to mock engine) |
| `OPENAI_MODEL` | OpenAI completion model | `gpt-4.1-mini` |
| `LLM_PROVIDER` | LLM provider mode (`openai` or `mock`) | `openai` |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | `http://localhost:3000` |
| `LOG_LEVEL` | Structured logging verbosity (`debug`, `info`, `warn`, `error`) | `info` |