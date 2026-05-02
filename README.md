# sandybeach

Web frontend for the Chroma image-generation workers running on RunPod.

## Layout

- `text_to_image.py` — original RunPod Flash worker (img2img, ChromaImg2ImgPipeline + anime LoRA). Already deployed at endpoint id `dnmokdobw4kk7l`.
- `workers/text_to_image_t2i.py` — new T2I worker (ChromaPipeline + same LoRA). Deploy with `flash deploy workers/text_to_image_t2i.py`, then put the resulting endpoint id in `RUNPOD_T2I_ENDPOINT_ID`.
- `main.py` — original CLI smoke test against the img2img endpoint. Still works.
- `web/` — Next.js 16 app (Vercel target) that's the user-facing product.

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

- **Vercel Postgres** (Neon-backed). Create a DB in the Vercel dashboard, copy the `POSTGRES_URL`.
- **Cloudflare R2** bucket named `sandybeach-images`. Create an API token with read+write to that bucket. Enable public access on the bucket (`outputs/*` is served directly to browsers).
- **RunPod**: existing img2img endpoint `dnmokdobw4kk7l`; you need to deploy the new T2I worker to get a second endpoint id.

### 2. Deploy the T2I worker

```sh
# from the repo root, with the same Python env that already has runpod-flash
flash deploy workers/text_to_image_t2i.py
# copy the resulting endpoint id and put it in web/.env.local
```

### 3. Configure env

```sh
cd web
cp .env.local.example .env.local
# fill in POSTGRES_URL, RUNPOD_*, R2_* (see file for details)
```

### 4. Migrate the DB

```sh
cd web
npm install
npm run db:push   # applies lib/db/schema.ts to Postgres directly (dev)
# OR for prod-style migrations: npm run db:generate && npm run db:migrate
```

### 5. Run

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
