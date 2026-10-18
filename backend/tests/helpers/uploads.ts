import crypto from "crypto";

// An address shaped exactly like one of our own uploads (see
// isOwnUploadUrl), for tests that send a photo or selfie URL.
export function ownUploadUrl(bucket: "food-photos" | "selfies") {
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${crypto.randomUUID()}.jpg`;
}
