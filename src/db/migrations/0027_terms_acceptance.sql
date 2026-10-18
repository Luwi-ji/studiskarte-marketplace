ALTER TABLE "student" ADD COLUMN "terms_version" text;--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_terms_pair" CHECK (("student"."terms_version" is null) = ("student"."terms_accepted_at" is null));