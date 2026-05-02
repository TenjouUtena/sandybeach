CREATE TYPE "public"."job_kind" AS ENUM('t2i', 'i2i');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('PENDING', 'IN_QUEUE', 'IN_PROGRESS', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" "job_kind" NOT NULL,
	"prompt" text NOT NULL,
	"negative_prompt" text DEFAULT '' NOT NULL,
	"params" jsonb NOT NULL,
	"input_r2_key" text,
	"output_r2_key" text,
	"runpod_job_id" text,
	"status" "job_status" DEFAULT 'PENDING' NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
