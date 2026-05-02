"""
RunPod Serverless handler for Chroma1-HD.

Single endpoint that does both text-to-image and image-to-image.
Pipelines share underlying weights so the cold start (~3-6 min) is paid
once for both modes.

Input shape (under job["input"]):
    prompt: str (required)
    mode: "t2i" | "i2i" (optional; auto-detected from image_url/image_b64)
    image_url: str (i2i only — fetched on the worker)
    image_b64: str (i2i only — inline)
    negative_prompt: str = ""
    strength: float = 0.9       (i2i only)
    steps: int = 35
    guidance: float = 5.0
    width: int | None
    height: int | None
    seed: int | None
    lora_scale: float = 0.8

Output:
    { "image_b64": "<base64 png>" }
"""

import base64
import builtins
import io

import runpod
import torch
from diffusers import ChromaImg2ImgPipeline, ChromaPipeline
from diffusers.utils import load_image
from PIL import Image

MODEL_ID = "lodestones/Chroma1-HD"
LORA_REPO = "Ainonake/ChromaAestheticAnimeV5"
LORA_FILE = "aestcrls7_v5.safetensors"
LORA_NAME = "anime"


def _t2i() -> ChromaPipeline:
    pipe = getattr(builtins, "_chroma_t2i", None)
    if pipe is not None:
        return pipe
    pipe = ChromaPipeline.from_pretrained(
        MODEL_ID, torch_dtype=torch.bfloat16
    ).to("cuda")
    pipe.load_lora_weights(
        LORA_REPO, weight_name=LORA_FILE, adapter_name=LORA_NAME
    )
    pipe.set_progress_bar_config(disable=True)
    builtins._chroma_t2i = pipe
    return pipe


def _i2i() -> ChromaImg2ImgPipeline:
    pipe = getattr(builtins, "_chroma_i2i", None)
    if pipe is not None:
        return pipe
    # Reuse the T2I pipeline's loaded components — same weights, no re-download.
    base = _t2i()
    pipe = ChromaImg2ImgPipeline(**base.components)
    pipe.set_progress_bar_config(disable=True)
    builtins._chroma_i2i = pipe
    return pipe


def _load_init_image(inp: dict) -> Image.Image:
    if inp.get("image_url"):
        return load_image(inp["image_url"]).convert("RGB")
    if inp.get("image_b64"):
        return Image.open(
            io.BytesIO(base64.b64decode(inp["image_b64"]))
        ).convert("RGB")
    raise ValueError("i2i requires image_url or image_b64")


def handler(job):
    inp = job.get("input") or {}

    prompt = inp.get("prompt")
    if not prompt:
        return {"error": "missing 'prompt'"}

    mode = inp.get("mode")
    if mode is None:
        mode = "i2i" if (inp.get("image_url") or inp.get("image_b64")) else "t2i"
    if mode not in ("t2i", "i2i"):
        return {"error": f"invalid mode: {mode}"}

    seed = inp.get("seed")
    generator = (
        torch.Generator(device="cuda").manual_seed(int(seed))
        if seed is not None
        else None
    )

    common = dict(
        prompt=prompt,
        negative_prompt=inp.get("negative_prompt") or None,
        num_inference_steps=int(inp.get("steps", 35)),
        guidance_scale=float(inp.get("guidance", 5.0)),
        width=inp.get("width"),
        height=inp.get("height"),
        generator=generator,
        joint_attention_kwargs={"scale": float(inp.get("lora_scale", 0.8))},
    )

    try:
        if mode == "i2i":
            init_image = _load_init_image(inp)
            image = _i2i()(
                image=init_image,
                strength=float(inp.get("strength", 0.9)),
                **common,
            ).images[0]
        else:
            image = _t2i()(**common).images[0]
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}"}

    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return {"image_b64": base64.b64encode(buf.getvalue()).decode()}


runpod.serverless.start({"handler": handler})
