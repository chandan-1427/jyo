import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env.js";

const client = postgres(env.DATABASE_URL, {
  prepare: false,
});

export const db = drizzle({ client });

// Lets in-flight queries finish before the connection is torn down —
// called during graceful shutdown so a deploy/restart doesn't cut a
// query off mid-flight.
export function closeDb() {
  return client.end();
}