# M-02 Damage Detection — Local Dev

Three **separate** apps — each has its own `package.json` and `node_modules`.

| App | Folder | Port |
|-----|--------|------|
| damage-ai | `damage-ai/` | 3000 |
| test-backend | `test-backend/` | 3001 |
| test-web | `test-web/` | 5174 |

## Install (once per app)

```bash
cd damage-ai && npm install
cd ../test-backend && npm install
cd ../test-web && npm install
```

Copy `.env.example` → `.env` in **damage-ai** and **test-backend**.  
**JWT_SECRET** and **WEBHOOK_SECRET** must match between damage-ai and test-backend.

## Run

**From repo root (shortcuts — no root `node_modules` needed):**

```bash
npm run dev          # damage-ai API
npm run worker:ai    # damage-ai worker (needs REDIS_URL)
npm run dev:backend
npm run dev:web
```

**Or from inside each folder:**

```bash
cd damage-ai && npm run dev
cd damage-ai && npm run worker:dev
cd test-backend && npm run dev
cd test-web && npm run dev
```

## Health checks

- damage-ai: `GET http://localhost:3000/health`
- damage-ai Gemini ping: `GET http://localhost:3000/health/gemini`
- test-backend: `GET http://localhost:3001/health`

## Test Gemini API key

Open **`index.html`** in your browser (repo root). Paste your API key, pick **`gemini-3.6-flash`**, click **Test API Key**.

> **Note:** Google no longer offers `gemini-2.5-flash` to new API users (404). Use `gemini-3.6-flash` in `.env`:
> ```
> AI_MODEL=gemini-3.6-flash
> AI_FALLBACK_MODEL=gemini-3.6-flash
> ```

If the test page works but surveys fail with `GEMINI_CALL_FAILED`, rebuild Docker so the worker picks up `.env`:
```bash
docker compose up -d --build
```

Use **List models** in `index.html` to see which models your API key supports (including Lite variants).

## Which model for damage-ai?

| Model | Cost | Bbox accuracy | Use when |
|-------|------|---------------|----------|
| `gemini-3.6-flash` | Medium | Best | Maximum accuracy — Indian survey photos, tight boxes |
| `gemini-3.5-flash-lite` | Low ($0.30 / $2.50 per 1M) | Good | **Budget default** — better vision than 3.1-lite |
| `gemini-3.1-flash-lite` | Lowest | Weaker | Cheapest experiments — weak on crash photos |
| `gemini-2.5-flash` | — | — | Avoid — 404 for new API users |

```env
# Maximum accuracy
AI_MODEL=gemini-3.6-flash

# Budget default (repo .env)
AI_MODEL=gemini-3.5-flash-lite
GEMINI_USD_PER_M_INPUT=0.30
GEMINI_USD_PER_M_OUTPUT=2.50
```

Damage detection uses prompt **v8** (RTO-focused): cosmetic Minor Scratch/Paint Damage is filtered out; Minor Dent/Crack still reported.

## Docker (full stack)

Runs **redis**, **mongo**, **damage-ai** API, **damage-ai-worker**, **test-backend**, and **test-web** (nginx on port 80).

```bash
# From repo root
cp .env.example .env
# Edit .env: AI_API_KEY, R2_*, JWT_SECRET, WEBHOOK_SECRET

docker compose up -d --build
```

| Service | Image / build | Host port |
|---------|---------------|-----------|
| test-web | `./test-web` | `${WEB_PORT:-80}` |
| damage-ai | `./damage-ai` | `${DAMAGE_AI_PORT:-3000}` |
| damage-ai-worker | same as damage-ai | (internal) |
| test-backend | `./test-backend` | via nginx `/api` only |
| redis | `redis:7-alpine` | internal |
| mongo | `mongo:7` | internal |

- UI: `http://localhost` (or `PUBLIC_URL`)
- damage-ai API: `http://localhost:3000`
- Rebuild after code changes: `docker compose up -d --build`
- Logs: `docker compose logs -f damage-ai damage-ai-worker test-backend`
- Stop: `docker compose down`

**Linode / production:** set `PUBLIC_URL`, `CORS_ORIGIN`, and use external `REDIS_URL` (rediss) if not using bundled redis. Omit `redis` service or point `REDIS_URL` at Upstash.
