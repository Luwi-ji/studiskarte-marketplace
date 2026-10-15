-- Categories confirmed by the owner 2026-10-16 (business logic, "Categories").
INSERT INTO "category" ("id", "parent_id", "name", "requires_condition", "position") VALUES
  ('textbooks', NULL, 'Textbooks & Study Materials', true, 1),
  ('supplies', NULL, 'School & Office Supplies', true, 2),
  ('uniforms', NULL, 'Uniforms & Org Merch', true, 3),
  ('electronics', NULL, 'Electronics & Gadgets', true, 4),
  ('dorm', NULL, 'Dorm & Living Essentials', true, 5),
  ('clothing', NULL, 'Clothing & Accessories', true, 6),
  ('hobbies', NULL, 'Hobbies & Entertainment', true, 7),
  ('transport', NULL, 'Transportation', true, 8),
  ('housing', NULL, 'Housing & Bedspace', false, 9),
  ('food', NULL, 'Food & Treats', false, 10),
  ('services', NULL, 'Services', false, 11),
  ('other', NULL, 'Other', false, 12);
--> statement-breakpoint
INSERT INTO "category" ("id", "parent_id", "name", "position") VALUES
  ('textbooks.books', 'textbooks', 'Books', 1),
  ('textbooks.reviewers', 'textbooks', 'Reviewers', 2),
  ('textbooks.notes', 'textbooks', 'Notes', 3),
  ('textbooks.reference', 'textbooks', 'Reference materials', 4),
  ('textbooks.other', 'textbooks', 'Other study materials', 5),
  ('supplies.notebooks', 'supplies', 'Notebooks', 1),
  ('supplies.writing', 'supplies', 'Pens and writing', 2),
  ('supplies.art', 'supplies', 'Art materials', 3),
  ('supplies.printing', 'supplies', 'Printing supplies', 4),
  ('supplies.other', 'supplies', 'Other supplies', 5),
  ('uniforms.school', 'uniforms', 'School uniforms', 1),
  ('uniforms.org_shirts', 'uniforms', 'Org shirts', 2),
  ('uniforms.event_merch', 'uniforms', 'Event merchandise', 3),
  ('uniforms.other', 'uniforms', 'Other uniforms and merch', 4),
  ('electronics.calculators', 'electronics', 'Calculators', 1),
  ('electronics.chargers', 'electronics', 'Chargers', 2),
  ('electronics.headphones', 'electronics', 'Headphones', 3),
  ('electronics.computer', 'electronics', 'Computer accessories', 4),
  ('electronics.other', 'electronics', 'Other electronics', 5),
  ('dorm.storage', 'dorm', 'Storage', 1),
  ('dorm.bedding', 'dorm', 'Bedding', 2),
  ('dorm.lamps', 'dorm', 'Lamps', 3),
  ('dorm.appliances', 'dorm', 'Small appliances', 4),
  ('dorm.other', 'dorm', 'Other dorm essentials', 5),
  ('clothing.thrift', 'clothing', 'Thrift clothes', 1),
  ('clothing.shoes', 'clothing', 'Shoes', 2),
  ('clothing.bags', 'clothing', 'Bags', 3),
  ('clothing.jewelry', 'clothing', 'Jewelry', 4),
  ('clothing.other', 'clothing', 'Other clothing and accessories', 5),
  ('hobbies.sports', 'hobbies', 'Sports gear', 1),
  ('hobbies.instruments', 'hobbies', 'Instruments', 2),
  ('hobbies.games', 'hobbies', 'Games', 3),
  ('hobbies.collectibles', 'hobbies', 'Collectibles', 4),
  ('hobbies.other', 'hobbies', 'Other hobbies', 5),
  ('transport.bikes', 'transport', 'Bikes', 1),
  ('transport.bike_accessories', 'transport', 'Bike accessories', 2),
  ('transport.other', 'transport', 'Other transport needs', 3),
  ('housing.dorms', 'housing', 'Dorms', 1),
  ('housing.rooms', 'housing', 'Rooms', 2),
  ('housing.bedspaces', 'housing', 'Bedspaces', 3),
  ('housing.roommates', 'housing', 'Roommates', 4),
  ('food.snacks', 'food', 'Snacks', 1),
  ('food.meals', 'food', 'Meals', 2),
  ('food.baked', 'food', 'Baked goods', 3),
  ('food.desserts', 'food', 'Desserts', 4),
  ('food.drinks', 'food', 'Drinks', 5),
  ('services.tutoring', 'services', 'Tutoring', 1),
  ('services.design', 'services', 'Graphic design', 2),
  ('services.programming', 'services', 'Programming', 3),
  ('services.photography', 'services', 'Photography', 4),
  ('services.repairs', 'services', 'Repairs', 5),
  ('services.other', 'services', 'Other services', 6),
  ('other.other', 'other', 'Other', 1);
--> statement-breakpoint
-- A post uses a subcategory, and states a condition exactly when the main
-- category asks for one. A CHECK cannot look at another table, hence a trigger.
CREATE FUNCTION post_category_rules() RETURNS trigger AS $$
DECLARE
  main_requires boolean;
BEGIN
  SELECT main.requires_condition INTO main_requires
  FROM category sub JOIN category main ON main.id = sub.parent_id
  WHERE sub.id = NEW.category_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'post must use a subcategory, not %', NEW.category_id USING ERRCODE = 'check_violation';
  END IF;
  IF main_requires AND NEW.condition IS NULL THEN
    RAISE EXCEPTION 'category % needs a condition', NEW.category_id USING ERRCODE = 'check_violation';
  END IF;
  IF NOT main_requires AND NEW.condition IS NOT NULL THEN
    RAISE EXCEPTION 'category % takes no condition', NEW.category_id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER post_category_rules
  BEFORE INSERT OR UPDATE OF category_id, condition ON post
  FOR EACH ROW EXECUTE FUNCTION post_category_rules();
--> statement-breakpoint
-- A live post (open or reserved) always has at least one availability window.
-- Checked at commit, so a post and its windows can be written together.
CREATE FUNCTION post_require_availability() RETURNS trigger AS $$
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
      AND NOT EXISTS (SELECT 1 FROM availability_window WHERE post_id = target_post)
  ) THEN
    RAISE EXCEPTION 'post % must have at least one availability window', target_post
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER post_require_availability_on_post
  AFTER INSERT OR UPDATE OF status ON post
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION post_require_availability();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER post_require_availability_on_window_delete
  AFTER DELETE ON availability_window
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION post_require_availability();
