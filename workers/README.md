# sandybeach worker

Standard RunPod Serverless worker for Chroma1-HD. One image, both modes.

## Files

- `handler.py` — single `runpod.serverless.start` handler. Branches on `input.mode` (or auto-detects from `image_url`/`image_b64`).
- `Dockerfile` — CUDA 12.4 / Python 3.11 base, installs deps, **pre-bakes the Chroma1-HD weights and the LoRA into the image** so cold starts don't re-download ~20 GB.
- `requirements.txt` — Python deps.

## Build & push

You need a Docker registry (Docker Hub, GHCR, etc). Pick one and replace `<USER>` below.

```sh
cd workers

# AMD64 image — RunPod runs x86_64. Build with buildx if you're on an M-series Mac.
docker buildx build \
  --platform linux/amd64 \
  -t <USER>/sandybeach-chroma:latest \
  --push .
```

Image is on the chunky side (~25 GB) because it bakes in the model. First push takes a while; subsequent pushes only ship the changed layers (typically just the `handler.py` line).

If you'd rather keep the image small, delete the `RUN python - <<'PY' ... PY` block from the `Dockerfile` and instead attach a RunPod **network volume** mounted at `/runpod-volume`. The first request on each cold worker will download to the volume and the rest will hit cache. Tradeoff: longer first request per cold worker, smaller image.

## Deploy on RunPod

1. https://www.console.runpod.io/serverless → **New Endpoint**.
2. **Container image**: `<USER>/sandybeach-chroma:latest`.
3. **GPU type**: anything with ≥48 GB VRAM (A6000, L40, A100 80G, etc).
4. **Min workers**: 0. **Max workers**: 2. **Idle timeout**: 300 s.
5. Save. Copy the endpoint id (looks like `abc123def456`) into `web/.env.local` as `RUNPOD_ENDPOINT_ID`.

The endpoint URL pattern is the same as before: `https://api.runpod.ai/v2/{endpointId}/run` (and `/status/{jobId}`). Auth is `Authorization: Bearer $RUNPOD_API_KEY`. The web app already speaks this protocol, no code change needed there.

## Test it

```sh
curl -X POST https://api.runpod.ai/v2/$RUNPOD_ENDPOINT_ID/run \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": {"mode": "t2i", "prompt": "a tiny cabin in a snowy forest", "steps": 30}}'
# returns { "id": "...", "status": "IN_QUEUE" }

# Poll:
curl https://api.runpod.ai/v2/$RUNPOD_ENDPOINT_ID/status/<id> \
  -H "Authorization: Bearer $RUNPOD_API_KEY"
```

## Migrating from the old Flash setup

The old `runpod_flash` workers (`text_to_image.py` at the repo root and the
short-lived `workers/text_to_image_t2i.py`) are obsolete. You can delete
them along with the `.flash/` directory. The previously-deployed Flash
endpoint id (`dnmokdobw4kk7l`) can be deleted in the RunPod console once
the new image is up and the web app is pointed at it.
