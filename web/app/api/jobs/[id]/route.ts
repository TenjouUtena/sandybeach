import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { jobs } from "@/lib/db/schema";
import { status as runpodStatus } from "@/lib/runpod";
import { publicUrl } from "@/lib/r2";

export const runtime = "nodejs";

const TERMINAL = new Set(["COMPLETED", "FAILED"]);
// If a job has been waiting this long without a webhook, opportunistically
// re-check RunPod status from this read path. Keeps things alive even if a
// webhook delivery is dropped.
const FALLBACK_POLL_AFTER_MS = 20_000;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  let current = job;

  if (
    !TERMINAL.has(current.status) &&
    current.runpodJobId &&
    Date.now() - new Date(current.createdAt).getTime() > FALLBACK_POLL_AFTER_MS
  ) {
    try {
      const r = await runpodStatus(current.runpodJobId);
      if (r.status !== current.status && !TERMINAL.has(current.status)) {
        const next: Partial<typeof current> = {};
        if (r.status === "IN_QUEUE") next.status = "IN_QUEUE";
        else if (r.status === "IN_PROGRESS") next.status = "IN_PROGRESS";
        // Don't try to write the COMPLETED result here — webhook owns that
        // path so the upload to R2 happens once. Just reflect the status.
        if (Object.keys(next).length > 0) {
          await db.update(jobs).set(next).where(eq(jobs.id, id));
          current = { ...current, ...(next as typeof current) };
        }
      }
    } catch {
      // Non-fatal — surface whatever DB has.
    }
  }

  return NextResponse.json({
    id: current.id,
    kind: current.kind,
    status: current.status,
    error: current.error,
    outputUrl: current.outputR2Key ? publicUrl(current.outputR2Key) : null,
    prompt: current.prompt,
    createdAt: current.createdAt,
    completedAt: current.completedAt,
  });
}
