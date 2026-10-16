ALTER TABLE "notification" DROP CONSTRAINT "notification_type";--> statement-breakpoint
DROP INDEX "deal_one_active_idx";--> statement-breakpoint
ALTER TABLE "deal" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "offer" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "quantity" integer DEFAULT 1;--> statement-breakpoint
CREATE UNIQUE INDEX "deal_one_active_idx" ON "deal" USING btree ("post_id","responder_id") WHERE "deal"."status" in ('agreed', 'scheduled');--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_quantity" CHECK ("deal"."quantity" between 1 and 1000);--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_type" CHECK ("notification"."type" in ('message', 'heart', 'post_expiring', 'post_expired', 'offer_received', 'offer_accepted', 'offer_declined', 'offer_expired', 'deal_cancelled'));--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_quantity" CHECK ("offer"."quantity" between 1 and 1000);--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_quantity_range" CHECK ("post"."quantity" is null or "post"."quantity" between 1 and 1000);
--> statement-breakpoint
-- Active and completed deals of a post never use more units than the post has.
-- The post row is locked first, so two deals written at once are counted one after the other.
CREATE FUNCTION deal_capacity() RETURNS trigger AS $$
DECLARE
  cap integer;
  taken integer;
BEGIN
  IF NEW.status NOT IN ('agreed', 'scheduled', 'completed') THEN
    RETURN NEW;
  END IF;
  SELECT quantity INTO cap FROM post WHERE id = NEW.post_id FOR UPDATE;
  IF cap IS NULL THEN
    RETURN NEW; -- ongoing: no limit
  END IF;
  SELECT COALESCE(SUM(quantity), 0) INTO taken FROM deal
    WHERE post_id = NEW.post_id AND status IN ('agreed', 'scheduled', 'completed') AND id <> NEW.id;
  IF taken + NEW.quantity > cap THEN
    RAISE EXCEPTION 'post % has only % left, deal asks for %', NEW.post_id, cap - taken, NEW.quantity
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER deal_capacity
  BEFORE INSERT OR UPDATE OF status, quantity ON deal
  FOR EACH ROW EXECUTE FUNCTION deal_capacity();
--> statement-breakpoint
-- A post cannot be set to fewer units than are already reserved or handed over.
CREATE FUNCTION post_quantity_floor() RETURNS trigger AS $$
DECLARE
  taken integer;
BEGIN
  IF NEW.quantity IS NULL OR NEW.quantity IS NOT DISTINCT FROM OLD.quantity THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(SUM(quantity), 0) INTO taken FROM deal
    WHERE post_id = NEW.id AND status IN ('agreed', 'scheduled', 'completed');
  IF NEW.quantity < taken THEN
    RAISE EXCEPTION 'post % already has % reserved, cannot go down to %', NEW.id, taken, NEW.quantity
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER post_quantity_floor
  BEFORE UPDATE OF quantity ON post
  FOR EACH ROW EXECUTE FUNCTION post_quantity_floor();
