import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { jobs } from "@/lib/db/schema";
import { putBytes } from "@/lib/r2";

export const runtime = "nodejs";
// Webhook bodies can be large (~base64 PNG). Bump to be safe.
export const maxDuration = 60;

type RunPodWebhookPayload = {
  id: string;
  status:
    | "IN_QUEUE"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED"
    | "TIMED_OUT";
  output?: { image_b64?: string };
  error?: string;
};

export async function POST(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  const secret = url.searchParams.get("secret");
  if (!jobId || !secret) {
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  }
  if (secret !== process.env.RUNPOD_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let payload: RunPodWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const [job] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);
  if (!job) {
    return NextResponse.json({ error: "unknown job" }, { status: 404 });
  }
  if (job.status === "COMPLETED") {
    return NextResponse.json({ ok: true, alreadyDone: true });
  }

  if (payload.status === "COMPLETED" && payload.output?.image_b64) {
    const key = `outputs/${job.id}.png`;
    const bytes = Buffer.from(payload.output.image_b64, "base64");
    await putBytes(key, bytes, "image/png");
    await db
      .update(jobs)
      .set({
        status: "COMPLETED",
        outputR2Key: key,
        completedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));
    return NextResponse.json({ ok: true });
  }

  if (
    payload.status === "FAILED" ||
    payload.status === "CANCELLED" ||
    payload.status === "TIMED_OUT"
  ) {
    await db
      .update(jobs)
      .set({
        status: "FAILED",
        error: payload.error ?? payload.status,
        completedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));
    return NextResponse.json({ ok: true });
  }

  // IN_QUEUE / IN_PROGRESS — just mirror the status.
  await db
    .update(jobs)
    .set({ status: payload.status })
    .where(eq(jobs.id, jobId));
  return NextResponse.json({ ok: true });
}
