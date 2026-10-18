CREATE TABLE "review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"reviewer_id" text NOT NULL,
	"reviewee_id" text NOT NULL,
	"rating" smallint NOT NULL,
	"text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_one_each" UNIQUE("deal_id","reviewer_id"),
	CONSTRAINT "review_rating" CHECK ("review"."rating" between 1 and 5),
	CONSTRAINT "review_text" CHECK ("review"."text" is null or char_length(btrim("review"."text")) between 1 and 500),
	CONSTRAINT "review_distinct_people" CHECK ("review"."reviewer_id" <> "review"."reviewee_id")
);
--> statement-breakpoint
ALTER TABLE "notification" DROP CONSTRAINT "notification_type";--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_deal_id_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_reviewer_id_student_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_reviewee_id_student_id_fk" FOREIGN KEY ("reviewee_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_reviewee_idx" ON "review" USING btree ("reviewee_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_type" CHECK ("notification"."type" in ('message', 'heart', 'post_expiring', 'post_expired', 'offer_received', 'offer_accepted', 'offer_declined', 'offer_expired', 'deal_cancelled', 'deal_proposed', 'deal_scheduled', 'deal_confirmed', 'deal_handover_rejected', 'deal_review_reminder', 'deal_proposal_declined', 'deal_completed', 'deal_reminder', 'deal_confirm_reminder', 'deal_expired', 'deal_paid', 'deal_payment_confirmed', 'deal_payment_requested', 'deal_cash_requested', 'deal_cash_answered', 'deal_cash_given', 'deal_cash_received', 'deal_payment_rejected', 'deal_reported', 'deal_disputed'));

--> statement-breakpoint
-- A review is by one of the two people of a completed deal, about the other one.
CREATE FUNCTION review_rules() RETURNS trigger AS $$
DECLARE
  d deal%ROWTYPE;
BEGIN
  SELECT * INTO d FROM deal WHERE id = NEW.deal_id;
  IF NOT FOUND OR d.status <> 'completed' THEN
    RAISE EXCEPTION 'A review needs a completed deal.' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT ((NEW.reviewer_id = d.owner_id AND NEW.reviewee_id = d.responder_id)
       OR (NEW.reviewer_id = d.responder_id AND NEW.reviewee_id = d.owner_id)) THEN
    RAISE EXCEPTION 'Only the two people of the deal can review each other.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER review_rules
  BEFORE INSERT ON review
  FOR EACH ROW EXECUTE FUNCTION review_rules();
--> statement-breakpoint
-- A review is final. There is no DELETE trigger: deleting a deal cascades to its reviews.
CREATE FUNCTION review_frozen() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'A review cannot be changed.' USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER review_frozen
  BEFORE UPDATE ON review
  FOR EACH ROW EXECUTE FUNCTION review_frozen();