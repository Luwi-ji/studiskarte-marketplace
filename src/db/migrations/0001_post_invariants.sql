-- A live post (open or reserved) always has at least one photo. Checked at
-- commit, so a post and its photos can be written in one transaction.
CREATE FUNCTION post_require_photo() RETURNS trigger AS $$
DECLARE
  target_post uuid;
BEGIN
  IF TG_TABLE_NAME = 'post' THEN
    target_post := NEW.id;
  ELSE
    target_post := OLD.post_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM post
    WHERE id = target_post
      AND status IN ('open', 'reserved')
      AND NOT EXISTS (SELECT 1 FROM post_photo WHERE post_id = target_post)
  ) THEN
    RAISE EXCEPTION 'post % must have at least one photo', target_post
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER post_require_photo_on_post
  AFTER INSERT OR UPDATE OF status ON post
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION post_require_photo();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER post_require_photo_on_photo_delete
  AFTER DELETE ON post_photo
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION post_require_photo();
--> statement-breakpoint
-- A post's kind never changes after creation.
CREATE FUNCTION post_kind_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW.kind IS DISTINCT FROM OLD.kind THEN
    RAISE EXCEPTION 'post kind cannot change' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER post_kind_immutable
  BEFORE UPDATE OF kind ON post
  FOR EACH ROW EXECUTE FUNCTION post_kind_immutable();
