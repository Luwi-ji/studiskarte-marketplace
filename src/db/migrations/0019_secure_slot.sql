CREATE TABLE "deal_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"reporter_id" text NOT NULL,
	"fault_party_id" text,
	"reason" text NOT NULL,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deal_report_one_each" UNIQUE("deal_id","reporter_id"),
	CONSTRAINT "deal_report_reason" CHECK ("deal_report"."reason" in ('no_show', 'not_as_described', 'payment_problem', 'unresponsive', 'other')),
	CONSTRAINT "deal_report_details" CHECK ("deal_report"."details" is null or char_length(btrim("deal_report"."details")) between 1 and 500)
);
--> statement-breakpoint
ALTER TABLE "deal" DROP CONSTRAINT "deal_status";--> statement-breakpoint
ALTER TABLE "deal" DROP CONSTRAINT "deal_completed_paid";--> statement-breakpoint
ALTER TABLE "notification" DROP CONSTRAINT "notification_type";--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "payment_asked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "payment_ask_method" text;--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "cash_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "cash_agreed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deal_report" ADD CONSTRAINT "deal_report_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_report" ADD CONSTRAINT "deal_report_reporter_id_student_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_report" ADD CONSTRAINT "deal_report_fault_party_id_student_id_fk" FOREIGN KEY ("fault_party_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_report_deal_idx" ON "deal_report" USING btree ("deal_id");--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_ask_method" CHECK (("deal"."payment_asked_at" is null) = ("deal"."payment_ask_method" is null) and ("deal"."payment_ask_method" is null or "deal"."payment_ask_method" in ('online', 'other')));--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_cash_order" CHECK ("deal"."cash_agreed_at" is null or "deal"."cash_requested_at" is not null);--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_status" CHECK ("deal"."status" in ('agreed', 'scheduled', 'completed', 'cancelled', 'disputed'));--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_completed_paid" CHECK ("deal"."status" <> 'completed' or "deal"."amount" = 0 or "deal"."payment_confirmed_at" is not null or "deal"."cash_agreed_at" is not null);--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_type" CHECK ("notification"."type" in ('message', 'heart', 'post_expiring', 'post_expired', 'offer_received', 'offer_accepted', 'offer_declined', 'offer_expired', 'deal_cancelled', 'deal_proposed', 'deal_scheduled', 'deal_confirmed', 'deal_completed', 'deal_reminder', 'deal_confirm_reminder', 'deal_expired', 'deal_paid', 'deal_payment_confirmed', 'deal_payment_requested', 'deal_cash_requested', 'deal_cash_answered', 'deal_payment_rejected', 'deal_reported', 'deal_disputed'));--> statement-breakpoint
-- Completed, cancelled and disputed are final. A deal completes only from scheduled, is disputed
-- only while it is being carried out, and cannot be cancelled once the slot is secured (the payer
-- said they paid, or cash in person was agreed): a secured deal ends by completing or by a report.
CREATE OR REPLACE FUNCTION deal_status_path() RETURNS trigger AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    IF OLD.status IN ('completed', 'cancelled', 'disputed') THEN
      RAISE EXCEPTION 'a % deal cannot change status', OLD.status USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status = 'completed' AND OLD.status <> 'scheduled' THEN
      RAISE EXCEPTION 'a deal completes only from scheduled' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status = 'cancelled' AND OLD.amount > 0 AND (OLD.paid_at IS NOT NULL OR OLD.cash_agreed_at IS NOT NULL) THEN
      RAISE EXCEPTION 'a secured reservation cannot be cancelled' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
-- A report is by one of the two people of the deal and blames one of them or nobody.
CREATE FUNCTION deal_report_rules() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM deal d
    WHERE d.id = NEW.deal_id
      AND NEW.reporter_id IN (d.owner_id, d.responder_id)
      AND (NEW.fault_party_id IS NULL OR NEW.fault_party_id IN (d.owner_id, d.responder_id))
  ) THEN
    RAISE EXCEPTION 'a report is by one of the two people of the reservation, about one of them'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER deal_report_rules
  BEFORE INSERT ON deal_report
  FOR EACH ROW EXECUTE FUNCTION deal_report_rules();
