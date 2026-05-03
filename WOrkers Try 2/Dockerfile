FROM runpod/worker-comfyui:5.8.5-base

# install custom nodes using comfy-cli
# RUN comfy-node-install comfyui-kjnodes comfyui-ic-light comfyui_ipadapter_plus comfyui_essentials ComfyUI-Hangover-Nodes



# download models using comfy-cli
# the "--filename" is what you use in your ComfyUI workflow

RUN comfy model download --url https://huggingface.co/lodestones/Chroma1-HD/resolve/main/Chroma1-HD.safetensors --relative-path models/unet --filename Chroma1-HD.safetensors 
RUN comfy model download --url https://huggingface.co/zhangjiong/t5xxl_fp8_e4m3fn_scaled.safetensors/resolve/main/t5xxl_fp8_e4m3fn_scaled.safetensors --relative-oath models/text_encoders t5xxl_fp8_e4m3fn_scaled.safetensors
RUN comfy model download --url https://huggingface.co/modelzpalace/ae.safetensors/resolve/main/ae.safetensors --relative-path models/vae ae.safetensors

#RUN comfy model download --url https://huggingface.co/lllyasviel/ic-light/resolve/main/iclight_sd15_fcon.safetensors --relative-path models/diffusion_models --filename iclight_sd15_fcon.safetensors
