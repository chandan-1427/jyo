CREATE TYPE "public"."notification_type" AS ENUM('request_received', 'request_cancelled', 'request_approved', 'request_rejected');--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "post_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "type" "notification_type";--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_post_id_food_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."food_posts"("id") ON DELETE set null ON UPDATE no action;