# Bill Tracker & Warranty Scanner

Scan paper bills with your phone camera, extract structured data with AI (Google Gemini / Ollama), and track bills and warranty expiry dates.

## Stack

| Part | Tech |
|---|---|
| `backend/` | Node.js (ESM), Express 5, Mongoose (MongoDB), Passport (OTP email login + Google/Facebook/Discord OAuth), Cloudinary uploads, Vitest |
| `frontend/` | React 19, Vite, react-router-dom 7, axios, Vitest + Testing Library |
| `monitoring/` | Docker Compose: Prometheus (9090), Loki (3100), Grafana (3001) |
| `docs/` | Static runtime architecture diagram (GitHub Pages) |

## Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)
- Docker (optional, for monitoring stack)
- Cloudinary account (bill image storage)
- Gmail app password (OTP emails)

## Setup

```bash
git clone <repo-url> && cd bill_scanning
npm --prefix backend install
npm --prefix frontend install

# Backend env
cp backend/.env.example backend/.env    # then fill in your keys

# Frontend env (defaults to http://localhost:3000/api if omitted)
cp frontend/.env.example frontend/.env

# Monitoring env (required before starting Grafana)
cp monitoring/.env.example monitoring/.env  # set GRAFANA_ADMIN_PASSWORD
```

Backend variables are documented in `backend/.env.example`. `SESSION_SECRET` is **required in production** — the server refuses to start without it when `NODE_ENV=production`. Registration and login both require a 6-digit email OTP before a session is created.

## Running

```bash
npm run dev:backend      # API on http://localhost:3000
npm run dev:frontend     # Web app on http://localhost:5173
npm run dev:monitoring   # Prometheus/Loki/Grafana (requires Docker)
```

API health check: `http://localhost:3000/api/health` · Metrics: `http://localhost:3000/metrics`

## Tests & Lint

```bash
npm test           # backend (37 tests, in-memory MongoDB) + frontend (5 tests)
npm run lint       # frontend ESLint
```

Tests use `mongodb-memory-server` — no real database is touched.

## Security

**All secrets live in environment variables — never in source code.** This includes `MONGODB_URI`, `SESSION_SECRET`, `GEMINI_API_KEY`, Cloudinary keys, OAuth client secrets, and Gmail credentials. Frontend code only reads `VITE_API_URL`, which is a public-safe URL; no `NEXT_PUBLIC_*`/`REACT_APP_*`-style sensitive vars exist, and this project uses no Supabase or Stripe keys.

Secret-handling behavior in the code:

- Profile API responses never include `password`, `otpCode`, or `otpExpiresAt`.
- OTP codes are only written to logs in non-production environments (dev convenience); production logs never contain them.
- HTTP request logs redact sensitive query parameters (`code`, `token`, `otp`, `password`, `secret`, `key`, …) so OAuth authorization codes never hit log files or Loki.
- 5xx responses return a generic `Internal Server Error`; raw driver/provider messages (which can embed connection strings) are logged server-side only.
- Gemini error logs redact the API key before writing.
- `.env` files are gitignored (`backend/.gitignore`, root, `monitoring/.gitignore`) and `.env.example` files list required variables with placeholders only.

> ⚠️ **Rotation warning:** if any secret was ever hardcoded, pasted into an issue/commit, or committed at any point, rotating it is the ONLY safe remediation — deleting it later does not invalidate it, because it remains recoverable from git history, old clones, caches, and logs. Rotate `SESSION_SECRET` by regenerating it; rotate API keys (Gemini, Cloudinary, OAuth, Gmail app password) in their provider consoles. Rotate your MongoDB password if the connection string was ever shared.

## Deployment notes (Vercel)

Deploy as **two Vercel projects** from this repo:

- **Backend** — set the project Root Directory to `backend/`. Vercel's zero-config Express support detects `src/app.js` (default export) and runs the whole API as one function (`backend/vercel.json` raises `maxDuration` to 60s for AI scans). Set env vars: `NODE_ENV=production`, `MONGODB_URI` (must use TLS), `SESSION_SECRET`, `CLIENT_URL`, `SERVER_URL`, `GEMINI_API_KEY`, `EMAIL_USER`, `EMAIL_PASS`, `CLOUDINARY_*`, OAuth client/secret + `*_CALLBACK_URL`, and optionally `REDIS_URL` / `METRICS_TOKEN`.
- **Frontend** — set the project Root Directory to `frontend/`. Set `VITE_API_URL` to the backend URL. `frontend/vercel.json` routes the SPA.

Production requirements enforced in code:

- **Cloudinary is mandatory in production.** Serverless has no persistent disk, so a failed upload throws instead of returning a local URL that would 404.
- **Uploads** go to `os.tmpdir()` on Vercel automatically; request bodies must stay under ~4.5MB (upload limit defaults to 4MB there).
- **Redis** (`REDIS_URL`) shares rate-limit counters across function instances; omit it only for single-instance setups.

- **Grafana:** credentials come from `monitoring/.env`. If an old `monitoring/grafana/grafana.db` exists from a previous run, it keeps its original password — delete it to re-initialize.
- OAuth redirects are configured via `*_CALLBACK_URL` backend variables.

## Project structure

```
bill_scanning/
├── backend/          Express API (controller → service → repository → model)
│   ├── dev-server.js Local dev entry (Vercel uses src/app.js via zero-config)
│   ├── src/app.js    Express app (default export)
│   └── tests/        Vitest + supertest + mongodb-memory-server
├── frontend/         React SPA (Vite)
│   └── src/pages/    Login (OTP), Register, Dashboard, ScanBill
├── monitoring/       docker-compose: Prometheus, Loki, Grafana
├── docs/             Architecture diagram (GitHub Pages)
└── package.json      Root scripts for running everything
```
