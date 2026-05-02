import {
  pgTable,
  text,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

export const jobKind = pgEnum("job_kind", ["t2i", "i2i"]);

export const jobStatus = pgEnum("job_status", [
  "PENDING",
  "IN_QUEUE",
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  kind: jobKind("kind").notNull(),
  prompt: text("prompt").notNull(),
  negativePrompt: text("negative_prompt").default("").notNull(),
  params: jsonb("params").$type<JobParams>().notNull(),
  inputR2Key: text("input_r2_key"),
  outputR2Key: text("output_r2_key"),
  runpodJobId: text("runpod_job_id"),
  status: jobStatus("status").default("PENDING").notNull(),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

export type JobParams = {
  steps: number;
  guidance: number;
  seed: number | null;
  width: number | null;
  height: number | null;
  loraScale: number;
  // I2I-only
  strength?: number;
};
