CREATE TABLE "block" (
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "block_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id"),
	CONSTRAINT "block_not_self" CHECK ("block"."blocker_id" <> "block"."blocked_id")
);
--> statement-breakpoint
CREATE TABLE "report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" text NOT NULL,
	"post_id" uuid,
	"student_id" text,
	"reason" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'open' NOT NULL,
	"handled_by" text,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_one_target" CHECK (("report"."post_id" is not null) <> ("report"."student_id" is not null)),
	CONSTRAINT "report_not_self" CHECK ("report"."student_id" is null or "report"."student_id" <> "report"."reporter_id"),
	CONSTRAINT "report_reason" CHECK ("report"."reason" in ('spam', 'scam', 'prohibited', 'offensive', 'harassment', 'impersonation', 'other')),
	CONSTRAINT "report_details_length" CHECK ("report"."details" is null or char_length(btrim("report"."details")) between 1 and 500),
	CONSTRAINT "report_status" CHECK ("report"."status" in ('open', 'dismissed', 'actioned')),
	CONSTRAINT "report_handled" CHECK (("report"."status" = 'open') = ("report"."handled_at" is null))
);
--> statement-breakpoint
ALTER TABLE "notification" DROP CONSTRAINT "notification_type";--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "status_before_hidden" text;--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "block" ADD CONSTRAINT "block_blocker_id_student_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block" ADD CONSTRAINT "block_blocked_id_student_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_reporter_id_student_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_handled_by_student_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "block_blocked_idx" ON "block" USING btree ("blocked_id");--> statement-breakpoint
CREATE UNIQUE INDEX "report_open_post" ON "report" USING btree ("reporter_id","post_id") WHERE "report"."status" = 'open' and "report"."post_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "report_open_student" ON "report" USING btree ("reporter_id","student_id") WHERE "report"."status" = 'open' and "report"."student_id" is not null;--> statement-breakpoint
CREATE INDEX "report_queue_idx" ON "report" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "report_post_idx" ON "report" USING btree ("post_id");--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_type" CHECK ("notification"."type" in ('message', 'heart', 'post_expiring', 'post_expired', 'post_hidden', 'post_restored', 'post_removed', 'offer_received', 'offer_accepted', 'offer_declined', 'offer_expired', 'deal_cancelled', 'deal_proposed', 'deal_scheduled', 'deal_confirmed', 'deal_handover_rejected', 'deal_review_reminder', 'deal_proposal_declined', 'deal_completed', 'deal_reminder', 'deal_confirm_reminder', 'deal_expired', 'deal_paid', 'deal_payment_confirmed', 'deal_payment_requested', 'deal_cash_requested', 'deal_cash_answered', 'deal_cash_given', 'deal_cash_received', 'deal_payment_rejected', 'deal_reported', 'deal_disputed'));--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_status_before_hidden" CHECK ("post"."status_before_hidden" is null or "post"."status_before_hidden" in ('open', 'reserved'));
--> statement-breakpoint
-- Nobody reports their own post.
CREATE FUNCTION report_rules() RETURNS trigger AS $$
BEGIN
  IF NEW.post_id IS NOT NULL AND EXISTS (SELECT 1 FROM post p WHERE p.id = NEW.post_id AND p.owner_id = NEW.reporter_id) THEN
    RAISE EXCEPTION 'You cannot report your own post.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER report_rules
  BEFORE INSERT ON report
  FOR EACH ROW EXECUTE FUNCTION report_rules();