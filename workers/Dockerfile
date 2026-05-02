# RunPod's official base image: CUDA 12.4 + Python 3.11, plus the runpod CLI.
FROM runpod/base:0.6.3-cuda12.4.1

WORKDIR /workspace

# Install Python deps. Torch wheel selection follows the base image's CUDA.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Pre-warm the model cache into the image so cold starts don't pay the
# ~20 GB download every time. Comment out if you'd rather attach a network
# volume mounted at /runpod-volume and lazy-download on first request.

COPY handler.py .

CMD ["python", "-u", "handler.py"]
