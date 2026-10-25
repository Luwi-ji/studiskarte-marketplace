CREATE TABLE "perk_suggestion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "perk_suggestion_shop_length" CHECK (char_length("perk_suggestion"."shop") between 2 and 80 and "perk_suggestion"."shop" !~ '[\r\n]')
);
