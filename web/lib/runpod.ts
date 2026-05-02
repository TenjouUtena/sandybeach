function apiKey() {
  const k = process.env.RUNPOD_API_KEY;
  if (!k) throw new Error("RUNPOD_API_KEY is not set");
  return k;
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
  output?: { image_b64?: string };
  error?: string;
};

export async function submit(
  endpointId: string,
  input: Record<string, unknown>,
  webhook?: string,
): Promise<RunPodSubmitResult> {
  const res = await fetch(`https://api.runpod.ai/v2/${endpointId}/run`, {
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
  endpointId: string,
  runpodJobId: string,
): Promise<RunPodStatusResult> {
  const res = await fetch(
    `https://api.runpod.ai/v2/${endpointId}/status/${runpodJobId}`,
    { headers: { Authorization: `Bearer ${apiKey()}` } },
  );
  if (!res.ok) {
    throw new Error(`RunPod status failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export function endpointFor(kind: "t2i" | "i2i") {
  const id =
    kind === "t2i"
      ? process.env.RUNPOD_T2I_ENDPOINT_ID
      : process.env.RUNPOD_I2I_ENDPOINT_ID;
  if (!id) {
    throw new Error(
      `Missing RunPod endpoint id for ${kind} (set RUNPOD_${kind.toUpperCase()}_ENDPOINT_ID)`,
    );
  }
  return id;
}
