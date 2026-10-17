ALTER TABLE "notification" DROP CONSTRAINT "notification_type";--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "proposed_by" text;--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "proposed_method" text;--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "proposed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "proposed_place" text;--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "owner_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "responder_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_proposed_by_student_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_place_length" CHECK ("deal"."place" is null or char_length(btrim("deal"."place")) between 1 and 200);--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_proposal" CHECK (("deal"."proposed_by" is null and "deal"."proposed_method" is null and "deal"."proposed_at" is null and "deal"."proposed_place" is null)
        or ("deal"."proposed_by" is not null and "deal"."proposed_method" in ('meetup', 'delivery') and "deal"."proposed_at" is not null and char_length(btrim("deal"."proposed_place")) between 1 and 200));--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_scheduled_fields" CHECK ("deal"."status" not in ('scheduled', 'completed') or ("deal"."handover_method" is not null and "deal"."scheduled_at" is not null and "deal"."place" is not null));--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_completed_confirmed" CHECK ("deal"."status" <> 'completed' or ("deal"."owner_confirmed_at" is not null and "deal"."responder_confirmed_at" is not null));--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_confirm_after_schedule" CHECK (("deal"."owner_confirmed_at" is null and "deal"."responder_confirmed_at" is null) or "deal"."scheduled_at" is not null);--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_type" CHECK ("notification"."type" in ('message', 'heart', 'post_expiring', 'post_expired', 'offer_received', 'offer_accepted', 'offer_declined', 'offer_expired', 'deal_cancelled', 'deal_proposed', 'deal_scheduled', 'deal_confirmed', 'deal_completed', 'deal_reminder', 'deal_confirm_reminder', 'deal_expired'));--> statement-breakpoint
-- A handover method (proposed or agreed) is one the post offers.
CREATE FUNCTION deal_method_offered() RETURNS trigger AS $$
DECLARE
  meetup boolean;
  delivery boolean;
BEGIN
  SELECT exchange_meetup, exchange_delivery INTO meetup, delivery FROM post WHERE id = NEW.post_id;
  IF (NEW.handover_method = 'meetup' AND NOT meetup) OR (NEW.handover_method = 'delivery' AND NOT delivery)
     OR (NEW.proposed_method = 'meetup' AND NOT meetup) OR (NEW.proposed_method = 'delivery' AND NOT delivery) THEN
    RAISE EXCEPTION 'the post does not offer that handover method'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER deal_method_offered
  BEFORE INSERT OR UPDATE OF handover_method, proposed_method ON deal
  FOR EACH ROW EXECUTE FUNCTION deal_method_offered();
--> statement-breakpoint
-- Completed and cancelled are final, and the only way to completed is from scheduled.
CREATE FUNCTION deal_status_path() RETURNS trigger AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    IF OLD.status IN ('completed', 'cancelled') THEN
      RAISE EXCEPTION 'a % deal cannot change status', OLD.status USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status = 'completed' AND OLD.status <> 'scheduled' THEN
      RAISE EXCEPTION 'a deal completes only from scheduled' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER deal_status_path
  BEFORE UPDATE OF status ON deal
  FOR EACH ROW EXECUTE FUNCTION deal_status_path();
