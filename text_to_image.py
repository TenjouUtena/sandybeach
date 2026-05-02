"""
Chroma img2img on RunPod Flash.

Pipeline reference:
    https://huggingface.co/docs/diffusers/api/pipelines/chroma#diffusers.ChromaImg2ImgPipeline
Model:
    https://huggingface.co/lodestones/Chroma1-HD

Local setup:
    pip install runpod-flash pillow
    flash login                # or: export RUNPOD_API_KEY=...

Run:
    python text_to_image.py "vibrant fantasy landscape" \\
        --image https://raw.githubusercontent.com/CompVis/stable-diffusion/main/assets/stable-samples/img2img/sketch-mountains-input.jpg \\
        -o out.png

The --image argument accepts either a URL (fetched on the worker) or a local
path (base64'd and sent inline; keep under ~8MB to stay below the payload cap).

First call provisions and downloads Chroma1-HD (~18GB transformer + T5-XXL) —
expect a 3–6 minute cold start. Warm calls reuse the worker for idle_timeout.
"""

import argparse
import asyncio
import base64
import sys,os
import requests
from pathlib import Path

from runpod_flash import Endpoint, GpuGroup


@Endpoint(
    name="chroma-img2img",
    gpu=GpuGroup.AMPERE_48,
    workers=(0, 2),
    idle_timeout=300,
    dependencies=[
        "torch",
        "diffusers>=0.37",
        "transformers",
        "accelerate",
        "safetensors",
        "sentencepiece",
        "torchvision",
        "protobuf",
        "pillow",
        "peft",
    ],
)
async def generate(
    prompt: str,
    image_url: str | None = None,
    image_b64: str | None = None,
    negative_prompt: str = "",
    strength: float = 0.9,
    steps: int = 35,
    guidance: float = 5.0,
    width: int | None = None,
    height: int | None = None,
    seed: int | None = None,
    lora_scale: float = 0.8,
):
    import base64
    import builtins
    import io

    import torch
    from diffusers import ChromaImg2ImgPipeline
    from diffusers.utils import load_image
    from PIL import Image

    pipe = getattr(builtins, "_chroma_img2img_pipe", None)
    if pipe is None:
        pipe = ChromaImg2ImgPipeline.from_pretrained(
            "lodestones/Chroma1-HD",
            torch_dtype=torch.bfloat16,
        )
        pipe.load_lora_weights(
            "Ainonake/ChromaAestheticAnimeV5",
            weight_name="aestcrls7_v5.safetensors",
            adapter_name="anime",
        )
        #pipe.enable_model_cpu_offload()
        pipe.set_progress_bar_config(disable=True)
        builtins._chroma_img2img_pipe = pipe

    if image_url:
        init_image = load_image(image_url).convert("RGB")
    elif image_b64:
        init_image = Image.open(io.BytesIO(base64.b64decode(image_b64))).convert("RGB")
    else:
        raise ValueError("Provide either image_url or image_b64")

    generator = (
        torch.Generator().manual_seed(seed) if seed is not None else None
    )

    image = pipe(
        prompt=prompt,
        image=init_image,
        negative_prompt=negative_prompt or None,
        strength=strength,
        num_inference_steps=steps,
        guidance_scale=guidance,
        width=width,
        height=height,
        generator=generator,
        joint_attention_kwargs={"scale": lora_scale},
    ).images[0]

    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return {"image_b64": base64.b64encode(buf.getvalue()).decode()}


def _looks_like_url(s: str) -> bool:
    return s.startswith(("http://", "https://"))


async def main():
    parser = argparse.ArgumentParser(
        description="Chroma1-HD img2img on RunPod Flash",
    )
    parser.add_argument("prompt", help="Text prompt")
    parser.add_argument(
        "--image", required=True, help="Input image (URL or local path)"
    )
    parser.add_argument("-n", "--negative", default="", help="Negative prompt")
    parser.add_argument("-o", "--output", default="output.png", help="Output PNG path")
    parser.add_argument(
        "--strength",
        type=float,
        default=0.9,
        help="0.0 keeps input, 1.0 ignores it (default 0.9)",
    )
    parser.add_argument("--steps", type=int, default=35)
    parser.add_argument("--guidance", type=float, default=5.0)
    parser.add_argument("--width", type=int, default=None)
    parser.add_argument("--height", type=int, default=None)
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument(
        "--lora-scale",
        type=float,
        default=0.8,
        help="ChromaAestheticAnimeV5 LoRA strength (0 disables, default 0.8)",
    )
    args = parser.parse_args()

    kwargs = {}
    if _looks_like_url(args.image):
        kwargs["image_url"] = args.image
    else:
        path = Path(args.image)
        if not path.is_file():
            sys.exit(f"Input image not found: {path}")
        kwargs["image_b64"] = base64.b64encode(path.read_bytes()).decode()

    print(f"Generating: {args.prompt!r}", file=sys.stderr)
    result = await generate(
        prompt=args.prompt,
        negative_prompt=args.negative,
        strength=args.strength,
        steps=args.steps,
        guidance=args.guidance,
        width=args.width,
        height=args.height,
        seed=args.seed,
        lora_scale=args.lora_scale,
        **kwargs,
    )

    out = Path(args.output)
    if 'output' not in result:
        url = "https://api.runpod.ai/v2/dnmokdobw4kk7l/status/" + result['id']
        key = os.environ['RUNPOD_API_KEY']
        headers = {
            f"Authorization":"Bearer {key}"
        }
        r =  'IN_PROGRESS'
        while r == "IN_PROGRESS":
            results = requests.get(url, headers=headers)
            r = results.json()['status']
            print("Checking...")
            await asyncio.sleep(5)
        
        if 'output' in results:
          out.write_bytes(base64.b64decode(result["image_b64"]))
          print(f"Wrote {out} ({out.stat().st_size / 1024:.1f} KB)", file=sys.stderr)
        else:
            print(results.content)
                                   
    else:
        out.write_bytes(base64.b64decode(result['output']["image_b64"]))
        print(f"Wrote {out} ({out.stat().st_size / 1024:.1f} KB)", file=sys.stderr)


if __name__ == "__main__":
    asyncio.run(main())
