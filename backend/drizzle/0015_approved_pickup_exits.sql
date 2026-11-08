ALTER TYPE "public"."notification_type" ADD VALUE 'pickup_withdrawn';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'pickup_reopened';--> statement-breakpoint
ALTER TYPE "public"."request_status" ADD VALUE 'missed';--> statement-breakpoint
ALTER TYPE "public"."request_status" ADD VALUE 'withdrawn';--> statement-breakpoint
ALTER TABLE "food_posts" ADD COLUMN "auto_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pickup_requests" ADD COLUMN "approved_at" timestamp;