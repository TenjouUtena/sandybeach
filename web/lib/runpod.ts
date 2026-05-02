function apiKey() {
  const k = process.env.RUNPOD_API_KEY;
  if (!k) throw new Error("RUNPOD_API_KEY is not set");
  return k;
}

export function endpointId() {
  const id = process.env.RUNPOD_ENDPOINT_ID;
  if (!id) throw new Error("RUNPOD_ENDPOINT_ID is not set");
  return id;
}

type RunPodStatus =
  | "IN_QUEUE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "TIMED_OUT";

export type RunPodSubmitResult = { id: string; status: RunPodStatus };

export type RunPodStatusResult = {
  id: string;
  status: RunPodStatus;
  output?: { image_b64?: string; error?: string };
  error?: string;
};

export async function submit(
  input: Record<string, unknown>,
  webhook?: string,
): Promise<RunPodSubmitResult> {
  const res = await fetch(`https://api.runpod.ai/v2/${endpointId()}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({ input, ...(webhook ? { webhook } : {}) }),
  });
  if (!res.ok) {
    throw new Error(`RunPod submit failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function status(
  runpodJobId: string,
): Promise<RunPodStatusResult> {
  const res = await fetch(
    `https://api.runpod.ai/v2/${endpointId()}/status/${runpodJobId}`,
    { headers: { Authorization: `Bearer ${apiKey()}` } },
  );
  if (!res.ok) {
    throw new Error(`RunPod status failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
