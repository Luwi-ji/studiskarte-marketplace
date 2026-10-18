ALTER TABLE "student" DROP CONSTRAINT "student_email_school";--> statement-breakpoint
ALTER TABLE "student" ALTER COLUMN "school_domain" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "school_email" text;--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "role" text DEFAULT 'student' NOT NULL;--> statement-breakpoint
-- Everyone so far signed up with a school email. Deleted accounts keep no school.
UPDATE "student" SET "school_email" = "email", "role" = 'student' WHERE "account_status" <> 'deleted';--> statement-breakpoint
UPDATE "student" SET "school_domain" = NULL, "role" = 'visitor' WHERE "account_status" = 'deleted';--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_school_email_unique" UNIQUE("school_email");--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_email_shape" CHECK ("student"."email" ~ '^[^@\s]+@[^@\s]+$');--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_school_email_shape" CHECK ("student"."school_email" is null or ("student"."school_email" = lower("student"."school_email") and "student"."school_email" ~ '^[^@]+@([a-z0-9-]+\.)+edu\.ph$' and split_part("student"."school_email", '@', 2) = "student"."school_domain"));--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_school_pair" CHECK (("student"."school_email" is null) = ("student"."school_domain" is null));--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_role_values" CHECK ("student"."role" in ('student', 'faculty', 'staff', 'alumni', 'visitor'));--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_role_school" CHECK (("student"."role" = 'visitor') = ("student"."school_email" is null));