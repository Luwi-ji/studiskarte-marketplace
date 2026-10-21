CREATE TABLE "admin_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" text NOT NULL,
	"action" text NOT NULL,
	"post_id" uuid,
	"student_id" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_action_kind" CHECK ("admin_action"."action" in ('restore_post', 'remove_post', 'dismiss_post_reports', 'dismiss_student_reports', 'suspend_student', 'restore_student')),
	CONSTRAINT "admin_action_reason_length" CHECK ("admin_action"."reason" is null or char_length(btrim("admin_action"."reason")) between 1 and 300)
);
--> statement-breakpoint
ALTER TABLE "admin_action" ADD CONSTRAINT "admin_action_admin_id_student_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_action_recent_idx" ON "admin_action" USING btree ("created_at" DESC NULLS LAST);