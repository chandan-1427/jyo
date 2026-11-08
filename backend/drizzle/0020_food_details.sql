CREATE TYPE "public"."food_diet" AS ENUM('veg', 'egg', 'non_veg');--> statement-breakpoint
ALTER TABLE "food_posts" ADD COLUMN "diet" "food_diet";--> statement-breakpoint
ALTER TABLE "food_posts" ADD COLUMN "servings" integer;--> statement-breakpoint
ALTER TABLE "food_posts" ADD COLUMN "cooked_at" timestamp;--> statement-breakpoint
ALTER TABLE "food_posts" ADD COLUMN "bring_container" boolean DEFAULT false NOT NULL;