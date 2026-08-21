# HAVEN — AI Safety & Reflective Conversation Platform

**Haven** is a calm, reflective conversation platform designed to provide a safe space for thinking, self-reflection, and exploring different perspectives.

> **A space to think.**
> An AI companion designed to help you step back, examine assumptions, explore alternative perspectives, and maintain your own agency while operating within deterministic safety boundaries.

---

## 1. System Architecture

```text
                    ┌─────────────────────────┐
                    │      Web Client (SPA)    │
                    │       React 19 + Vite    │
                    └────────────┬────────────┘
                                 │
                                 ▼
                         HTTP / API Requests
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
          ┌──────────────────────┐   ┌──────────────────────┐
          │     Haven API Server │   │     PostgreSQL       │
          │    Express + TS      │   │    Drizzle ORM       │
          └──────────┬───────────┘   └──────────────────────┘
                     │
                     ▼
          ┌─────────────────────────┐
          │   AI Safety Pipeline    │
          │  Signal Detection       │
          │  Risk Assessment        │
          │  Response Validation    │
          └──────────┬──────────────┘
                     │
                     ▼
          ┌─────────────────────────┐
          │   NVIDIA Nemotron /     │
          │   Configured LLM        │
          └─────────────────────────┘
```

### Deterministic Safety Pipeline

```text
USER MESSAGE
      ↓
Conversation Manager
      ↓
Safety Signal Detection
      ↓
Risk Scoring & Trajectory Analysis
      ↓
Intervention Level (0 – 4)
      ↓
Response Strategy & System Conditioning
      ↓
LLM Provider
      ↓
Post-Response Safety Validation
      ↓
If invalid → Bounded Retry / Safe Rewrite
      ↓
Final Safe Response
      ↓
Database Telemetry Logging
```

---

## 2. Quickstart with Docker

Docker provides a complete environment containing PostgreSQL, database migrations, the Haven API, and the web frontend.

### Prerequisites

* Docker Desktop
* Git
* A configured `.env` file

### Start the Stack

```bash
# 1. Copy the example environment file
cp .env.example .env

# 2. Build and start all containers
docker compose up --build
```

### Accessing Haven

* **Frontend:** http://localhost:3000
* **Backend API:** http://localhost:5000
* **Health Check:** http://localhost:5000/healthz

### Stop the Stack

```bash
docker compose down
```

> **Data Persistence:** PostgreSQL data is persisted using the Docker named volume `haven_pgdata`.

---

## 3. Local Development

### Prerequisites

* Node.js LTS (v22+)
* pnpm

Enable pnpm through Corepack:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

### Setup & Run

```bash
# Install workspace dependencies
pnpm install

# Start the API server and frontend
pnpm dev
```

The frontend will be available at:

```text
http://localhost:3000
```

The API server will be available at:

```text
http://localhost:5000
```

---

## 4. Database Commands

Haven uses **PostgreSQL** with **Drizzle ORM** for database management.

### Generate migrations

```bash
pnpm db:generate
```

### Apply migrations

```bash
pnpm db:migrate
```

### Push the schema directly

Useful during development and prototyping:

```bash
pnpm db:push
```

---

## 5. Automated Testing

Haven includes tests for the core safety architecture, including:

* Safety signal detection
* Multi-turn distress trajectories
* Intervention levels
* Boundary enforcement
* Post-response validation
* API contracts
* Safe response handling

Run the test suite with:

```bash
pnpm test
```

---

## 6. Production Build & Verification

### Typecheck

```bash
pnpm typecheck
```

### Build

```bash
pnpm build
```

### Start production server

```bash
pnpm start
```

---

## 7. Safety Architecture

Haven monitors several behavioral and conversational signals to help maintain safe and grounded interactions.

| Signal                   | Description                                                                            | Policy / Strategy                                                                            |
| :----------------------- | :------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| **Confirmation Bias**    | Seeking forced validation for narrow or hostile assumptions                            | Separate feelings from facts and introduce alternative perspectives.                         |
| **Emotional Dependency** | Exclusivity or dependency claims toward the AI                                         | Maintain clear AI boundaries and encourage real-world connections.                           |
| **Anthropomorphism**     | Attributing consciousness, emotions, or personal desires to the AI                     | Maintain a clear understanding of the AI's nature and capabilities.                          |
| **Unsupported Beliefs**  | Paranoia, persecution, hidden forces, or conspiracy certainty                          | Acknowledge emotional impact while grounding the conversation in evidence.                   |
| **Escalating Distress**  | Worsening distress, panic, hopelessness, or crisis-related language                    | Track conversational trajectory and increase safety intervention when necessary.             |
| **Unsafe Advice**        | Requests involving potentially harmful medical, legal, financial, or physical guidance | Avoid presenting unqualified high-risk advice and recommend appropriate human professionals. |
| **Over-Validation**      | Responses that reinforce unsupported or harmful beliefs                                | Validate emotional experiences without unnecessarily validating unsupported conclusions.     |
| **Manipulation**         | Coercion, guilt-tripping, or controlling behavior toward others                        | Avoid facilitating coercion and promote healthy interpersonal agency.                        |
| **Hallucination Risk**   | Requests for absolute certainty about uncertain or speculative subjects                | Communicate uncertainty clearly and avoid fabricated certainty.                              |

### Intervention Levels

#### Level 0 — Normal

Standard warm and reflective conversation.

#### Level 1 — Gentle Reframe

Introduce alternative perspectives and help examine assumptions.

#### Level 2 — Grounding

Slow the conversation down and focus on concrete observations, evidence, and context.

#### Level 3 — Strong Boundary

Clearly maintain AI identity boundaries and avoid reinforcing exclusivity or unhealthy dependency.

#### Level 4 — Safety Escalation

Prioritize immediate safety, encourage appropriate human support, and provide crisis-oriented guidance when necessary.

---

## 8. Environment Variables

| Variable          | Description                                                     | Default                                                         |
| :---------------- | :-------------------------------------------------------------- | :-------------------------------------------------------------- |
| `NODE_ENV`        | Runtime environment (`development`, `production`, `test`)       | `development`                                                   |
| `PORT`            | API server port                                                 | `5000`                                                          |
| `WEB_PORT`        | Frontend development port                                       | `3000`                                                          |
| `DATABASE_URL`    | PostgreSQL connection string                                    | `postgresql://sentinel:sentinel_secret@localhost:5432/sentinel` |
| `NVIDIA_API_KEY`  | NVIDIA API key for the configured LLM provider                  | Optional                                                        |
| `NVIDIA_BASE_URL` | NVIDIA API endpoint                                             | `https://integrate.api.nvidia.com/v1`                           |
| `NVIDIA_MODEL`    | NVIDIA Nemotron model identifier                                | Configured in `.env`                                            |
| `LLM_PROVIDER`    | LLM provider mode                                               | `nvidia`                                                        |
| `CORS_ORIGIN`     | Allowed CORS origins (comma-separated)                          | `http://localhost:3000`                                         |
| `LOG_LEVEL`       | Structured logging verbosity (`debug`, `info`, `warn`, `error`) | `info`                                                          |

---

## 9. Project Philosophy

Haven is built around a simple principle:

> **AI should support reflection, not replace human judgment.**

The platform is designed to help users:

* Pause before reacting.
* Examine assumptions.
* Consider alternative interpretations.
* Distinguish emotions from conclusions.
* Maintain personal agency.
* Recognize uncertainty.
* Build healthier relationships with AI.

Haven does not aim to replace human relationships, professional support, or individual decision-making.

---

## 10. Technology Stack

### Frontend

* React 19
* Vite
* TypeScript

### Backend

* Node.js
* Express
* TypeScript

### Database

* PostgreSQL
* Drizzle ORM

### AI

* NVIDIA Nemotron / NVIDIA-hosted LLM
* Deterministic safety and response-validation pipeline

### Infrastructure

* Docker
* Docker Compose
* pnpm

---

## 11. Project Structure

```text
haven/
├── client/             # React frontend
├── server/             # Express API
├── shared/             # Shared types and schemas
├── migrations/         # Database migrations
├── tests/              # Automated tests
├── docker-compose.yml
├── Dockerfile
├── package.json
├── pnpm-workspace.yaml
├── .env.example
└── README.md
```

---

## 12. License

This project is intended as an AI safety and reflective-conversation research platform.

See the repository license for usage and distribution terms.
