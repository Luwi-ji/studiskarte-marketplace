CREATE TABLE "school" (
	"domain" text PRIMARY KEY NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "school_domain_shape" CHECK ("school"."domain" ~ '^([a-z0-9-]+\.)+edu\.ph$'),
	CONSTRAINT "school_name_length" CHECK ("school"."name" is null or char_length(btrim("school"."name")) between 1 and 120)
);
--> statement-breakpoint
ALTER TABLE "image" DROP CONSTRAINT "image_purpose";--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "handle" text;--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "handle_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "avatar_image_id" uuid;--> statement-breakpoint
-- Existing students need their school row before the foreign key can exist.
INSERT INTO "school" ("domain") SELECT DISTINCT "school_domain" FROM "student" ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_school_domain_school_domain_fk" FOREIGN KEY ("school_domain") REFERENCES "public"."school"("domain") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_avatar_image_id_image_id_fk" FOREIGN KEY ("avatar_image_id") REFERENCES "public"."image"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_handle_unique" UNIQUE("handle");--> statement-breakpoint
ALTER TABLE "image" ADD CONSTRAINT "image_purpose" CHECK ("image"."purpose" in ('post_photo', 'avatar'));--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_handle_format" CHECK ("student"."handle" is null or (char_length("student"."handle") between 3 and 20 and "student"."handle" ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'));--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_name_length" CHECK (char_length("student"."name") <= 40 and "student"."name" !~ '[\r\n]');