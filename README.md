# sandybeach

Web frontend for the Chroma image-generation worker running on RunPod.

## Layout

- `workers/` — RunPod Serverless worker. One Docker image, one handler, both T2I and I2I modes (selected by `input.mode`). See [workers/README.md](workers/README.md) for build & deploy.
- `main.py` — CLI smoke test that hits a RunPod endpoint by id. Works against the new serverless endpoint as long as `RUNPOD_API_KEY` is set and you point it at the right endpoint.
- `web/` — Next.js 16 app (Vercel target) — the user-facing product.

The old `runpod_flash`-based files (`text_to_image.py` at the repo root and the `.flash/` directory) are obsolete; remove them once the serverless image is deployed.

## Architecture (Phase 1)

```
browser ──POST /api/jobs──▶ Vercel ──submit──▶ RunPod (worker)
                              │                    │
                              ▼                    │ webhook on completion
                          Postgres (job row)       │
                              ▲                    ▼
browser ◀─poll /api/jobs/[id]── Vercel ◀─POST /api/jobs/webhook
                                  │
                                  └─ upload PNG ─▶ Cloudflare R2
```

Why webhooks: RunPod cold starts run 3–6 min, but Vercel functions cap at 60s. The submit handler returns a job id immediately; the worker calls back our `/api/jobs/webhook` when done; the browser polls a cheap DB read for status. The status route also re-checks RunPod after ~20s as a fallback for dropped webhooks.

## Setup

### 1. Provision services

- **Railway Postgres**. Provision a Postgres service, copy the connection string into `POSTGRES_URL` (any standard `postgres://` URL works; Railway requires `sslmode=require`).
- **Cloudflare R2** bucket named `sandybeach-images`. Create an API token with read+write to that bucket. Enable public access on the bucket (`outputs/*` is served directly to browsers).
- **RunPod** serverless endpoint. Build and push the worker image, then create an endpoint in the RunPod console — see [workers/README.md](workers/README.md). Copy the endpoint id into `RUNPOD_ENDPOINT_ID`.

### 2. Configure env

```sh
cd web
cp .env.local.example .env.local
# fill in POSTGRES_URL, RUNPOD_*, R2_* (see file for details)
```

### 3. Migrate the DB

```sh
cd web
npm install
npm run db:push   # applies lib/db/schema.ts to Postgres directly (dev)
# OR for prod-style migrations: npm run db:generate && npm run db:migrate
```

### 4. Run

```sh
cd web
npm run dev
# webhook needs a public URL — for local end-to-end testing, point a tunnel
# (cloudflared / ngrok) at http://localhost:3000 and set SITE_URL to its URL,
# OR just deploy a Vercel preview and test there.
```

## Deploying to Vercel

1. `vercel link` inside `web/`.
2. Set the env vars from `.env.local.example` in the Vercel project settings.
3. `vercel --prod` (or push to the linked branch).

## What's next

This is Phase 1 (core generation). Future phases per the plan: Clerk auth + per-user gallery, then optional push to the sibling `../sandycove` image-sharing site.
