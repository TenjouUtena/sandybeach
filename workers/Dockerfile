# RunPod's official base image: CUDA 12.4 + Python 3.11, plus the runpod CLI.
FROM --platform=linux/amd64 runpod/base:0.6.3-cuda12.4.1

WORKDIR /workspace

# runpod/base ships python3 but no `python` symlink — add one so anything
# (handler CMD, pip subprocesses, model cards) that invokes `python` works.
RUN ln -sf "$(command -v python3)" /usr/local/bin/python

# Install Python deps. Torch wheel selection follows the base image's CUDA.
COPY requirements.txt .
RUN python3 -m pip install --no-cache-dir --upgrade pip && \
    python3 -m pip install --no-cache-dir -r requirements.txt && \
    python3 -c "import runpod; print('runpod', runpod.__version__)"

# Pre-warm the model cache into the image so cold starts don't pay the
# ~20 GB download every time. Comment out if you'd rather attach a network
# volume mounted at /runpod-volume and lazy-download on first request.

COPY handler.py .

CMD ["python3", "-u", "handler.py"]
