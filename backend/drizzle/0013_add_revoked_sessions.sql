CREATE TABLE "revoked_sessions" (
	"jti" uuid PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "revoked_sessions_expires_at_idx" ON "revoked_sessions" USING btree ("expires_at");--> statement-breakpoint
-- Default-deny for Supabase's public API, as for every table (see 0009).
ALTER TABLE "revoked_sessions" ENABLE ROW LEVEL SECURITY;
