import { db } from "../../src/db/index.js";
import { sql } from "drizzle-orm";

// Order doesn't matter — CASCADE handles the FK dependencies between
// users -> food_posts -> pickup_requests/notifications.
export async function resetDb() {
  await db.execute(sql`
    TRUNCATE TABLE
      notifications,
      pickup_requests,
      food_posts,
      users
    RESTART IDENTITY CASCADE
  `);
}
