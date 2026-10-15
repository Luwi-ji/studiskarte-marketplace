CREATE TABLE "availability_window" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	CONSTRAINT "availability_window_order" CHECK ("availability_window"."ends_at" > "availability_window"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"name" text NOT NULL,
	"requires_condition" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "category_position" UNIQUE("parent_id","position"),
	CONSTRAINT "category_condition_on_main" CHECK ("category"."parent_id" is null or "category"."requires_condition" = false)
);
--> statement-breakpoint
ALTER TABLE "post_photo" DROP CONSTRAINT "post_photo_position_nonneg";--> statement-breakpoint
DROP INDEX "post_owner_idx";--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "description" text NOT NULL;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "category_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "condition" text;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "price_kind" text NOT NULL;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "price_amount" integer;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "exchange_meetup" boolean NOT NULL;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "exchange_delivery" boolean NOT NULL;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "meetup_location" text;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "delivery_area" text;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "availability_window" ADD CONSTRAINT "availability_window_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_parent_id_category_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_window_post_idx" ON "availability_window" USING btree ("post_id");--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "post_open_duplicate" ON "post" USING btree ("owner_id","kind",lower(btrim("title")),md5(btrim("description"))) WHERE "post"."status" = 'open';--> statement-breakpoint
CREATE INDEX "post_owner_idx" ON "post" USING btree ("owner_id","status");--> statement-breakpoint
ALTER TABLE "post_photo" ADD CONSTRAINT "post_photo_image" UNIQUE("image_id");--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_description_length" CHECK (char_length(btrim("post"."description")) between 1 and 2000);--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_condition_value" CHECK ("post"."condition" is null or "post"."condition" in ('new', 'used_like_new', 'used_good', 'used_fair'));--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_price" CHECK (("post"."price_kind" = 'amount' and coalesce("post"."price_amount", 0) between 1 and 1000000)
        or ("post"."price_kind" in ('free', 'negotiable') and "post"."price_amount" is null));--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_exchange_any" CHECK ("post"."exchange_meetup" or "post"."exchange_delivery");--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_meetup_location" CHECK (case when "post"."exchange_meetup"
        then char_length(btrim(coalesce("post"."meetup_location", ''))) between 1 and 120
        else "post"."meetup_location" is null end);--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_delivery_area" CHECK (case when "post"."exchange_delivery"
        then char_length(btrim(coalesce("post"."delivery_area", ''))) between 1 and 120
        else "post"."delivery_area" is null end);--> statement-breakpoint
ALTER TABLE "post_photo" ADD CONSTRAINT "post_photo_position_range" CHECK ("post_photo"."position" between 0 and 9);