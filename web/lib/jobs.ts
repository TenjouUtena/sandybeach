import { z } from "zod";

export const jobParamsSchema = z.object({
  steps: z.number().int().min(1).max(100).default(35),
  guidance: z.number().min(0).max(20).default(5.0),
  seed: z.number().int().nullable().default(null),
  width: z.number().int().min(64).max(2048).nullable().default(null),
  height: z.number().int().min(64).max(2048).nullable().default(null),
  loraScale: z.number().min(0).max(2).default(0.8),
  strength: z.number().min(0).max(1).optional(),
});

export const createJobSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("t2i"),
    prompt: z.string().min(1).max(4000),
    negativePrompt: z.string().max(4000).default(""),
    params: jobParamsSchema,
  }),
  z.object({
    kind: z.literal("i2i"),
    prompt: z.string().min(1).max(4000),
    negativePrompt: z.string().max(4000).default(""),
    params: jobParamsSchema.extend({
      strength: z.number().min(0).max(1).default(0.9),
    }),
    inputR2Key: z.string().min(1),
  }),
]);

export type CreateJobInput = z.infer<typeof createJobSchema>;

export const ANON_USER_ID = "anon";
