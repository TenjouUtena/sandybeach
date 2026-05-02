import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";

import { presignPut } from "@/lib/r2";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024;

const bodySchema = z.object({
  contentType: z.string(),
  sizeBytes: z.number().int().positive(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  if (!ALLOWED.has(parsed.data.contentType)) {
    return NextResponse.json(
      { error: `unsupported content type: ${parsed.data.contentType}` },
      { status: 400 },
    );
  }
  if (parsed.data.sizeBytes > MAX_BYTES) {
    return NextResponse.json(
      { error: `file too large (max ${MAX_BYTES} bytes)` },
      { status: 400 },
    );
  }

  const ext =
    parsed.data.contentType === "image/jpeg"
      ? "jpg"
      : parsed.data.contentType === "image/webp"
        ? "webp"
        : "png";
  const key = `inputs/${nanoid()}.${ext}`;
  const uploadUrl = await presignPut(key, parsed.data.contentType);
  return NextResponse.json({ key, uploadUrl });
}
