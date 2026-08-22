# 🚀 Haven / SENTINEL — Production Deployment Guide

Haven is built as a self-contained, full-stack application. In production, the Node server bundles both the **Express 5 API engine** and the **Vite React frontend** into a single container/service with automatic database migrations.

---

## 🌟 Quick Platform Options

| Platform | Deployment Type | Managed Database | Free Tier |
| :--- | :--- | :--- | :--- |
| **[Render](https://render.com)** *(Recommended)* | Blueprint (`render.yaml`) / Docker | Yes (PostgreSQL) | ✅ Yes |
| **[Railway](https://railway.app)** | GitHub Repo / Dockerfile (`railway.json`) | Yes (PostgreSQL plugin) | ✅ $5 free credit |
| **[Fly.io](https://fly.io)** | `fly launch` / Dockerfile (`fly.toml`) | Yes (`fly postgres`) | ✅ Yes |

---

## 🔑 Required Environment Variables

Before deploying, ensure you have configured these environment variables in your hosting provider's dashboard:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Web port | `5000` (or assigned by provider) |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/haven` |
| `SESSION_SECRET` | Secret key for auth sessions | *Random 32-char string* |
| `NVIDIA_API_KEY` | NVIDIA NIM AI API key *(if using NVIDIA)* | `nvapi-...` |
| `OPENAI_API_KEY` | OpenAI API key *(if using OpenAI)* | `sk-...` |
| `LLM_PROVIDER` | Active AI provider | `nvidia` or `openai` |
| `NVIDIA_MODEL` | Model identifier | `nvidia/nemotron-3-nano-30b-a3b` |
| `NVIDIA_BASE_URL` | NVIDIA endpoint | `https://integrate.api.nvidia.com/v1` |

---

## Option 1: Deploy to Render (Recommended)

### Step 1: Push your code to GitHub
```bash
git add .
git commit -m "Prepare Haven for deployment"
git push origin main
```

### Step 2: Deploy on Render
1. Go to **[dashboard.render.com](https://dashboard.render.com)** and sign in.
2. Click **New +** → **Blueprint**.
3. Connect your GitHub repository.
4. Render will detect [render.yaml](file:///c:/Users/Tushita%20Pandey/OneDrive/Desktop/Projects/Haven/render.yaml) automatically:
   - It provisions a **Managed PostgreSQL Database** (`haven-db`).
   - It provisions the **Haven Web Service** (`haven-app`).
5. When prompted for environment variables:
   - Enter your `NVIDIA_API_KEY` (or `OPENAI_API_KEY`).
6. Click **Apply**.
7. Render will build the Docker container and provide a live HTTPS URL (e.g. `https://haven-app.onrender.com`).

---

## Option 2: Deploy to Railway

1. Install the Railway CLI (optional) or use the web dashboard at **[railway.app](https://railway.app)**.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select your Haven repository.
4. Click **+ New** inside your project canvas → **Database** → **PostgreSQL**.
5. In your Haven service settings:
   - Under **Variables**, add:
     - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}`
     - `NVIDIA_API_KEY`: *(Your key)*
     - `LLM_PROVIDER`: `nvidia`
     - `NVIDIA_MODEL`: `nvidia/nemotron-3-nano-30b-a3b`
     - `SESSION_SECRET`: *(A random secret string)*
6. In **Settings** → **Networking** → Click **Generate Domain**.
7. Railway will deploy and serve your live Haven app!

---

## Option 3: Deploy to Fly.io

1. Install Flyctl:
   - Windows (PowerShell): `iwr https://fly.io/install.ps1 -useb | iex`
   - Mac/Linux: `curl -L https://fly.io/install.sh | sh`
2. Authenticate:
   ```bash
   fly auth login
   ```
3. Create a Postgres database on Fly:
   ```bash
   fly postgres create --name haven-postgres
   ```
4. Launch and attach:
   ```bash
   fly launch --copy-config
   fly postgres attach haven-postgres
   ```
5. Set your AI secrets:
   ```bash
   fly secrets set NVIDIA_API_KEY="your-nvidia-key" SESSION_SECRET="your-session-secret"
   ```
6. Deploy:
   ```bash
   fly deploy
   ```

---

## 🛠️ Post-Deployment Verification

1. Open your live deployed URL (e.g. `https://your-haven-app.onrender.com`).
2. Visit `/healthz` — should return `{"status":"ok"}`.
3. Visit `/space` — start a conversation or click a reflective starter to confirm AI streaming works.
4. Visit `/journal` — create a journal entry, add custom stamps and photos to verify persistence.
