import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  doublePrecision,
  integer,
  boolean,
  index
} from "drizzle-orm/pg-core";

// --- Enums ---
export const postStatusEnum = pgEnum("post_status", [
  "open",
  "pending_approval",
  "closed",
  "expired",
  "completed",
]);

export const requestStatusEnum = pgEnum("request_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "request_received",
  "request_cancelled",
  "request_approved",
  "request_rejected",
]);

// --- Users ---
export const users = pgTable("users", {
  id:           uuid("id").primaryKey().defaultRandom(),
  name:         text("name").notNull(),
  email:        text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phone:        text("phone").notNull(),
  locationText: text("location_text"),
  description:  text("description"),
  avatarUrl:    text("avatar_url"),
  emailVerified:      boolean("email_verified").notNull().default(false),
  verificationToken:  text("verification_token"),
  verificationTokenExpiry: timestamp("verification_token_expiry"),
  resetToken:         text("reset_token"),
  resetTokenExpiry:   timestamp("reset_token_expiry"),
  isDemo:       boolean("is_demo").notNull().default(false),
  demoExpiresAt: timestamp("demo_expires_at"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

// --- Food Posts ---
export const foodPosts = pgTable("food_posts", {
  id:                uuid("id").primaryKey().defaultRandom(),
  posterId:          uuid("poster_id").notNull().references(() => users.id),
  title:             text("title").notNull(),
  description:       text("description"),
  photoUrl:          text("photo_url"),
  pickupLat:         doublePrecision("pickup_lat").notNull(),
  pickupLng:         doublePrecision("pickup_lng").notNull(),
  pickupWindowStart: timestamp("pickup_window_start").notNull(),
  pickupWindowEnd:   timestamp("pickup_window_end").notNull(),
  status:            postStatusEnum("status").notNull().default("open"),
  approvedRequestId: uuid("approved_request_id"),             // set after approval
  seededForUserId:   uuid("seeded_for_user_id").references(() => users.id),
  isDemo:            boolean("is_demo").notNull().default(false),
  demoExpiresAt:     timestamp("demo_expires_at"),
  createdAt:         timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  // Feed query (posts.ts) and the expiry cron (jobs/expiry.ts) both filter
  // on exactly this pair.
  index("food_posts_status_window_end_idx").on(table.status, table.pickupWindowEnd),
  index("food_posts_poster_id_idx").on(table.posterId),
]);

// --- Pickup Requests ---
export const pickupRequests = pgTable("pickup_requests", {
  id:         uuid("id").primaryKey().defaultRandom(),
  postId:     uuid("post_id").notNull().references(() => foodPosts.id),
  pickerId:   uuid("picker_id").notNull().references(() => users.id),
  pickerName: text("picker_name").notNull(),
  selfieUrl:  text("selfie_url"),
  etaMinutes: integer("eta_minutes").notNull(),
  status:     requestStatusEnum("status").notNull().default("pending"),
  isDemo:     boolean("is_demo").notNull().default(false),
  demoExpiresAt: timestamp("demo_expires_at"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("pickup_requests_post_id_idx").on(table.postId),
  index("pickup_requests_picker_id_idx").on(table.pickerId),
]);

// --- Notifications ---
export const notifications = pgTable("notifications", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    uuid("user_id").notNull().references(() => users.id),
  postId:    uuid("post_id").references(() => foodPosts.id, { onDelete: "set null" }),
  type:      notificationTypeEnum("type"),
  message:   text("message").notNull(),
  read:      boolean("read").notNull().default(false),
  isDemo:    boolean("is_demo").notNull().default(false),
  demoExpiresAt: timestamp("demo_expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("notifications_user_id_idx").on(table.userId),
]);