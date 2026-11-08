ALTER TYPE "public"."notification_type" ADD VALUE 'request_timed_out';--> statement-breakpoint
ALTER TYPE "public"."request_status" ADD VALUE 'timed_out';--> statement-breakpoint
CREATE INDEX "pickup_requests_pending_created_at_idx" ON "pickup_requests" USING btree ("created_at") WHERE "pickup_requests"."status" = 'pending';