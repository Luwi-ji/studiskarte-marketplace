ALTER TABLE "notification" DROP CONSTRAINT "notification_type";--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "payment_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "payment_cash" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "payment_online" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "payment_other" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "payment_note" text;--> statement-breakpoint
-- Posts made before payment modes existed took cash, in person: say so (a free post takes none).
UPDATE "post" SET payment_cash = true WHERE price_kind <> 'free';--> statement-breakpoint
-- Handovers completed before payment was tracked count as paid in cash when they were completed.
UPDATE "deal" SET payment_method = 'cash', paid_at = updated_at, payment_confirmed_at = updated_at WHERE status = 'completed' AND amount > 0;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_payment_method" CHECK (("deal"."paid_at" is null) = ("deal"."payment_method" is null) and ("deal"."payment_method" is null or "deal"."payment_method" in ('cash', 'online', 'other')));--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_payment_order" CHECK ("deal"."payment_confirmed_at" is null or "deal"."paid_at" is not null);--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_completed_paid" CHECK ("deal"."status" <> 'completed' or "deal"."amount" = 0 or "deal"."payment_confirmed_at" is not null);--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_type" CHECK ("notification"."type" in ('message', 'heart', 'post_expiring', 'post_expired', 'offer_received', 'offer_accepted', 'offer_declined', 'offer_expired', 'deal_cancelled', 'deal_proposed', 'deal_scheduled', 'deal_confirmed', 'deal_completed', 'deal_reminder', 'deal_confirm_reminder', 'deal_expired', 'deal_paid', 'deal_payment_confirmed'));--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_payment_modes" CHECK (("post"."price_kind" = 'free') = (not ("post"."payment_cash" or "post"."payment_online" or "post"."payment_other")));--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_payment_note" CHECK ("post"."payment_note" is null or (("post"."payment_online" or "post"."payment_other") and char_length(btrim("post"."payment_note")) between 1 and 100));
--> statement-breakpoint
-- A handover method and a payment method (proposed or agreed) are ones the post offers.
CREATE OR REPLACE FUNCTION deal_method_offered() RETURNS trigger AS $$
DECLARE
  meetup boolean;
  delivery boolean;
  cash boolean;
  online boolean;
  other boolean;
BEGIN
  SELECT exchange_meetup, exchange_delivery, payment_cash, payment_online, payment_other
    INTO meetup, delivery, cash, online, other FROM post WHERE id = NEW.post_id;
  IF (NEW.handover_method = 'meetup' AND NOT meetup) OR (NEW.handover_method = 'delivery' AND NOT delivery)
     OR (NEW.proposed_method = 'meetup' AND NOT meetup) OR (NEW.proposed_method = 'delivery' AND NOT delivery) THEN
    RAISE EXCEPTION 'the post does not offer that handover method'
      USING ERRCODE = 'check_violation';
  END IF;
  IF (NEW.payment_method = 'cash' AND NOT cash) OR (NEW.payment_method = 'online' AND NOT online) OR (NEW.payment_method = 'other' AND NOT other) THEN
    RAISE EXCEPTION 'the post does not take that way of paying'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER deal_method_offered ON deal;
--> statement-breakpoint
CREATE TRIGGER deal_method_offered
  BEFORE INSERT OR UPDATE OF handover_method, proposed_method, payment_method ON deal
  FOR EACH ROW EXECUTE FUNCTION deal_method_offered();
