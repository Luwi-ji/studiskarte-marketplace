CREATE TABLE "funnel_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage" text NOT NULL,
	"student_id" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "funnel_event_once_per_student" UNIQUE("student_id","stage"),
	CONSTRAINT "funnel_event_stage" CHECK ("funnel_event"."stage" in ('landing_view','signup_started','signup_completed','first_listing','first_message','first_handover_confirmed'))
);
--> statement-breakpoint
CREATE TABLE "perk_vote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "perk_vote_kind" CHECK ("perk_vote"."kind" in ('food','clothes','printing','services','other'))
);
--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "utm_source" text;--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "utm_medium" text;--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "utm_campaign" text;--> statement-breakpoint
ALTER TABLE "funnel_event" ADD CONSTRAINT "funnel_event_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "funnel_event_stage_idx" ON "funnel_event" USING btree ("stage","created_at");--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_utm_length" CHECK (char_length(coalesce("student"."utm_source", '')) <= 64 and char_length(coalesce("student"."utm_medium", '')) <= 64 and char_length(coalesce("student"."utm_campaign", '')) <= 64);