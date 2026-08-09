import crypto from "crypto";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users, foodPosts } from "../../db/schema.js";
import { createRequestRow, approveRequestTx } from "./requestActions.js";
import { createNotification } from "../notifications/notify.js";
import { logger } from "../logger.js";

// A demo session — the seeded post, the pending request on the visitor's
// own post, and any synthetic counterparty accounts — all disappear this
// long after being provisioned. Started/stopped via POST /auth/demo/start
// and /stop (routes/auth.ts), available to any logged-in user regardless
// of location — see docs/demo-mode-plan.md.
export const DEMO_SESSION_MS = 10 * 60 * 1000;

const SYNTHETIC_EMAIL_DOMAIN = "@jyo.internal";

// Synthetic counterparties (the seeded poster, the seeded requester) get a
// dummy address in this domain so notify.ts's email call sites can skip
// them, and so the cleanup cron knows to delete the account outright rather
// than just resetting a real user's demo flag.
export function isSyntheticEmail(email: string): boolean {
  return email.endsWith(SYNTHETIC_EMAIL_DOMAIN);
}

// Small random offset (roughly within ~1km) so a seeded post doesn't sit
// exactly on top of the visitor's own coordinates.
function jitter(coord: number): number {
  return coord + (Math.random() - 0.5) * 0.015;
}

async function createSyntheticUser(name: string, demoExpiresAt: Date) {
  const [user] = await db
    .insert(users)
    .values({
      name,
      email: `demo-${crypto.randomUUID()}${SYNTHETIC_EMAIL_DOMAIN}`,
      passwordHash: crypto.randomBytes(32).toString("hex"), // never used to log in
      phone: "0000000000",
      emailVerified: true,
      isDemo: true,
      demoExpiresAt,
    })
    .returning({ id: users.id, name: users.name });
  return user;
}

// Provisions a fake nearby post for a demo visitor's feed. Called lazily
// from GET /posts (not at login) since that's the only place with the
// visitor's real GPS coordinates to jitter a "nearby" location from —
// login only has coarse IP-geo. Idempotent: no-ops if the visitor already
// has an active (open, unexpired) seeded post; the partial unique index on
// food_posts(seeded_for_user_id) (see drizzle/0008) guards the race between
// two concurrent feed loads both provisioning at once. Deliberately keyed
// on status = "open", not just an unexpired demoExpiresAt — once the
// visitor requests it (status flips to "closed" via auto-approve), a fresh
// one gets provisioned so the feed doesn't sit empty for the rest of the
// session.
export async function provisionSeededPost(visitorId: string, lat: number, lng: number) {
  const now = new Date();

  const [existing] = await db
    .select({ id: foodPosts.id })
    .from(foodPosts)
    .where(
      and(
        eq(foodPosts.seededForUserId, visitorId),
        eq(foodPosts.status, "open"),
        gt(foodPosts.demoExpiresAt, now)
      )
    )
    .limit(1);

  if (existing) return;

  const demoExpiresAt = new Date(now.getTime() + DEMO_SESSION_MS);
  const poster = await createSyntheticUser("Ramesh Kumar", demoExpiresAt);

  try {
    await db.insert(foodPosts).values({
      posterId: poster.id,
      title: "Homemade Pulihora & Curd Rice",
      description: "Extra prasadam from a family function today — still warm, plenty for two.",
      pickupLat: jitter(lat),
      pickupLng: jitter(lng),
      pickupWindowStart: now,
      pickupWindowEnd: demoExpiresAt,
      seededForUserId: visitorId,
      isDemo: true,
      demoExpiresAt,
    });
  } catch (err: any) {
    // Lost the race to another concurrent feed load provisioning the same
    // visitor's post — the row it inserted already covers this session.
    // drizzle-orm 0.45's postgres-js driver wraps the raw driver error in
    // a DrizzleQueryError with the original PostgresError on `.cause`, so
    // the unique-violation code has to be checked on both.
    if (err?.code === "23505" || err?.cause?.code === "23505") return;
    throw err;
  }
}

// Fires right after a demo visitor creates their own post — seeds a
// pending request against it from a fresh synthetic picker, left pending on
// purpose so the visitor gets to experience being the poster who reviews
// and approves/rejects a request. Bypasses the real POST /requests route
// (no session to act as the synthetic picker with), so it also creates the
// "someone wants your food" notification that route would normally send.
export async function seedRequestOnOwnPost(postId: string, posterId: string, demoExpiresAt: Date) {
  const picker = await createSyntheticUser("Priya Sharma", demoExpiresAt);

  const request = await createRequestRow({
    postId,
    pickerId: picker.id,
    pickerName: picker.name,
    etaMinutes: 15,
    isDemo: true,
    demoExpiresAt,
  });

  if (!request) return;

  createNotification(
    posterId,
    "Someone wants to pick up your food. Review their request.",
    postId,
    "request_received",
    demoExpiresAt
  ).catch((err) => logger.error({ err, postId, pickupRequestId: request.id }, "Failed to create demo request_received notification"));
}

// Fires right after a demo visitor requests the seeded post — auto-approves
// instantly instead of waiting on a poster (synthetic, with no one behind
// it) to ever review. Reuses the same conflict-safe transaction the real
// approve route uses.
export async function autoApproveIfDemo(requestId: string, postId: string): Promise<boolean> {
  return approveRequestTx(requestId, postId);
}
