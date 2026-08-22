# HAVEN — AI Safety, Reflective Conversation & Journaling Platform

[![Live Deployment](https://img.shields.io/badge/Deployment-Live%20on%20Render-success?style=for-the-badge&logo=render)](https://haven-app-llxr.onrender.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

🌐 **Live Application**: **[https://haven-app-llxr.onrender.com/](https://haven-app-llxr.onrender.com/)**

**Haven** is a calm, privacy-first AI reflection engine and creative journal sanctuary. It is designed to provide a safe, grounded space for examining assumptions, slowing down, exploring competing values, and maintaining personal agency within deterministic safety boundaries.

> **A space to think, notice, and reflect.**  
> Not a therapist. Not a mirror that blindly agrees. A careful, epistemic AI presence that will tell you when it is uncertain.

---

## 🌟 Key Features

- **💬 Domain-Agnostic Reflective Dialogue**: Live SSE-streamed conversations focused on epistemic humility, thought untangling, and exploring alternative perspectives.
- **🛡️ Deterministic Safety & Epistemic Boundaries**: Multi-tier safety pipeline (Levels 0–4) that detects confirmation bias, emotional dependency, anthropomorphism, and crisis risks before rendering.
- **✨ Epistemic Reasoning Transparency**: Assistant messages feature an **Inspect Reasoning** drawer displaying conversational goals, tone strategy, and epistemic boundaries.
- **🏷️ Intelligent Conversation Naming**: Conversations are automatically given thoughtful, succinct titles based on the user's initial inquiry or reflective starter.
- **📖 Haven Journal & Scrapbook (`/journal`)**:
  - **Tactile Paper Textures**: Natural Parchment, Sage Linen, Dark Slate Velvet, Kraft Earth, and Studio White.
  - **Typography Vibes**: Editorial Serif, Handwritten Script, and Clean Modern Sans.
  - **Aesthetic Sticker Vault**: Curated Botanical, Celestial, Washi Tape & Seals, and Mindful Mantra badges.
  - **Custom Sticker Generator**: Stamp custom emblems with personalized icons, mood palettes, and mottos.
  - **Photo Keepsakes & Polaroids**: Attach personal photos or curated mood photoprints with handwritten captions and washi tape toppers.
- **🔐 Multi-Tenant Authentication & Privacy**: Secure JWT email/password auth with persistent user vaults, plus seamless guest exploration.
- **📥 Markdown Export**: Export any conversation or journal entry as formatted `.md` files.
- **📊 Research Telemetry Observatory**: Anonymized behavioral signal observatory for safety researchers.

---

## 🏗️ System Architecture

```text
                     ┌──────────────────────────────────────┐
                     │          Haven Web Client            │
                     │          React 19 + Vite + CSS       │
                     └──────────────────┬───────────────────┘
                                        │
                                        ▼ HTTP / SSE Stream
                     ┌──────────────────┴───────────────────┐
                     │          Haven API Server            │
                     │         Express 5 + TypeScript       │
                     └──────────┬──────────────────┬────────┘
                                │                  │
                                ▼                  ▼
                     ┌──────────────────┐   ┌──────────────────┐
                     │    PostgreSQL    │   │  Safety & Bias   │
                     │   Drizzle ORM    │   │  State Machine   │
                     └──────────────────┘   └──────────┬───────┘
                                                       │
                                                       ▼
                                            ┌──────────────────┐
                                            │  NVIDIA Nemotron │
                                            │   / OpenAI API   │
                                            └──────────────────┘
```

---

## 🚀 Quickstart & Local Development

### Prerequisites

- **Node.js**: v22+
- **pnpm**: v9+ / Corepack enabled (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Docker** (optional, for containerized runs)

### Setup & Run

1. **Clone the repository and install dependencies**:
   ```bash
   git clone https://github.com/your-username/haven.git
   cd haven
   pnpm install
   ```

2. **Configure your environment variables**:
   ```bash
   cp .env.example .env
   ```
   Add your NVIDIA API key (or OpenAI key) in `.env`:
   ```ini
   LLM_PROVIDER=nvidia
   NVIDIA_API_KEY=your_nvidia_api_key_here
   NVIDIA_MODEL=nvidia/nemotron-3-nano-30b-a3b
   NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
   ```

3. **Start the local development server**:
   ```bash
   pnpm dev
   ```
   - **Frontend App**: `http://localhost:3000`
   - **Backend API**: `http://localhost:5000`
   - **API Health**: `http://localhost:5000/healthz`

---

## 🧪 Automated Testing & Verification

Run the full automated test suite (safety state machine, turn analysis, API contracts):

```bash
# Run all unit and integration tests
pnpm test

# Run TypeScript typechecks across all monorepo packages
pnpm run typecheck

# Build production bundle
pnpm run build
```

---

## 🐳 Docker & Docker Compose

Start the full stack with local PostgreSQL:

```bash
# Build and start all containers
docker compose up --build

# Stop the stack
docker compose down
```

---

## 🌐 Production Deployment

Haven is optimized for single-container / full-stack deployment. Production configuration files are included out of the box:

- **Render**: [`render.yaml`](./render.yaml) (1-Click Blueprint with Managed PostgreSQL)
- **Railway**: [`railway.json`](./railway.json)
- **Fly.io**: [`fly.toml`](./fly.toml)

Detailed step-by-step instructions can be found in the [**Deployment Guide (`DEPLOYMENT.md`)**](./DEPLOYMENT.md).

### Environment Variables Checklist

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | API server & web port | `5000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/haven` |
| `SESSION_SECRET` | Auth session signing secret | *Random 32-character string* |
| `LLM_PROVIDER` | Active AI provider (`nvidia` or `openai`) | `nvidia` |
| `NVIDIA_API_KEY` | NVIDIA NIM AI API key | `nvapi-...` |
| `NVIDIA_MODEL` | NVIDIA model identifier | `nvidia/nemotron-3-nano-30b-a3b` |
| `NVIDIA_BASE_URL` | NVIDIA API endpoint | `https://integrate.api.nvidia.com/v1` |

---

## 📂 Project Structure

```text
haven/
├── artifacts/
│   ├── api-server/         # Express 5 backend & AI conversation engine
│   └── sentinel-ai/        # React 19 + Vite frontend ("Haven")
├── lib/
│   ├── db/                 # Drizzle ORM PostgreSQL schema & migrations
│   ├── api-zod/            # Shared Zod schemas & contracts
│   └── api-client-react/   # Generated React Query API client
├── tests/                  # Safety pipeline & end-to-end integration tests
├── Dockerfile              # Production multi-stage Dockerfile
├── docker-compose.yml      # Local container orchestration
├── render.yaml             # Render Blueprint configuration
├── fly.toml                # Fly.io deployment specification
├── railway.json            # Railway deployment specification
├── DEPLOYMENT.md           # Step-by-step production deployment guide
└── package.json            # Monorepo workspace configuration
```

---

## 🌿 Philosophy & Commitments

Haven operates under five fundamental design commitments:

1. **Agency Preservation**: Haven never tells you what to choose. It helps you untangle your own thoughts.
2. **Epistemic Humility**: When the system is uncertain or lacks information, it explicitly communicates that uncertainty.
3. **Deterministic Safety Boundaries**: AI safety checks run deterministically before and after model generation.
4. **Anti-Dependency Stance**: Haven actively discourages unhealthy anthropomorphism or emotional reliance on AI.
5. **Privacy by Design**: Conversations and journal entries belong exclusively to the user.

---

## 📄 License

MIT © 2026 Haven / Sentinel Project.
