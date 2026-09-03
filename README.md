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
- test-backend: `GET http://localhost:3001/health`

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
