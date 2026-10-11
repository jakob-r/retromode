ALTER TABLE "boards" ADD COLUMN "timer_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "timer_seconds" integer;