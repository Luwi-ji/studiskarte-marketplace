ALTER TABLE "availability_window" DROP CONSTRAINT "availability_window_order";--> statement-breakpoint
ALTER TABLE "availability_window" ADD COLUMN "kind" text NOT NULL;--> statement-breakpoint
ALTER TABLE "availability_window" ADD COLUMN "weekday" smallint;--> statement-breakpoint
ALTER TABLE "availability_window" ADD COLUMN "on_date" date;--> statement-breakpoint
ALTER TABLE "availability_window" ADD COLUMN "start_time" time NOT NULL;--> statement-breakpoint
ALTER TABLE "availability_window" ADD COLUMN "end_time" time NOT NULL;--> statement-breakpoint
ALTER TABLE "availability_window" DROP COLUMN "starts_at";--> statement-breakpoint
ALTER TABLE "availability_window" DROP COLUMN "ends_at";--> statement-breakpoint
ALTER TABLE "availability_window" ADD CONSTRAINT "availability_window_weekday" UNIQUE("post_id","weekday");--> statement-breakpoint
ALTER TABLE "availability_window" ADD CONSTRAINT "availability_window_date" UNIQUE("post_id","on_date");--> statement-breakpoint
ALTER TABLE "availability_window" ADD CONSTRAINT "availability_window_kind" CHECK (("availability_window"."kind" = 'weekly' and coalesce("availability_window"."weekday", -1) between 0 and 6 and "availability_window"."on_date" is null)
        or ("availability_window"."kind" = 'date' and "availability_window"."on_date" is not null and "availability_window"."weekday" is null));--> statement-breakpoint
ALTER TABLE "availability_window" ADD CONSTRAINT "availability_window_order" CHECK ("availability_window"."end_time" > "availability_window"."start_time");