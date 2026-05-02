import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { db } from "@/lib/db/client";
import { jobs } from "@/lib/db/schema";
import {
  ANON_USER_ID,
  createJobSchema,
  type CreateJobInput,
} from "@/lib/jobs";
import { endpointFor, submit } from "@/lib/runpod";
import { r2, R2_BUCKET } from "@/lib/r2";



export const runtime = "nodejs";

function siteUrl(req: Request) {
  return process.env.SITE_URL ?? new URL(req.url).origin;
}

async function buildRunpodInput(parsed: CreateJobInput) {
  const { params } = parsed;
  const base = {
    prompt: parsed.prompt,
    negative_prompt: parsed.negativePrompt,
    steps: params.steps,
    guidance: params.guidance,
    width: params.width,
    height: params.height,
    seed: params.seed,
    lora_scale: params.loraScale,
  };
  if (parsed.kind === "t2i") return base;

  // I2I: hand the worker a presigned GET URL to the R2 input object.
  const cmd = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: parsed.inputR2Key,
  });
  const image_url = await getSignedUrl(r2(), cmd, { expiresIn: 60 * 60 });
  return {
    ...base,
    strength: parsed.params.strength,
    image_url,
  };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const secret = process.env.RUNPOD_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "RUNPOD_WEBHOOK_SECRET not configured" },
      { status: 500 },
    );
  }

  const id = nanoid();
  const endpointId = endpointFor(parsed.data.kind);
  const webhook = `${siteUrl(req)}/api/jobs/webhook?jobId=${id}&secret=${encodeURIComponent(secret)}`;

  await db.insert(jobs).values({
    id,
    userId: ANON_USER_ID,
    kind: parsed.data.kind,
    prompt: parsed.data.prompt,
    negativePrompt: parsed.data.negativePrompt,
    params: parsed.data.params,
    inputR2Key:
      parsed.data.kind === "i2i" ? parsed.data.inputR2Key : null,
    status: "PENDING",
  });

  let runpodResult;
  try {
    const input = await buildRunpodInput(parsed.data);
    runpodResult = await submit(endpointId, input, webhook);
  } catch (err) {
    await db
      .update(jobs)
      .set({
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
      })
      .where(eq(jobs.id, id));
    
    return NextResponse.json(
      { error: `runpod submit failed ${err}` },
      { status: 502 },
    );
  }

  await db
    .update(jobs)
    .set({
      runpodJobId: runpodResult.id,
      status: runpodResult.status === "IN_QUEUE" ? "IN_QUEUE" : "PENDING",
    })
    .where(eq(jobs.id, id));

  return NextResponse.json({ jobId: id });
}
