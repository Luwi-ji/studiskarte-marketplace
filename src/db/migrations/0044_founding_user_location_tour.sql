ALTER TABLE "student" RENAME COLUMN "founding_seller_at" TO "founding_user_at";--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "tour_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_location_length" CHECK ("student"."location" is null or (char_length(btrim("student"."location")) between 2 and 60 and "student"."location" !~ '[\r\n]'));
--> statement-breakpoint
-- Existing members already know their way around: only people who finish sign-up from now on get the tour.
UPDATE "student" SET "tour_seen_at" = now() WHERE "tour_seen_at" IS NULL;
