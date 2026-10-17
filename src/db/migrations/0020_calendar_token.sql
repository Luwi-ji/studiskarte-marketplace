ALTER TABLE "student" ADD COLUMN "calendar_token_hash" text;--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_calendar_token_hash" UNIQUE("calendar_token_hash");--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_calendar_token_format" CHECK ("student"."calendar_token_hash" is null or "student"."calendar_token_hash" ~ '^[0-9a-f]{64}$');