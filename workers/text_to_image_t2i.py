"""
Chroma text-to-image on RunPod Flash.

Mirror of text_to_image.py at the repo root, but uses ChromaPipeline (no
init image required) instead of ChromaImg2ImgPipeline.

Pipeline reference:
    https://huggingface.co/docs/diffusers/api/pipelines/chroma#diffusers.ChromaPipeline
Model:
    https://huggingface.co/lodestones/Chroma1-HD

Deploy:
    flash deploy workers/text_to_image_t2i.py
    # then record the resulting endpoint id as RUNPOD_T2I_ENDPOINT_ID
"""

from runpod_flash import Endpoint, GpuGroup


@Endpoint(
    name="chroma-t2i",
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
    negative_prompt: str = "",
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
    from diffusers import ChromaPipeline

    pipe = getattr(builtins, "_chroma_t2i_pipe", None)
    if pipe is None:
        pipe = ChromaPipeline.from_pretrained(
            "lodestones/Chroma1-HD",
            torch_dtype=torch.bfloat16,
        )
        pipe.load_lora_weights(
            "Ainonake/ChromaAestheticAnimeV5",
            weight_name="aestcrls7_v5.safetensors",
            adapter_name="anime",
        )
        pipe.set_progress_bar_config(disable=True)
        builtins._chroma_t2i_pipe = pipe

    generator = (
        torch.Generator().manual_seed(seed) if seed is not None else None
    )

    image = pipe(
        prompt=prompt,
        negative_prompt=negative_prompt or None,
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
