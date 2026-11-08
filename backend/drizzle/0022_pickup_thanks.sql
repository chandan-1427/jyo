ALTER TYPE "public"."notification_type" ADD VALUE 'pickup_thanked';--> statement-breakpoint
ALTER TABLE "pickup_requests" ADD COLUMN "picked_up_at" timestamp;--> statement-breakpoint
ALTER TABLE "pickup_requests" ADD COLUMN "thank_you_note" text;