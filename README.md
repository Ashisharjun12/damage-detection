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
