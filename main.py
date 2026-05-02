import argparse, os, sys
import requests
import base64
from pathlib import Path
import json, time


def _looks_like_url(s: str) -> bool:
    return s.startswith(("http://", "https://"))


def main():

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
    args = parser.parse_args()

    kwargs = {}
    if _looks_like_url(args.image):
        kwargs["image_url"] = args.image
    else:
        path = Path(args.image)
        if not path.is_file():
            sys.exit(f"Input image not found: {path}")
        kwargs["image_b64"] = base64.b64encode(path.read_bytes()).decode()

    payload = {
        "prompt": args.prompt,
        "negative_prompt": args.negative,
        "strength": args.strength,
        "steps": args.steps,
        "guidance": args.guidance,
        "width": args.width,
        "height": args.height,
        "seed": args.seed,
        **kwargs
    }

    url = "https://api.runpod.ai/v2/dnmokdobw4kk7l/run"
    key = os.environ['RUNPOD_API_KEY']
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {key}"
    }
    post = {"input": payload}
    resp = requests.post(url, json=post, headers=headers)
    r = resp.json()
    statusurl = "https://api.runpod.ai/v2/dnmokdobw4kk7l/status/" + r['id']
    while r['status'] != 'COMPLETED':
        print("Status: ", r['status'])
        time.sleep(30)
        resp = requests.get(statusurl, headers=headers)
        r = resp.json()

    out = Path(args.output)
    if 'output' in r:
        if 'image_b64' in r['output']:
            out.write_bytes(base64.b64decode(r['output']["image_b64"]))
        else:
            print("No image in result")
    else:
        print("Error in result:")
        print(r)
        


if __name__ == "__main__":
    main()
